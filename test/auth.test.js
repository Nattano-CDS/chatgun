import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/api/auth/[[path]].js";
import { cookieValue, environment, jsonRequest, TestD1 } from "./helpers/d1.js";
import { base64Url } from "../functions/_lib/crypto.js";

const originalFetch = globalThis.fetch;

function installDeliveryMock() {
  let deliveredCode = null;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.includes("turnstile/v0/siteverify")) {
      return Response.json({ success: true, hostname: "chatgun.pages.dev", action: "auth_start" });
    }
    if (url === "https://api.resend.com/emails") {
      const email = JSON.parse(init.body);
      deliveredCode = email.text.match(/\b(\d{6})\b/u)?.[1] || null;
      return Response.json({ id: "email-id" });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  return () => deliveredCode;
}

function installLineCallbackMock(env, nonce, subject) {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://api.line.me/oauth2/v2.1/token") {
      return Response.json({ access_token: "line-access", id_token: "line-id-token" });
    }
    if (url === "https://api.line.me/oauth2/v2.1/verify") {
      return Response.json({
        iss: "https://access.line.me",
        aud: env.LINE_CLIENT_ID,
        nonce,
        exp: Math.floor(Date.now() / 1000) + 300,
        sub: subject,
        name: "Line Member",
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
}

async function startOtp(env, email = "member@example.com") {
  env.EMAIL_OTP_ENABLED = "true";
  return onRequest({
    env,
    request: jsonRequest("/api/auth/otp/start", {
      channel: "email",
      destination: email,
      turnstileToken: "valid-turnstile-token",
    }),
  });
}

async function verifyOtp(env, challengeId, code) {
  return onRequest({ env, request: jsonRequest("/api/auth/otp/verify", { challengeId, code }) });
}

test.afterEach(() => { globalThis.fetch = originalFetch; });

test("invalid cross-origin POST is returned as JSON instead of escaping the handler", async () => {
  const database = new TestD1();
  const env = environment(database);
  const request = jsonRequest("/api/auth/otp/start", {
    channel: "email", destination: "member@example.com", turnstileToken: "valid-turnstile-token",
  }, { origin: "https://evil.example" });
  const response = await onRequest({ env, request });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "invalid_origin");
  database.close();
});

test("OTP endpoints are disabled by feature flag without removing the schema", async () => {
  const database = new TestD1();
  const env = environment(database);
  const start = await onRequest({
    env,
    request: jsonRequest("/api/auth/otp/start", {
      channel: "email", destination: "member@example.com", turnstileToken: "valid-turnstile-token",
    }),
  });
  assert.equal(start.status, 404);
  assert.equal((await start.json()).code, "otp_disabled");

  const mobileStart = await onRequest({
    env,
    request: jsonRequest("/api/auth/otp/start", {
      channel: "mobile", destination: "+66800000000", turnstileToken: "valid-turnstile-token",
    }),
  });
  assert.equal(mobileStart.status, 404);
  assert.equal((await mobileStart.json()).code, "otp_disabled");

  const verify = await verifyOtp(env, "unused-challenge", "123456");
  assert.equal(verify.status, 404);
  assert.equal((await verify.json()).code, "otp_disabled");
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM otp_challenges").get().count, 0);
  database.close();
});

test("email OTP is hashed, authenticates once, and establishes secure cookies", async () => {
  const database = new TestD1();
  const env = environment(database);
  const deliveredCode = installDeliveryMock();
  const start = await startOtp(env);
  assert.equal(start.status, 200);
  const challenge = await start.json();
  assert.match(challenge.challengeId, /^[0-9a-f-]{36}$/u);
  const stored = database.database.prepare("SELECT code_hash FROM otp_challenges WHERE id = ?").get(challenge.challengeId);
  assert.notEqual(stored.code_hash, deliveredCode());
  assert.equal(stored.code_hash.includes(deliveredCode()), false);

  const verified = await verifyOtp(env, challenge.challengeId, deliveredCode());
  assert.equal(verified.status, 200);
  assert.deepEqual(await verified.json(), { authenticated: true, redirectUrl: "/account.html" });
  const cookies = verified.headers.getSetCookie().join("\n");
  assert.match(cookies, /__Host-cg_session=.*HttpOnly.*SameSite=Lax/u);
  assert.match(cookies, /__Host-cg_csrf=.*SameSite=Lax/u);

  const replay = await verifyOtp(env, challenge.challengeId, deliveredCode());
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).code, "otp_unavailable");
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM sessions").get().count, 1);
  database.close();
});

