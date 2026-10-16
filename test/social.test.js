import assert from "node:assert/strict";
import test from "node:test";
import { issueSession, unixTime } from "../functions/_lib/db.js";
import { onRequest } from "../functions/api/social/[[path]].js";
import { environment, TestD1 } from "./helpers/d1.js";

async function addUser(database, id, name = id) {
  const now = unixTime();
  await database.prepare(`
    INSERT INTO users(id, display_name, status, created_at, updated_at)
    VALUES (?, ?, 'active', ?, ?)
  `).bind(id, name, now, now).run();
  return issueSession(database, id, now);
}

function request(path, session, { method = "GET", body, csrf = true } = {}) {
  const headers = {
    cookie: `__Host-cg_session=${encodeURIComponent(session.token)}; __Host-cg_csrf=${encodeURIComponent(session.csrf)}`,
  };
  if (method !== "GET") {
    headers.origin = "https://chatgun.pages.dev";
    headers["content-type"] = "application/json";
    if (csrf) headers["x-csrf-token"] = session.csrf;
  }
  return new Request(`https://chatgun.pages.dev${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function socialEnvironment(database) {
  return {
    ...environment(database),
    SOCIAL_APP_ENABLED: "true",
    ADULT_ONBOARDING_ENABLED: "true",
    PUBLIC_DISCOVERY_ENABLED: "true",
    FRIEND_REQUESTS_ENABLED: "true",
    MESSAGING_ENABLED: "true",
    MEDIA_UPLOAD_ENABLED: "false",
    RATINGS_ENABLED: "true",
    IDENTITY_VERIFICATION_ENABLED: "false",
    ADULT_NOTICE_VERSION: "adult-preview-v1",
  };
}

async function call(env, req) {
  return onRequest({ request: req, env });
}

async function onboard(env, session, name) {
  const response = await call(env, request("/api/social/onboarding/adult", session, {
    method: "POST",
    body: {
      confirmedAdult: true,
      dateOfBirth: "1990-01-01",
      noticeVersion: "adult-preview-v1",
      name,
      gender: "ไม่ระบุ",
      bio: `${name} bio`,
      interests: "กาแฟ, เทคโนโลยี",
    },
  }));
  assert.equal(response.status, 201, await response.text());
}

test("social capabilities fail closed and never expose a game capability", async () => {
  const database = new TestD1();
  const env = environment(database);
  const config = await call(env, new Request("https://chatgun.pages.dev/api/social/config"));
  assert.deepEqual(await config.json(), {
    socialAppEnabled: false,
    adultOnboardingEnabled: false,
    ageAssuranceModel: null,
    adultNoticeVersion: null,
    publicDiscoveryEnabled: false,
    friendRequestsEnabled: false,
    messagingEnabled: false,
    mediaUploadEnabled: false,
    mediaQuarantineEnabled: false,
    ratingsEnabled: false,
    identityVerificationEnabled: false,
    demoModeEnabled: false,
    gameEnabled: false,
    emailOtpEnabled: false,
    mobileOtpEnabled: false,
  });
  const session = await addUser(database, "closed-user");
  const response = await call(env, request("/api/social/profile", session));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "feature_disabled");
  database.close();
});

test("adult onboarding requires CSRF, recent auth, registration flag, and matching notice", async () => {
  const database = new TestD1();
  const env = socialEnvironment(database);
  const session = await addUser(database, "adult-user", "Adult User");

  const missingCsrf = await call(env, request("/api/social/onboarding/adult", session, {
    method: "POST",
    csrf: false,
    body: { confirmedAdult: true, dateOfBirth: "1990-01-01", noticeVersion: "adult-preview-v1", name: "Adult User" },
  }));
  assert.equal(missingCsrf.status, 403);

  const wrongNotice = await call(env, request("/api/social/onboarding/adult", session, {
    method: "POST",
    body: { confirmedAdult: true, dateOfBirth: "1990-01-01", noticeVersion: "wrong", name: "Adult User" },
  }));
  assert.equal(wrongNotice.status, 400);
  assert.equal((await wrongNotice.json()).code, "adult_confirmation_required");

  const underage = await call(env, request("/api/social/onboarding/adult", session, {
    method: "POST",
    body: { confirmedAdult: true, dateOfBirth: "2010-01-01", noticeVersion: "adult-preview-v1", name: "Adult User" },
  }));
  assert.equal(underage.status, 400);
  assert.equal((await underage.json()).code, "adult_confirmation_required");

  await onboard(env, session, "Adult User");
  const profile = await database.prepare("SELECT * FROM member_profiles WHERE user_id = ?").bind("adult-user").first();
  assert.equal(profile.name, "Adult User");
  assert.equal(profile.discovery_visible, 0);
  const assurance = await database.prepare(
    "SELECT age_band, method, notice_version FROM age_assurance_events WHERE id = ?",
  ).bind(profile.age_assurance_id).first();
  assert.deepEqual({ ...assurance }, {
    age_band: "adult_18_plus",
    method: "self_declaration",
    notice_version: "adult-preview-v1",
  });
  database.close();
});

test("discovery preserves proximity behavior without returning precise coordinates", async () => {
  const database = new TestD1();
  const env = socialEnvironment(database);
  const alice = await addUser(database, "alice", "Alice");
  const bob = await addUser(database, "bob", "Bob");
  await onboard(env, alice, "Alice");
  await onboard(env, bob, "Bob");

  for (const [session, latitude, longitude] of [[alice, 13.7563, 100.5018], [bob, 13.7567, 100.5020]]) {
    const response = await call(env, request("/api/social/discovery", session, {
      method: "POST",
      body: { action: "location", latitude, longitude, accuracy: 12 },
    }));
    assert.equal(response.status, 200, await response.text());
  }

  const response = await call(env, request("/api/social/discovery", alice));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.locationFresh, true);
  assert.equal(result.people.length, 1);
  assert.equal(result.people[0].user_id, "bob");
  assert.equal(result.people[0].distance, 100);
  assert.equal(result.people[0].distance_min, 0);
  assert.equal(result.people[0].distance_max, 100);
  assert.equal(result.people[0].distance_label, "ใกล้กว่า 100 ม.");
  assert.equal("latitude" in result.people[0], false);
  assert.equal("longitude" in result.people[0], false);

  const publicProfile = await call(env, request("/api/social/profile?user=bob", alice));
  const publicData = (await publicProfile.json()).profile;
  assert.equal("accuracy" in publicData, false);
  assert.equal("located_at" in publicData, false);
  assert.equal("adult_self_declared" in publicData, false);

  const hidden = await call(env, request("/api/social/discovery", bob, {
    method: "POST", body: { action: "hide" },
  }));
  assert.equal(hidden.status, 200);
  const after = await call(env, request("/api/social/discovery", alice));
  assert.equal((await after.json()).people.length, 0);
  database.close();
});

test("discovery throttles repeated reads used for location inference", async () => {
  const database = new TestD1();
  const env = socialEnvironment(database);
  const session = await addUser(database, "location-prober", "Location Prober");
  await onboard(env, session, "Location Prober");
  for (let index = 0; index < 60; index += 1) {
    const response = await call(env, request("/api/social/discovery", session));
    assert.equal(response.status, 200, `read ${index + 1}`);
  }
  const throttled = await call(env, request("/api/social/discovery", session));
  assert.equal(throttled.status, 429);
  assert.equal((await throttled.json()).code, "rate_limited");
  database.close();
});

test("friendship, messaging, blocking, and reports enforce server-side relationship rules", async () => {
  const database = new TestD1();
  const env = socialEnvironment(database);
  const alice = await addUser(database, "rel-alice", "Alice");
  const bob = await addUser(database, "rel-bob", "Bob");
  await onboard(env, alice, "Alice");
  await onboard(env, bob, "Bob");

  const premature = await call(env, request("/api/social/messages", alice, {
    method: "POST", body: { action: "send", target: "rel-bob", body: "hello" },
  }));
  assert.equal(premature.status, 403);

  assert.equal((await call(env, request("/api/social/relationships", alice, {
    method: "POST", body: { action: "request", target: "rel-bob" },
  }))).status, 200);
  assert.equal((await call(env, request("/api/social/relationships", bob, {
    method: "POST", body: { action: "accept", target: "rel-alice" },
  }))).status, 200);

  const sent = await call(env, request("/api/social/messages", alice, {
    method: "POST", body: { action: "send", target: "rel-bob", body: "hello" },
  }));
  assert.equal(sent.status, 200, await sent.text());
  const thread = await call(env, request("/api/social/messages?target=rel-alice", bob));
  const payload = await thread.json();
  assert.equal(payload.messages[0].body, "hello");
  const inbox = await call(env, request("/api/social/relationships", alice));
  const conversation = (await inbox.json()).relationships.find((item) => item.other_user_id === "rel-bob");
  assert.equal(conversation.last_message_body, "hello");
  assert.equal(conversation.last_message_sender_id, "rel-alice");
  assert.ok(Number(conversation.last_message_at) > 0);
  await database.prepare("UPDATE social_relationships SET status='pending' WHERE id=?").bind(conversation.id).run();
  const pendingInbox = await call(env, request("/api/social/relationships", alice));
  const pendingConversation = (await pendingInbox.json()).relationships.find((item) => item.other_user_id === "rel-bob");
  assert.equal(pendingConversation.last_message_body, null, "pending relationships do not receive message previews");
  assert.equal(pendingConversation.unread_count, 0);
  await database.prepare("UPDATE social_relationships SET status='accepted' WHERE id=?").bind(conversation.id).run();

  const report = await call(env, request("/api/social/reports", bob, {
    method: "POST",
    body: { target: "rel-alice", category: "harassment", details: "ข้อความไม่เหมาะสม" },
  }));
  assert.equal(report.status, 201);

  const blocked = await call(env, request("/api/social/blocks", bob, {
    method: "POST", body: { action: "block", target: "rel-alice" },
  }));
  assert.equal(blocked.status, 200);
  const blockedList = await call(env, request("/api/social/blocks", bob));
  assert.deepEqual((await blockedList.json()).blocked.map((item) => [item.user_id, item.name]), [["rel-alice", "Alice"]]);
  assert.equal(await database.prepare("SELECT COUNT(*) count FROM social_relationships").first().then((r) => r.count), 0);
  const denied = await call(env, request("/api/social/messages?target=rel-bob", alice));
  assert.equal(denied.status, 403);
  database.close();
});

test("message cursor pagination is stable when many messages share a timestamp", async () => {
  const database = new TestD1();
  const env = socialEnvironment(database);
  const alice = await addUser(database, "page-alice", "Alice");
  const bob = await addUser(database, "page-bob", "Bob");
  await onboard(env, alice, "Alice");
  await onboard(env, bob, "Bob");
  await database.prepare(`INSERT INTO social_relationships(id,user_low,user_high,requested_by,status,created_at,updated_at) VALUES ('page-rel','page-alice','page-bob','page-alice','accepted',1,1)`).run();
  for (let index = 0; index < 55; index += 1) {
    const id = `message-${String(index).padStart(3, "0")}`;
    await database.prepare("INSERT INTO social_messages(id,sender_user_id,receiver_user_id,body,created_at) VALUES (?,?,?,?,100)")
      .bind(id, "page-alice", "page-bob", id).run();
  }
  const first = await call(env, request("/api/social/messages?target=page-bob", alice));
  const firstPage = await first.json();
  assert.equal(firstPage.messages.length, 50);
  assert.equal(firstPage.hasMore, true);
  const cursor = firstPage.messages.at(-1);
  const second = await call(env, request(`/api/social/messages?target=page-bob&before=${cursor.created_at}&beforeId=${cursor.id}`, alice));
  const secondPage = await second.json();
  assert.equal(secondPage.messages.length, 5);
  assert.equal(secondPage.hasMore, false);
  assert.equal(new Set([...firstPage.messages, ...secondPage.messages].map((message) => message.id)).size, 55);
  database.close();
});

test("proximity ratings are recipient-private and limited to once per Bangkok day", async () => {
  const database = new TestD1();
  const env = socialEnvironment(database);
  const alice = await addUser(database, "rate-alice", "Alice");
  const bob = await addUser(database, "rate-bob", "Bob");
  await onboard(env, alice, "Alice");
  await onboard(env, bob, "Bob");
  for (const [session, latitude] of [[alice, 13.7563], [bob, 13.7565]]) {
    assert.equal((await call(env, request("/api/social/discovery", session, {
      method: "POST", body: { action: "location", latitude, longitude: 100.5018, accuracy: 10 },
    }))).status, 200);
  }
  const first = await call(env, request("/api/social/ratings", alice, {
    method: "POST", body: { target: "rate-bob", score: 5, comment: "สุภาพมาก" },
  }));
  assert.equal(first.status, 201, await first.text());
  const replay = await call(env, request("/api/social/ratings", alice, {
    method: "POST", body: { target: "rate-bob", score: 4, comment: "again" },
  }));
  assert.equal(replay.status, 409);
  assert.equal((await replay.json()).code, "already_rated");
  const own = await call(env, request("/api/social/ratings", bob));
  assert.deepEqual((await own.json()).ratings.map((row) => [row.sender_name, row.score, row.comment]), [
    ["Alice", 5, "สุภาพมาก"],
  ]);
  database.close();
});
