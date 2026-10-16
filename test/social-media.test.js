import assert from "node:assert/strict";
import test from "node:test";
import { issueSession, unixTime } from "../functions/_lib/db.js";
import { bangkokUploadWindow, onRequest } from "../functions/api/social/[[path]].js";
import { environment, TestD1 } from "./helpers/d1.js";
import { ONE_PIXEL_PNG } from "./helpers/image.js";

class TestR2 {
  constructor() { this.objects = new Map(); this.failNextPut = false; }
  async put(key, value, options) {
    if (this.failNextPut) { this.failNextPut = false; throw new Error("synthetic_r2_failure"); }
    this.objects.set(key, { value: new Uint8Array(value), options });
  }
  async get(key) {
    const object = this.objects.get(key);
    return object ? { body: object.value } : null;
  }
  async delete(key) { this.objects.delete(key); }
}

async function member(database, id, name) {
  const now = unixTime();
  await database.prepare("INSERT INTO users(id, display_name, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)")
    .bind(id, name, now, now).run();
  const session = await issueSession(database, id, now);
  const assurance = `${id}-adult`;
  await database.prepare("INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at) VALUES (?,?,'adult_18_plus','self_declaration','v1',?)")
    .bind(assurance, id, now).run();
  await database.prepare("INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at) VALUES (?,?,?,?,?)")
    .bind(id, assurance, name, now, now).run();
  return session;
}

function env(database, media) {
  return {
    ...environment(database), MEDIA: media,
    SOCIAL_APP_ENABLED: "true", MEDIA_UPLOAD_ENABLED: "true", PUBLIC_DISCOVERY_ENABLED: "true",
  };
}

function authHeaders(session) {
  return {
    cookie: `__Host-cg_session=${encodeURIComponent(session.token)}; __Host-cg_csrf=${encodeURIComponent(session.csrf)}`,
    origin: "https://chatgun.pages.dev",
    "x-csrf-token": session.csrf,
  };
}

let uploadSequence = 0;
function uploadHeaders(session, key = `test-upload-${String(++uploadSequence).padStart(8, "0")}`) {
  return { ...authHeaders(session), "idempotency-key": key };
}

function imageForm({ target, caption } = {}) {
  const form = new FormData();
  if (target) form.set("target", target);
  if (caption) form.set("caption", caption);
  form.set("file", new File([ONE_PIXEL_PNG], "photo.png", { type: "image/png" }));
  return form;
}

async function mediaUpload(runtime, path, session, form, key) {
  return onRequest({
    env: runtime,
    request: new Request(`https://chatgun.pages.dev${path}`, {
      method: "POST", headers: uploadHeaders(session, key), body: form,
    }),
  });
}

async function jsonCall(runtime, path, session, body) {
  return onRequest({
    env: runtime,
    request: new Request(`https://chatgun.pages.dev${path}`, {
      method: "POST", headers: { ...authHeaders(session), "content-type": "application/json" }, body: JSON.stringify(body),
    }),
  });
}

