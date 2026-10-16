import { safeUuid } from "../../_lib/crypto.js";
import { getSession, hasRecentAuthentication, rateLimit, requireCsrf, unixTime } from "../../_lib/db.js";
import { RequestError, failure, json, readJson, requireSameOrigin } from "../../_lib/http.js";

const LOCATION_FRESH_SECONDS = 120;
const ALLOWED_GENDERS = new Set([
  "ไม่ระบุ", "ชาย", "หญิง", "เกย์", "ทอม", "ดี้", "เลสเบี้ยน", "ไบเซ็กชวล", "นอนไบนารี", "อื่น ๆ",
]);

class SocialError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function enabled(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function capability(env, name) {
  if (!enabled(env[name])) throw new SocialError("feature_disabled", "ฟีเจอร์นี้ยังไม่เปิดใช้งาน", 404);
}

async function authenticated(request, env, { csrf = false } = {}) {
  const session = await getSession(request, env.DB);
  if (!session) throw new SocialError("unauthorized", "กรุณาเข้าสู่ระบบ", 401);
  if (csrf) {
    requireSameOrigin(request);
    if (!await requireCsrf(request, session)) {
      throw new SocialError("invalid_csrf", "คำขอหมดอายุ กรุณาลองใหม่", 403);
    }
  }
  return session;
}

async function limited(env, scope, key, limit, windowSeconds) {
  if (!env.RATE_LIMIT_PEPPER) throw new Error("missing_rate_limit_pepper");
  if (!await rateLimit(env.DB, scope, key, limit, windowSeconds, env.RATE_LIMIT_PEPPER)) {
    throw new SocialError("rate_limited", "ดำเนินการบ่อยเกินไป กรุณารอสักครู่", 429);
  }
}

function cleanText(value, maximum, { required = false } = {}) {
  const result = String(value ?? "").trim();
  if ((required && !result) || result.length > maximum) throw new SocialError("invalid_input", "ข้อมูลไม่ถูกต้อง");
  return result;
}

function pair(a, b) {
  if (!b || a === b) throw new SocialError("invalid_target", "ไม่พบผู้ใช้");
  return a < b ? [a, b] : [b, a];
}

async function profileFor(db, userId) {
  return db.prepare(`
    SELECT p.user_id, p.name, p.gender, p.bio, p.interests, p.selected_photo_id,
           p.discovery_visible, p.accuracy, p.located_at, p.created_at, p.updated_at,
           EXISTS(
             SELECT 1 FROM age_assurance_events a
             WHERE a.id = p.age_assurance_id AND a.user_id = p.user_id
               AND a.age_band = 'adult_18_plus' AND a.revoked_at IS NULL
           ) AS adult_confirmed
    FROM member_profiles p WHERE p.user_id = ?
  `).bind(userId).first();
}

async function requireProfile(db, userId) {
  const profile = await profileFor(db, userId);
  if (!profile) throw new SocialError("onboarding_required", "กรุณาสร้างโปรไฟล์ก่อน", 403);
  return profile;
}

async function targetExists(db, target) {
  return Boolean(await db.prepare(`
    SELECT 1 present FROM member_profiles p JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ? AND u.status = 'active'
  `).bind(target).first());
}

async function isBlocked(db, a, b) {
  return Boolean(await db.prepare(`
    SELECT 1 blocked FROM social_blocks
    WHERE (blocker_user_id = ? AND blocked_user_id = ?)
       OR (blocker_user_id = ? AND blocked_user_id = ?)
  `).bind(a, b, b, a).first());
}

async function accepted(db, a, b) {
  const [low, high] = pair(a, b);
  return Boolean(await db.prepare(`
    SELECT 1 accepted FROM social_relationships
    WHERE user_low = ? AND user_high = ? AND status = 'accepted'
  `).bind(low, high).first());
}

function radians(value) {
  return value * Math.PI / 180;
}

function distanceMetres(a, b) {
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

async function config(env) {
  return json({
    socialAppEnabled: enabled(env.SOCIAL_APP_ENABLED),
    adultOnboardingEnabled: enabled(env.ADULT_ONBOARDING_ENABLED),
    publicDiscoveryEnabled: enabled(env.PUBLIC_DISCOVERY_ENABLED),
    friendRequestsEnabled: enabled(env.FRIEND_REQUESTS_ENABLED),
    messagingEnabled: enabled(env.MESSAGING_ENABLED),
    mediaUploadEnabled: enabled(env.MEDIA_UPLOAD_ENABLED),
    ratingsEnabled: enabled(env.RATINGS_ENABLED),
    identityVerificationEnabled: enabled(env.IDENTITY_VERIFICATION_ENABLED),
    gameEnabled: false,
    emailOtpEnabled: false,
    mobileOtpEnabled: false,
  });
}

async function adultOnboarding(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "ADULT_ONBOARDING_ENABLED");
  if (!enabled(env.NEW_ACCOUNT_REGISTRATION_ENABLED)) {
    throw new SocialError("registration_closed", "ขณะนี้ยังไม่เปิดรับสมัครบัญชีใหม่", 403);
  }
  const session = await authenticated(request, env, { csrf: true });
  if (!hasRecentAuthentication(session)) {
    throw new SocialError("recent_auth_required", "กรุณายืนยันตัวตนอีกครั้ง", 428);
  }
  await limited(env, "adult_onboarding_user_hour", session.user_id, 5, 3600);
  const body = await readJson(request);
  const noticeVersion = String(env.ADULT_NOTICE_VERSION || "");
  if (!noticeVersion || body.confirmedAdult !== true || body.noticeVersion !== noticeVersion) {
    throw new SocialError("adult_confirmation_required", "กรุณายืนยันว่าคุณมีอายุ 18 ปีขึ้นไป", 400);
  }
  const name = cleanText(body.name || session.display_name, 50, { required: true });
  const gender = ALLOWED_GENDERS.has(body.gender) ? body.gender : "ไม่ระบุ";
  const bio = cleanText(body.bio, 250);
  const interests = cleanText(body.interests, 100);
  const timestamp = unixTime();
  const eventId = safeUuid();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE age_assurance_events SET revoked_at = ?
      WHERE user_id = ? AND revoked_at IS NULL
    `).bind(timestamp, session.user_id),
    env.DB.prepare(`
      INSERT INTO age_assurance_events(id, user_id, age_band, method, notice_version, declared_at)
      VALUES (?, ?, 'adult_18_plus', 'self_declaration', ?, ?)
    `).bind(eventId, session.user_id, noticeVersion, timestamp),
    env.DB.prepare(`
      INSERT INTO member_profiles(
        user_id, age_assurance_id, name, gender, bio, interests, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        age_assurance_id = excluded.age_assurance_id,
        name = excluded.name,
        gender = excluded.gender,
        bio = excluded.bio,
        interests = excluded.interests,
        updated_at = excluded.updated_at
    `).bind(session.user_id, eventId, name, gender, bio, interests, timestamp, timestamp),
  ]);
  return json({ profile: await profileFor(env.DB, session.user_id) }, 201);
}

async function getProfile(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  const session = await authenticated(request, env);
  const target = new URL(request.url).searchParams.get("user") || session.user_id;
  if (target !== session.user_id) {
    if (await isBlocked(env.DB, session.user_id, target)) {
      throw new SocialError("not_found", "ไม่พบโปรไฟล์", 404);
    }
    const visible = enabled(env.PUBLIC_DISCOVERY_ENABLED) && Boolean(await env.DB.prepare(`
      SELECT 1 visible FROM member_profiles
      WHERE user_id = ? AND discovery_visible = 1 AND located_at > ?
    `).bind(target, unixTime() - LOCATION_FRESH_SECONDS).first());
    if (!visible && !await accepted(env.DB, session.user_id, target)) {
      throw new SocialError("not_found", "ไม่พบโปรไฟล์", 404);
    }
  }
  const profile = await profileFor(env.DB, target);
  if (!profile) throw new SocialError("not_found", "ไม่พบโปรไฟล์", 404);
  return json({ profile });
}

async function updateProfile(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  const session = await authenticated(request, env, { csrf: true });
  await requireProfile(env.DB, session.user_id);
  await limited(env, "profile_write_user_hour", session.user_id, 30, 3600);
  const body = await readJson(request);
  const timestamp = unixTime();
  if (body.action === "hide") {
    await env.DB.prepare(`
      UPDATE member_profiles SET discovery_visible = 0, latitude = NULL, longitude = NULL,
        accuracy = NULL, located_at = NULL, updated_at = ? WHERE user_id = ?
    `).bind(timestamp, session.user_id).run();
  } else if (body.action === "edit") {
    const name = cleanText(body.name, 50, { required: true });
    const gender = ALLOWED_GENDERS.has(body.gender) ? body.gender : "ไม่ระบุ";
    await env.DB.prepare(`
      UPDATE member_profiles SET name = ?, gender = ?, bio = ?, interests = ?, updated_at = ?
      WHERE user_id = ?
    `).bind(name, gender, cleanText(body.bio, 250), cleanText(body.interests, 100), timestamp, session.user_id).run();
  } else {
    throw new SocialError("invalid_action", "คำขอไม่ถูกต้อง");
  }
  return json({ profile: await profileFor(env.DB, session.user_id) });
}

async function discovery(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "PUBLIC_DISCOVERY_ENABLED");
  const session = await authenticated(request, env, { csrf: request.method === "POST" });
  const me = await requireProfile(env.DB, session.user_id);
  const timestamp = unixTime();
  if (request.method === "POST") {
    await limited(env, "presence_user_10m", session.user_id, 30, 600);
    const body = await readJson(request);
    if (body.action === "hide") {
      await env.DB.prepare(`
        UPDATE member_profiles SET discovery_visible = 0, latitude = NULL, longitude = NULL,
          accuracy = NULL, located_at = NULL, updated_at = ? WHERE user_id = ?
      `).bind(timestamp, session.user_id).run();
    } else if (body.action === "location") {
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      const accuracy = Number(body.accuracy);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy)
        || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0 || accuracy > 50) {
        throw new SocialError("location_inaccurate", "ตำแหน่งต้องมีความแม่นยำไม่เกิน 50 เมตร");
      }
      await env.DB.prepare(`
        UPDATE member_profiles SET discovery_visible = 1, latitude = ?, longitude = ?,
          accuracy = ?, located_at = ?, updated_at = ? WHERE user_id = ?
      `).bind(latitude, longitude, accuracy, timestamp, timestamp, session.user_id).run();
    } else {
      throw new SocialError("invalid_action", "คำขอไม่ถูกต้อง");
    }
    return json({ profile: await profileFor(env.DB, session.user_id) });
  }
  if (!me.discovery_visible || !me.located_at || Number(me.located_at) <= timestamp - LOCATION_FRESH_SECONDS) {
    return json({ people: [], locationFresh: false });
  }
  const ownLocation = await env.DB.prepare(
    "SELECT latitude, longitude FROM member_profiles WHERE user_id = ?",
  ).bind(session.user_id).first();
  const rows = await env.DB.prepare(`
    SELECT p.user_id, p.name, p.gender, p.bio, p.interests, p.selected_photo_id,
           p.latitude, p.longitude,
           (SELECT AVG(score) FROM proximity_ratings r WHERE r.receiver_user_id = p.user_id) rating,
           (SELECT COUNT(*) FROM proximity_ratings r WHERE r.receiver_user_id = p.user_id) rating_count
    FROM member_profiles p JOIN users u ON u.id = p.user_id
    WHERE p.user_id <> ? AND u.status = 'active' AND p.discovery_visible = 1
      AND p.located_at > ? AND p.accuracy <= 50
      AND p.latitude BETWEEN ? AND ?
      AND NOT EXISTS (
        SELECT 1 FROM social_blocks b
        WHERE (b.blocker_user_id = ? AND b.blocked_user_id = p.user_id)
           OR (b.blocker_user_id = p.user_id AND b.blocked_user_id = ?)
      )
    LIMIT 500
  `).bind(
    session.user_id,
    timestamp - LOCATION_FRESH_SECONDS,
    Number(ownLocation.latitude) - 0.06,
    Number(ownLocation.latitude) + 0.06,
    session.user_id,
    session.user_id,
  ).all();
  const people = (rows.results || []).map((person) => {
    const metres = distanceMetres(ownLocation, person);
    const { latitude, longitude, ...safe } = person;
    return { ...safe, distance: metres };
  }).filter((person) => person.distance <= 5000).sort((a, b) => a.distance - b.distance);
  return json({ people, locationFresh: true });
}

async function relationships(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "FRIEND_REQUESTS_ENABLED");
  const session = await authenticated(request, env, { csrf: request.method === "POST" });
  await requireProfile(env.DB, session.user_id);
  if (request.method === "GET") {
    const rows = await env.DB.prepare(`
      SELECT r.id, r.user_low, r.user_high, r.requested_by, r.status, r.created_at, r.updated_at,
             p.user_id other_user_id, p.name, p.gender, p.bio, p.interests, p.selected_photo_id
      FROM social_relationships r
      JOIN member_profiles p ON p.user_id = CASE WHEN r.user_low = ? THEN r.user_high ELSE r.user_low END
      WHERE (r.user_low = ? OR r.user_high = ?)
        AND NOT EXISTS (
          SELECT 1 FROM social_blocks b
          WHERE (b.blocker_user_id = ? AND b.blocked_user_id = p.user_id)
             OR (b.blocker_user_id = p.user_id AND b.blocked_user_id = ?)
        )
      ORDER BY r.updated_at DESC
    `).bind(session.user_id, session.user_id, session.user_id, session.user_id, session.user_id).all();
    return json({ relationships: rows.results || [] });
  }
  await limited(env, "relationship_write_user_hour", session.user_id, 40, 3600);
  const body = await readJson(request);
  const target = String(body.target || "");
  if (!await targetExists(env.DB, target)) throw new SocialError("invalid_target", "ไม่พบผู้ใช้", 404);
  if (await isBlocked(env.DB, session.user_id, target)) throw new SocialError("blocked", "ไม่สามารถติดต่อผู้ใช้นี้", 403);
  const [low, high] = pair(session.user_id, target);
  const existing = await env.DB.prepare(
    "SELECT * FROM social_relationships WHERE user_low = ? AND user_high = ?",
  ).bind(low, high).first();
  const timestamp = unixTime();
  if (body.action === "request") {
    if (existing) throw new SocialError("relationship_exists", "มีคำขอหรือเป็นเพื่อนกันแล้ว", 409);
    await env.DB.prepare(`
      INSERT INTO social_relationships(id, user_low, user_high, requested_by, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `).bind(safeUuid(), low, high, session.user_id, timestamp, timestamp).run();
  } else if (body.action === "accept") {
    if (!existing || existing.status !== "pending" || existing.requested_by === session.user_id) {
      throw new SocialError("request_not_found", "ไม่พบคำขอ", 404);
    }
    await env.DB.prepare(
      "UPDATE social_relationships SET status = 'accepted', updated_at = ? WHERE id = ?",
    ).bind(timestamp, existing.id).run();
  } else if (body.action === "reject") {
    if (!existing || existing.status !== "pending" || existing.requested_by === session.user_id) {
      throw new SocialError("request_not_found", "ไม่พบคำขอ", 404);
    }
    await env.DB.prepare("DELETE FROM social_relationships WHERE id = ?").bind(existing.id).run();
  } else if (body.action === "cancel") {
    if (!existing || existing.status !== "pending" || existing.requested_by !== session.user_id) {
      throw new SocialError("request_not_found", "ไม่พบคำขอ", 404);
    }
    await env.DB.prepare("DELETE FROM social_relationships WHERE id = ?").bind(existing.id).run();
  } else if (body.action === "unfriend") {
    if (!existing || existing.status !== "accepted") throw new SocialError("friend_not_found", "ไม่พบเพื่อน", 404);
    await env.DB.prepare("DELETE FROM social_relationships WHERE id = ?").bind(existing.id).run();
  } else {
    throw new SocialError("invalid_action", "คำขอไม่ถูกต้อง");
  }
  return json({ ok: true });
}

async function blocks(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  const session = await authenticated(request, env, { csrf: true });
  await requireProfile(env.DB, session.user_id);
  await limited(env, "block_write_user_hour", session.user_id, 30, 3600);
  const body = await readJson(request);
  const target = String(body.target || "");
  if (!await targetExists(env.DB, target) || target === session.user_id) {
    throw new SocialError("invalid_target", "ไม่พบผู้ใช้", 404);
  }
  if (body.action === "block") {
    const [low, high] = pair(session.user_id, target);
    await env.DB.batch([
      env.DB.prepare(`
        INSERT OR IGNORE INTO social_blocks(blocker_user_id, blocked_user_id, created_at)
        VALUES (?, ?, ?)
      `).bind(session.user_id, target, unixTime()),
      env.DB.prepare("DELETE FROM social_relationships WHERE user_low = ? AND user_high = ?").bind(low, high),
    ]);
  } else if (body.action === "unblock") {
    await env.DB.prepare(
      "DELETE FROM social_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?",
    ).bind(session.user_id, target).run();
  } else {
    throw new SocialError("invalid_action", "คำขอไม่ถูกต้อง");
  }
  return json({ ok: true });
}

async function messages(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "MESSAGING_ENABLED");
  const session = await authenticated(request, env, { csrf: request.method === "POST" });
  await requireProfile(env.DB, session.user_id);
  if (request.method === "GET") {
    const url = new URL(request.url);
    const target = String(url.searchParams.get("target") || "");
    if (!await accepted(env.DB, session.user_id, target) || await isBlocked(env.DB, session.user_id, target)) {
      throw new SocialError("not_friends", "ต้องเป็นเพื่อนกันก่อนแชท", 403);
    }
    const before = Number(url.searchParams.get("before") || Number.MAX_SAFE_INTEGER);
    if (!Number.isFinite(before)) throw new SocialError("invalid_cursor", "คำขอไม่ถูกต้อง");
    const rows = await env.DB.prepare(`
      SELECT id, sender_user_id, receiver_user_id,
             CASE WHEN unsent_at IS NULL THEN body ELSE '' END body,
             CASE WHEN unsent_at IS NULL THEN media_id ELSE NULL END media_id,
             unsent_at, read_at, created_at
      FROM social_messages
      WHERE ((sender_user_id = ? AND receiver_user_id = ?)
          OR (sender_user_id = ? AND receiver_user_id = ?))
        AND created_at < ?
      ORDER BY created_at DESC, id DESC LIMIT 51
    `).bind(session.user_id, target, target, session.user_id, before).all();
    return json({ messages: (rows.results || []).slice(0, 50), hasMore: (rows.results || []).length > 50 });
  }
  await limited(env, "message_write_user_minute", session.user_id, 30, 60);
  const body = await readJson(request);
  if (body.action === "unsend") {
    const result = await env.DB.prepare(`
      UPDATE social_messages SET unsent_at = ?
      WHERE id = ? AND sender_user_id = ? AND unsent_at IS NULL
    `).bind(unixTime(), String(body.id || ""), session.user_id).run();
    if (!Number(result.meta?.changes || 0)) throw new SocialError("message_not_found", "ไม่พบข้อความ", 404);
    return json({ ok: true });
  }
  const target = String(body.target || "");
  if (!await accepted(env.DB, session.user_id, target) || await isBlocked(env.DB, session.user_id, target)) {
    throw new SocialError("not_friends", "ต้องเป็นเพื่อนกันก่อนแชท", 403);
  }
  if (body.action === "read") {
    await env.DB.prepare(`
      UPDATE social_messages SET read_at = ?
      WHERE sender_user_id = ? AND receiver_user_id = ? AND read_at IS NULL AND unsent_at IS NULL
    `).bind(unixTime(), target, session.user_id).run();
  } else if (body.action === "send") {
    const text = cleanText(body.body, 2000, { required: true });
    await env.DB.prepare(`
      INSERT INTO social_messages(id, sender_user_id, receiver_user_id, body, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(safeUuid(), session.user_id, target, text, unixTime()).run();
  } else {
    throw new SocialError("invalid_action", "คำขอไม่ถูกต้อง");
  }
  return json({ ok: true });
}

async function reports(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  const session = await authenticated(request, env, { csrf: true });
  await requireProfile(env.DB, session.user_id);
  await limited(env, "report_user_day", session.user_id, 20, 86400);
  const body = await readJson(request);
  const target = String(body.target || "");
  if (!await targetExists(env.DB, target) || target === session.user_id) {
    throw new SocialError("invalid_target", "ไม่พบผู้ใช้", 404);
  }
  const categories = new Set(["harassment", "spam", "impersonation", "sexual_content", "violence", "privacy", "other"]);
  if (!categories.has(body.category)) throw new SocialError("invalid_category", "กรุณาเลือกประเภทการรายงาน");
  await env.DB.prepare(`
    INSERT INTO social_reports(id, reporter_user_id, subject_user_id, category, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(safeUuid(), session.user_id, target, body.category, cleanText(body.details, 1000, { required: true }), unixTime()).run();
  return json({ ok: true }, 201);
}

async function ratings(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "RATINGS_ENABLED");
  const session = await authenticated(request, env, { csrf: request.method === "POST" });
  const me = await requireProfile(env.DB, session.user_id);
  if (request.method === "GET") {
    const rows = await env.DB.prepare(`
      SELECT r.id, r.score, r.comment, r.created_at, p.name sender_name
      FROM proximity_ratings r JOIN member_profiles p ON p.user_id = r.sender_user_id
      WHERE r.receiver_user_id = ? ORDER BY r.created_at DESC
    `).bind(session.user_id).all();
    return json({ ratings: rows.results || [] });
  }
  await limited(env, "rating_user_day", session.user_id, 30, 86400);
  const body = await readJson(request);
  const target = String(body.target || "");
  const score = Number(body.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) throw new SocialError("invalid_score", "เลือกคะแนน 1–5");
  if (await isBlocked(env.DB, session.user_id, target)) throw new SocialError("blocked", "ไม่สามารถให้คะแนนผู้ใช้นี้", 403);
  const targetProfile = await env.DB.prepare(
    "SELECT latitude, longitude, accuracy, located_at, discovery_visible FROM member_profiles WHERE user_id = ?",
  ).bind(target).first();
  const ownLocation = await env.DB.prepare(
    "SELECT latitude, longitude, accuracy, located_at, discovery_visible FROM member_profiles WHERE user_id = ?",
  ).bind(session.user_id).first();
  const timestamp = unixTime();
  if (!targetProfile || !ownLocation.discovery_visible || !targetProfile.discovery_visible
    || Number(ownLocation.located_at || 0) <= timestamp - LOCATION_FRESH_SECONDS
    || Number(targetProfile.located_at || 0) <= timestamp - LOCATION_FRESH_SECONDS
    || Number(ownLocation.accuracy) > 50 || Number(targetProfile.accuracy) > 50
    || distanceMetres(ownLocation, targetProfile) > 100) {
    throw new SocialError("proximity_required", "ทั้งสองคนต้องอยู่ในระยะ 100 เมตร", 403);
  }
  const localDay = new Date(timestamp * 1000 + 7 * 3600 * 1000).toISOString().slice(0, 10);
  try {
    await env.DB.prepare(`
      INSERT INTO proximity_ratings(id, sender_user_id, receiver_user_id, local_day, score, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(safeUuid(), session.user_id, target, localDay, score, cleanText(body.comment, 500), timestamp).run();
  } catch (error) {
    if (String(error?.message || "").includes("UNIQUE")) {
      throw new SocialError("already_rated", "วันนี้คุณให้คะแนนคนนี้แล้ว", 409);
    }
    throw error;
  }
  return json({ ok: true }, 201);
}

export async function onRequest({ request, env }) {
  try {
    if (!env.DB) throw new Error("missing_db_binding");
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/api/social/config") return config(env);
    if (request.method === "POST" && path === "/api/social/onboarding/adult") return await adultOnboarding(request, env);
    if (path === "/api/social/profile") {
      if (request.method === "GET") return await getProfile(request, env);
      if (request.method === "POST") return await updateProfile(request, env);
    }
    if (path === "/api/social/discovery" && ["GET", "POST"].includes(request.method)) return await discovery(request, env);
    if (path === "/api/social/relationships" && ["GET", "POST"].includes(request.method)) return await relationships(request, env);
    if (request.method === "POST" && path === "/api/social/blocks") return await blocks(request, env);
    if (path === "/api/social/messages" && ["GET", "POST"].includes(request.method)) return await messages(request, env);
    if (request.method === "POST" && path === "/api/social/reports") return await reports(request, env);
    if (path === "/api/social/ratings" && ["GET", "POST"].includes(request.method)) return await ratings(request, env);
    return failure("ไม่พบหน้าที่เรียก", 404, "not_found");
  } catch (error) {
    if (error instanceof RequestError) return failure("คำขอไม่ถูกต้อง", error.status, error.code);
    if (error instanceof SocialError) return failure(error.message, error.status, error.code);
    console.error(JSON.stringify({ event: "social_request_failed", reason: error?.message || "unknown" }));
    return failure("ไม่สามารถดำเนินการได้ กรุณาลองใหม่", 500, "internal_error");
  }
}
