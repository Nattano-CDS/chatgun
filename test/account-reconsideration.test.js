import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TestD1, environment } from "./helpers/d1.js";
import { issueSession, unixTime } from "../functions/_lib/db.js";
import { onRequest } from "../functions/api/social/[[path]].js";

test("member and operator UI label reconsideration as non-independent and use separate endpoints", () => {
  const page = readFileSync("app/appeals.html", "utf8");
  const member = readFileSync("app/appeals.js", "utf8");
  const operator = readFileSync("app/moderation.js", "utf8");
  assert.match(page, /ไม่ใช่การอุทธรณ์อิสระ/);
  assert.match(page, /ผู้ตัดสินเดิม/);
  assert.match(member, /account-reconsiderations/);
  assert.match(member, /same|พิจารณาใหม่/u);
  assert.match(operator, /moderation\/reconsiderations/);
  assert.doesNotMatch(member, /conflictAcknowledged/);
});

async function setup() {
  const db = new TestD1(); const now = unixTime(); const sessions = {};
  for (const id of ["owner", "independent", "member", "other"]) {
    await db.prepare("INSERT INTO users(id,status,account_state,created_at,updated_at)VALUES(?,'active','active',?,?)").bind(id, now, now).run();
    await db.prepare("INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at)VALUES(?,?,'adult_18_plus','self_declaration','v1',?)").bind(id, id, now).run();
    await db.prepare("INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at)VALUES(?,?,?,?,?)").bind(id, id, id, now, now).run();
    await db.prepare("INSERT INTO beta_enrollments(user_id,status,created_at,activated_at)VALUES(?,'active',?,?)").bind(id, now, now).run();
    sessions[id] = await issueSession(db, id, now);
  }
  for (const id of ["owner", "independent"]) await db.prepare("INSERT INTO moderation_roles(user_id,role,created_at)VALUES(?,'safety_admin',?)").bind(id, now).run();
  await db.prepare("INSERT INTO social_reports(id,reporter_user_id,subject_user_id,category,details,created_at)VALUES('case','other','member','harassment','Private reporter fixture',?)").bind(now).run();
  const env = { ...environment(db), SOCIAL_APP_ENABLED: "true", MODERATION_TOOLS_ENABLED: "true", ACCOUNT_MODERATION_ENABLED: "true", ACCOUNT_RECONSIDERATION_ENABLED: "true" };
  const request = (path, actor, body, extra = {}) => {
    const session = sessions[actor]; const headers = {
      cookie: session ? `__Host-cg_session=${session.token}; __Host-cg_csrf=${session.csrf}` : "",
      "x-moderation-purpose": "Review same-operator reconsideration safely", ...extra,
    };
    if (body) Object.assign(headers, { origin: "https://chatgun.pages.dev", "content-type": "application/json", "x-csrf-token": session?.csrf || "" });
    return onRequest({ env, request: new Request(`https://chatgun.pages.dev${path}`, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined }) });
  };
  return { db, env, sessions, request };
}

async function suspend(db, sessions, request) {
  assert.equal((await request("/api/social/moderation/accounts", "owner", { action: "suspend", reportId: "case", reason: "Restrict account while reviewing the authorized safety report" })).status, 201);
  const restriction = await db.prepare("SELECT id,revision FROM beta_account_restrictions WHERE user_id='member'").first();
  sessions.member = await issueSession(db, "member", unixTime());
  return restriction;
}

