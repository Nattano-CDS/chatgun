import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/api/auth/[[path]].js";
import {
  confirmAccountDeletion,
  createDeletionRequest,
  issueSession,
  RECENT_AUTH_TTL_SECONDS,
} from "../functions/_lib/db.js";
import { runRetentionCleanup } from "../functions/_lib/retention.js";
import { cookieValue, environment, jsonRequest, TestD1 } from "./helpers/d1.js";

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

function seedUser(database, id = "privacy-user", timestamp = 1_800_000_000) {
  database.database.prepare(`
    INSERT INTO users(id, email, email_verified_at, display_name, status, created_at, updated_at)
    VALUES (?, ?, ?, 'Privacy Member', 'active', ?, ?)
  `).run(id, `${id}@example.test`, timestamp, timestamp, timestamp);
  database.database.prepare(`
    INSERT INTO identities(provider, subject, user_id, provider_email, email_verified, created_at, last_login_at)
    VALUES ('line', ?, ?, NULL, 0, ?, ?)
  `).run(`line-${id}`, id, timestamp, timestamp);
}

function authenticatedRequest(path, body, session, extraHeaders = {}) {
  return jsonRequest(path, body, {
    cookie: `__Host-cg_session=${encodeURIComponent(session.token)}; __Host-cg_csrf=${encodeURIComponent(session.csrf)}`,
    "x-csrf-token": session.csrf,
    ...extraHeaders,
  });
}

test("retention cleanup removes only expired or aged security records", async () => {
  const database = new TestD1();
  const now = 1_800_000_000;
  seedUser(database, "cleanup-user", now - 10_000);
  database.database.prepare(`
    INSERT INTO sessions(token_hash,user_id,csrf_hash,created_at,expires_at,last_seen_at,revoked_at)
    VALUES ('active-session','cleanup-user','csrf-a',?,?,?,NULL),
           ('expired-session','cleanup-user','csrf-b',?,?,?,NULL),
           ('recently-revoked','cleanup-user','csrf-c',?,?,?,?)
  `).run(
    now - 100, now + 100, now - 10,
    now - 200, now - 1, now - 20,
    now - 200, now + 100, now - 20, now - 60,
  );
  database.database.prepare(`
    INSERT INTO session_auth_evidence(token_hash,user_id,authenticated_at,expires_at)
    VALUES ('active-session','cleanup-user',?,?), ('expired-session','cleanup-user',?,?),
           ('recently-revoked','cleanup-user',?,?)
  `).run(now - 100, now + 100, now - 200, now - 1, now - 60, now + 100);
  database.database.prepare(`
    INSERT INTO oauth_flows(state_hash,provider,pkce_verifier,nonce,ip_hash,created_at,expires_at)
    VALUES ('active-flow','google','v','n','ip',?,?), ('expired-flow','google','v','n','ip',?,?)
  `).run(now - 10, now + 100, now - 20, now - 1);
  database.database.prepare(`
    INSERT INTO rate_limits(scope,key_hash,window_start,count,expires_at)
    VALUES ('test','active-rate',?,1,?), ('test','expired-rate',?,1,?)
  `).run(now - 10, now + 100, now - 20, now - 1);
  database.database.prepare(`
    INSERT INTO otp_challenges(id,email,code_hash,ip_hash,expires_at,created_at,attempts,used_at)
    VALUES ('active-otp','a@example.test','h','i',?,?,0,NULL),
           ('expired-otp','b@example.test','h','i',?,?,0,NULL)
  `).run(now + 100, now - 10, now - 1, now - 400);
  database.exec(`
    INSERT INTO beta_invitations(id,token_hash,label,expires_at,created_at)
    VALUES ('expired-invite','invite-hash','cleanup-test',${now - 700000},${now - 800000});
    INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at,revoked_at)
    VALUES ('current-age','cleanup-user','adult_18_plus','self_declaration','test',${now - 200},NULL),
           ('old-age','cleanup-user','adult_18_plus','self_declaration','test',${now - 100000},${now - 90000});
    INSERT INTO member_profiles(
      user_id,age_assurance_id,name,discovery_visible,latitude,longitude,accuracy,located_at,created_at,updated_at
    ) VALUES ('cleanup-user','current-age','Cleanup',1,13.75,100.5,10,${now - 90000},${now - 100000},${now - 90000});
    INSERT INTO media_deletion_queue(object_key,operation_id,next_attempt_at,created_at,completed_at)
    VALUES ('old-completed.webp','op',${now - 1000000},${now - 1000000},${now - 700000});
  `);

  const deleted = await runRetentionCleanup(database, now);
  assert.deepEqual(deleted, {
    oauthFlows: 1,
    betaInvitations: 1,
    sessions: 1,
    rateLimits: 1,
    otpChallenges: 1,
    authEvidence: 0,
    deletionRequests: 0,
    deletionReceipts: 0,
    stalePresence: 1,
    revokedAgeAssurance: 1,
    completedMediaQueue: 1,
  });
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM sessions WHERE token_hash='active-session'").get().count, 1);
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM sessions WHERE token_hash='recently-revoked'").get().count, 1);
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM oauth_flows WHERE state_hash='active-flow'").get().count, 1);
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM otp_challenges WHERE id='active-otp'").get().count, 1);
  const presence = database.database.prepare(
    "SELECT discovery_visible,latitude,longitude,located_at FROM member_profiles WHERE user_id='cleanup-user'",
  ).get();
  assert.deepEqual({ ...presence }, { discovery_visible: 0, latitude: null, longitude: null, located_at: null });
  database.close();
});

