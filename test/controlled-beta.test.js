import assert from "node:assert/strict";
import test from "node:test";
import { onRequest as authRequest } from "../functions/api/auth/[[path]].js";
import { onRequest as socialRequest } from "../functions/api/social/[[path]].js";
import { sha256 } from "../functions/_lib/crypto.js";
import { issueSession, unixTime } from "../functions/_lib/db.js";
import { cookieValue, environment, jsonRequest, TestD1 } from "./helpers/d1.js";

const originalFetch = globalThis.fetch;
const invitationCode = "A".repeat(43);

function installTurnstileMock() {
  globalThis.fetch = async (input) => {
    if (String(input).includes("turnstile/v0/siteverify")) {
      return Response.json({ success: true, hostname: "chatgun.pages.dev", action: "auth_start" });
    }
    throw new Error(`Unexpected fetch: ${String(input)}`);
  };
}

function installLineMock(env, nonce, subject) {
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
        exp: unixTime() + 300,
        iat: unixTime(),
        sub: subject,
        name: "Invited Member",
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
}

async function insertInvitation(database, { id = "invite-1", maxUses = 1 } = {}) {
  const timestamp = unixTime();
  await database.prepare(`
    INSERT INTO beta_invitations(id, token_hash, label, max_uses, expires_at, created_at)
    VALUES (?, ?, 'synthetic test', ?, ?, ?)
  `).bind(id, await sha256(invitationCode), maxUses, timestamp + 3600, timestamp).run();
}

async function startLine(env, code = invitationCode) {
  installTurnstileMock();
  const response = await authRequest({
    env,
    request: jsonRequest("/api/auth/oauth/line/start", {
      turnstileToken: "valid-turnstile-token",
      invitationCode: code,
    }),
  });
  const body = await response.json();
  return { response, body, authorization: body.authorizationUrl ? new URL(body.authorizationUrl) : null };
}

async function finishLine(env, start, subject) {
  const state = start.authorization.searchParams.get("state");
  installLineMock(env, start.authorization.searchParams.get("nonce"), subject);
  return authRequest({
    env,
    request: new Request(
      `https://chatgun.pages.dev/api/auth/oauth/line/callback?state=${encodeURIComponent(state)}&code=line-code`,
      { headers: { cookie: `__Host-cg_oauth=${encodeURIComponent(cookieValue(start.response, "__Host-cg_oauth"))}` } },
    ),
  });
}

test.afterEach(() => { globalThis.fetch = originalFetch; });

test("invalid Beta invitation fails closed without persisting an OAuth flow", async () => {
  const database = new TestD1();
  const env = environment(database);
  env.NEW_ACCOUNT_REGISTRATION_ENABLED = "false";
  env.BETA_INVITATION_REGISTRATION_ENABLED = "true";
  const start = await startLine(env, "B".repeat(43));
  assert.equal(start.response.status, 403);
  assert.equal(start.body.code, "invitation_invalid");
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM oauth_flows").get().count, 0);
  database.close();
});

test("expired and revoked Beta invitations fail with the same generic response", async () => {
  for (const state of ["expired", "revoked"]) {
    const database = new TestD1();
    const env = environment(database);
    env.NEW_ACCOUNT_REGISTRATION_ENABLED = "false";
    env.BETA_INVITATION_REGISTRATION_ENABLED = "true";
    await insertInvitation(database);
    if (state === "expired") {
      database.database.prepare("UPDATE beta_invitations SET created_at = ?, expires_at = ? WHERE id = 'invite-1'")
        .run(unixTime() - 100, unixTime() - 1);
    } else {
      database.database.prepare("UPDATE beta_invitations SET status = 'revoked', revoked_at = ? WHERE id = 'invite-1'").run(unixTime());
    }
    const start = await startLine(env);
    assert.equal(start.response.status, 403);
    assert.equal(start.body.code, "invitation_invalid");
    assert.equal(database.database.prepare("SELECT COUNT(*) count FROM oauth_flows").get().count, 0);
    database.close();
  }
});

test("multi-use invitation records are rejected even if inserted outside the issuer", async () => {
  const database = new TestD1();
  const env = environment(database);
  env.NEW_ACCOUNT_REGISTRATION_ENABLED = "false";
  env.BETA_INVITATION_REGISTRATION_ENABLED = "true";
  await insertInvitation(database, { maxUses: 2 });
  const start = await startLine(env);
  assert.equal(start.response.status, 403);
  assert.equal(start.body.code, "invitation_invalid");
  database.close();
});

test("existing identity can sign in without an invitation while public registration is closed", async () => {
  const database = new TestD1();
  const env = environment(database);
  env.NEW_ACCOUNT_REGISTRATION_ENABLED = "false";
  env.BETA_INVITATION_REGISTRATION_ENABLED = "true";
  const timestamp = unixTime();
  database.database.prepare(`
    INSERT INTO users(id,display_name,status,created_at,updated_at)
    VALUES ('existing-beta-user','Existing Member','active',?,?)
  `).run(timestamp, timestamp);
  database.database.prepare(`
    INSERT INTO identities(provider,subject,user_id,email_verified,created_at,last_login_at)
    VALUES ('line','existing-line','existing-beta-user',0,?,?)
  `).run(timestamp, timestamp);
  const start = await startLine(env, "");
  assert.equal(start.response.status, 200);
  const callback = await finishLine(env, start, "existing-line");
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get("location"), "/account.html");
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM beta_enrollments").get().count, 0);
  database.close();
});

