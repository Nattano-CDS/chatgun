import assert from "node:assert/strict";
import test from "node:test";
import { onRequest as authRequest } from "../functions/api/auth/[[path]].js";
import { onRequest as socialRequest } from "../functions/api/social/[[path]].js";
import { issueSession, unixTime } from "../functions/_lib/db.js";
import { environment, TestD1 } from "./helpers/d1.js";

function acceptanceEnvironment(database) {
  return {
    ...environment(database),
    ACCEPTANCE_FLOW_ENABLED: "true",
    ADULT_NOTICE_VERSION: "adult-preview-v1",
    TERMS_VERSION: "terms-preview-v1",
    PRIVACY_VERSION: "privacy-preview-v1",
    NEW_ACCOUNT_REGISTRATION_ENABLED: "false",
    BETA_INVITATION_REGISTRATION_ENABLED: "true",
    SOCIAL_APP_ENABLED: "true",
    ADULT_ONBOARDING_ENABLED: "true",
  };
}

function sessionHeaders(session, { json = false } = {}) {
  return {
    ...(json ? { "content-type": "application/json" } : {}),
    origin: "https://chatgun.pages.dev",
    cookie: `__Host-cg_session=${session.token}; __Host-cg_csrf=${session.csrf}`,
    "x-csrf-token": session.csrf,
  };
}

function acceptanceBody(overrides = {}) {
  return {
    confirmedAdult: true,
    acceptedTerms: true,
    acknowledgedPrivacy: true,
    adultNoticeVersion: "adult-preview-v1",
    termsVersion: "terms-preview-v1",
    privacyVersion: "privacy-preview-v1",
    ...overrides,
  };
}

async function seedPending(database, id = "pending-member") {
  const now = unixTime();
  await database.prepare(`
    INSERT INTO users(id, display_name, status, account_state, created_at, updated_at)
    VALUES (?, 'Pending Member', 'active', 'pending_acceptance', ?, ?)
  `).bind(id, now, now).run();
  await database.prepare(`
    INSERT INTO beta_invitations(id, token_hash, label, max_uses, use_count, expires_at, created_at)
    VALUES ('acceptance-invite', 'synthetic-hash', 'synthetic', 1, 1, ?, ?)
  `).bind(now + 3600, now).run();
  await database.prepare(`
    INSERT INTO beta_enrollments(user_id, invitation_id, status, created_at)
    VALUES (?, 'acceptance-invite', 'pending_age', ?)
  `).bind(id, now).run();
  return issueSession(database, id, now);
}

async function postAuth(env, path, session, body = {}) {
  return authRequest({
    env,
    request: new Request(`https://chatgun.pages.dev${path}`, {
      method: "POST", headers: sessionHeaders(session, { json: true }), body: JSON.stringify(body),
    }),
  });
}

test("pending OAuth account cannot bypass acceptance and underage declaration is rejected", async () => {
  const database = new TestD1();
  const env = acceptanceEnvironment(database);
  const session = await seedPending(database);

  const recovery = await authRequest({
    env,
    request: new Request("https://chatgun.pages.dev/api/auth/me", { headers: sessionHeaders(session) }),
  });
  assert.equal((await recovery.json()).nextPath, "/acceptance");

  const directSocial = await socialRequest({
    env,
    request: new Request("https://chatgun.pages.dev/api/social/profile", { headers: sessionHeaders(session) }),
  });
  assert.equal(directSocial.status, 403);
  assert.equal((await directSocial.json()).code, "acceptance_required");

  const underage = await postAuth(env, "/api/auth/acceptance", session, acceptanceBody({ confirmedAdult: false }));
  assert.equal(underage.status, 403);
  assert.equal((await underage.json()).code, "underage_not_eligible");
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM account_acceptances").get().count, 0);
  assert.equal(database.database.prepare("SELECT account_state FROM users WHERE id = 'pending-member'").get().account_state, "pending_acceptance");

  const staleVersion = await postAuth(env, "/api/auth/acceptance", session, acceptanceBody({ termsVersion: "stale" }));
  assert.equal(staleVersion.status, 400);
  assert.equal((await staleVersion.json()).code, "acceptance_required");
  database.close();
});