test("account deletion requires CSRF and recent authentication", async () => {
  const database = new TestD1();
  const env = environment(database);
  const now = Math.floor(Date.now() / 1000);
  seedUser(database, "guarded-user", now);
  const session = await issueSession(database, "guarded-user", now - RECENT_AUTH_TTL_SECONDS - 1);

  const wrongCsrf = await onRequest({
    env,
    request: authenticatedRequest("/api/auth/account-deletion/request", { acknowledged: true }, session, { "x-csrf-token": "wrong" }),
  });
  assert.equal(wrongCsrf.status, 403);

  const stale = await onRequest({
    env,
    request: authenticatedRequest("/api/auth/account-deletion/request", { acknowledged: true }, session),
  });
  assert.equal(stale.status, 428);
  assert.equal((await stale.json()).code, "recent_auth_required");
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM account_deletion_requests").get().count, 0);
  database.close();
});

test("confirmed deletion erases account data, queues owned media, revokes access, and leaves a minimal receipt", async () => {
  const database = new TestD1();
  const env = environment(database);
  const now = Math.floor(Date.now() / 1000);
  seedUser(database, "delete-user", now);
  const session = await issueSession(database, "delete-user", now);
  database.exec(`
    INSERT INTO beta_invitations(id,token_hash,label,max_uses,use_count,expires_at,created_at,consumed_at)
    VALUES ('delete-invite','delete-invite-hash','deletion-test',1,1,${now + 3600},${now - 60},${now});
    INSERT INTO beta_enrollments(user_id,invitation_id,status,created_at,activated_at)
    VALUES ('delete-user','delete-invite','active',${now - 60},${now});
    INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at)
    VALUES ('age-delete','delete-user','adult_18_plus','self_declaration','test',${now});
    INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at)
    VALUES ('delete-user','age-delete','Delete User',${now},${now});
    INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,created_at)
    VALUES ('media-delete','delete-user','staging/delete-user/photo.webp','gallery','image/webp',100,${now});
    INSERT INTO media_upload_quota_attempts(user_id,category,idempotency_key,local_day,status,media_id,result_id,reserved_at,completed_at)
    VALUES ('delete-user','gallery','delete-quota-key-0001','2026-10-16','completed','media-delete','media-delete',${now},${now});
  `);

  const requested = await onRequest({
    env,
    request: authenticatedRequest("/api/auth/account-deletion/request", { acknowledged: true }, session),
  });
  assert.equal(requested.status, 200);
  const deletion = await requested.json();
  assert.notEqual(deletion.confirmationToken, database.database.prepare(
    "SELECT confirmation_hash FROM account_deletion_requests WHERE request_id = ?",
  ).get(deletion.requestId).confirmation_hash);

  const confirmed = await onRequest({
    env,
    request: authenticatedRequest("/api/auth/account-deletion/confirm", {
      requestId: deletion.requestId,
      confirmationToken: deletion.confirmationToken,
      confirmText: "ลบบัญชีถาวร",
    }, session),
  });
  assert.equal(confirmed.status, 200);
  const result = await confirmed.json();
  assert.deepEqual(result, {
    deleted: false,
    accountAccessRevoked: true,
    mediaDeletionPending: 1,
    receipt: { requestId: deletion.requestId, completedAt: result.receipt.completedAt },
  });
  assert.match(confirmed.headers.getSetCookie().join("\n"), /__Host-cg_session=;.*Max-Age=0/u);
  for (const table of [
    "users", "identities", "sessions", "session_auth_evidence", "account_deletion_requests",
    "age_assurance_events", "beta_enrollments", "member_profiles", "social_media", "media_upload_quota_attempts",
  ]) {
    assert.equal(database.database.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count, 0, table);
  }
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM beta_invitations WHERE id='delete-invite'").get().count, 1);
  assert.deepEqual({ ...database.database.prepare(
    "SELECT object_key, attempts, completed_at FROM media_deletion_queue",
  ).get() }, {
    object_key: "staging/delete-user/photo.webp",
    attempts: 0,
    completed_at: null,
  });
  const receipt = database.database.prepare("SELECT * FROM deletion_receipts").get();
  assert.deepEqual(Object.keys(receipt).sort(), [
    "completed_at", "expires_at", "implementation_version", "outcome", "policy_version", "request_id",
  ]);
  assert.equal(JSON.stringify(receipt).includes("delete-user@example.test"), false);

  const replay = await onRequest({
    env,
    request: authenticatedRequest("/api/auth/account-deletion/confirm", {
      requestId: deletion.requestId,
      confirmationToken: deletion.confirmationToken,
      confirmText: "ลบบัญชีถาวร",
    }, session),
  });
  assert.equal(replay.status, 401);
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM deletion_receipts").get().count, 1);
  database.close();
});