test("OTP expires after five minutes", async () => {
  const database = new TestD1();
  const env = environment(database);
  const deliveredCode = installDeliveryMock();
  const challenge = await (await startOtp(env, "expired@example.com")).json();
  const expiredAt = Math.floor(Date.now() / 1000) - 1;
  database.database.prepare("UPDATE otp_challenges SET created_at = ?, expires_at = ? WHERE id = ?")
    .run(expiredAt - 300, expiredAt, challenge.challengeId);
  const response = await verifyOtp(env, challenge.challengeId, deliveredCode());
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "otp_unavailable");
  database.close();
});

test("OTP locks after five incorrect attempts", async () => {
  const database = new TestD1();
  const env = environment(database);
  const deliveredCode = installDeliveryMock();
  const challenge = await (await startOtp(env, "attempts@example.com")).json();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await verifyOtp(env, challenge.challengeId, "000000");
    assert.equal(response.status, 400);
  }
  assert.equal(database.database.prepare("SELECT attempts FROM otp_challenges WHERE id = ?").get(challenge.challengeId).attempts, 5);
  const correct = await verifyOtp(env, challenge.challengeId, deliveredCode());
  assert.equal((await correct.json()).code, "otp_unavailable");
  database.close();
});

test("OTP request rate limit applies per normalized email", async () => {
  const database = new TestD1();
  const env = environment(database);
  installDeliveryMock();
  assert.equal((await startOtp(env, "RATE@example.com")).status, 200);
  for (let request = 0; request < 4; request += 1) {
    assert.equal((await startOtp(env, "rate@example.com")).status, 429);
  }
  const limited = await startOtp(env, "rate@example.com");
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).code, "rate_limited");
  database.close();
});

test("Google authorization uses state, nonce, and S256 PKCE", async () => {
  const database = new TestD1();
  const env = environment(database);
  installDeliveryMock();
  const response = await onRequest({
    env,
    request: jsonRequest("/api/auth/oauth/google/start", { turnstileToken: "valid-turnstile-token" }),
  });
  assert.equal(response.status, 200);
  const authorization = new URL((await response.json()).authorizationUrl);
  assert.equal(authorization.origin, "https://accounts.google.com");
  assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
  assert.ok(authorization.searchParams.get("code_challenge"));
  assert.ok(authorization.searchParams.get("nonce"));
  const rawState = authorization.searchParams.get("state");
  const flow = database.database.prepare("SELECT state_hash, pkce_verifier, nonce FROM oauth_flows").get();
  assert.notEqual(flow.state_hash, rawState);
  assert.notEqual(flow.pkce_verifier, authorization.searchParams.get("code_challenge"));
  assert.equal(cookieValue(response, "__Host-cg_oauth"), rawState);
  database.close();
});

