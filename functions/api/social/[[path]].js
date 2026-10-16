import { safeUuid } from "../../_lib/crypto.js";
import { getSession, hasRecentAuthentication, rateLimit, requireCsrf, unixTime } from "../../_lib/db.js";
import { RequestError, failure, json, readJson, requireSameOrigin } from "../../_lib/http.js";
import { sanitizeImage } from "../../_lib/image.js";

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

function identifier(value, message = "ไม่พบผู้ใช้") {
  const result = String(value || "");
  if (!result || result.length > 128) throw new SocialError("invalid_target", message, 404);
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
           ) AS adult_confirmed,
           EXISTS(
             SELECT 1 FROM identity_verification_requests v
             WHERE v.user_id = p.user_id AND v.status = 'approved'
           ) AS identity_verified
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
  const socialAppEnabled = enabled(env.SOCIAL_APP_ENABLED);
  const adultOnboardingEnabled = socialAppEnabled && enabled(env.ADULT_ONBOARDING_ENABLED);
  return json({
    socialAppEnabled,
    adultOnboardingEnabled,
    adultNoticeVersion: adultOnboardingEnabled ? String(env.ADULT_NOTICE_VERSION || "") || null : null,
    publicDiscoveryEnabled: enabled(env.PUBLIC_DISCOVERY_ENABLED),
    friendRequestsEnabled: enabled(env.FRIEND_REQUESTS_ENABLED),
    messagingEnabled: enabled(env.MESSAGING_ENABLED),
    mediaUploadEnabled: enabled(env.MEDIA_UPLOAD_ENABLED),
    ratingsEnabled: enabled(env.RATINGS_ENABLED),
    identityVerificationEnabled: enabled(env.IDENTITY_VERIFICATION_ENABLED),
    demoModeEnabled: enabled(env.DEMO_MODE_ENABLED),
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
    const current = await profileFor(env.DB, session.user_id);
    const statements = [env.DB.prepare(`
      UPDATE member_profiles SET name = ?, gender = ?, bio = ?, interests = ?, updated_at = ?
      WHERE user_id = ?
    `).bind(name, gender, cleanText(body.bio, 250), cleanText(body.interests, 100), timestamp, session.user_id)];
    if (current.name !== name) {
      const evidence = await env.DB.prepare(`
        SELECT v.id_media_id, v.selfie_media_id, idm.object_key id_key, selfie.object_key selfie_key
        FROM identity_verification_requests v
        LEFT JOIN social_media idm ON idm.id = v.id_media_id
        LEFT JOIN social_media selfie ON selfie.id = v.selfie_media_id
        WHERE v.user_id = ?
      `).bind(session.user_id).first();
      if (evidence) {
        statements.push(env.DB.prepare(`
          UPDATE identity_verification_requests SET status = 'rejected', reason = 'profile_name_changed',
            reviewed_at = ?, reviewed_by = NULL, id_media_id = NULL, selfie_media_id = NULL WHERE user_id = ?
        `).bind(timestamp, session.user_id));
        for (const [mediaId, objectKey] of [[evidence.id_media_id, evidence.id_key], [evidence.selfie_media_id, evidence.selfie_key]]) {
          if (!mediaId || !objectKey) continue;
          statements.push(env.DB.prepare("UPDATE social_media SET state = 'pending_deletion' WHERE id = ?").bind(mediaId));
          statements.push(env.DB.prepare(`
            INSERT OR IGNORE INTO media_deletion_queue(object_key, operation_id, next_attempt_at, created_at)
            VALUES (?, ?, ?, ?)
          `).bind(objectKey, safeUuid(), timestamp, timestamp));
        }
      }
    }
    await env.DB.batch(statements);
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
           EXISTS(SELECT 1 FROM identity_verification_requests v WHERE v.user_id = p.user_id AND v.status = 'approved') identity_verified,
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
             ,EXISTS(SELECT 1 FROM identity_verification_requests v WHERE v.user_id = p.user_id AND v.status = 'approved') identity_verified
             ,(SELECT COUNT(*) FROM social_messages m WHERE r.status = 'accepted' AND m.sender_user_id = p.user_id
                AND m.receiver_user_id = ? AND m.read_at IS NULL AND m.unsent_at IS NULL) unread_count
             ,(SELECT MAX(m.created_at) FROM social_messages m WHERE r.status = 'accepted' AND (
                (m.sender_user_id = ? AND m.receiver_user_id = p.user_id)
                OR (m.sender_user_id = p.user_id AND m.receiver_user_id = ?))) last_message_at
             ,(SELECT CASE WHEN m.unsent_at IS NULL THEN m.body ELSE '' END FROM social_messages m WHERE r.status = 'accepted' AND (
                (m.sender_user_id = ? AND m.receiver_user_id = p.user_id)
                OR (m.sender_user_id = p.user_id AND m.receiver_user_id = ?))
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) last_message_body
             ,(SELECT m.media_id FROM social_messages m WHERE r.status = 'accepted' AND (
                (m.sender_user_id = ? AND m.receiver_user_id = p.user_id)
                OR (m.sender_user_id = p.user_id AND m.receiver_user_id = ?))
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) last_message_media_id
             ,(SELECT m.sender_user_id FROM social_messages m WHERE r.status = 'accepted' AND (
                (m.sender_user_id = ? AND m.receiver_user_id = p.user_id)
                OR (m.sender_user_id = p.user_id AND m.receiver_user_id = ?))
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) last_message_sender_id
             ,(SELECT m.unsent_at FROM social_messages m WHERE r.status = 'accepted' AND (
                (m.sender_user_id = ? AND m.receiver_user_id = p.user_id)
                OR (m.sender_user_id = p.user_id AND m.receiver_user_id = ?))
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) last_message_unsent_at
      FROM social_relationships r
      JOIN member_profiles p ON p.user_id = CASE WHEN r.user_low = ? THEN r.user_high ELSE r.user_low END
      WHERE (r.user_low = ? OR r.user_high = ?)
        AND NOT EXISTS (
          SELECT 1 FROM social_blocks b
          WHERE (b.blocker_user_id = ? AND b.blocked_user_id = p.user_id)
             OR (b.blocker_user_id = p.user_id AND b.blocked_user_id = ?)
        )
      ORDER BY r.updated_at DESC
    `).bind(
      session.user_id, session.user_id, session.user_id,
      session.user_id, session.user_id, session.user_id, session.user_id,
      session.user_id, session.user_id, session.user_id, session.user_id,
      session.user_id, session.user_id, session.user_id, session.user_id, session.user_id,
    ).all();
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
  const session = await authenticated(request, env, { csrf: request.method === "POST" });
  await requireProfile(env.DB, session.user_id);
  if (request.method === "GET") {
    const rows = await env.DB.prepare(`
      SELECT b.blocked_user_id user_id, p.name, p.gender, b.created_at
      FROM social_blocks b
      JOIN member_profiles p ON p.user_id = b.blocked_user_id
      WHERE b.blocker_user_id = ?
      ORDER BY b.created_at DESC
    `).bind(session.user_id).all();
    return json({ blocked: rows.results || [] });
  }
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
    const target = identifier(url.searchParams.get("target"));
    if (!await accepted(env.DB, session.user_id, target) || await isBlocked(env.DB, session.user_id, target)) {
      throw new SocialError("not_friends", "ต้องเป็นเพื่อนกันก่อนแชท", 403);
    }
    const before = Number(url.searchParams.get("before") || Number.MAX_SAFE_INTEGER);
    const beforeId = String(url.searchParams.get("beforeId") || "\uffff");
    if (!Number.isFinite(before) || beforeId.length > 128) throw new SocialError("invalid_cursor", "คำขอไม่ถูกต้อง");
    const rows = await env.DB.prepare(`
      SELECT id, sender_user_id, receiver_user_id,
             CASE WHEN unsent_at IS NULL THEN body ELSE '' END body,
             CASE WHEN unsent_at IS NULL THEN media_id ELSE NULL END media_id,
             unsent_at, read_at, created_at
      FROM social_messages
      WHERE ((sender_user_id = ? AND receiver_user_id = ?)
          OR (sender_user_id = ? AND receiver_user_id = ?))
        AND (created_at < ? OR (created_at = ? AND id < ?))
      ORDER BY created_at DESC, id DESC LIMIT 51
    `).bind(session.user_id, target, target, session.user_id, before, before, beforeId).all();
    return json({ messages: (rows.results || []).slice(0, 50), hasMore: (rows.results || []).length > 50 });
  }
  await limited(env, "message_write_user_minute", session.user_id, 30, 60);
  if ((request.headers.get("content-type") || "").startsWith("multipart/form-data")) {
    capability(env, "MEDIA_UPLOAD_ENABLED");
    if (!env.MEDIA) throw new Error("missing_media_binding");
    const form = await request.formData();
    const target = String(form.get("target") || "");
    if (!await accepted(env.DB, session.user_id, target) || await isBlocked(env.DB, session.user_id, target)) {
      throw new SocialError("not_friends", "ต้องเป็นเพื่อนกันก่อนแชท", 403);
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > 8 * 1024 * 1024) {
      throw new SocialError("invalid_file", "รูปภาพต้องมีขนาดไม่เกิน 8 MB");
    }
    let image;
    try { image = sanitizeImage(new Uint8Array(await file.arrayBuffer()), file.type); }
    catch { throw new SocialError("invalid_image", "รองรับเฉพาะ JPG, PNG และ WebP ที่ถูกต้อง"); }
    const { bytes, contentType } = image;
    const mediaId = safeUuid();
    const messageId = safeUuid();
    const objectKey = `chat/${safeUuid()}`;
    const timestamp = unixTime();
    const oldest = await env.DB.prepare(`
      SELECT id, object_key FROM social_media
      WHERE owner_user_id = ? AND purpose = 'chat' AND state = 'active'
        AND (SELECT COUNT(*) FROM social_media WHERE owner_user_id = ? AND purpose = 'chat' AND state = 'active') >= 5
      ORDER BY created_at ASC LIMIT 1
    `).bind(session.user_id, session.user_id).first();
    await env.MEDIA.put(objectKey, bytes, { httpMetadata: { contentType }, customMetadata: { purpose: "chat" } });
    const statements = [
      env.DB.prepare(`
        INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,created_at)
        VALUES (?,?,?,'chat',?,?,?)
      `).bind(mediaId, session.user_id, objectKey, contentType, bytes.length, timestamp),
      env.DB.prepare(`
        INSERT INTO social_messages(id,sender_user_id,receiver_user_id,body,media_id,created_at)
        VALUES (?,?,?,'',?,?)
      `).bind(messageId, session.user_id, target, mediaId, timestamp),
    ];
    if (oldest) {
      statements.push(env.DB.prepare("UPDATE social_media SET state = 'pending_deletion' WHERE id = ?").bind(oldest.id));
      statements.push(env.DB.prepare(`
        INSERT OR IGNORE INTO media_deletion_queue(object_key,operation_id,next_attempt_at,created_at) VALUES (?,?,?,?)
      `).bind(oldest.object_key, safeUuid(), timestamp, timestamp));
    }
    try { await env.DB.batch(statements); }
    catch (error) { await env.MEDIA.delete(objectKey).catch(() => {}); throw error; }
    return json({ ok: true, messageId }, 201);
  }
  const body = await readJson(request);
  if (body.action === "unsend") {
    const messageId = identifier(body.id, "ไม่พบข้อความ");
    const result = await env.DB.prepare(`
      UPDATE social_messages SET unsent_at = ?
      WHERE id = ? AND sender_user_id = ? AND unsent_at IS NULL
    `).bind(unixTime(), messageId, session.user_id).run();
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
    const mediaId = String(body.mediaId || "") || null;
    const text = cleanText(body.body, 2000, { required: !mediaId });
    if (mediaId) {
      const reusable = await accessibleChatAsset(env.DB, mediaId, session.user_id);
      if (!reusable) throw new SocialError("media_not_found", "ไม่พบรูปภาพที่ส่งได้", 404);
    }
    await env.DB.prepare(`
      INSERT INTO social_messages(id, sender_user_id, receiver_user_id, body, media_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(safeUuid(), session.user_id, target, text, mediaId, unixTime()).run();
  } else {
    throw new SocialError("invalid_action", "คำขอไม่ถูกต้อง");
  }
  return json({ ok: true });
}