test("deletion transaction rolls back completely on failure and can be retried", async () => {
  const database = new TestD1();
  const now = 1_800_000_000;
  seedUser(database, "retry-user", now);
  await issueSession(database, "retry-user", now);
  const deletion = await createDeletionRequest(database, "retry-user", now);
  const realBatch = database.batch.bind(database);
  database.batch = async () => { throw new Error("simulated_batch_failure"); };
  await assert.rejects(
    confirmAccountDeletion(database, "retry-user", deletion.requestId, deletion.confirmationToken, now),
    /simulated_batch_failure/u,
  );
  assert.equal(database.database.prepare("SELECT status FROM account_deletion_requests").get().status, "pending");
  assert.equal(database.database.prepare("SELECT status FROM users WHERE id='retry-user'").get().status, "active");
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM deletion_receipts").get().count, 0);

  database.batch = realBatch;
  const receipt = await confirmAccountDeletion(database, "retry-user", deletion.requestId, deletion.confirmationToken, now);
  assert.equal(receipt.requestId, deletion.requestId);
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM users").get().count, 0);
  database.close();
});

test("concurrent deletion confirmations produce one receipt", async () => {
  const database = new TestD1();
  const now = 1_800_000_000;
  seedUser(database, "race-user", now);
  await issueSession(database, "race-user", now);
  const deletion = await createDeletionRequest(database, "race-user", now);
  const outcomes = await Promise.all([
    confirmAccountDeletion(database, "race-user", deletion.requestId, deletion.confirmationToken, now),
    confirmAccountDeletion(database, "race-user", deletion.requestId, deletion.confirmationToken, now),
  ]);
  assert.equal(outcomes.filter(Boolean).length, 1);
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM deletion_receipts").get().count, 1);
  database.close();
});

