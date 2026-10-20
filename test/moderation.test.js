import assert from "node:assert/strict";
import test from "node:test";
import { issueSession, unixTime } from "../functions/_lib/db.js";
import { onRequest } from "../functions/api/social/[[path]].js";
import { environment, TestD1 } from "./helpers/d1.js";

class TestR2 {
  constructor() { this.objects = new Map(); }
  async get(key) { return this.objects.has(key) ? { body: this.objects.get(key) } : null; }
}

async function member(database, id) {
  const now = unixTime();
  await database.prepare("INSERT INTO users(id,display_name,status,created_at,updated_at) VALUES (?,?,'active',?,?)").bind(id, id, now, now).run();
  const session = await issueSession(database, id, now);
  await database.prepare("INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at) VALUES (?,?,'adult_18_plus','self_declaration','v1',?)").bind(`${id}-age`, id, now).run();
  await database.prepare("INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at) VALUES (?,?,?,?,?)").bind(id, `${id}-age`, id, now, now).run();
  return session;
}

function request(path, session, { method = "GET", body, purpose = "Investigate a reported safety incident" } = {}) {
  const headers = {
    cookie: `__Host-cg_session=${encodeURIComponent(session.token)}; __Host-cg_csrf=${encodeURIComponent(session.csrf)}`,
    "x-moderation-purpose": purpose,
  };
  if (method === "POST") Object.assign(headers, { origin: "https://chatgun.pages.dev", "content-type": "application/json", "x-csrf-token": session.csrf });
  return new Request(`https://chatgun.pages.dev${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
}

test("moderation is fail-closed, role-gated, purpose-logged, and supports report decisions", async () => {
  const database = new TestD1();
  const reviewer = await member(database, "mod-reviewer");
  const reporter = await member(database, "mod-reporter");
  await member(database, "mod-subject");
  const now = unixTime();
  await database.prepare("INSERT INTO social_reports(id,reporter_user_id,subject_user_id,category,details,created_at) VALUES ('report-1','mod-reporter','mod-subject','harassment','รายละเอียด',?)").bind(now).run();
  const runtime = { ...environment(database), SOCIAL_APP_ENABLED: "true", MODERATION_TOOLS_ENABLED: "true" };

  const forbidden = await onRequest({ env: runtime, request: request("/api/social/moderation/reports", reporter) });
  assert.equal(forbidden.status, 403);
  await database.prepare("INSERT INTO moderation_roles(user_id,role,created_at) VALUES ('mod-reviewer','report_reviewer',?)").bind(now).run();
  const queue = await onRequest({ env: runtime, request: request("/api/social/moderation/reports", reviewer) });
  assert.equal(queue.status, 200);
  assert.equal((await queue.json()).reports[0].id, "report-1");
  const decision = await onRequest({ env: runtime, request: request("/api/social/moderation/reports", reviewer, {
    method: "POST", body: { id: "report-1", status: "escalated", note: "ส่งต่อเพื่อประเมินความปลอดภัย" },
  }) });
  assert.equal(decision.status, 200);
  assert.equal((await database.prepare("SELECT status FROM social_reports WHERE id = 'report-1'").first()).status, "escalated");
  const audits = await database.prepare("SELECT action, purpose FROM moderation_audit_events ORDER BY created_at, action").all();
  assert.deepEqual(audits.results.map((row) => row.action).sort(), ["report_review", "report_view"]);
  assert.ok(audits.results.every((row) => row.purpose.length >= 10));

  const disabled = await onRequest({ env: { ...runtime, MODERATION_TOOLS_ENABLED: "false" }, request: request("/api/social/moderation/reports", reviewer) });
  assert.equal(disabled.status, 404);
  database.close();
});

test("message audit requires safety_admin and records access purpose", async () => {
  const database = new TestD1();
  const admin = await member(database, "safety-admin");
  await member(database, "message-a");
  await member(database, "message-b");
  const now = unixTime();
  await database.prepare("INSERT INTO moderation_roles(user_id,role,created_at) VALUES ('safety-admin','safety_admin',?)").bind(now).run();
  await database.prepare("INSERT INTO social_messages(id,sender_user_id,receiver_user_id,body,created_at) VALUES ('message-1','message-a','message-b','audit me',?)").bind(now).run();
  const runtime = { ...environment(database), SOCIAL_APP_ENABLED: "true", MODERATION_TOOLS_ENABLED: "true" };
  const response = await onRequest({ env: runtime, request: request("/api/social/moderation/messages", admin, { purpose: "Review content for an active abuse report" }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).messages[0].body, "audit me");
  assert.equal((await database.prepare("SELECT action FROM moderation_audit_events").first()).action, "message_audit_view");
  database.close();
});

test('safety reviewer can inspect purpose audit history without exposed actor/session identifiers',async()=>{
 const db=new TestD1(),session=await member(db,'audit-reader'),now=unixTime();try{
  await db.prepare("INSERT INTO moderation_access_grants(id,user_id,role,grant_reason,granted_at,expires_at)VALUES('audit-role','audit-reader','safety_admin','Approved local audit review fixture',?,?)").bind(now,now+3600).run();
  const env={...environment(db),SOCIAL_APP_ENABLED:'true',MODERATION_TOOLS_ENABLED:'true'};
  await onRequest({env,request:request('/api/social/moderation/overview',session)});
  const response=await onRequest({env,request:request('/api/social/moderation/audit',session)});assert.equal(response.status,200);const data=await response.json();assert.ok(data.accessEvents.some(e=>e.purpose==='routine_admin_dashboard_access'));assert.ok(data.accessEvents.every(e=>!('actor_user_id'in e)&&!('token_hash'in e)));
 }finally{db.close();}
});

test('safety_admin cannot view or classify identity evidence even with an accidental safety-review row',async()=>{
 const db=new TestD1(),admin=await member(db,'boundary-admin');await member(db,'evidence-owner');const now=unixTime();try{
  await db.prepare("INSERT INTO moderation_roles(user_id,role,created_at)VALUES('boundary-admin','safety_admin',?)").bind(now).run();
  await db.prepare("INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,created_at)VALUES('proof-id','evidence-owner','verification/private-local-proof','verification_id','image/png',4,?)").bind(now).run();
  await db.prepare("INSERT INTO media_safety_reviews(media_id,status,source,created_at)VALUES('proof-id','pending','manual',?)").bind(now).run();
  const media=new TestR2();media.objects.set('verification/private-local-proof',new Uint8Array([1,2,3,4]));const env={...environment(db),SOCIAL_APP_ENABLED:'true',MODERATION_TOOLS_ENABLED:'true',MEDIA:media};
  const object=await onRequest({env,request:request('/api/social/moderation/media/proof-id',admin)});assert.equal(object.status,404);
  const queue=await(await onRequest({env,request:request('/api/social/moderation/media',admin)})).json();assert.equal(queue.media.length,0);
  const decision=await onRequest({env,request:request('/api/social/moderation/media',admin,{method:'POST',body:{id:'proof-id',status:'released',category:'general',reason:'Must not classify identity evidence',revision:0}})});assert.equal(decision.status,404);
  await db.prepare("INSERT INTO media_appeals(id,media_id,appellant_user_id,reason,created_at)VALUES('proof-appeal','proof-id','evidence-owner','Accidental identity appeal must stay separate',?)").bind(now).run();
  const appeals=await(await onRequest({env,request:request('/api/social/moderation/appeals',admin)})).json();assert.equal(appeals.appeals.length,0);
  const appealDecision=await onRequest({env,request:request('/api/social/moderation/appeals',admin,{method:'POST',body:{id:'proof-appeal',decision:'granted',category:'general',reason:'Must not grant an identity evidence appeal',revision:0}})});assert.equal(appealDecision.status,404);
 }finally{db.close();}
});

test("message media audit is role-gated, private, purpose-logged, and hides unsent media", async () => {
  const database = new TestD1();
  const media = new TestR2();
  const admin = await member(database, "media-admin");
  const reviewer = await member(database, "media-reviewer");
  await member(database, "media-sender");
  await member(database, "media-recipient");
  const now = unixTime();
  await database.prepare("INSERT INTO moderation_roles(user_id,role,created_at) VALUES ('media-admin','safety_admin',?)").bind(now).run();
  await database.prepare("INSERT INTO moderation_roles(user_id,role,created_at) VALUES ('media-reviewer','report_reviewer',?)").bind(now).run();
  await database.prepare(`INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,created_at) VALUES ('audit-media','media-sender','chat/audit','chat','image/png',4,?)`).bind(now).run();
  await database.prepare(`INSERT INTO social_messages(id,sender_user_id,receiver_user_id,body,media_id,created_at) VALUES ('audit-message','media-sender','media-recipient','','audit-media',?)`).bind(now).run();
  media.objects.set("chat/audit", new Uint8Array([1, 2, 3, 4]));
  const runtime = { ...environment(database), MEDIA: media, SOCIAL_APP_ENABLED: "true", MODERATION_TOOLS_ENABLED: "true" };

  const forbidden = await onRequest({ env: runtime, request: request("/api/social/moderation/messages/media/audit-media", reviewer) });
  assert.equal(forbidden.status, 403);
  const allowed = await onRequest({ env: runtime, request: request("/api/social/moderation/messages/media/audit-media", admin, { purpose: "Inspect image attached to abuse report" }) });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(allowed.headers.get("x-content-type-options"), "nosniff");
  const audit = await database.prepare("SELECT action,subject_id,purpose FROM moderation_audit_events").first();
  assert.deepEqual({ ...audit }, { action: "message_audit_view", subject_id: "audit-message", purpose: "Inspect image attached to abuse report" });

  await database.prepare("UPDATE social_messages SET unsent_at=? WHERE id='audit-message'").bind(now).run();
  const hidden = await onRequest({ env: runtime, request: request("/api/social/moderation/messages/media/audit-media", admin) });
  assert.equal(hidden.status, 404);
  database.close();
});

test("moderation purpose safely decodes non-Latin text for the audit trail", async () => {
  const database = new TestD1();
  const reviewer = await member(database, "thai-reviewer");
  await member(database, "thai-reporter");
  await member(database, "thai-subject");
  const now = unixTime();
  await database.prepare("INSERT INTO moderation_roles(user_id,role,created_at) VALUES ('thai-reviewer','report_reviewer',?)").bind(now).run();
  await database.prepare("INSERT INTO social_reports(id,reporter_user_id,subject_user_id,category,details,created_at) VALUES ('thai-report','thai-reporter','thai-subject','spam','รายละเอียด',?)").bind(now).run();
  const runtime = { ...environment(database), SOCIAL_APP_ENABLED: "true", MODERATION_TOOLS_ENABLED: "true" };
  const thaiPurpose = "ตรวจสอบรายงานความปลอดภัยหมายเลขหนึ่ง";
  const response = await onRequest({ env: runtime, request: request("/api/social/moderation/reports", reviewer, { purpose: encodeURIComponent(thaiPurpose) }) });
  assert.equal(response.status, 200);
  assert.equal((await database.prepare("SELECT purpose FROM moderation_audit_events").first()).purpose, thaiPurpose);
  database.close();
});

test("media quarantine hides pending objects and requires an audited safety-admin release", async () => {
  const database = new TestD1();
  const media = new TestR2();
  const admin = await member(database, "quarantine-admin");
  const ownerSession = await member(database, "quarantine-owner");
  const now = unixTime();
  await database.prepare("INSERT INTO moderation_roles(user_id,role,created_at) VALUES ('quarantine-admin','safety_admin',?)").bind(now).run();
  await database.prepare(`INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,created_at) VALUES ('quarantine-media','quarantine-owner','gallery/quarantine','gallery','image/png',4,?)`).bind(now).run();
  await database.prepare("INSERT INTO profile_photos(media_id,owner_user_id,created_at) VALUES ('quarantine-media','quarantine-owner',?)").bind(now).run();
  await database.prepare("INSERT INTO media_safety_reviews(media_id,status,source,created_at) VALUES ('quarantine-media','pending','manual',?)").bind(now).run();
  media.objects.set("gallery/quarantine", new Uint8Array([1, 2, 3, 4]));
  const runtime = { ...environment(database), MEDIA: media, SOCIAL_APP_ENABLED: "true", PUBLIC_DISCOVERY_ENABLED: "false", MEDIA_QUARANTINE_ENABLED: "true", MODERATION_TOOLS_ENABLED: "true" };

  const hidden = await onRequest({ env: runtime, request: request("/api/social/media/quarantine-media", ownerSession) });
  assert.equal(hidden.status, 404);
  const queue = await onRequest({ env: runtime, request: request("/api/social/moderation/media", admin) });
  assert.equal(queue.status, 200);
  assert.equal((await queue.json()).media[0].media_id, "quarantine-media");
  const object = await onRequest({ env: runtime, request: request("/api/social/moderation/media/quarantine-media", admin) });
  assert.equal(object.status, 200);
  const released = await onRequest({ env: runtime, request: request("/api/social/moderation/media", admin, {
    method: "POST", body: { id: "quarantine-media", status: "released", category: "general", reason: "ผ่านการตรวจสอบสำหรับการทดสอบ", revision: 0 },
  }) });
  assert.equal(released.status, 200);
  assert.equal((await database.prepare("SELECT status FROM media_safety_reviews WHERE media_id='quarantine-media'").first()).status, "released");
  const visible = await onRequest({ env: runtime, request: request("/api/social/media/quarantine-media", ownerSession) });
  assert.equal(visible.status, 200);
  const duplicate = await onRequest({ env: runtime, request: request("/api/social/moderation/media", admin, {
    method: "POST", body: { id: "quarantine-media", status: "rejected", category: "prohibited", reason: "ต้องไม่เขียนทับผลเดิม", revision: 0 },
  }) });
  assert.equal(duplicate.status, 409);
  const audits = await database.prepare("SELECT action FROM media_safety_audit_events ORDER BY created_at,action").all();
  assert.deepEqual(audits.results.map((row) => row.action).sort(), ["decision", "object_view", "queue_view"]);
  database.close();
});

test("role administration is separated, recent-authenticated, audited, and revocable", async () => {
  const database = new TestD1();
  const accessAdmin = await member(database, "access-admin");
  const reviewer = await member(database, "new-reviewer");
  const ordinary = await member(database, "ordinary-member");
  const now = unixTime();
  await database.prepare(`
    INSERT INTO moderation_access_grants(id,user_id,role,grant_reason,granted_at,expires_at)
    VALUES ('bootstrap-admin','access-admin','moderation_admin','Owner-approved staging bootstrap',?,?)
  `).bind(now, now + 86400).run();
  const runtime = { ...environment(database), SOCIAL_APP_ENABLED: "true", MODERATION_TOOLS_ENABLED: "true" };

  const ordinaryDenied = await onRequest({ env: runtime, request: request("/api/social/moderation/roles", ordinary, {
    method: "POST",
    body: { action: "grant", userId: "ordinary-member", role: "safety_admin", reason: "Attempted unauthorized privilege escalation", expiresAt: now + 86400 },
  }) });
  assert.equal(ordinaryDenied.status, 403);

  const inspect = await onRequest({ env: runtime, request: request("/api/social/moderation/roles", accessAdmin, {
    purpose: "Review current least privilege assignments",
  }) });
  assert.equal(inspect.status, 200);
  assert.ok((await inspect.json()).grants.some((grant) => grant.role === "moderation_admin"));
  const adminCannotReviewMedia = await onRequest({ env: runtime, request: request("/api/social/moderation/media", accessAdmin) });
  assert.equal(adminCannotReviewMedia.status, 403, "role administrators do not automatically receive private-media access");

  const selfGrant = await onRequest({ env: runtime, request: request("/api/social/moderation/roles", accessAdmin, {
    method: "POST",
    purpose: "Attempt an unauthorized self privilege change",
    body: { action: "grant", userId: "access-admin", role: "report_reviewer", reason: "Self grant must be rejected", expiresAt: now + 86400 },
  }) });
  assert.equal(selfGrant.status, 403);

  const granted = await onRequest({ env: runtime, request: request("/api/social/moderation/roles", accessAdmin, {
    method: "POST",
    purpose: "Provision a reviewer for a synthetic staging drill",
    body: { action: "grant", userId: "new-reviewer", role: "report_reviewer", reason: "Owner-approved staging drill assignment", expiresAt: now + 86400 },
  }) });
  assert.equal(granted.status, 201);
  const grantId = (await granted.json()).grantId;

  const reviewerQueue = await onRequest({ env: runtime, request: request("/api/social/moderation/reports", reviewer) });
  assert.equal(reviewerQueue.status, 200);
  const privateMediaDenied = await onRequest({ env: runtime, request: request("/api/social/moderation/media", reviewer) });
  assert.equal(privateMediaDenied.status, 403, "report reviewers cannot inspect private media");

  const revoked = await onRequest({ env: runtime, request: request("/api/social/moderation/roles", accessAdmin, {
    method: "POST",
    purpose: "End the reviewer staging drill assignment",
    body: { action: "revoke", grantId, reason: "Staging drill completed and access is no longer needed" },
  }) });
  assert.equal(revoked.status, 200);
  const deniedAfterRevoke = await onRequest({ env: runtime, request: request("/api/social/moderation/reports", reviewer) });
  assert.equal(deniedAfterRevoke.status, 403);
  const events = await database.prepare("SELECT action FROM moderation_role_events ORDER BY created_at,id").all();
  assert.deepEqual(events.results.map((event) => event.action).sort(), ["grant", "inspect", "revoke"]);

  await database.prepare("UPDATE session_auth_evidence SET authenticated_at=? WHERE user_id='access-admin'").bind(now - 1000).run();
  const staleSession = await onRequest({ env: runtime, request: request("/api/social/moderation/roles", accessAdmin) });
  assert.equal(staleSession.status, 403);
  assert.equal((await staleSession.json()).code, "recent_authentication_required");
  database.close();
});