async function accessibleChatAsset(db, mediaId, userId) {
  return db.prepare(`
    SELECT media.id, media.object_key, media.content_type, media.byte_size, media.created_at
    FROM social_media media
    WHERE media.id = ? AND media.purpose = 'chat' AND media.state = 'active' AND (
      media.owner_user_id = ? OR EXISTS (
        SELECT 1 FROM social_messages message
        WHERE message.media_id = media.id AND message.unsent_at IS NULL
          AND (message.sender_user_id = ? OR message.receiver_user_id = ?)
          AND EXISTS (
            SELECT 1 FROM social_relationships relationship
            WHERE relationship.status = 'accepted' AND (
              (relationship.user_low = message.sender_user_id AND relationship.user_high = message.receiver_user_id)
              OR (relationship.user_low = message.receiver_user_id AND relationship.user_high = message.sender_user_id)
            )
          )
          AND NOT EXISTS (
            SELECT 1 FROM social_blocks blocked
            WHERE (blocked.blocker_user_id = message.sender_user_id AND blocked.blocked_user_id = message.receiver_user_id)
               OR (blocked.blocker_user_id = message.receiver_user_id AND blocked.blocked_user_id = message.sender_user_id)
          )
      )
    )
    LIMIT 1
  `).bind(mediaId, userId, userId, userId).first();
}