test("Turnstile verification requires the expected hostname and action", async () => {
  const database = new TestD1();
  const env = environment(database);
  globalThis.fetch = async (input) => {
    if (String(input).includes("turnstile/v0/siteverify")) return Response.json({ success: true });
    throw new Error(`Unexpected fetch: ${String(input)}`);
  };
  const response = await onRequest({
    env,
    request: jsonRequest("/api/auth/oauth/google/start", { turnstileToken: "valid-turnstile-token" }),
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "turnstile_failed");
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM oauth_flows").get().count, 0);
  database.close();
});

test("provider denial validates state and consumes the OAuth flow", async () => {
  const database = new TestD1();
  const env = environment(database);
  installDeliveryMock();
  const start = await onRequest({
    env,
    request: jsonRequest("/api/auth/oauth/google/start", { turnstileToken: "valid-turnstile-token" }),
  });
  const state = new URL((await start.json()).authorizationUrl).searchParams.get("state");
  const cookie = cookieValue(start, "__Host-cg_oauth");
  const deniedUrl = `https://chatgun.pages.dev/api/auth/oauth/google/callback?error=access_denied&state=${encodeURIComponent(state)}`;
  const denied = await onRequest({
    env,
    request: new Request(deniedUrl, { headers: { cookie: `__Host-cg_oauth=${encodeURIComponent(cookie)}` } }),
  });
  assert.equal(denied.status, 303);
  assert.match(denied.headers.get("location"), /auth_error=provider_denied/u);
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM oauth_flows").get().count, 0);

  const replay = await onRequest({
    env,
    request: new Request(deniedUrl, { headers: { cookie: `__Host-cg_oauth=${encodeURIComponent(cookie)}` } }),
  });
  assert.match(replay.headers.get("location"), /auth_error=oauth_expired/u);
  const unsolicited = await onRequest({
    env,
    request: new Request("https://chatgun.pages.dev/api/auth/oauth/google/callback?error=access_denied"),
  });
  assert.match(unsolicited.headers.get("location"), /auth_error=invalid_state/u);
  database.close();
});

test("account linking requires the authenticated session and matching CSRF token", async () => {
  const database = new TestD1();
  const env = environment(database);
  installDeliveryMock();
  const timestamp = Math.floor(Date.now() / 1000);
  database.database.prepare(`
    INSERT INTO users(id, email, email_verified_at, status, created_at, updated_at)
    VALUES ('link-user', 'link@example.com', ?, 'active', ?, ?)
  `).run(timestamp, timestamp, timestamp);
  const { issueSession } = await import("../functions/_lib/db.js");
  const session = await issueSession(database, "link-user", timestamp);

  const linked = await onRequest({
    env,
    request: jsonRequest("/api/auth/oauth/line/start", {
      link: true,
      turnstileToken: "valid-turnstile-token",
    }, {
      cookie: `__Host-cg_session=${encodeURIComponent(session.token)}; __Host-cg_csrf=${encodeURIComponent(session.csrf)}`,
      "x-csrf-token": session.csrf,
    }),
  });
  assert.equal(linked.status, 200);
  assert.equal(database.database.prepare("SELECT link_user_id FROM oauth_flows").get().link_user_id, "link-user");

  const rejected = await onRequest({
    env,
    request: jsonRequest("/api/auth/oauth/google/start", {
      link: true,
      turnstileToken: "valid-turnstile-token",
    }, {
      cookie: `__Host-cg_session=${encodeURIComponent(session.token)}; __Host-cg_csrf=${encodeURIComponent(session.csrf)}`,
      "x-csrf-token": "wrong-token",
    }),
  });
  assert.equal(rejected.status, 403);
  assert.equal((await rejected.json()).code, "invalid_csrf");
  database.close();
});

test("account linking callback attaches a new provider identity to the authenticated user", async () => {
  const database = new TestD1();
  const env = environment(database);
  installDeliveryMock();
  const timestamp = Math.floor(Date.now() / 1000);
  database.database.prepare(`
    INSERT INTO users(id, email, email_verified_at, status, created_at, updated_at)
    VALUES ('link-target', 'target@example.com', ?, 'active', ?, ?)
  `).run(timestamp, timestamp, timestamp);
  const { issueSession } = await import("../functions/_lib/db.js");
  const session = await issueSession(database, "link-target", timestamp);
  const start = await onRequest({
    env,
    request: jsonRequest("/api/auth/oauth/line/start", {
      link: true,
      turnstileToken: "valid-turnstile-token",
    }, {
      cookie: `__Host-cg_session=${encodeURIComponent(session.token)}; __Host-cg_csrf=${encodeURIComponent(session.csrf)}`,
      "x-csrf-token": session.csrf,
    }),
  });
  const authorization = new URL((await start.json()).authorizationUrl);
  assert.equal(authorization.searchParams.get("scope"), "openid profile");
  const state = authorization.searchParams.get("state");
  installLineCallbackMock(env, authorization.searchParams.get("nonce"), "line-link-new");

  const callback = await onRequest({
    env,
    request: new Request(
      `https://chatgun.pages.dev/api/auth/oauth/line/callback?state=${encodeURIComponent(state)}&code=line-link-code`,
      { headers: { cookie: `__Host-cg_oauth=${encodeURIComponent(cookieValue(start, "__Host-cg_oauth"))}` } },
    ),
  });
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get("location"), "/account.html");
  assert.equal(
    database.database.prepare("SELECT user_id FROM identities WHERE provider = 'line' AND subject = 'line-link-new'").get().user_id,
    "link-target",
  );
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM users").get().count, 1);
  assert.match(callback.headers.getSetCookie().join("\n"), /__Host-cg_session=.*HttpOnly.*SameSite=Lax/u);
  database.close();
});

