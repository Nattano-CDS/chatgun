import assert from "node:assert/strict";
import test from "node:test";
import { issueSession, unixTime } from "../functions/_lib/db.js";
import { onRequest } from "../functions/api/social/[[path]].js";
import { environment, TestD1 } from "./helpers/d1.js";
import { ONE_PIXEL_PNG } from "./helpers/image.js";

class TestR2 {
  constructor() { this.objects = new Map(); }
  async put(key, bytes) { this.objects.set(key, new Uint8Array(bytes)); }
  async get(key) { return this.objects.has(key) ? { body: this.objects.get(key) } : null; }
  async delete(key) { this.objects.delete(key); }
}

async function member(database, id) {
  const now = unixTime();
  await database.prepare("INSERT INTO users(id,display_name,status,created_at,updated_at) VALUES (?,?,'active',?,?)").bind(id, id, now, now).run();
  const session = await issueSession(database, id, now);
  await database.prepare("INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at) VALUES (?,?,'adult_18_plus','self_declaration','v1',?)").bind(`${id}-age`, id, now).run();
  await database.prepare("INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at) VALUES (?,?,?,?,?)").bind(id, `${id}-age`, id, now, now).run();
  return session;
}

function headers(session, { moderator = false } = {}) {
  return {
    cookie: `__Host-cg_session=${encodeURIComponent(session.token)}; __Host-cg_csrf=${encodeURIComponent(session.csrf)}`,
    origin: "https://chatgun.pages.dev",
    "x-csrf-token": session.csrf,
    ...(moderator ? { "x-moderation-purpose": "Review identity evidence requested by this member" } : {}),
  };
}

test("verification evidence is private, reviewed by role, and queued for deletion after decision", async () => {
  const database = new TestD1();
  const media = new TestR2();
  const applicant = await member(database, "verify-applicant");
  const reviewer = await member(database, "verify-reviewer");
  const now = unixTime();
  await database.prepare("INSERT INTO moderation_roles(user_id,role,created_at) VALUES ('verify-reviewer','identity_reviewer',?)").bind(now).run();
  const runtime = { ...environment(database), MEDIA: media, SOCIAL_APP_ENABLED: "true", IDENTITY_VERIFICATION_ENABLED: "true", MODERATION_TOOLS_ENABLED: "true" };
  const png = ONE_PIXEL_PNG;
  const form = new FormData();
  form.set("identity", new File([png], "identity.png", { type: "image/png" }));
  form.set("selfie", new File([png], "selfie.png", { type: "image/png" }));
  form.set("consent", "accepted");
  const submitted = await onRequest({ env: runtime, request: new Request("https://chatgun.pages.dev/api/social/verification", { method: "POST", headers: headers(applicant), body: form }) });
  assert.equal(submitted.status, 201);
  assert.equal(media.objects.size, 2);

  const queue = await onRequest({ env: runtime, request: new Request("https://chatgun.pages.dev/api/social/moderation/verification", { headers: headers(reviewer, { moderator: true }) }) });
  assert.equal(queue.status, 200);
  const pending = (await queue.json()).requests[0];
  assert.equal(pending.user_id, "verify-applicant");
  const evidence = await onRequest({ env: runtime, request: new Request(`https://chatgun.pages.dev/api/social/moderation/verification/media/${pending.id_media_id}`, { headers: headers(reviewer, { moderator: true }) }) });
  assert.equal(evidence.status, 200);
  assert.equal(evidence.headers.get("cache-control"), "private, no-store, max-age=0");

  const decision = await onRequest({ env: runtime, request: new Request("https://chatgun.pages.dev/api/social/moderation/verification", {
    method: "POST", headers: { ...headers(reviewer, { moderator: true }), "content-type": "application/json" },
    body: JSON.stringify({ user: "verify-applicant", status: "approved", reason: "" }),
  }) });
  assert.equal(decision.status, 200);
  assert.equal((await decision.json()).evidenceDeletionPending, true);
  const record = await database.prepare("SELECT status,id_media_id,selfie_media_id FROM identity_verification_requests WHERE user_id='verify-applicant'").first();
  assert.deepEqual({ ...record }, { status: "approved", id_media_id: null, selfie_media_id: null });
  assert.equal((await database.prepare("SELECT COUNT(*) count FROM media_deletion_queue").first()).count, 2);
  const profile = await onRequest({ env: runtime, request: new Request("https://chatgun.pages.dev/api/social/profile", { headers: { cookie: headers(applicant).cookie } }) });
  assert.equal((await profile.json()).profile.identity_verified, 1);
  database.close();
});

test("verification remains server-disabled when its feature flag is false", async () => {
  const database = new TestD1();
  const applicant = await member(database, "verify-disabled");
  const response = await onRequest({ env: { ...environment(database), SOCIAL_APP_ENABLED: "true" }, request: new Request("https://chatgun.pages.dev/api/social/verification", { headers: { cookie: headers(applicant).cookie } }) });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "feature_disabled");
  database.close();
});