async function chatAssets(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "MESSAGING_ENABLED");
  const session = await authenticated(request, env);
  await requireProfile(env.DB, session.user_id);
  const rows = await env.DB.prepare(`
    SELECT media.id, media.content_type, media.byte_size, media.created_at FROM social_media media
    WHERE media.purpose = 'chat' AND media.state = 'active' AND (
      media.owner_user_id = ? OR EXISTS (
        SELECT 1 FROM social_messages message
        WHERE message.media_id = media.id AND message.unsent_at IS NULL
          AND (message.sender_user_id = ? OR message.receiver_user_id = ?)
          AND EXISTS (
            SELECT 1 FROM social_relationships relationship
            WHERE relationship.status = 'accepted' AND (
              (relationship.user_low = message.sender_user_id AND relationship.user_high = message.receiver_user_id)
              OR (relationship.user_low = message.receiver_user_id AND relationship.user_high = message.sender_user_id)
            )
          )
          AND NOT EXISTS (
            SELECT 1 FROM social_blocks blocked
            WHERE (blocked.blocker_user_id = message.sender_user_id AND blocked.blocked_user_id = message.receiver_user_id)
               OR (blocked.blocker_user_id = message.receiver_user_id AND blocked.blocked_user_id = message.sender_user_id)
          )
      )
    )
    ORDER BY media.created_at DESC, media.id DESC LIMIT 5
  `).bind(session.user_id, session.user_id, session.user_id).all();
  return json({ assets: rows.results || [] });
}

async function chatMedia(request, env, id) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "MESSAGING_ENABLED");
  const session = await authenticated(request, env);
  const media = await accessibleChatAsset(env.DB, id, session.user_id);
  if (!media || !env.MEDIA) {
    throw new SocialError("not_found", "ไม่พบรูปภาพ", 404);
  }
  const object = await env.MEDIA.get(media.object_key);
  if (!object) throw new SocialError("not_found", "ไม่พบรูปภาพ", 404);
  return new Response(object.body, { headers: {
    "content-type": media.content_type,
    "cache-control": "private, no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
    "content-disposition": "inline",
  } });
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