test("gallery validates bytes, stores private media, authorizes reads, and queues deletion", async () => {
  const database = new TestD1();
  const media = new TestR2();
  const runtime = env(database, media);
  const owner = await member(database, "media-owner", "เจ้าของ");
  const friend = await member(database, "media-friend", "เพื่อน");
  const stranger = await member(database, "media-stranger", "คนอื่น");
  await database.prepare(`INSERT INTO social_relationships(id,user_low,user_high,requested_by,status,created_at,updated_at) VALUES ('rel','media-friend','media-owner','media-owner','accepted',1,1)`).run();

  const form = new FormData();
  const png = ONE_PIXEL_PNG;
  form.set("file", new File([png], "photo.png", { type: "image/png" }));
  form.set("caption", "ภาพทดสอบ");
  const upload = await onRequest({
    env: runtime,
    request: new Request("https://chatgun.pages.dev/api/social/gallery", { method: "POST", headers: uploadHeaders(owner), body: form }),
  });
  assert.equal(upload.status, 201);
  const { id } = await upload.json();
  const stored = await database.prepare("SELECT object_key, state FROM social_media WHERE id = ?").bind(id).first();
  assert.equal(stored.state, "active");
  assert.equal(media.objects.size, 1);

  const pendingRead = await onRequest({ env: runtime, request: new Request(`https://chatgun.pages.dev/api/social/media/${id}`, { headers: { cookie: authHeaders(owner).cookie } }) });
  assert.equal(pendingRead.status, 404, "even the owner cannot retrieve media before review");
  await database.prepare("UPDATE media_safety_reviews SET status='released',category='general',reviewed_at=? WHERE media_id=?")
    .bind(unixTime(), id).run();

  const friendRead = await onRequest({ env: runtime, request: new Request(`https://chatgun.pages.dev/api/social/media/${id}`, { headers: { cookie: authHeaders(friend).cookie } }) });
  assert.equal(friendRead.status, 200);
  assert.equal(friendRead.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(friendRead.headers.get("x-content-type-options"), "nosniff");
  const strangerRead = await onRequest({ env: runtime, request: new Request(`https://chatgun.pages.dev/api/social/media/${id}`, { headers: { cookie: authHeaders(stranger).cookie } }) });
  assert.equal(strangerRead.status, 404);
  const comment = await jsonCall(runtime, "/api/social/gallery", friend, { action: "comment", id, comment: "เห็นเฉพาะเพื่อนและเจ้าของ" });
  assert.equal(comment.status, 200);
  await database.prepare("UPDATE member_profiles SET discovery_visible=1,latitude=13.7563,longitude=100.5018,accuracy=10,located_at=? WHERE user_id='media-owner'").bind(unixTime()).run();
  const publicGallery = await onRequest({ env: runtime, request: new Request(`https://chatgun.pages.dev/api/social/gallery?user=media-owner&photo=${id}`, { headers: { cookie: authHeaders(stranger).cookie } }) });
  assert.equal(publicGallery.status, 200);
  assert.deepEqual((await publicGallery.json()).comments, [], "public discovery viewers never receive comment bodies");

  const removed = await jsonCall(runtime, "/api/social/gallery", owner, { action: "delete", id });
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).mediaDeletionPending, true);
  assert.equal((await database.prepare("SELECT state FROM social_media WHERE id = ?").bind(id).first()).state, "pending_deletion");
  assert.equal((await database.prepare("SELECT COUNT(*) count FROM media_deletion_queue").first()).count, 1);
  assert.equal(media.objects.size, 1, "binary remains only until the deletion worker completes");
  database.close();
});