test("account linking callback rejects an identity owned by another user", async () => {
  const database = new TestD1();
  const env = environment(database);
  installDeliveryMock();
  const timestamp = Math.floor(Date.now() / 1000);
  database.database.prepare(`
    INSERT INTO users(id, email, email_verified_at, status, created_at, updated_at)
    VALUES ('identity-owner', 'owner@example.com', ?, 'active', ?, ?),
           ('link-requester', 'requester@example.com', ?, 'active', ?, ?)
  `).run(timestamp, timestamp, timestamp, timestamp, timestamp, timestamp);
  database.database.prepare(`
    INSERT INTO identities(provider, subject, user_id, provider_email, email_verified, created_at, last_login_at)
    VALUES ('line', 'line-already-owned', 'identity-owner', NULL, 0, ?, ?)
  `).run(timestamp, timestamp);
  const { issueSession } = await import("../functions/_lib/db.js");
  const session = await issueSession(database, "link-requester", timestamp);
  const start = await onRequest({
    env,
    request: jsonRequest("/api/auth/oauth/line/start", {
      link: true,
      turnstileToken: "valid-turnstile-token",
    }, {
      cookie: `__Host-cg_session=${encodeURIComponent(session.token)}; __Host-cg_csrf=${encodeURIComponent(session.csrf)}`,
      "x-csrf-token": session.csrf,
    }),
  });
  const authorization = new URL((await start.json()).authorizationUrl);
  const state = authorization.searchParams.get("state");
  installLineCallbackMock(env, authorization.searchParams.get("nonce"), "line-already-owned");

  const callback = await onRequest({
    env,
    request: new Request(
      `https://chatgun.pages.dev/api/auth/oauth/line/callback?state=${encodeURIComponent(state)}&code=line-link-code`,
      { headers: { cookie: `__Host-cg_oauth=${encodeURIComponent(cookieValue(start, "__Host-cg_oauth"))}` } },
    ),
  });
  assert.equal(callback.status, 303);
  assert.match(callback.headers.get("location"), /auth_error=identity_linked/u);
  assert.equal(
    database.database.prepare("SELECT user_id FROM identities WHERE provider = 'line' AND subject = 'line-already-owned'").get().user_id,
    "identity-owner",
  );
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM identities").get().count, 1);
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM sessions").get().count, 1);
  database.close();
});

test("LINE callback validates ID token claims, creates identity, and rejects replay", async () => {
  const database = new TestD1();
  const env = environment(database);
  installDeliveryMock();
  const start = await onRequest({
    env,
    request: jsonRequest("/api/auth/oauth/line/start", { turnstileToken: "valid-turnstile-token" }),
  });
  const authorization = new URL((await start.json()).authorizationUrl);
  const state = authorization.searchParams.get("state");
  const nonce = authorization.searchParams.get("nonce");
  const oauthCookie = cookieValue(start, "__Host-cg_oauth");

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://api.line.me/oauth2/v2.1/token") {
      return Response.json({ access_token: "line-access", id_token: "line-id-token" });
    }
    if (url === "https://api.line.me/oauth2/v2.1/verify") {
      return Response.json({
        iss: "https://access.line.me", aud: env.LINE_CLIENT_ID, nonce,
        exp: Math.floor(Date.now() / 1000) + 300, sub: "line-user-1",
        email: "line@example.com", name: "Line Member",
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const callbackUrl = `https://chatgun.pages.dev/api/auth/oauth/line/callback?state=${encodeURIComponent(state)}&code=one-time-code`;
  const callback = await onRequest({
    env,
    request: new Request(callbackUrl, { headers: { cookie: `__Host-cg_oauth=${encodeURIComponent(oauthCookie)}` } }),
  });
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get("location"), "/account.html");
  const identity = database.database.prepare("SELECT provider, subject, email_verified FROM identities").get();
  assert.deepEqual({ ...identity }, { provider: "line", subject: "line-user-1", email_verified: 1 });
  assert.equal(database.database.prepare("SELECT email_verified_at IS NOT NULL verified FROM users").get().verified, 1);

  const replay = await onRequest({
    env,
    request: new Request(callbackUrl, { headers: { cookie: `__Host-cg_oauth=${encodeURIComponent(oauthCookie)}` } }),
  });
  assert.equal(replay.status, 303);
  assert.match(replay.headers.get("location"), /auth_error=oauth_expired/u);
  database.close();
});

test("Google callback verifies the ID token signature, audience, and nonce", async () => {
  const database = new TestD1();
  const env = environment(database);
  installDeliveryMock();
  const start = await onRequest({
    env,
    request: jsonRequest("/api/auth/oauth/google/start", { turnstileToken: "valid-turnstile-token" }),
  });
  const authorization = new URL((await start.json()).authorizationUrl);
  const state = authorization.searchParams.get("state");
  const nonce = authorization.searchParams.get("nonce");
  const keyPair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", kid: "test-key" })));
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: "https://accounts.google.com", aud: env.GOOGLE_CLIENT_ID, sub: "google-user-1", nonce,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300,
    email: "google@example.com", email_verified: true, name: "Google Member",
  })));
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keyPair.privateKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const idToken = `${header}.${payload}.${base64Url(signature)}`;
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  publicJwk.kid = "test-key";

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "google-access", id_token: idToken });
    if (url === "https://www.googleapis.com/oauth2/v3/certs") {
      return Response.json({ keys: [publicJwk] }, { headers: { "cache-control": "max-age=300" } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const callback = await onRequest({
    env,
    request: new Request(
      `https://chatgun.pages.dev/api/auth/oauth/google/callback?state=${encodeURIComponent(state)}&code=google-code`,
      { headers: { cookie: `__Host-cg_oauth=${encodeURIComponent(cookieValue(start, "__Host-cg_oauth"))}` } },
    ),
  });
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get("location"), "/account.html");
  assert.equal(database.database.prepare("SELECT subject FROM identities WHERE provider = 'google'").get().subject, "google-user-1");
  database.close();
});