async function moderationAccess(request, env, roles) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "MODERATION_TOOLS_ENABLED");
  const session = await authenticated(request, env, { csrf: request.method === "POST" });
  const encodedPurpose = String(request.headers.get("x-moderation-purpose") || "");
  if (encodedPurpose.length > 900) throw new SocialError("purpose_required", "วัตถุประสงค์การเข้าถึงไม่ถูกต้อง");
  let decodedPurpose;
  try { decodedPurpose = decodeURIComponent(encodedPurpose); }
  catch { throw new SocialError("purpose_required", "วัตถุประสงค์การเข้าถึงไม่ถูกต้อง"); }
  const purpose = cleanText(decodedPurpose, 300, { required: true });
  if (purpose.length < 10) throw new SocialError("purpose_required", "กรุณาระบุวัตถุประสงค์การเข้าถึงอย่างน้อย 10 ตัวอักษร");
  const placeholders = roles.map(() => "?").join(",");
  const role = await env.DB.prepare(`
    SELECT role FROM moderation_roles WHERE user_id = ? AND role IN (${placeholders}) LIMIT 1
  `).bind(session.user_id, ...roles).first();
  if (!role) throw new SocialError("forbidden", "ไม่มีสิทธิ์เข้าถึงเครื่องมือดูแล", 403);
  return { session, purpose, role: role.role };
}

async function auditModeration(db, actor, action, subjectType, subjectId, purpose) {
  await db.prepare(`
    INSERT INTO moderation_audit_events(id, actor_user_id, action, subject_type, subject_id, purpose, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(safeUuid(), actor, action, subjectType, subjectId, purpose, unixTime()).run();
}

async function moderationReports(request, env) {
  const { session, purpose } = await moderationAccess(request, env, ["report_reviewer", "safety_admin"]);
  if (request.method === "GET") {
    const status = new URL(request.url).searchParams.get("status") || "pending";
    if (!["pending", "reviewed", "escalated", "closed"].includes(status)) throw new SocialError("invalid_status", "สถานะไม่ถูกต้อง");
    const rows = await env.DB.prepare(`
      SELECT r.id, r.category, r.details, r.status, r.created_at, r.reviewed_at,
             reporter.name reporter_name, subject.name subject_name, r.subject_user_id
      FROM social_reports r
      JOIN member_profiles reporter ON reporter.user_id = r.reporter_user_id
      JOIN member_profiles subject ON subject.user_id = r.subject_user_id
      WHERE r.status = ? ORDER BY r.created_at ASC LIMIT 100
    `).bind(status).all();
    await auditModeration(env.DB, session.user_id, "report_view", "report", `queue:${status}`, purpose);
    return json({ reports: rows.results || [] });
  }
  const body = await readJson(request);
  const id = String(body.id || "");
  const status = String(body.status || "");
  if (!["reviewed", "escalated", "closed"].includes(status)) throw new SocialError("invalid_status", "สถานะไม่ถูกต้อง");
  const decisionPurpose = `${purpose}; ${cleanText(body.note, 300, { required: true })}`.slice(0, 300);
  const timestamp = unixTime();
  const results = await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO moderation_audit_events(id,actor_user_id,action,subject_type,subject_id,purpose,created_at)
      SELECT ?,?,'report_review','report',?,?,? WHERE EXISTS(
        SELECT 1 FROM social_reports WHERE id = ? AND status <> 'closed'
      )
    `).bind(safeUuid(), session.user_id, id, decisionPurpose, timestamp, id),
    env.DB.prepare(`
      UPDATE social_reports SET status = ?, reviewed_at = ? WHERE id = ? AND status <> 'closed'
    `).bind(status, timestamp, id),
  ]);
  if (!Number(results[1]?.meta?.changes || 0)) throw new SocialError("not_found", "ไม่พบรายงานที่ดำเนินการได้", 404);
  return json({ ok: true });
}

async function moderationMessages(request, env) {
  const { session, purpose } = await moderationAccess(request, env, ["safety_admin"]);
  const before = Number(new URL(request.url).searchParams.get("before") || Number.MAX_SAFE_INTEGER);
  if (!Number.isFinite(before)) throw new SocialError("invalid_cursor", "คำขอไม่ถูกต้อง");
  const rows = await env.DB.prepare(`
    SELECT m.id, m.sender_user_id, m.receiver_user_id, m.body, m.media_id,
           m.unsent_at, m.read_at, m.created_at, sender.name sender_name, receiver.name receiver_name
    FROM social_messages m
    JOIN member_profiles sender ON sender.user_id = m.sender_user_id
    JOIN member_profiles receiver ON receiver.user_id = m.receiver_user_id
    WHERE m.created_at < ? ORDER BY m.created_at DESC, m.id DESC LIMIT 101
  `).bind(before).all();
  await auditModeration(env.DB, session.user_id, "message_audit_view", "message_audit", String(before), purpose);
  return json({ messages: (rows.results || []).slice(0, 100), hasMore: (rows.results || []).length > 100 });
}