test("gallery rejects MIME spoofing and leaves no R2 object or D1 row", async () => {
  const database = new TestD1();
  const media = new TestR2();
  const runtime = env(database, media);
  const owner = await member(database, "spoof-owner", "เจ้าของ");
  const form = new FormData();
  form.set("file", new File([new Uint8Array(16)], "fake.png", { type: "image/png" }));
  const response = await onRequest({
    env: runtime,
    request: new Request("https://chatgun.pages.dev/api/social/gallery", { method: "POST", headers: uploadHeaders(owner), body: form }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "invalid_image");
  assert.equal(media.objects.size, 0);
  assert.equal((await database.prepare("SELECT COUNT(*) count FROM social_media").first()).count, 0);
  database.close();
});

test("chat images require friendship, remain private, and retain only five active sender assets", async () => {
  const database = new TestD1();
  const media = new TestR2();
  const runtime = { ...env(database, media), MESSAGING_ENABLED: "true" };
  const sender = await member(database, "chat-media-a", "ผู้ส่ง");
  const recipient = await member(database, "chat-media-b", "ผู้รับ");
  const stranger = await member(database, "chat-media-c", "คนอื่น");
  await database.prepare(`INSERT INTO social_relationships(id,user_low,user_high,requested_by,status,created_at,updated_at) VALUES ('chat-rel','chat-media-a','chat-media-b','chat-media-a','accepted',1,1)`).run();
  const png = ONE_PIXEL_PNG;
  for (let index = 0; index < 6; index += 1) {
    const form = new FormData();
    form.set("target", "chat-media-b");
    form.set("file", new File([png], `${index}.png`, { type: "image/png" }));
    const response = await onRequest({ env: runtime, request: new Request("https://chatgun.pages.dev/api/social/messages", { method: "POST", headers: uploadHeaders(sender), body: form }) });
    assert.equal(response.status, 201);
  }
  await database.prepare("UPDATE media_safety_reviews SET status='released',category='general',reviewed_at=? WHERE status='pending'").bind(unixTime()).run();
  assert.equal((await database.prepare("SELECT COUNT(*) count FROM social_media WHERE owner_user_id='chat-media-a' AND state='active'").first()).count, 5);
  assert.equal((await database.prepare("SELECT COUNT(*) count FROM media_deletion_queue").first()).count, 1);
  const latest = await database.prepare("SELECT id media_id FROM social_media WHERE owner_user_id='chat-media-a' AND state='active' LIMIT 1").first();
  const allowed = await onRequest({ env: runtime, request: new Request(`https://chatgun.pages.dev/api/social/chat/media/${latest.media_id}`, { headers: { cookie: authHeaders(recipient).cookie } }) });
  assert.equal(allowed.status, 200);
  const denied = await onRequest({ env: runtime, request: new Request(`https://chatgun.pages.dev/api/social/chat/media/${latest.media_id}`, { headers: { cookie: authHeaders(stranger).cookie } }) });
  assert.equal(denied.status, 404);
  database.close();
});

test("received chat images can be reused only while an accepted unblocked relationship grants access", async () => {
  const database = new TestD1();
  const media = new TestR2();
  const runtime = { ...env(database, media), MESSAGING_ENABLED: "true" };
  const owner = await member(database, "reuse-owner", "เจ้าของรูป");
  const recipient = await member(database, "reuse-recipient", "ผู้รับรูป");
  const nextFriend = await member(database, "reuse-friend", "เพื่อนอีกคน");
  const outsider = await member(database, "reuse-outsider", "บุคคลอื่น");
  await database.prepare(`INSERT INTO social_relationships(id,user_low,user_high,requested_by,status,created_at,updated_at) VALUES ('reuse-original','reuse-owner','reuse-recipient','reuse-owner','accepted',1,1)`).run();
  await database.prepare(`INSERT INTO social_relationships(id,user_low,user_high,requested_by,status,created_at,updated_at) VALUES ('reuse-next','reuse-friend','reuse-recipient','reuse-recipient','accepted',1,1)`).run();
  const png = ONE_PIXEL_PNG;
  const form = new FormData();
  form.set("target", "reuse-recipient");
  form.set("file", new File([png], "shared.png", { type: "image/png" }));
  const upload = await onRequest({ env: runtime, request: new Request("https://chatgun.pages.dev/api/social/messages", { method: "POST", headers: uploadHeaders(owner), body: form }) });
  assert.equal(upload.status, 201);
  const asset = await database.prepare("SELECT id FROM social_media WHERE owner_user_id='reuse-owner'").first();
  await database.prepare("UPDATE media_safety_reviews SET status='released',category='general',reviewed_at=? WHERE media_id=?").bind(unixTime(), asset.id).run();

  const library = await onRequest({ env: runtime, request: new Request("https://chatgun.pages.dev/api/social/chat-assets", { headers: { cookie: authHeaders(recipient).cookie } }) });
  assert.deepEqual((await library.json()).assets.map((item) => item.id), [asset.id]);
  const privateRead = await onRequest({ env: runtime, request: new Request(`https://chatgun.pages.dev/api/social/chat/media/${asset.id}`, { headers: { cookie: authHeaders(recipient).cookie } }) });
  assert.equal(privateRead.status, 200);

  await database.prepare("DELETE FROM social_relationships WHERE id='reuse-original'").run();
  const revokedLibrary = await onRequest({ env: runtime, request: new Request("https://chatgun.pages.dev/api/social/chat-assets", { headers: { cookie: authHeaders(recipient).cookie } }) });
  assert.deepEqual((await revokedLibrary.json()).assets, []);
  const revokedReuse = await jsonCall(runtime, "/api/social/messages", recipient, { action: "send", target: "reuse-friend", mediaId: asset.id, body: "" });
  assert.equal(revokedReuse.status, 404);
  const ownerLibrary = await onRequest({ env: runtime, request: new Request("https://chatgun.pages.dev/api/social/chat-assets", { headers: { cookie: authHeaders(owner).cookie } }) });
  assert.deepEqual((await ownerLibrary.json()).assets.map((item) => item.id), [asset.id]);

  await database.prepare(`INSERT INTO social_relationships(id,user_low,user_high,requested_by,status,created_at,updated_at) VALUES ('reuse-restored','reuse-owner','reuse-recipient','reuse-owner','accepted',2,2)`).run();
  const forwarded = await jsonCall(runtime, "/api/social/messages", recipient, { action: "send", target: "reuse-friend", mediaId: asset.id, body: "" });
  assert.equal(forwarded.status, 200);
  const forwardedRead = await onRequest({ env: runtime, request: new Request(`https://chatgun.pages.dev/api/social/chat/media/${asset.id}`, { headers: { cookie: authHeaders(nextFriend).cookie } }) });
  assert.equal(forwardedRead.status, 200);
  const denied = await onRequest({ env: runtime, request: new Request(`https://chatgun.pages.dev/api/social/chat/media/${asset.id}`, { headers: { cookie: authHeaders(outsider).cookie } }) });
  assert.equal(denied.status, 404);
  database.close();
});

test("daily gallery quota allows ten, rejects eleven, and deletion or rejection does not restore it", async () => {
  const database = new TestD1();
  const media = new TestR2();
  const runtime = env(database, media);
  const owner = await member(database, "gallery-quota-owner", "เจ้าของโควตา");
  const ids = [];
  for (let index = 0; index < 10; index += 1) {
    const response = await mediaUpload(runtime, "/api/social/gallery", owner, imageForm(), `gallery-quota-${index.toString().padStart(3, "0")}`);
    assert.equal(response.status, 201, `gallery upload ${index + 1} should succeed`);
    ids.push((await response.json()).id);
  }
  await database.prepare("UPDATE media_safety_reviews SET status='rejected',category='prohibited',reviewed_at=? WHERE media_id=?")
    .bind(unixTime(), ids[0]).run();
  const removed = await jsonCall(runtime, "/api/social/gallery", owner, { action: "delete", id: ids[1] });
  assert.equal(removed.status, 200);
  const eleventh = await mediaUpload(runtime, "/api/social/gallery", owner, imageForm(), "gallery-quota-011");
  assert.equal(eleventh.status, 429);
  assert.equal((await eleventh.json()).code, "daily_upload_limit_reached");
  const quota = await onRequest({ env: runtime, request: new Request("https://chatgun.pages.dev/api/social/upload-quotas", { headers: { cookie: authHeaders(owner).cookie } }) });
  assert.equal(quota.status, 200);
  const payload = await quota.json();
  assert.deepEqual(payload.gallery, { limit: 10, used: 10, reserved: 0, remaining: 0 });
  assert.equal(payload.chat.remaining, 10);
  database.close();
});

test("chat and gallery quotas are independent and concurrent chat uploads cannot exceed ten", async () => {
  const database = new TestD1();
  const media = new TestR2();
  const runtime = { ...env(database, media), MESSAGING_ENABLED: "true" };
  const sender = await member(database, "parallel-quota-a", "ผู้ส่ง");
  await member(database, "parallel-quota-b", "ผู้รับ");
  await database.prepare(`INSERT INTO social_relationships(id,user_low,user_high,requested_by,status,created_at,updated_at) VALUES ('parallel-rel','parallel-quota-a','parallel-quota-b','parallel-quota-a','accepted',1,1)`).run();
  const responses = await Promise.all(Array.from({ length: 11 }, (_, index) => mediaUpload(
    runtime,
    "/api/social/messages",
    sender,
    imageForm({ target: "parallel-quota-b" }),
    `parallel-chat-${index.toString().padStart(3, "0")}`,
  )));
  assert.equal(responses.filter((response) => response.status === 201).length, 10);
  assert.equal(responses.filter((response) => response.status === 429).length, 1);
  const gallery = await mediaUpload(runtime, "/api/social/gallery", sender, imageForm(), "parallel-gallery-001");
  assert.equal(gallery.status, 201, "gallery quota remains independent after chat reaches its limit");
  const completed = await database.prepare(`
    SELECT category, COUNT(*) count FROM media_upload_quota_attempts
    WHERE user_id = ? AND status = 'completed' GROUP BY category ORDER BY category
  `).bind("parallel-quota-a").all();
  assert.deepEqual(completed.results.map((row) => ({ ...row })), [{ category: "chat", count: 10 }, { category: "gallery", count: 1 }]);
  database.close();
});

test("failed media storage releases a reservation and an idempotent retry is counted once", async () => {
  const database = new TestD1();
  const media = new TestR2();
  const runtime = env(database, media);
  const owner = await member(database, "retry-quota-owner", "ผู้ลองใหม่");
  const key = "retry-gallery-key-0001";
  media.failNextPut = true;
  const failed = await mediaUpload(runtime, "/api/social/gallery", owner, imageForm(), key);
  assert.equal(failed.status, 500);
  assert.equal((await database.prepare("SELECT status FROM media_upload_quota_attempts WHERE user_id=?").bind("retry-quota-owner").first()).status, "released");
  const succeeded = await mediaUpload(runtime, "/api/social/gallery", owner, imageForm(), key);
  assert.equal(succeeded.status, 201);
  const first = await succeeded.json();
  const replay = await mediaUpload(runtime, "/api/social/gallery", owner, imageForm(), key);
  assert.equal(replay.status, 201);
  assert.deepEqual(await replay.json(), { id: first.id, reviewStatus: "pending", idempotentReplay: true });
  assert.equal((await database.prepare("SELECT COUNT(*) count FROM social_media WHERE owner_user_id=?").bind("retry-quota-owner").first()).count, 1);
  assert.equal((await database.prepare("SELECT COUNT(*) count FROM media_upload_quota_attempts WHERE user_id=? AND status='completed'").bind("retry-quota-owner").first()).count, 1);
  database.close();
});

test("upload API requires idempotency and deleting an account cascades quota records", async () => {
  const database = new TestD1();
  const media = new TestR2();
  const runtime = env(database, media);
  const owner = await member(database, "direct-quota-owner", "ผู้ใช้ API");
  const missingKey = await onRequest({
    env: runtime,
    request: new Request("https://chatgun.pages.dev/api/social/gallery", { method: "POST", headers: authHeaders(owner), body: imageForm() }),
  });
  assert.equal(missingKey.status, 400);
  assert.equal((await missingKey.json()).code, "invalid_idempotency_key");
  assert.equal((await mediaUpload(runtime, "/api/social/gallery", owner, imageForm(), "direct-gallery-key-01")).status, 201);
  await database.prepare("DELETE FROM users WHERE id=?").bind("direct-quota-owner").run();
  assert.equal((await database.prepare("SELECT COUNT(*) count FROM media_upload_quota_attempts WHERE user_id=?").bind("direct-quota-owner").first()).count, 0);
  database.close();
});

test("Bangkok upload window resets exactly at local midnight", () => {
  const before = bangkokUploadWindow(Date.parse("2026-10-16T16:59:59.999Z"));
  const after = bangkokUploadWindow(Date.parse("2026-10-16T17:00:00.000Z"));
  assert.equal(before.localDay, "2026-10-16");
  assert.equal(before.resetsAt, Date.parse("2026-10-16T17:00:00.000Z") / 1000);
  assert.equal(after.localDay, "2026-10-17");
  assert.equal(after.resetsAt, Date.parse("2026-10-17T17:00:00.000Z") / 1000);
});

test("completed uploads from the previous Bangkok day do not consume today's quota", async () => {
  const database = new TestD1();
  const media = new TestR2();
  const runtime = env(database, media);
  const owner = await member(database, "midnight-quota-owner", "ผู้ใช้ข้ามวัน");
  const timestamp = unixTime();
  const yesterday = bangkokUploadWindow((timestamp - 24 * 60 * 60) * 1000).localDay;
  for (let index = 0; index < 10; index += 1) {
    await database.prepare(`
      INSERT INTO media_upload_quota_attempts(
        user_id,category,idempotency_key,local_day,status,result_id,reserved_at,completed_at
      ) VALUES (?,'gallery',?,?,'completed',?,?,?)
    `).bind("midnight-quota-owner", `prior-day-key-${index.toString().padStart(3, "0")}`, yesterday, `prior-result-${index}`, timestamp - 86400, timestamp - 86400).run();
  }
  const response = await mediaUpload(runtime, "/api/social/gallery", owner, imageForm(), "new-bangkok-day-key-01");
  assert.equal(response.status, 201);
  const quota = await onRequest({ env: runtime, request: new Request("https://chatgun.pages.dev/api/social/upload-quotas", { headers: { cookie: authHeaders(owner).cookie } }) });
  assert.equal((await quota.json()).gallery.used, 1);
  database.close();
});
