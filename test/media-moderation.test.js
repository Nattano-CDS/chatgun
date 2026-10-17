import assert from "node:assert/strict";
import test from "node:test";
import { issueSession, unixTime } from "../functions/_lib/db.js";
import { moderationCoverage, onRequest } from "../functions/api/social/[[path]].js";
import { environment, TestD1 } from "./helpers/d1.js";

class TestR2 {
  constructor() { this.objects = new Map(); }
  async get(key) { return this.objects.has(key) ? { body: this.objects.get(key) } : null; }
}

async function member(database, id) {
  const now = unixTime();
  await database.prepare("INSERT INTO users(id,display_name,status,account_state,created_at,updated_at) VALUES (?,?,'active','active',?,?)").bind(id, id, now, now).run();
  const session = await issueSession(database, id, now);
  await database.prepare("INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at) VALUES (?,?,'adult_18_plus','self_declaration','v1',?)").bind(`${id}-age`, id, now).run();
  await database.prepare("INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at) VALUES (?,?,?,?,?)").bind(id, `${id}-age`, id, now, now).run();
  return session;
}

function runtime(database, media, extras = {}) {
  return {
    ...environment(database), MEDIA: media, SOCIAL_APP_ENABLED: "true", MEDIA_UPLOAD_ENABLED: "true",
    MEDIA_QUARANTINE_ENABLED: "true", MODERATION_TOOLS_ENABLED: "true", SENSITIVE_CONTENT_ENABLED: "false",
    ...extras,
  };
}

