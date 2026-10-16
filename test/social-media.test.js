import assert from "node:assert/strict";
import test from "node:test";
import { issueSession, unixTime } from "../functions/_lib/db.js";
import { onRequest } from "../functions/api/social/[[path]].js";
import { environment, TestD1 } from "./helpers/d1.js";

class TestR2 {
  constructor() { this.objects = new Map(); }
  async put(key, value, options) { this.objects.set(key, { value: new Uint8Array(value), options }); }
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
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  form.set("file", new File([png], "photo.png", { type: "image/png" }));
  form.set("caption", "ภาพทดสอบ");
  const upload = await onRequest({
    env: runtime,
    request: new Request("https://chatgun.pages.dev/api/social/gallery", { method: "POST", headers: authHeaders(owner), body: form }),
  });
  assert.equal(upload.status, 201);
  const { id } = await upload.json();
  const stored = await database.prepare("SELECT object_key, state FROM social_media WHERE id = ?").bind(id).first();
  assert.equal(stored.state, "active");
  assert.equal(media.objects.size, 1);

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
    request: new Request("https://chatgun.pages.dev/api/social/gallery", { method: "POST", headers: authHeaders(owner), body: form }),
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
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  for (let index = 0; index < 6; index += 1) {
    const form = new FormData();
    form.set("target", "chat-media-b");
    form.set("file", new File([png], `${index}.png`, { type: "image/png" }));
    const response = await onRequest({ env: runtime, request: new Request("https://chatgun.pages.dev/api/social/messages", { method: "POST", headers: authHeaders(sender), body: form }) });
    assert.equal(response.status, 201);
  }
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
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const form = new FormData();
  form.set("target", "reuse-recipient");
  form.set("file", new File([png], "shared.png", { type: "image/png" }));
  const upload = await onRequest({ env: runtime, request: new Request("https://chatgun.pages.dev/api/social/messages", { method: "POST", headers: authHeaders(owner), body: form }) });
  assert.equal(upload.status, 201);
  const asset = await database.prepare("SELECT id FROM social_media WHERE owner_user_id='reuse-owner'").first();

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