async function moderationMessageMedia(request, env, id) {
  const { session, purpose } = await moderationAccess(request, env, ["safety_admin"]);
  const mediaId = identifier(id, "ไม่พบรูปในข้อความ");
  const media = await env.DB.prepare(`
    SELECT media.object_key, media.content_type, message.id message_id
    FROM social_media media
    JOIN social_messages message ON message.media_id = media.id
    WHERE media.id = ? AND media.state = 'active' AND message.unsent_at IS NULL
    LIMIT 1
  `).bind(mediaId).first();
  if (!media || !env.MEDIA) throw new SocialError("not_found", "ไม่พบรูปในข้อความ", 404);
  const object = await env.MEDIA.get(media.object_key);
  if (!object) throw new SocialError("not_found", "ไม่พบรูปในข้อความ", 404);
  await auditModeration(env.DB, session.user_id, "message_audit_view", "message_audit", media.message_id, purpose);
  return new Response(object.body, { headers: {
    "content-type": media.content_type,
    "cache-control": "private, no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
    "content-disposition": "inline",
  } });
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
  if (!target || target === session.user_id) throw new SocialError("invalid_target", "ไม่พบผู้ใช้", 404);
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

async function mayViewProfile(db, env, viewer, owner) {
  if (viewer === owner) return true;
  if (await isBlocked(db, viewer, owner)) return false;
  if (await accepted(db, viewer, owner)) return true;
  if (!enabled(env.PUBLIC_DISCOVERY_ENABLED)) return false;
  return Boolean(await db.prepare(`
    SELECT 1 visible FROM member_profiles p JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ? AND u.status = 'active' AND p.discovery_visible = 1 AND p.located_at > ?
  `).bind(owner, unixTime() - LOCATION_FRESH_SECONDS).first());
}

async function gallery(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  const session = await authenticated(request, env, { csrf: request.method === "POST" });
  await requireProfile(env.DB, session.user_id);
  if (request.method === "GET") {
    const url = new URL(request.url);
    const owner = String(url.searchParams.get("user") || session.user_id);
    if (!await mayViewProfile(env.DB, env, session.user_id, owner)) {
      throw new SocialError("not_found", "ไม่พบแกลเลอรี", 404);
    }
    const rows = await env.DB.prepare(`
      SELECT p.media_id id, p.caption, p.created_at, m.content_type, m.byte_size,
             mp.selected_photo_id = p.media_id selected,
             (SELECT COUNT(*) FROM photo_likes l WHERE l.media_id = p.media_id) like_count,
             EXISTS(SELECT 1 FROM photo_likes l WHERE l.media_id = p.media_id AND l.user_id = ?) liked
      FROM profile_photos p
      JOIN social_media m ON m.id = p.media_id AND m.state = 'active'
      JOIN member_profiles mp ON mp.user_id = p.owner_user_id
      WHERE p.owner_user_id = ? ORDER BY p.created_at DESC LIMIT 12
    `).bind(session.user_id, owner).all();
    const photos = rows.results || [];
    if (url.searchParams.get("photo")) {
      const id = String(url.searchParams.get("photo"));
      if (!photos.some((photo) => photo.id === id)) throw new SocialError("not_found", "ไม่พบรูปภาพ", 404);
      const canReadComments = owner === session.user_id || await accepted(env.DB, session.user_id, owner);
      if (!canReadComments) return json({ photos, comments: [], owner });
      const comments = await env.DB.prepare(`
        SELECT c.id, c.body, c.created_at, p.user_id sender_user_id, p.name sender_name
        FROM photo_comments c JOIN member_profiles p ON p.user_id = c.sender_user_id
        WHERE c.media_id = ? ORDER BY c.created_at ASC LIMIT 200
      `).bind(id).all();
      return json({ photos, comments: comments.results || [], owner });
    }
    return json({ photos, comments: [], owner });
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.startsWith("multipart/form-data")) {
    capability(env, "MEDIA_UPLOAD_ENABLED");
    if (!env.MEDIA) throw new Error("missing_media_binding");
    await limited(env, "gallery_upload_user_hour", session.user_id, 12, 3600);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new SocialError("invalid_file", "กรุณาเลือกรูปภาพ");
    if (file.size < 1 || file.size > 8 * 1024 * 1024) throw new SocialError("invalid_file_size", "รูปภาพต้องมีขนาดไม่เกิน 8 MB");
    const count = await env.DB.prepare(
      "SELECT COUNT(*) count FROM profile_photos WHERE owner_user_id = ?",
    ).bind(session.user_id).first();
    if (Number(count?.count || 0) >= 12) throw new SocialError("gallery_full", "อัปโหลดได้สูงสุด 12 รูป", 409);
    let image;
    try { image = sanitizeImage(new Uint8Array(await file.arrayBuffer()), file.type); }
    catch { throw new SocialError("invalid_image", "รองรับเฉพาะ JPG, PNG และ WebP ที่ถูกต้อง"); }
    const { bytes, contentType: detectedType } = image;
    const id = safeUuid();
    const objectKey = `gallery/${safeUuid()}`;
    const timestamp = unixTime();
    await env.MEDIA.put(objectKey, bytes, { httpMetadata: { contentType: detectedType }, customMetadata: { purpose: "gallery" } });
    try {
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO social_media(id, owner_user_id, object_key, purpose, content_type, byte_size, created_at)
          VALUES (?, ?, ?, 'gallery', ?, ?, ?)
        `).bind(id, session.user_id, objectKey, detectedType, bytes.length, timestamp),
        env.DB.prepare(`
          INSERT INTO profile_photos(media_id, owner_user_id, caption, created_at) VALUES (?, ?, ?, ?)
        `).bind(id, session.user_id, cleanText(form.get("caption"), 300), timestamp),
      ]);
    } catch (error) {
      await env.MEDIA.delete(objectKey).catch(() => {});
      throw error;
    }
    return json({ id }, 201);
  }

  const body = await readJson(request);
  const id = String(body.id || "");
  const photo = await env.DB.prepare(`
    SELECT p.owner_user_id, m.object_key, m.state
    FROM profile_photos p JOIN social_media m ON m.id = p.media_id WHERE p.media_id = ?
  `).bind(id).first();
  if (!photo) throw new SocialError("not_found", "ไม่พบรูปภาพ", 404);
  if (body.action === "delete") {
    capability(env, "MEDIA_UPLOAD_ENABLED");
    if (photo.owner_user_id !== session.user_id) throw new SocialError("forbidden", "ไม่มีสิทธิ์ลบรูปภาพ", 403);
    const timestamp = unixTime();
    await env.DB.batch([
      env.DB.prepare("UPDATE member_profiles SET selected_photo_id = NULL, updated_at = ? WHERE user_id = ? AND selected_photo_id = ?").bind(timestamp, session.user_id, id),
      env.DB.prepare("DELETE FROM profile_photos WHERE media_id = ? AND owner_user_id = ?").bind(id, session.user_id),
      env.DB.prepare("UPDATE social_media SET state = 'pending_deletion' WHERE id = ? AND owner_user_id = ?").bind(id, session.user_id),
      env.DB.prepare(`
        INSERT OR IGNORE INTO media_deletion_queue(object_key, operation_id, next_attempt_at, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(photo.object_key, safeUuid(), timestamp, timestamp),
    ]);
    return json({ ok: true, mediaDeletionPending: true });
  }
  if (!await mayViewProfile(env.DB, env, session.user_id, photo.owner_user_id)) {
    throw new SocialError("not_found", "ไม่พบรูปภาพ", 404);
  }
  if (body.action === "select") {
    if (photo.owner_user_id !== session.user_id) throw new SocialError("forbidden", "ไม่มีสิทธิ์เลือกรูปภาพ", 403);
    await env.DB.prepare("UPDATE member_profiles SET selected_photo_id = ?, updated_at = ? WHERE user_id = ?")
      .bind(id, unixTime(), session.user_id).run();
  } else if (body.action === "like") {
    await limited(env, "gallery_like_user_hour", session.user_id, 120, 3600);
    const liked = await env.DB.prepare("SELECT 1 liked FROM photo_likes WHERE media_id = ? AND user_id = ?")
      .bind(id, session.user_id).first();
    if (liked) await env.DB.prepare("DELETE FROM photo_likes WHERE media_id = ? AND user_id = ?").bind(id, session.user_id).run();
    else await env.DB.prepare("INSERT INTO photo_likes(media_id, user_id, created_at) VALUES (?, ?, ?)").bind(id, session.user_id, unixTime()).run();
  } else if (body.action === "comment") {
    await limited(env, "gallery_comment_user_hour", session.user_id, 40, 3600);
    await env.DB.prepare(`
      INSERT INTO photo_comments(id, media_id, sender_user_id, body, created_at) VALUES (?, ?, ?, ?, ?)
    `).bind(safeUuid(), id, session.user_id, cleanText(body.comment, 500, { required: true }), unixTime()).run();
  } else {
    throw new SocialError("invalid_action", "คำขอไม่ถูกต้อง");
  }
  return json({ ok: true });
}

async function mediaFile(request, env, id) {
  capability(env, "SOCIAL_APP_ENABLED");
  const session = await authenticated(request, env);
  const media = await env.DB.prepare(`
    SELECT m.object_key, m.content_type, m.owner_user_id, m.state
    FROM social_media m JOIN profile_photos p ON p.media_id = m.id
    WHERE m.id = ?
  `).bind(id).first();
  if (!media || media.state !== "active" || !await mayViewProfile(env.DB, env, session.user_id, media.owner_user_id)) {
    throw new SocialError("not_found", "ไม่พบรูปภาพ", 404);
  }
  if (!env.MEDIA) throw new Error("missing_media_binding");
  const object = await env.MEDIA.get(media.object_key);
  if (!object) throw new SocialError("not_found", "ไม่พบรูปภาพ", 404);
  return new Response(object.body, {
    headers: {
      "content-type": media.content_type,
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "content-disposition": "inline",
    },
  });
}

async function verification(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "IDENTITY_VERIFICATION_ENABLED");
  const session = await authenticated(request, env, { csrf: request.method === "POST" });
  await requireProfile(env.DB, session.user_id);
  if (request.method === "GET") {
    const row = await env.DB.prepare(`
      SELECT status, reason, created_at, reviewed_at FROM identity_verification_requests WHERE user_id = ?
    `).bind(session.user_id).first();
    return json({ verification: row || null });
  }
  if (!hasRecentAuthentication(session)) throw new SocialError("recent_auth_required", "กรุณายืนยันตัวตนอีกครั้ง", 428);
  if (!env.MEDIA) throw new Error("missing_media_binding");
  await limited(env, "verification_submit_user_day", session.user_id, 3, 86400);
  const current = await env.DB.prepare("SELECT status FROM identity_verification_requests WHERE user_id = ?").bind(session.user_id).first();
  if (current?.status === "pending") throw new SocialError("verification_pending", "คำขอตรวจสอบอยู่ระหว่างดำเนินการ", 409);
  if (current?.status === "approved") throw new SocialError("already_verified", "บัญชีได้รับการยืนยันแล้ว", 409);
  const form = await request.formData();
  if (form.get("consent") !== "accepted") throw new SocialError("consent_required", "กรุณายืนยันความยินยอมก่อนส่งหลักฐาน");
  const files = [["id", form.get("identity")], ["selfie", form.get("selfie")]];
  const prepared = [];
  for (const [kind, file] of files) {
    if (!(file instanceof File) || file.size < 1 || file.size > 8 * 1024 * 1024) {
      throw new SocialError("invalid_file", "หลักฐานแต่ละรูปต้องมีขนาดไม่เกิน 8 MB");
    }
    let image;
    try { image = sanitizeImage(new Uint8Array(await file.arrayBuffer()), file.type); }
    catch { throw new SocialError("invalid_image", "รองรับเฉพาะ JPG, PNG และ WebP ที่ถูกต้อง"); }
    prepared.push({ kind, id: safeUuid(), key: `verification/${safeUuid()}`, bytes: image.bytes, contentType: image.contentType });
  }
  const uploaded = [];
  try {
    for (const item of prepared) {
      await env.MEDIA.put(item.key, item.bytes, { httpMetadata: { contentType: item.contentType }, customMetadata: { purpose: `verification_${item.kind}` } });
      uploaded.push(item.key);
    }
  } catch (error) {
    await Promise.all(uploaded.map((key) => env.MEDIA.delete(key).catch(() => {})));
    throw error;
  }
  const timestamp = unixTime();
  try {
    await env.DB.batch([
      ...prepared.map((item) => env.DB.prepare(`
        INSERT INTO social_media(id, owner_user_id, object_key, purpose, content_type, byte_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(item.id, session.user_id, item.key, item.kind === "id" ? "verification_id" : "verification_selfie", item.contentType, item.bytes.length, timestamp)),
      env.DB.prepare(`
        INSERT INTO identity_verification_requests(user_id,id_media_id,selfie_media_id,status,reason,created_at,reviewed_at,reviewed_by)
        VALUES (?, ?, ?, 'pending', '', ?, NULL, NULL)
        ON CONFLICT(user_id) DO UPDATE SET id_media_id=excluded.id_media_id,
          selfie_media_id=excluded.selfie_media_id,status='pending',reason='',created_at=excluded.created_at,
          reviewed_at=NULL,reviewed_by=NULL
      `).bind(session.user_id, prepared[0].id, prepared[1].id, timestamp),
    ]);
  } catch (error) {
    await Promise.all(prepared.map((item) => env.MEDIA.delete(item.key).catch(() => {})));
    throw error;
  }
  return json({ verification: { status: "pending", created_at: timestamp } }, 201);
}

async function moderationVerification(request, env) {
  capability(env, "IDENTITY_VERIFICATION_ENABLED");
  const { session, purpose } = await moderationAccess(request, env, ["identity_reviewer", "safety_admin"]);
  if (request.method === "GET") {
    const rows = await env.DB.prepare(`
      SELECT v.user_id, v.id_media_id, v.selfie_media_id, v.status, v.created_at, p.name
      FROM identity_verification_requests v JOIN member_profiles p ON p.user_id = v.user_id
      WHERE v.status = 'pending' ORDER BY v.created_at ASC LIMIT 50
    `).all();
    await auditModeration(env.DB, session.user_id, "verification_view", "verification", "queue:pending", purpose);
    return json({ requests: rows.results || [] });
  }
  const body = await readJson(request);
  const target = String(body.user || "");
  const status = String(body.status || "");
  if (!["approved", "rejected"].includes(status)) throw new SocialError("invalid_status", "สถานะไม่ถูกต้อง");
  const reason = cleanText(body.reason, 300, { required: status === "rejected" });
  const evidence = await env.DB.prepare(`
    SELECT v.id_media_id, v.selfie_media_id, idm.object_key id_key, selfie.object_key selfie_key
    FROM identity_verification_requests v
    LEFT JOIN social_media idm ON idm.id = v.id_media_id
    LEFT JOIN social_media selfie ON selfie.id = v.selfie_media_id
    WHERE v.user_id = ? AND v.status = 'pending'
  `).bind(target).first();
  if (!evidence) throw new SocialError("not_found", "ไม่พบคำขอที่รอตรวจสอบ", 404);
  const timestamp = unixTime();
  const statements = [];
  for (const [mediaId, objectKey] of [[evidence.id_media_id, evidence.id_key], [evidence.selfie_media_id, evidence.selfie_key]]) {
    if (!mediaId || !objectKey) continue;
    statements.push(env.DB.prepare(`
      UPDATE social_media SET state = 'pending_deletion' WHERE id = ? AND EXISTS(
        SELECT 1 FROM identity_verification_requests WHERE user_id = ? AND status = 'pending'
      )
    `).bind(mediaId, target));
    statements.push(env.DB.prepare(`
      INSERT OR IGNORE INTO media_deletion_queue(object_key,operation_id,next_attempt_at,created_at)
      SELECT ?,?,?,? WHERE EXISTS(
        SELECT 1 FROM identity_verification_requests WHERE user_id = ? AND status = 'pending'
      )
    `).bind(objectKey, safeUuid(), timestamp, timestamp, target));
  }
  statements.push(env.DB.prepare(`
    INSERT INTO moderation_audit_events(id,actor_user_id,action,subject_type,subject_id,purpose,created_at)
    SELECT ?,?,'verification_decision','verification',?,?,? WHERE EXISTS(
      SELECT 1 FROM identity_verification_requests WHERE user_id = ? AND status = 'pending'
    )
  `).bind(safeUuid(), session.user_id, target, `${purpose}; ${status}`.slice(0, 300), timestamp, target));
  statements.push(env.DB.prepare(`
    UPDATE identity_verification_requests SET status = ?, reason = ?, reviewed_at = ?, reviewed_by = ?,
      id_media_id = NULL, selfie_media_id = NULL WHERE user_id = ? AND status = 'pending'
  `).bind(status, reason, timestamp, session.user_id, target));
  const results = await env.DB.batch(statements);
  if (!Number(results.at(-1)?.meta?.changes || 0)) throw new SocialError("not_found", "ไม่พบคำขอที่รอตรวจสอบ", 404);
  return json({ ok: true, evidenceDeletionPending: true });
}

async function verificationMedia(request, env, id) {
  capability(env, "IDENTITY_VERIFICATION_ENABLED");
  const { session, purpose } = await moderationAccess(request, env, ["identity_reviewer", "safety_admin"]);
  const media = await env.DB.prepare(`
    SELECT m.object_key, m.content_type, m.owner_user_id FROM social_media m
    JOIN identity_verification_requests v ON v.id_media_id = m.id OR v.selfie_media_id = m.id
    WHERE m.id = ? AND m.state = 'active' AND v.status = 'pending'
  `).bind(id).first();
  if (!media || !env.MEDIA) throw new SocialError("not_found", "ไม่พบหลักฐาน", 404);
  const object = await env.MEDIA.get(media.object_key);
  if (!object) throw new SocialError("not_found", "ไม่พบหลักฐาน", 404);
  await auditModeration(env.DB, session.user_id, "verification_view", "verification", media.owner_user_id, purpose);
  return new Response(object.body, { headers: {
    "content-type": media.content_type,
    "cache-control": "private, no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
    "content-disposition": "inline",
  } });
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
    if (path === "/api/social/blocks" && ["GET", "POST"].includes(request.method)) return await blocks(request, env);
    if (path === "/api/social/messages" && ["GET", "POST"].includes(request.method)) return await messages(request, env);
    if (request.method === "GET" && path === "/api/social/chat-assets") return await chatAssets(request, env);
    if (request.method === "GET" && path.startsWith("/api/social/chat/media/")) {
      return await chatMedia(request, env, decodeURIComponent(path.slice("/api/social/chat/media/".length)));
    }
    if (request.method === "POST" && path === "/api/social/reports") return await reports(request, env);
    if (path === "/api/social/moderation/reports" && ["GET", "POST"].includes(request.method)) return await moderationReports(request, env);
    if (request.method === "GET" && path === "/api/social/moderation/messages") return await moderationMessages(request, env);
    if (request.method === "GET" && path.startsWith("/api/social/moderation/messages/media/")) {
      return await moderationMessageMedia(request, env, decodeURIComponent(path.slice("/api/social/moderation/messages/media/".length)));
    }
    if (path === "/api/social/ratings" && ["GET", "POST"].includes(request.method)) return await ratings(request, env);
    if (path === "/api/social/gallery" && ["GET", "POST"].includes(request.method)) return await gallery(request, env);
    if (request.method === "GET" && path.startsWith("/api/social/media/")) {
      return await mediaFile(request, env, decodeURIComponent(path.slice("/api/social/media/".length)));
    }
    if (path === "/api/social/verification" && ["GET", "POST"].includes(request.method)) return await verification(request, env);
    if (path === "/api/social/moderation/verification" && ["GET", "POST"].includes(request.method)) return await moderationVerification(request, env);
    if (request.method === "GET" && path.startsWith("/api/social/moderation/verification/media/")) {
      return await verificationMedia(request, env, decodeURIComponent(path.slice("/api/social/moderation/verification/media/".length)));
    }
    return failure("ไม่พบหน้าที่เรียก", 404, "not_found");
  } catch (error) {
    if (error instanceof RequestError) return failure("คำขอไม่ถูกต้อง", error.status, error.code);
    if (error instanceof SocialError) return failure(error.message, error.status, error.code);
    console.error(JSON.stringify({ event: "social_request_failed", reason: error?.message || "unknown" }));
    return failure("ไม่สามารถดำเนินการได้ กรุณาลองใหม่", 500, "internal_error");
  }
}