function request(path, session, { method = "GET", body, purpose = "Review synthetic media safety evidence" } = {}) {
  const headers = session ? { cookie: `__Host-cg_session=${session.token}; __Host-cg_csrf=${session.csrf}` } : {};
  if (purpose) headers["x-moderation-purpose"] = encodeURIComponent(purpose);
  if (method === "POST") Object.assign(headers, { origin: "https://chatgun.pages.dev", "content-type": "application/json", "x-csrf-token": session?.csrf || "" });
  return new Request(`https://chatgun.pages.dev${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
}

async function seedMedia(database, media, owner, id = "media-1") {
  const now = unixTime();
  const key = `gallery/${id}`;
  await database.prepare("INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,created_at) VALUES (?,?,?,'gallery','image/png',4,?)").bind(id, owner, key, now).run();
  await database.prepare("INSERT INTO profile_photos(media_id,owner_user_id,created_at,visibility) VALUES (?,?,?,'public')").bind(id, owner, now).run();
  await database.prepare("INSERT INTO media_safety_reviews(media_id,status,source,created_at) VALUES (?,'pending','manual',?)").bind(id, now).run();
  media.objects.set(key, new Uint8Array([1, 2, 3, 4]));
}

test("approved Bangkok moderation coverage opens exactly from 19:00 through 21:59", () => {
  const before = moderationCoverage(Date.parse("2026-10-16T11:59:00Z"));
  const opening = moderationCoverage(Date.parse("2026-10-16T12:00:00Z"));
  const beforeClose = moderationCoverage(Date.parse("2026-10-16T14:59:00Z"));
  const closed = moderationCoverage(Date.parse("2026-10-16T15:00:00Z"));
  assert.equal(before.isOpen, false);
  assert.equal(opening.isOpen, true);
  assert.equal(beforeClose.isOpen, true);
  assert.equal(closed.isOpen, false);
  assert.deepEqual(
    { timezone: opening.timezone, start: opening.start, end: opening.end, weeklyHours: opening.weeklyHours, reportingAlwaysAvailable: opening.reportingAlwaysAvailable, immediateResponseGuaranteed: opening.immediateResponseGuaranteed },
    { timezone: "Asia/Bangkok", start: "19:00", end: "22:00", weeklyHours: 21, reportingAlwaysAvailable: true, immediateResponseGuaranteed: false },
  );
});

test("single-operator overview prioritizes urgent queues and exposes aggregate workload health", async () => {
  const database = new TestD1(); const media = new TestR2();
  const admin = await member(database, "overview-admin");
  await member(database, "overview-owner");
  await member(database, "overview-reporter");
  const now = unixTime();
  await database.prepare("INSERT INTO moderation_roles(user_id,role,created_at) VALUES ('overview-admin','safety_admin',?)").bind(now).run();
  await seedMedia(database, media, "overview-owner", "overview-media");
  await database.prepare(`
    INSERT INTO social_reports(id,reporter_user_id,subject_user_id,category,reason_code,details,status,created_at)
    VALUES ('urgent-user-report','overview-reporter','overview-owner','violence','threat','synthetic threat report','pending',?)
  `).bind(now - 120).run();
  await database.prepare(`
    INSERT INTO media_reports(id,media_id,reporter_user_id,reason_code,details,status,created_at)
    VALUES ('urgent-media-report','overview-media','overview-reporter','ncii','synthetic NCII report','pending',?)
  `).bind(now - 180).run();
  await database.prepare(`
    INSERT INTO media_appeals(id,media_id,appellant_user_id,reason,status,created_at)
    VALUES ('pending-appeal','overview-media','overview-owner','Synthetic appeal for workload summary','pending',?)
  `).bind(now - 60).run();
  await database.prepare(`
    INSERT INTO media_deletion_queue(object_key,operation_id,attempts,next_attempt_at,created_at)
    VALUES ('synthetic-exhausted','cleanup-op',10,?,?)
  `).bind(now, now - 300).run();
  const env = runtime(database, media);
  const response = await onRequest({ env, request: request("/api/social/moderation/overview", admin) });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.counts.pending, 1);
  assert.equal(payload.counts.userReports, 1);
  assert.equal(payload.counts.mediaReports, 1);
  assert.equal(payload.counts.appeals, 1);
  assert.equal(payload.counts.critical, 2);
  assert.equal(payload.daily.newLast24Hours, 4);
  assert.equal(payload.cleanup.pending, 1);
  assert.equal(payload.cleanup.exhausted, 1);
  assert.equal(payload.coverage.timezone, "Asia/Bangkok");
  assert.equal(payload.coverage.start, "19:00");
  assert.equal(payload.coverage.end, "22:00");
  assert.equal(payload.coverage.weeklyHours, 21);
  assert.equal(payload.coverage.reportingAlwaysAvailable, true);
  assert.equal(payload.coverage.immediateResponseGuaranteed, false);
  assert.ok(payload.daily.oldestOpenAt <= now - 180);
  assert.equal((await database.prepare("SELECT purpose FROM media_safety_audit_events WHERE action='queue_view' ORDER BY created_at DESC LIMIT 1").first()).purpose, "routine_admin_dashboard_access");

  await database.prepare("UPDATE session_auth_evidence SET authenticated_at=? WHERE user_id='overview-admin'").bind(now - 3600).run();
  const staleButAuthorized = await onRequest({ env, request: request("/api/social/moderation/overview", admin, { purpose: "" }) });
  assert.equal(staleButAuthorized.status, 200, "routine overview requires a valid session and role, not a fresh high-risk reauthentication");

  const ordinary = await member(database, "overview-ordinary");
  const unauthorized = await onRequest({ env, request: request("/api/social/moderation/overview", ordinary, { purpose: "" }) });
  assert.equal(unauthorized.status, 403);
  assert.equal((await database.prepare("SELECT COUNT(*) count FROM media_safety_audit_events WHERE action='queue_view'").first()).count, 2);
  database.close();
});

test("media classification is role-gated, concurrency-safe, and revokes access immediately", async () => {
  const database = new TestD1(); const media = new TestR2();
  const admin = await member(database, "media-admin");
  const owner = await member(database, "media-owner");
  const viewer = await member(database, "media-viewer");
  const unauthorized = await member(database, "media-outsider");
  const now = unixTime();
  await database.prepare("INSERT INTO moderation_roles(user_id,role,created_at) VALUES ('media-admin','safety_admin',?)").bind(now).run();
  await database.prepare("INSERT INTO social_relationships(id,user_low,user_high,requested_by,status,created_at,updated_at) VALUES ('friend','media-owner','media-viewer','media-owner','accepted',?,?)").bind(now, now).run();
  await seedMedia(database, media, "media-owner");
  const env = runtime(database, media);

  const anonymous = await onRequest({ env, request: request("/api/social/media/media-1", null, { purpose: "" }) });
  assert.equal(anonymous.status, 401);
  const pending = await onRequest({ env, request: request("/api/social/media/media-1", owner, { purpose: "" }) });
  assert.equal(pending.status, 404);
  const pendingLike = await onRequest({ env, request: request("/api/social/gallery", viewer, {
    method: "POST", purpose: "", body: { action: "like", id: "media-1" },
  }) });
  assert.equal(pendingLike.status, 404, "pending media cannot be reached through interaction APIs");
  const deniedModerator = await onRequest({ env, request: request("/api/social/moderation/media", unauthorized) });
  assert.equal(deniedModerator.status, 403);

  const general = await onRequest({ env, request: request("/api/social/moderation/media", admin, {
    method: "POST", body: { id: "media-1", status: "released", category: "general", reason: "ภาพทั่วไปผ่านการตรวจ", revision: 0 },
  }) });
  assert.equal(general.status, 200);
  const generalRead = await onRequest({ env, request: request("/api/social/media/media-1", viewer, { purpose: "" }) });
  assert.equal(generalRead.status, 200);
  await database.prepare("UPDATE member_profiles SET selected_photo_id='media-1' WHERE user_id='media-owner'").run();

  const stale = await onRequest({ env, request: request("/api/social/moderation/media", admin, {
    method: "POST", body: { id: "media-1", status: "released", category: "sensitive", reason: "ข้อมูลรุ่นเก่า", revision: 0 },
  }) });
  assert.equal(stale.status, 409);
  const sensitive = await onRequest({ env, request: request("/api/social/moderation/media", admin, {
    method: "POST", body: { id: "media-1", status: "released", category: "sensitive", reason: "จัดเป็นเนื้อหาละเอียดอ่อน", revision: 1 },
  }) });
  assert.equal(sensitive.status, 200);
  assert.equal((await database.prepare("SELECT selected_photo_id FROM member_profiles WHERE user_id='media-owner'").first()).selected_photo_id, null);
  const selfDeclaredDenied = await onRequest({ env, request: request("/api/social/media/media-1", viewer, { purpose: "" }) });
  assert.equal(selfDeclaredDenied.status, 404);
  await database.prepare("INSERT INTO independent_age_assurances(id,user_id,method,status,verified_at,reviewed_by) VALUES ('verified-adult','media-viewer','external_provider','verified',?,'media-admin')").bind(now).run();
  const featureDisabled = await onRequest({ env, request: request("/api/social/media/media-1", viewer, { purpose: "" }) });
  assert.equal(featureDisabled.status, 404, "verified adults are still denied while Sensitive content is disabled");
  const sensitiveEnabled = runtime(database, media, { SENSITIVE_CONTENT_ENABLED: "true" });
  const verifiedRead = await onRequest({ env: sensitiveEnabled, request: request("/api/social/media/media-1", viewer, { purpose: "" }) });
  assert.equal(verifiedRead.status, 200);

  const prohibited = await onRequest({ env, request: request("/api/social/moderation/media", admin, {
    method: "POST", body: { id: "media-1", status: "rejected", category: "prohibited", reason: "เนื้อหาต้องห้ามตามกฎ", revision: 2 },
  }) });
  assert.equal(prohibited.status, 200);
  const immediatelyRevoked = await onRequest({ env: sensitiveEnabled, request: request("/api/social/media/media-1", viewer, { purpose: "" }) });
  assert.equal(immediatelyRevoked.status, 404);
  assert.equal((await database.prepare("SELECT state FROM social_media WHERE id='media-1'").first()).state, "pending_deletion");
  assert.equal((await database.prepare("SELECT COUNT(*) count FROM media_deletion_queue").first()).count, 1);
  assert.equal((await database.prepare("SELECT COUNT(*) count FROM media_moderation_decisions").first()).count, 3);
  database.close();
});

test("media reports protect reporter privacy and appeals restore only after audited review", async () => {
  const database = new TestD1(); const media = new TestR2();
  const admin = await member(database, "appeal-admin");
  const owner = await member(database, "appeal-owner");
  const reporter = await member(database, "appeal-reporter");
  const now = unixTime();
  await database.prepare("INSERT INTO moderation_roles(user_id,role,created_at) VALUES ('appeal-admin','safety_admin',?)").bind(now).run();
  await database.prepare("INSERT INTO social_relationships(id,user_low,user_high,requested_by,status,created_at,updated_at) VALUES ('appeal-friend','appeal-owner','appeal-reporter','appeal-owner','accepted',?,?)").bind(now, now).run();
  await seedMedia(database, media, "appeal-owner", "appeal-media");
  await database.prepare("UPDATE media_safety_reviews SET status='released',category='general',revision=1 WHERE media_id='appeal-media'").run();
  const env = runtime(database, media);

  const report = await onRequest({ env, request: request("/api/social/reports/media", reporter, {
    method: "POST", purpose: "", body: { mediaId: "appeal-media", reason: "privacy", details: "รูปนี้เปิดเผยข้อมูลส่วนตัว" },
  }) });
  assert.equal(report.status, 201);
  const duplicate = await onRequest({ env, request: request("/api/social/reports/media", reporter, {
    method: "POST", purpose: "", body: { mediaId: "appeal-media", reason: "privacy", details: "รายงานซ้ำ" },
  }) });
  assert.equal(duplicate.status, 409);
  const queue = await onRequest({ env, request: request("/api/social/moderation/media-reports", admin) });
  const queued = (await queue.json()).reports[0];
  assert.equal(queued.media_id, "appeal-media");
  assert.equal(Object.hasOwn(queued, "reporter_user_id"), false);

  const reject = await onRequest({ env, request: request("/api/social/moderation/media", admin, {
    method: "POST", body: { id: "appeal-media", status: "rejected", category: "prohibited", reason: "จำกัดสื่อระหว่างตรวจสอบ", revision: 1 },
  }) });
  assert.equal(reject.status, 200);
  const appeal = await onRequest({ env, request: request("/api/social/media/appeals", owner, {
    method: "POST", purpose: "", body: { mediaId: "appeal-media", reason: "ขอให้ตรวจสอบใหม่ เนื่องจากเป็นข้อมูลที่ได้รับอนุญาต" },
  }) });
  assert.equal(appeal.status, 201);
  const appealId = (await appeal.json()).id;
  const granted = await onRequest({ env, request: request("/api/social/moderation/appeals", admin, {
    method: "POST", body: { id: appealId, decision: "granted", category: "general", reason: "ตรวจซ้ำแล้วไม่เข้าข่ายต้องห้าม", revision: 0 },
  }) });
  assert.equal(granted.status, 200);
  assert.deepEqual(
    { ...(await database.prepare("SELECT state FROM social_media WHERE id='appeal-media'").first()), ...(await database.prepare("SELECT status,category FROM media_safety_reviews WHERE media_id='appeal-media'").first()) },
    { state: "active", status: "released", category: "general" },
  );
  assert.equal((await database.prepare("SELECT COUNT(*) count FROM media_deletion_queue").first()).count, 0);
  const notifications = await onRequest({ env, request: request("/api/social/moderation/notifications", owner, { purpose: "" }) });
  assert.ok((await notifications.json()).notifications.some((item) => item.message_code === "appeal_granted"));
  const audit = await onRequest({ env, request: request("/api/social/moderation/audit", admin) });
  assert.ok((await audit.json()).events.length >= 2);
  database.close();
});