test("same-operator reconsideration is explicit, private, deduplicated and separate from independent appeal", async () => {
  const { db, sessions, request } = await setup();
  try {
    const restriction = await suspend(db, sessions, request);
    assert.equal((await request("/api/social/account-reconsiderations", "member", { id: restriction.id, reason: "short" })).status, 400);
    assert.equal((await request("/api/social/account-reconsiderations", "other", { id: restriction.id, reason: "Another member cannot request review for this restriction" })).status, 404);
    const submitted = await request("/api/social/account-reconsiderations", "member", {
      id: restriction.id,
      reason: "Please reconsider the restriction using the additional context supplied here",
      evidenceText: "Additional text evidence that was not available for the first decision",
    });
    assert.equal(submitted.status, 201);
    assert.deepEqual(await submitted.json(), { ok: true, reviewType: "same_operator_reconsideration", independent: false });
    assert.equal((await request("/api/social/account-reconsiderations", "member", { id: restriction.id, reason: "Duplicate reconsideration must not create another queue item" })).status, 409);
    assert.equal((await request("/api/social/account-appeals", "member", { id: restriction.id, reason: "A pending reconsideration prevents a parallel appeal race" })).status, 409);
    const memberView = await (await request("/api/social/account-reconsiderations", "member")).json();
    assert.equal(memberView.independent, false); assert.match(memberView.disclosure, /ไม่ใช่การอุทธรณ์/);
    const ownerQueue = await (await request("/api/social/moderation/reconsiderations", "owner")).json();
    assert.equal(ownerQueue.items.length, 1); assert.equal(ownerQueue.items[0].original_decision_maker, 1);
    assert.equal("report_id" in ownerQueue.items[0], false); assert.equal("reporter_user_id" in ownerQueue.items[0], false);
    const otherQueue = await (await request("/api/social/moderation/reconsiderations", "independent")).json();
    assert.equal(otherQueue.items.length, 0);
    const item = ownerQueue.items[0];
    assert.equal((await request("/api/social/moderation/reconsiderations", "independent", { id: item.id, revision: item.revision, decision: "lifted", reason: "A different reviewer cannot impersonate same-operator reconsideration" })).status, 403);
    assert.equal((await request("/api/social/moderation/reconsiderations", "other", { id: item.id, revision: item.revision, decision: "lifted", reason: "Unauthorized member must not decide reconsideration" })).status, 403);
    assert.equal((await request("/api/social/moderation/reconsiderations", "owner", { id: item.id, revision: item.revision, decision: "upheld", reason: "New information does not change the original safety assessment" })).status, 200);
    assert.equal((await request("/api/social/moderation/reconsiderations", "owner", { id: item.id, revision: item.revision, decision: "lifted", reason: "Stale duplicate decision must fail closed" })).status, 409);
    const decided = await db.prepare("SELECT status,decided_by,revision FROM account_reconsiderations").first();
    assert.equal(decided.status, "upheld"); assert.equal(decided.decided_by, "owner"); assert.equal(decided.revision, 1);
    assert.equal((await db.prepare("SELECT status,revision FROM beta_account_restrictions").first()).status, "active");
    const events = (await db.prepare("SELECT action,actor_user_id FROM account_reconsideration_events WHERE action<>'queue_view' ORDER BY created_at,action").all()).results;
    assert.deepEqual(events.map(({ action }) => action), ["requested", "upheld"]);
    assert.throws(() => db.database.prepare("UPDATE account_reconsideration_events SET reason='tamper attempt' WHERE action='requested'").run(), /append_only/);
    assert.throws(() => db.database.prepare("DELETE FROM account_reconsideration_events WHERE action='requested'").run(), /append_only/);
    assert.equal(db.database.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally { db.close(); }
});

test("same original decision-maker can reverse a restriction without restoring privacy-sensitive state", async () => {
  const { db, sessions, request } = await setup();
  try {
    const now = unixTime();
    await db.prepare("UPDATE member_profiles SET discovery_visible=1,latitude=13.7,longitude=100.5,accuracy=10,located_at=? WHERE user_id='member'").bind(now).run();
    const restriction = await suspend(db, sessions, request);
    assert.equal((await request("/api/social/account-reconsiderations", "member", { id: restriction.id, reason: "New information supports reversing this account restriction" })).status, 201);
    const item = (await (await request("/api/social/moderation/reconsiderations", "owner")).json()).items[0];
    assert.equal((await request("/api/social/moderation/reconsiderations", "owner", { id: item.id, revision: item.revision, decision: "lifted", reason: "Additional evidence resolves the original account safety concern" })).status, 200);
    const profile = await db.prepare("SELECT discovery_visible,latitude,longitude FROM member_profiles WHERE user_id='member'").first();
    assert.equal(profile.discovery_visible, 0); assert.equal(profile.latitude, null); assert.equal(profile.longitude, null);
    assert.equal((await db.prepare("SELECT status FROM beta_enrollments WHERE user_id='member'").first()).status, "active");
    assert.equal((await db.prepare("SELECT status FROM beta_account_restrictions WHERE user_id='member'").first()).status, "lifted");
    assert.equal(db.database.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally { db.close(); }
});

test("reconsideration requires CSRF and keeps independent-appeal self-adjudication blocked", async () => {
  const { db, env, sessions, request } = await setup();
  try {
    const restriction = await suspend(db, sessions, request);
    const noCsrf = await onRequest({ env, request: new Request("https://chatgun.pages.dev/api/social/account-reconsiderations", {
      method: "POST", headers: { origin: "https://chatgun.pages.dev", "content-type": "application/json", cookie: `__Host-cg_session=${sessions.member.token}` },
      body: JSON.stringify({ id: restriction.id, reason: "Missing CSRF must not create a reconsideration request" }),
    }) });
    assert.equal(noCsrf.status, 403);
    assert.equal((await db.prepare("SELECT COUNT(*) n FROM account_reconsiderations").first()).n, 0);
    assert.equal((await request("/api/social/account-appeals", "member", { id: restriction.id, reason: "Submit independent appeal for regression verification" })).status, 201);
    const appeal = (await (await request("/api/social/moderation/accounts?view=appeals", "owner")).json()).items[0];
    assert.equal(appeal.reviewer_conflict, 1);
    assert.equal((await request("/api/social/moderation/accounts", "owner", { action: "resolve_appeal", id: appeal.id, revision: appeal.revision, decision: "lifted", reason: "Original moderator remains blocked from independent self-review" })).status, 409);
    assert.equal((await db.prepare("SELECT status FROM beta_account_appeals").first()).status, "pending");
  } finally { db.close(); }
});