test("one-time invitation is bound to OAuth, stored only as a hash, and consumed atomically", async () => {
  const database = new TestD1();
  const env = environment(database);
  env.NEW_ACCOUNT_REGISTRATION_ENABLED = "false";
  env.BETA_INVITATION_REGISTRATION_ENABLED = "true";
  env.ACCEPTANCE_FLOW_ENABLED = "true";
  env.ADULT_NOTICE_VERSION = "adult-preview-v1";
  env.TERMS_VERSION = "terms-preview-v1";
  env.PRIVACY_VERSION = "privacy-preview-v1";
  await insertInvitation(database);

  const first = await startLine(env);
  const second = await startLine(env);
  assert.equal(first.response.status, 200);
  assert.equal(second.response.status, 200);
  const storedFlow = database.database.prepare("SELECT invitation_id, state_hash FROM oauth_flows LIMIT 1").get();
  assert.equal(storedFlow.invitation_id, "invite-1");
  assert.notEqual(storedFlow.state_hash, invitationCode);
  assert.equal(
    JSON.stringify(database.database.prepare("SELECT * FROM beta_invitations").get()).includes(invitationCode),
    false,
  );

  const accepted = await finishLine(env, first, "invited-line-user");
  assert.equal(accepted.status, 303);
  assert.equal(accepted.headers.get("location"), "/acceptance");
  const enrollment = database.database.prepare(`
    SELECT e.status, e.invitation_id FROM beta_enrollments e
    JOIN identities i ON i.user_id = e.user_id
    WHERE i.provider = 'line' AND i.subject = 'invited-line-user'
  `).get();
  assert.deepEqual({ ...enrollment }, { status: "pending_age", invitation_id: "invite-1" });
  assert.equal(database.database.prepare(`
    SELECT u.account_state FROM users u JOIN identities i ON i.user_id = u.id
    WHERE i.provider = 'line' AND i.subject = 'invited-line-user'
  `).get().account_state, "pending_acceptance");
  assert.equal(database.database.prepare("SELECT use_count FROM beta_invitations").get().use_count, 1);

  const rejected = await finishLine(env, second, "second-line-user");
  assert.equal(rejected.status, 303);
  assert.match(rejected.headers.get("location"), /auth_error=invitation_unavailable/u);
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM users").get().count, 1);
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM identities").get().count, 1);
  database.close();
});

test("invited account must pass the server-side 18+ gate before Beta activation", async () => {
  const database = new TestD1();
  const env = {
    ...environment(database),
    NEW_ACCOUNT_REGISTRATION_ENABLED: "false",
    BETA_INVITATION_REGISTRATION_ENABLED: "true",
    SOCIAL_APP_ENABLED: "true",
    ADULT_ONBOARDING_ENABLED: "true",
    ADULT_NOTICE_VERSION: "adult-preview-v1",
  };
  const timestamp = unixTime();
  await database.prepare(`
    INSERT INTO users(id, display_name, status, created_at, updated_at)
    VALUES ('invited-user', 'Invited User', 'active', ?, ?)
  `).bind(timestamp, timestamp).run();
  await insertInvitation(database);
  await database.prepare(`
    INSERT INTO beta_enrollments(user_id, invitation_id, status, created_at)
    VALUES ('invited-user', 'invite-1', 'pending_age', ?)
  `).bind(timestamp).run();
  const session = await issueSession(database, "invited-user", timestamp);
  const headers = {
    "content-type": "application/json",
    origin: "https://chatgun.pages.dev",
    cookie: `__Host-cg_session=${session.token}; __Host-cg_csrf=${session.csrf}`,
    "x-csrf-token": session.csrf,
  };
  const body = {
    confirmedAdult: true,
    dateOfBirth: "2012-01-01",
    noticeVersion: "adult-preview-v1",
    name: "Invited User",
  };
  const underage = await socialRequest({
    env,
    request: new Request("https://chatgun.pages.dev/api/social/onboarding/adult", {
      method: "POST", headers, body: JSON.stringify(body),
    }),
  });
  assert.equal(underage.status, 400);
  assert.equal(database.database.prepare("SELECT status FROM beta_enrollments").get().status, "pending_age");

  body.dateOfBirth = "1990-01-01";
  const adult = await socialRequest({
    env,
    request: new Request("https://chatgun.pages.dev/api/social/onboarding/adult", {
      method: "POST", headers, body: JSON.stringify(body),
    }),
  });
  assert.equal(adult.status, 201, await adult.text());
  assert.equal(database.database.prepare("SELECT status FROM beta_enrollments").get().status, "active");
  assert.equal(database.database.prepare("SELECT age_band FROM age_assurance_events").get().age_band, "adult_18_plus");
  database.close();
});