test("provider reauthentication refreshes only the matching active session", async () => {
  const database = new TestD1();
  const env = environment(database);
  const now = Math.floor(Date.now() / 1000);
  seedUser(database, "reauth-user", now);
  const session = await issueSession(database, "reauth-user", now - RECENT_AUTH_TTL_SECONDS - 20);
  let expectedNonce = null;
  let providerSubject = "line-reauth-user";
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("turnstile/v0/siteverify")) {
      return Response.json({ success: true, hostname: "chatgun.pages.dev", action: "auth_start" });
    }
    if (url === "https://api.line.me/oauth2/v2.1/token") {
      return Response.json({ access_token: "line-access", id_token: "line-id-token" });
    }
    if (url === "https://api.line.me/oauth2/v2.1/verify") {
      return Response.json({
        iss: "https://access.line.me",
        aud: env.LINE_CLIENT_ID,
        nonce: expectedNonce,
        exp: Math.floor(Date.now() / 1000) + 300,
        iat: Math.floor(Date.now() / 1000),
        sub: providerSubject,
        name: "Privacy Member",
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const start = await onRequest({
    env,
    request: authenticatedRequest("/api/auth/oauth/line/start", {
      purpose: "account_deletion",
      turnstileToken: "valid-turnstile-token",
    }, session),
  });
  assert.equal(start.status, 200);
  const authorization = new URL((await start.json()).authorizationUrl);
  expectedNonce = authorization.searchParams.get("nonce");
  const state = authorization.searchParams.get("state");
  assert.equal(database.database.prepare("SELECT purpose FROM oauth_reauth_contexts").get().purpose, "account_deletion");

  const callback = await onRequest({
    env,
    request: new Request(
      `https://chatgun.pages.dev/api/auth/oauth/line/callback?state=${encodeURIComponent(state)}&code=reauth-code`,
      { headers: { cookie: `__Host-cg_oauth=${encodeURIComponent(cookieValue(start, "__Host-cg_oauth"))}; __Host-cg_session=${encodeURIComponent(session.token)}; __Host-cg_csrf=${encodeURIComponent(session.csrf)}` } },
    ),
  });
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get("location"), "/account.html?reauth=account_deletion");
  assert.ok(database.database.prepare("SELECT authenticated_at FROM session_auth_evidence").get().authenticated_at >= now);
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM oauth_reauth_contexts").get().count, 0);

  const staleTimestamp = now - RECENT_AUTH_TTL_SECONDS - 20;
  database.database.prepare("UPDATE session_auth_evidence SET authenticated_at = ?").run(staleTimestamp);
  providerSubject = "line-belongs-to-another-user";
  const mismatchedStart = await onRequest({
    env,
    request: authenticatedRequest("/api/auth/oauth/line/start", {
      purpose: "account_deletion",
      turnstileToken: "valid-turnstile-token",
    }, session),
  });
  const mismatchedAuthorization = new URL((await mismatchedStart.json()).authorizationUrl);
  expectedNonce = mismatchedAuthorization.searchParams.get("nonce");
  const mismatchedState = mismatchedAuthorization.searchParams.get("state");
  const mismatchedCallback = await onRequest({
    env,
    request: new Request(
      `https://chatgun.pages.dev/api/auth/oauth/line/callback?state=${encodeURIComponent(mismatchedState)}&code=mismatch-code`,
      { headers: { cookie: `__Host-cg_oauth=${encodeURIComponent(cookieValue(mismatchedStart, "__Host-cg_oauth"))}; __Host-cg_session=${encodeURIComponent(session.token)}; __Host-cg_csrf=${encodeURIComponent(session.csrf)}` } },
    ),
  });
  assert.match(mismatchedCallback.headers.get("location"), /auth_error=oauth_failed/u);
  assert.equal(database.database.prepare("SELECT authenticated_at FROM session_auth_evidence").get().authenticated_at, staleTimestamp);
  database.close();
});

test("closed registration rejects an unknown provider identity without creating a user", async () => {
  const database = new TestD1();
  const env = environment(database);
  env.NEW_ACCOUNT_REGISTRATION_ENABLED = "false";
  let expectedNonce = null;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("turnstile/v0/siteverify")) {
      return Response.json({ success: true, hostname: "chatgun.pages.dev", action: "auth_start" });
    }
    if (url === "https://api.line.me/oauth2/v2.1/token") {
      return Response.json({ access_token: "line-access", id_token: "line-id-token" });
    }
    if (url === "https://api.line.me/oauth2/v2.1/verify") {
      return Response.json({
        iss: "https://access.line.me",
        aud: env.LINE_CLIENT_ID,
        nonce: expectedNonce,
        exp: Math.floor(Date.now() / 1000) + 300,
        iat: Math.floor(Date.now() / 1000),
        sub: "unknown-line-user",
        name: "Unknown Member",
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const start = await onRequest({
    env,
    request: jsonRequest("/api/auth/oauth/line/start", { turnstileToken: "valid-turnstile-token" }),
  });
  const authorization = new URL((await start.json()).authorizationUrl);
  expectedNonce = authorization.searchParams.get("nonce");
  const state = authorization.searchParams.get("state");
  const callback = await onRequest({
    env,
    request: new Request(
      `https://chatgun.pages.dev/api/auth/oauth/line/callback?state=${encodeURIComponent(state)}&code=registration-code`,
      { headers: { cookie: `__Host-cg_oauth=${encodeURIComponent(cookieValue(start, "__Host-cg_oauth"))}` } },
    ),
  });
  assert.equal(callback.status, 303);
  assert.match(callback.headers.get("location"), /auth_error=registration_closed/u);
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM users").get().count, 0);
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM identities").get().count, 0);
  database.close();
});

test("closed registration cannot be bypassed by enabling the dormant OTP flag", async () => {
  const database = new TestD1();
  const env = environment(database);
  env.EMAIL_OTP_ENABLED = "true";
  env.NEW_ACCOUNT_REGISTRATION_ENABLED = "false";
  const response = await onRequest({
    env,
    request: jsonRequest("/api/auth/otp/start", {
      channel: "email",
      destination: "minor@example.test",
      turnstileToken: "valid-turnstile-token",
    }),
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "registration_closed");
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM otp_challenges").get().count, 0);
  database.close();
});