test("Facebook callback debugs the token and does not mark its email verified", async () => {
  const database = new TestD1();
  const env = environment(database);
  env.FACEBOOK_EMAIL_ENABLED = "true";
  env.FACEBOOK_CLIENT_ID = "1136950635489003";
  installDeliveryMock();
  const start = await onRequest({
    env,
    request: jsonRequest("/api/auth/oauth/facebook/start", { turnstileToken: "valid-turnstile-token" }),
  });
  const authorization = new URL((await start.json()).authorizationUrl);
  const state = authorization.searchParams.get("state");
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/oauth/access_token")) return Response.json({ access_token: "facebook-access" });
    if (url.includes("/debug_token?")) {
      assert.equal(new URL(url).searchParams.get("input_token"), "facebook-access");
      assert.equal(init.headers.authorization, `Bearer ${env.FACEBOOK_CLIENT_ID}|${env.FACEBOOK_CLIENT_SECRET}`);
      return Response.json({ data: {
        is_valid: true, app_id: Number(env.FACEBOOK_CLIENT_ID), user_id: 123456789,
        expires_at: Math.floor(Date.now() / 1000) + 300,
      } });
    }
    if (url.startsWith(`https://graph.facebook.com/${env.FACEBOOK_GRAPH_VERSION}/me`)) {
      return Response.json({ id: "123456789", name: "Facebook Member", email: "facebook@example.com" });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const callback = await onRequest({
    env,
    request: new Request(
      `https://chatgun.pages.dev/api/auth/oauth/facebook/callback?state=${encodeURIComponent(state)}&code=facebook-code`,
      { headers: { cookie: `__Host-cg_oauth=${encodeURIComponent(cookieValue(start, "__Host-cg_oauth"))}` } },
    ),
  });
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get("location"), "/account.html");
  const identity = database.database.prepare("SELECT provider_email, email_verified FROM identities WHERE provider = 'facebook'").get();
  assert.deepEqual({ ...identity }, { provider_email: "facebook@example.com", email_verified: 0 });
  assert.equal(database.database.prepare("SELECT email FROM users").get().email, null);
  database.close();
});

test("Facebook unverified email cannot take over an existing verified email account", async () => {
  const database = new TestD1();
  const timestamp = Math.floor(Date.now() / 1000);
  database.database.prepare(`
    INSERT INTO users(id, email, email_verified_at, status, created_at, updated_at)
    VALUES ('existing', 'same@example.com', ?, 'active', ?, ?)
  `).run(timestamp, timestamp, timestamp);
  const { findOrCreateIdentity } = await import("../functions/_lib/db.js");
  const createdId = await findOrCreateIdentity(database, {
    provider: "facebook", subject: "facebook-subject", email: "same@example.com",
    emailVerified: false, name: "Different Person", picture: null,
  }, null, timestamp);
  assert.notEqual(createdId, "existing");
  assert.equal(database.database.prepare("SELECT email FROM users WHERE id = ?").get(createdId).email, null);
  database.close();
});