test("acceptance evidence transitions to onboarding and onboarding alone activates social access", async () => {
  const database = new TestD1();
  const env = acceptanceEnvironment(database);
  const session = await seedPending(database);

  const accepted = await postAuth(env, "/api/auth/acceptance", session, acceptanceBody());
  assert.equal(accepted.status, 200, await accepted.clone().text());
  assert.deepEqual(await accepted.json(), { accepted: true, nextPath: "/app/?onboarding=1" });
  const evidence = database.database.prepare(`
    SELECT adult_notice_version, terms_version, privacy_version, adult_declared_at, accepted_at
    FROM account_acceptances WHERE user_id = 'pending-member'
  `).get();
  assert.deepEqual({ adult_notice_version: evidence.adult_notice_version, terms_version: evidence.terms_version, privacy_version: evidence.privacy_version }, {
    adult_notice_version: "adult-preview-v1", terms_version: "terms-preview-v1", privacy_version: "privacy-preview-v1",
  });
  assert.ok(evidence.adult_declared_at > 0 && evidence.accepted_at > 0);
  assert.equal(database.database.prepare("SELECT account_state FROM users WHERE id = 'pending-member'").get().account_state, "pending_onboarding");

  const beforeOnboarding = await socialRequest({
    env,
    request: new Request("https://chatgun.pages.dev/api/social/profile", { headers: sessionHeaders(session) }),
  });
  assert.equal(beforeOnboarding.status, 403);
  assert.equal((await beforeOnboarding.json()).code, "onboarding_required");

  const onboarding = await socialRequest({
    env,
    request: new Request("https://chatgun.pages.dev/api/social/onboarding/member", {
      method: "POST", headers: sessionHeaders(session, { json: true }),
      body: JSON.stringify({ name: "Pending Member", gender: "ไม่ระบุ", bio: "", interests: "" }),
    }),
  });
  assert.equal(onboarding.status, 201, await onboarding.clone().text());
  assert.equal(database.database.prepare("SELECT account_state FROM users WHERE id = 'pending-member'").get().account_state, "active");
  assert.equal(database.database.prepare("SELECT status FROM beta_enrollments WHERE user_id = 'pending-member'").get().status, "active");
  assert.equal(database.database.prepare("PRAGMA table_info(account_acceptances)").all().some(({ name }) => name === "date_of_birth"), false);

  const me = await authRequest({
    env,
    request: new Request("https://chatgun.pages.dev/api/auth/me", { headers: sessionHeaders(session) }),
  });
  assert.equal((await me.json()).nextPath, "/app/");

  const duplicateOnboarding = await socialRequest({
    env,
    request: new Request("https://chatgun.pages.dev/api/social/onboarding/member", {
      method: "POST", headers: sessionHeaders(session, { json: true }), body: JSON.stringify({ name: "Changed" }),
    }),
  });
  assert.equal(duplicateOnboarding.status, 409);
  assert.equal((await duplicateOnboarding.json()).code, "onboarding_complete");
  database.close();
});

test("a Terms version change requires acceptance once without repeating onboarding", async () => {
  const database = new TestD1();
  const env = acceptanceEnvironment(database);
  const session = await seedPending(database);
  await postAuth(env, "/api/auth/acceptance", session, acceptanceBody());
  await socialRequest({
    env,
    request: new Request("https://chatgun.pages.dev/api/social/onboarding/member", {
      method: "POST", headers: sessionHeaders(session, { json: true }), body: JSON.stringify({ name: "Member" }),
    }),
  });

  env.TERMS_VERSION = "terms-preview-v2";
  const meBefore = await authRequest({ env, request: new Request("https://chatgun.pages.dev/api/auth/me", { headers: sessionHeaders(session) }) });
  assert.equal((await meBefore.json()).nextPath, "/acceptance");
  const blocked = await socialRequest({ env, request: new Request("https://chatgun.pages.dev/api/social/profile", { headers: sessionHeaders(session) }) });
  assert.equal((await blocked.json()).code, "acceptance_required");

  const renewed = await postAuth(env, "/api/auth/acceptance", session, acceptanceBody({ termsVersion: "terms-preview-v2" }));
  assert.equal((await renewed.json()).nextPath, "/app/");
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM account_acceptances WHERE user_id = 'pending-member'").get().count, 2);
  assert.equal(database.database.prepare("SELECT COUNT(*) count FROM age_assurance_events WHERE user_id = 'pending-member'").get().count, 1);
  const repeated = await postAuth(env, "/api/auth/acceptance", session, acceptanceBody({ termsVersion: "terms-preview-v2" }));
  assert.equal((await repeated.json()).alreadyAccepted, true);
  database.close();
});

test("an existing account without a Beta enrollment can resume incomplete onboarding", async () => {
  const database = new TestD1();
  const env = acceptanceEnvironment(database);
  const now = unixTime();
  await database.prepare(`
    INSERT INTO users(id, display_name, status, account_state, created_at, updated_at)
    VALUES ('legacy-incomplete', 'Legacy Member', 'active', 'active', ?, ?)
  `).bind(now, now).run();
  const session = await issueSession(database, "legacy-incomplete", now);
  const accepted = await postAuth(env, "/api/auth/acceptance", session, acceptanceBody());
  assert.equal((await accepted.json()).nextPath, "/app/?onboarding=1");
  const onboarding = await socialRequest({
    env,
    request: new Request("https://chatgun.pages.dev/api/social/onboarding/member", {
      method: "POST", headers: sessionHeaders(session, { json: true }), body: JSON.stringify({ name: "Legacy Member" }),
    }),
  });
  assert.equal(onboarding.status, 201, await onboarding.clone().text());
  assert.equal(database.database.prepare("SELECT account_state FROM users WHERE id = 'legacy-incomplete'").get().account_state, "active");
  database.close();
});

test("declining acceptance revokes the session and preserves the pending account", async () => {
  const database = new TestD1();
  const env = acceptanceEnvironment(database);
  const session = await seedPending(database);
  const declined = await postAuth(env, "/api/auth/acceptance/decline", session);
  assert.equal(declined.status, 200);
  assert.deepEqual(await declined.json(), { declined: true, redirectUrl: "/" });
  const me = await authRequest({ env, request: new Request("https://chatgun.pages.dev/api/auth/me", { headers: sessionHeaders(session) }) });
  assert.equal(me.status, 401);
  assert.equal(database.database.prepare("SELECT account_state FROM users WHERE id = 'pending-member'").get().account_state, "pending_acceptance");
  database.close();
});

test("acceptance endpoints enforce same-origin CSRF", async () => {
  const database = new TestD1();
  const env = acceptanceEnvironment(database);
  const session = await seedPending(database);
  const response = await authRequest({
    env,
    request: new Request("https://chatgun.pages.dev/api/auth/acceptance", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example", cookie: `__Host-cg_session=${session.token}; __Host-cg_csrf=${session.csrf}`, "x-csrf-token": session.csrf },
      body: JSON.stringify(acceptanceBody()),
    }),
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "invalid_origin");
  database.close();
});
