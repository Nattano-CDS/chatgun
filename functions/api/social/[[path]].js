import { safeUuid } from "../../_lib/crypto.js";
import { eligibilityModeration } from '../../_lib/eligibility-review.js';
import { onlineStatuses, writeOnlineHeartbeat } from '../../_lib/online-presence.js';
import { getSession, hasRecentAuthentication, rateLimit, requireCsrf, unixTime } from "../../_lib/db.js";
import { RequestError, failure, json, readJson, requireSameOrigin } from "../../_lib/http.js";
import { sanitizeImage } from "../../_lib/image.js";
import { acceptanceFlowEnabled, currentAcceptance } from "../../_lib/acceptance.js";
import { selfDeclaredAdult } from "../../_lib/age.js";
import { requireCloudflareAdminAccess } from "../../_lib/cloudflare-admin-access.js";
import { standaloneAdminEnabled, adminAccessContext, getAdminAccessSession, startAdminAccessSession, adminCsrfValid } from '../../_lib/cloudflare-admin-session.js';
import { canContact, albumGrant, canViewPhoto, publicPortrait, publicPortraitColumn, eligibleSql, unblockedSql } from "../../_lib/social-permissions.js";

const LOCATION_FRESH_SECONDS = 120;
const MEDIA_UPLOAD_DAILY_LIMIT = 10;
const MEDIA_UPLOAD_RESERVATION_SECONDS = 15 * 60;
const MODERATION_COVERAGE = Object.freeze({
  timezone: "Asia/Bangkok",
  utcOffset: "+07:00",
  start: "19:00",
  end: "22:00",
  days: "every_day",
  weeklyHours: 21,
});
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

function queuePage(request,limit=50){
  const params=new URL(request.url).searchParams,page=Number(params.get('page')||1),q=String(params.get('q')||'').trim();
  if(!Number.isSafeInteger(page)||page<1||page>10000||q.length>80)throw new SocialError('invalid_cursor','ตัวกรองหรือหน้ารายการไม่ถูกต้อง');
  return{page,limit,offset:(page-1)*limit,q};
}
function queueResult(rows,key,paging){const items=rows.results||[];return json({[key]:items.slice(0,paging.limit),page:paging.page,hasMore:items.length>paging.limit});}
function betaTargetSql(env,alias){return enabled(env.BETA_ENROLLMENT_REQUIRED)?`EXISTS(SELECT 1 FROM beta_enrollments admitted WHERE admitted.user_id=${alias} AND admitted.status='active')`:'1';}
async function requireBetaTarget(env,id){if(enabled(env.BETA_ENROLLMENT_REQUIRED)&&!await env.DB.prepare("SELECT 1 ok FROM beta_enrollments WHERE user_id=? AND status='active'").bind(id).first())throw new SocialError('not_found','ไม่พบสมาชิกที่มีสิทธิ์เข้าร่วม',404);}
async function safeOnlineStatuses(env,viewer,targets){
  if(!enabled(env.BETA_ENROLLMENT_REQUIRED))return onlineStatuses(env.DB,viewer,targets);
  const unique=[...new Set(targets)];if(!unique.length)return{};
  const admitted=await env.DB.prepare(`SELECT user_id FROM beta_enrollments WHERE status='active' AND user_id IN (${unique.map(()=>'?').join(',')})`).bind(...unique).all();
  return{...Object.fromEntries(unique.map(id=>[id,false])),...await onlineStatuses(env.DB,viewer,(admitted.results||[]).map(r=>r.user_id))};
}

export function bangkokUploadWindow(timestampMs = Date.now()) {
  const shifted = new Date(timestampMs + 7 * 60 * 60 * 1000);
  const localDay = shifted.toISOString().slice(0, 10);
  const [year, month, day] = localDay.split("-").map(Number);
  return {
    localDay,
    resetsAt: Math.floor((Date.UTC(year, month - 1, day + 1) - 7 * 60 * 60 * 1000) / 1000),
    timezone: "Asia/Bangkok",
  };
}

function uploadIdempotencyKey(request) {
  const key = String(request.headers.get("idempotency-key") || "").trim();
  if (!/^[A-Za-z0-9._:-]{16,128}$/u.test(key)) {
    throw new SocialError("invalid_idempotency_key", "ไม่สามารถยืนยันคำขออัปโหลดได้ กรุณาลองใหม่", 400);
  }
  return key;
}

async function reserveMediaUpload(db, userId, category, idempotencyKey, timestamp = unixTime()) {
  const window = bangkokUploadWindow(timestamp * 1000);
  const staleBefore = timestamp - MEDIA_UPLOAD_RESERVATION_SECONDS;
  const existing = await db.prepare(`
    SELECT status, local_day, media_id, result_id, reserved_at
    FROM media_upload_quota_attempts
    WHERE user_id = ? AND category = ? AND idempotency_key = ?
  `).bind(userId, category, idempotencyKey).first();
  if (existing?.status === "completed") return { replay: true, ...existing, ...window };
  if (existing?.status === "reserved" && Number(existing.reserved_at) > staleBefore) {
    throw new SocialError("upload_in_progress", "คำขออัปโหลดนี้กำลังดำเนินการ", 409);
  }
  const result = await db.prepare(`
    INSERT INTO media_upload_quota_attempts(
      user_id, category, idempotency_key, local_day, status, reserved_at
    )
    SELECT ?, ?, ?, ?, 'reserved', ?
    WHERE (
      SELECT COUNT(*) FROM media_upload_quota_attempts quota
      WHERE quota.user_id = ? AND quota.category = ? AND quota.local_day = ?
        AND (quota.status = 'completed'
          OR (quota.status = 'reserved' AND quota.reserved_at > ?))
    ) < ?
    ON CONFLICT(user_id, category, idempotency_key) DO UPDATE SET
      local_day = excluded.local_day,
      status = 'reserved',
      media_id = NULL,
      result_id = NULL,
      reserved_at = excluded.reserved_at,
      completed_at = NULL,
      released_at = NULL
    WHERE media_upload_quota_attempts.status = 'released'
       OR (media_upload_quota_attempts.status = 'reserved'
         AND media_upload_quota_attempts.reserved_at <= ?)
  `).bind(
    userId, category, idempotencyKey, window.localDay, timestamp,
    userId, category, window.localDay, staleBefore, MEDIA_UPLOAD_DAILY_LIMIT, staleBefore,
  ).run();
  if (Number(result.meta?.changes || 0) === 1) return { replay: false, ...window };
  const conflict = await db.prepare(`
    SELECT status, media_id, result_id FROM media_upload_quota_attempts
    WHERE user_id = ? AND category = ? AND idempotency_key = ?
  `).bind(userId, category, idempotencyKey).first();
  if (conflict?.status === "completed") return { replay: true, ...conflict, ...window };
  if (conflict?.status === "reserved") throw new SocialError("upload_in_progress", "คำขออัปโหลดนี้กำลังดำเนินการ", 409);
  throw new SocialError("daily_upload_limit_reached", `อัปโหลดรูป${category === "chat" ? "ในแชท" : "แกลเลอรี"}ครบ 10 รูปสำหรับวันนี้แล้ว ลองใหม่หลัง 00:00 น.`, 429);
}

function completeMediaUploadStatement(db, userId, category, idempotencyKey, mediaId, resultId, timestamp) {
  return db.prepare(`
    UPDATE media_upload_quota_attempts
    SET status = 'completed', media_id = ?, result_id = ?, completed_at = ?, released_at = NULL
    WHERE user_id = ? AND category = ? AND idempotency_key = ? AND status = 'reserved'
  `).bind(mediaId, resultId, timestamp, userId, category, idempotencyKey);
}

async function releaseMediaUpload(db, userId, category, idempotencyKey, timestamp = unixTime()) {
  await db.prepare(`
    UPDATE media_upload_quota_attempts
    SET status = 'released', released_at = ?, completed_at = NULL, media_id = NULL, result_id = NULL
    WHERE user_id = ? AND category = ? AND idempotency_key = ? AND status = 'reserved'
  `).bind(timestamp, userId, category, idempotencyKey).run();
}

async function uploadQuotas(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  const session = await authenticated(request, env);
  await requireProfile(env.DB, session.user_id);
  const timestamp = unixTime();
  const window = bangkokUploadWindow(timestamp * 1000);
  const staleBefore = timestamp - MEDIA_UPLOAD_RESERVATION_SECONDS;
  const rows = await env.DB.prepare(`
    SELECT category,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) completed,
      SUM(CASE WHEN status = 'reserved' AND reserved_at > ? THEN 1 ELSE 0 END) reserved
    FROM media_upload_quota_attempts
    WHERE user_id = ? AND local_day = ?
    GROUP BY category
  `).bind(staleBefore, session.user_id, window.localDay).all();
  const byCategory = Object.fromEntries((rows.results || []).map((row) => [row.category, row]));
  const category = (name) => {
    const completed = Number(byCategory[name]?.completed || 0);
    const reserved = Number(byCategory[name]?.reserved || 0);
    return { limit: MEDIA_UPLOAD_DAILY_LIMIT, used: completed, reserved, remaining: Math.max(0, MEDIA_UPLOAD_DAILY_LIMIT - completed - reserved) };
  };
  // Only the authenticated owner's aggregate; never expose another member's
  // private album count. The insertion trigger remains the atomic backstop.
  const capacity = await env.DB.prepare('SELECT COUNT(*) AS used FROM profile_photos WHERE owner_user_id = ?').bind(session.user_id).first();
  return json({ ...window, chat: category("chat"), gallery: category("gallery"), galleryCapacity: {used:Number(capacity.used),limit:12,remaining:Math.max(0,12-Number(capacity.used))} });
}

export function moderationCoverage(timestampMs = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MODERATION_COVERAGE.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestampMs));
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const minutes = hour * 60 + minute;
  return {
    ...MODERATION_COVERAGE,
    isOpen: minutes >= 19 * 60 && minutes < 22 * 60,
    reportingAlwaysAvailable: true,
    immediateResponseGuaranteed: false,
  };
}

function capability(env, name) {
  if (!enabled(env[name])) throw new SocialError("feature_disabled", "ฟีเจอร์นี้ยังไม่เปิดใช้งาน", 404);
}

async function authenticated(request, env, { csrf = false, onboarding = false, allowRevokedEnrollment = false } = {}) {
  const session = await getSession(request, env.DB);
  if (!session) throw new SocialError("unauthorized", "กรุณาเข้าสู่ระบบ", 401);
  if(enabled(env.UAT_PRIVATE_COHORT_REQUIRED)&&!await env.DB.prepare("SELECT 1 ok FROM uat_authorized_identities WHERE user_id=? AND revoked_at IS NULL").bind(session.user_id).first())throw new SocialError('uat_cohort_required','บัญชีนี้ไม่อยู่ในกลุ่ม UAT ส่วนตัวที่ได้รับอนุญาต',403);
  const ageHold = await env.DB.prepare("SELECT 1 held FROM member_age_safety_holds WHERE user_id=? AND (state='held' OR age_band<>'20_plus')").bind(session.user_id).first();
  if (ageHold) throw new SocialError('age_safety_review_required', 'บัญชีนี้ยังไม่เปิดใช้ฟีเจอร์สังคมระหว่างตรวจสอบสิทธิ์ตามช่วงอายุ คุณยังเข้าหน้าบัญชีเพื่อออกจากระบบ ติดต่อผู้ดูแล หรือขอลบข้อมูลได้', 403);
  const betaEnrollment = await env.DB.prepare(
    `SELECT (SELECT status FROM beta_enrollments WHERE user_id=?) status,
      EXISTS(SELECT 1 FROM beta_account_restrictions WHERE user_id=? AND status='active') account_restricted`,
  ).bind(session.user_id,session.user_id).first();
  if (betaEnrollment?.status === "revoked" && !allowRevokedEnrollment) {
    throw new SocialError("beta_access_revoked", "สิทธิ์เข้าร่วม Beta ถูกระงับ", 403);
  }
  // Public registrations have no Beta enrollment. Restrictions must remain
  // effective after re-login and even if the moderation UI flag is disabled.
  if(betaEnrollment?.account_restricted&&!allowRevokedEnrollment)throw new SocialError('account_access_restricted','บัญชีถูกระงับสิทธิ์ กรุณาไปหน้าบัญชีเพื่อดูหรือยื่นอุทธรณ์',403);
  if (acceptanceFlowEnabled(env)) {
    const acceptance = await currentAcceptance(env.DB, session.user_id, env);
    if (!acceptance.accepted || session.account_state === "pending_acceptance") {
      throw new SocialError("acceptance_required", "กรุณายืนยันอายุและยอมรับข้อกำหนดก่อน", 403);
    }
    if (onboarding) {
      if (!["pending_onboarding", "active"].includes(session.account_state)) {
        throw new SocialError("onboarding_not_available", "บัญชีนี้ไม่อยู่ในขั้นตอนสร้างโปรไฟล์", 403);
      }
    } else if (session.account_state !== "active") {
      throw new SocialError("onboarding_required", "กรุณาสร้างโปรไฟล์ก่อน", 403);
    }
  }
  if(enabled(env.BETA_ENROLLMENT_REQUIRED)&&betaEnrollment?.status!=='active'&&!(onboarding&&betaEnrollment?.status==='pending_age')&&!(allowRevokedEnrollment&&betaEnrollment?.status==='revoked'))throw new SocialError('beta_access_required','บัญชีนี้ยังไม่ได้รับสิทธิ์สำหรับรอบทดสอบที่เปิดอยู่',403);
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
           p.discovery_visible, p.direct_messages_enabled, p.accuracy, p.located_at, p.created_at, p.updated_at,
           EXISTS(
             SELECT 1 FROM age_assurance_events a
             WHERE a.id = p.age_assurance_id AND a.user_id = p.user_id
               AND a.age_band = 'adult_18_plus' AND a.revoked_at IS NULL
           ) AS adult_self_declared,
           0 AS age_independently_verified,
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
  if(!await db.prepare(`SELECT 1 ok WHERE ${eligibleSql('?')}`).bind(userId).first()) throw new SocialError('account_ineligible','บัญชีนี้ยังไม่มีสิทธิ์ใช้ฟีเจอร์สังคม',403);
  return profile;
}

function visibleProfile(profile, own) {
  if (own) return profile;
  const {
    accuracy: _accuracy,
    located_at: _locatedAt,
    discovery_visible: _discoveryVisible,
    adult_self_declared: _adultSelfDeclared,
    age_independently_verified: _ageVerified,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...visible
  } = profile;
  return visible;
}

async function targetExists(db, target) {
  return Boolean(await db.prepare(`
    SELECT 1 present FROM member_profiles p JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ? AND u.status = 'active' AND u.account_state = 'active'
  `).bind(target).first());
}

async function isBlocked(db, a, b) {
  return Boolean(await db.prepare(`
    SELECT 1 blocked FROM social_blocks
    WHERE (blocker_user_id = ? AND blocked_user_id = ?)
       OR (blocker_user_id = ? AND blocked_user_id = ?)
  `).bind(a, b, b, a).first());
}

async function independentlyVerifiedAdult(db, userId, timestamp = unixTime()) {
  return Boolean(await db.prepare(`
    SELECT 1 verified FROM independent_age_assurances
    WHERE user_id = ? AND status = 'verified' AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY verified_at DESC LIMIT 1
  `).bind(userId, timestamp).first());
}

async function approvedMediaForViewer(env, review, userId) {
  if (review?.review_status !== "released") return false;
  const category = review.review_category || "general";
  if (category === "general") return true;
  if (category !== "sensitive" || !enabled(env.SENSITIVE_CONTENT_ENABLED)) return false;
  return independentlyVerifiedAdult(env.DB, userId);
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

function privateDistance(metres) {
  if (metres < 250) return { distance: 250, distance_min: 0, distance_max: 250, distance_label: "ใกล้กว่า 250 ม." };
  const maximum = Math.ceil(metres / 250) * 250;
  return { distance: maximum, distance_min: maximum - 250, distance_max: maximum, distance_label: `ประมาณ ${maximum} ม.` };
}

async function config(env) {
  const socialAppEnabled = enabled(env.SOCIAL_APP_ENABLED);
  const adultOnboardingEnabled = socialAppEnabled && enabled(env.ADULT_ONBOARDING_ENABLED);
  return json({
    socialAppEnabled,
    adultOnboardingEnabled,
    ageAssuranceModel: adultOnboardingEnabled ? "post_oauth_self_declaration_without_date_of_birth" : null,
    adultNoticeVersion: adultOnboardingEnabled ? String(env.ADULT_NOTICE_VERSION || "") || null : null,
    publicDiscoveryEnabled: enabled(env.PUBLIC_DISCOVERY_ENABLED),
    friendRequestsEnabled: false,
    messagingEnabled: enabled(env.MESSAGING_ENABLED),
    mediaUploadEnabled: enabled(env.MEDIA_UPLOAD_ENABLED),
    mediaQuarantineEnabled: enabled(env.MEDIA_QUARANTINE_ENABLED),
    ratingsEnabled: enabled(env.RATINGS_ENABLED),
    identityVerificationEnabled: enabled(env.IDENTITY_VERIFICATION_ENABLED),
    sensitiveContentEnabled: enabled(env.SENSITIVE_CONTENT_ENABLED),
    demoModeEnabled: false,
    demoAutoStartEnabled: false,
    onlineStatusEnabled: socialAppEnabled && enabled(env.PRESENCE_ENABLED),
    moderationToolsEnabled: socialAppEnabled && enabled(env.MODERATION_TOOLS_ENABLED),
    alwaysOnPrivateUat: socialAppEnabled && env.UAT_ACCESS_MODE === "always-on-until-explicit-close",
    participantAccess: socialAppEnabled && env.UAT_ACCESS_MODE === "always-on-until-explicit-close" ? "24x7-until-explicit-close" : null,
    moderationCoverage: socialAppEnabled && env.UAT_ACCESS_MODE === "always-on-until-explicit-close" ? moderationCoverage() : null,
    adminAccessStandaloneEnabled: standaloneAdminEnabled(env),
    accountModerationEnabled: socialAppEnabled && enabled(env.ACCOUNT_MODERATION_ENABLED),
    gameEnabled: false,
    emailOtpEnabled: false,
    mobileOtpEnabled: false,
  });
}

async function onlinePresence(request,env) {
  capability(env,'SOCIAL_APP_ENABLED');capability(env,'PRESENCE_ENABLED');
  const session=await authenticated(request,env,{csrf:request.method==='POST'});
  await requireProfile(env.DB,session.user_id);
  if(request.method==='GET') {
    await limited(env,'online_read_minute',session.user_id,120,60);
    const raw=new URL(request.url).searchParams.get('users')||'';
    const ids=raw?raw.split(','):[];
    if(ids.length>50||ids.some(id=>!id||id.length>128))throw new SocialError('invalid_input','ข้อมูลไม่ถูกต้อง');
    const pref=await env.DB.prepare('SELECT show_online FROM member_presence_preferences WHERE user_id=?').bind(session.user_id).first();
    return json({showOnline:pref?.show_online===1,statuses:await safeOnlineStatuses(env,session.user_id,ids)});
  }
  const body=await readJson(request);
  if(body.action==='preference') {
    if(typeof body.enabled!=='boolean')throw new SocialError('invalid_input','ข้อมูลไม่ถูกต้อง');
    await limited(env,'online_preference_minute',session.user_id,10,60);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO member_presence_preferences(user_id,show_online) VALUES (?,?)
        ON CONFLICT(user_id) DO UPDATE SET show_online=excluded.show_online`).bind(session.user_id,body.enabled?1:0),
      env.DB.prepare('DELETE FROM member_presence_leases WHERE user_id=?').bind(session.user_id),
    ]);
    return json({ok:true,showOnline:body.enabled});
  }
  if(!/^[a-zA-Z0-9_-]{16,64}$/.test(body.tabId||''))throw new SocialError('invalid_input','ข้อมูลไม่ถูกต้อง');
  await limited(env,'online_heartbeat_minute',session.user_id,12,60);
  if(body.action==='offline') {
    await env.DB.prepare('DELETE FROM member_presence_leases WHERE session_token_hash=? AND tab_id=?').bind(session.token_hash,body.tabId).run();
  } else if(body.action==='heartbeat'&&body.foreground===true) {
    await writeOnlineHeartbeat(env.DB,session,body.tabId);
  } else throw new SocialError('invalid_input','ข้อมูลไม่ถูกต้อง');
  return json({ok:true});
}

async function memberOnboarding(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "ADULT_ONBOARDING_ENABLED");
  const session = await authenticated(request, env, { csrf: true, onboarding: true });
  if (acceptanceFlowEnabled(env) && session.account_state === "active") {
    const existingProfile = await env.DB.prepare("SELECT 1 present FROM member_profiles WHERE user_id = ?")
      .bind(session.user_id).first();
    if (existingProfile) throw new SocialError("onboarding_complete", "สร้างโปรไฟล์เรียบร้อยแล้ว", 409);
  }
  const betaEnrollment = enabled(env.BETA_INVITATION_REGISTRATION_ENABLED)
    ? await env.DB.prepare(
      "SELECT status FROM beta_enrollments WHERE user_id = ?",
    ).bind(session.user_id).first()
    : null;
  const resumableExistingAccount = acceptanceFlowEnabled(env)
    && session.account_state === "pending_onboarding" && !betaEnrollment;
  if (!enabled(env.NEW_ACCOUNT_REGISTRATION_ENABLED)
    && betaEnrollment?.status !== "pending_age" && !resumableExistingAccount) {
    throw new SocialError("registration_closed", "ขณะนี้ยังไม่เปิดรับสมัครบัญชีใหม่", 403);
  }
  if (!hasRecentAuthentication(session)) {
    throw new SocialError("recent_auth_required", "กรุณายืนยันตัวตนอีกครั้ง", 428);
  }
  await limited(env, "adult_onboarding_user_hour", session.user_id, 5, 3600);
  const body = await readJson(request);
  const name = cleanText(body.name || session.display_name, 50, { required: true });
  const gender = ALLOWED_GENDERS.has(body.gender) ? body.gender : "ไม่ระบุ";
  const bio = cleanText(body.bio, 250);
  const interests = cleanText(body.interests, 100);
  const timestamp = unixTime();
  const noticeVersion = String(env.ADULT_NOTICE_VERSION || "");
  let assurance;
  const assuranceStatements = [];
  if (acceptanceFlowEnabled(env)) {
    assurance = await env.DB.prepare(`
      SELECT id FROM age_assurance_events
      WHERE user_id = ? AND age_band = 'adult_18_plus' AND method = 'self_declaration'
        AND notice_version = ? AND revoked_at IS NULL
      ORDER BY declared_at DESC LIMIT 1
    `).bind(session.user_id, noticeVersion).first();
    if (!assurance) throw new SocialError("acceptance_required", "กรุณายืนยันอายุและยอมรับข้อกำหนดก่อน", 403);
  } else {
    const declaredAge = selfDeclaredAdult(body.dateOfBirth);
    if (!noticeVersion || body.confirmedAdult !== true || body.noticeVersion !== noticeVersion
      || !declaredAge.valid || !declaredAge.adult) {
      throw new SocialError("adult_confirmation_required", "กรุณายืนยันว่าคุณมีอายุ 18 ปีขึ้นไป", 400);
    }
    assurance = { id: safeUuid() };
    assuranceStatements.push(
      env.DB.prepare("UPDATE age_assurance_events SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
        .bind(timestamp, session.user_id),
      env.DB.prepare(`
        INSERT INTO age_assurance_events(id, user_id, age_band, method, notice_version, declared_at)
        VALUES (?, ?, 'adult_18_plus', 'self_declaration', ?, ?)
      `).bind(assurance.id, session.user_id, noticeVersion, timestamp),
    );
  }
  await env.DB.batch([
    ...assuranceStatements,
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
    `).bind(session.user_id, assurance.id, name, gender, bio, interests, timestamp, timestamp),
    env.DB.prepare(`
      UPDATE beta_enrollments SET status = 'active', activated_at = ?
      WHERE user_id = ? AND status = 'pending_age'
    `).bind(timestamp, session.user_id),
    env.DB.prepare(`
      UPDATE users SET account_state = 'active', updated_at = ?
      WHERE id = ? AND status = 'active' AND account_state = 'pending_onboarding'
    `).bind(timestamp, session.user_id),
  ]);
  return json({ profile: await profileFor(env.DB, session.user_id) }, 201);
}

async function getProfile(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  const session = await authenticated(request, env);
  const target = new URL(request.url).searchParams.get("user") || session.user_id;
  if (target !== session.user_id) {
    await requireBetaTarget(env,target);
    await requireProfile(env.DB,session.user_id);
    if(!await env.DB.prepare(`SELECT 1 ok WHERE ${eligibleSql('?')}`).bind(target).first()) throw new SocialError('not_found','ไม่พบโปรไฟล์',404);
    if (await isBlocked(env.DB, session.user_id, target)) {
      throw new SocialError("not_found", "ไม่พบโปรไฟล์", 404);
    }
    const visible = enabled(env.PUBLIC_DISCOVERY_ENABLED) && Boolean(await env.DB.prepare(`
      SELECT 1 visible FROM member_profiles
      WHERE user_id = ? AND discovery_visible = 1 AND located_at > ?
    `).bind(target, unixTime() - LOCATION_FRESH_SECONDS).first());
    if (!visible && !await canContact(env.DB, session.user_id, target) && !await albumGrant(env.DB,session.user_id,target)) {
      throw new SocialError("not_found", "ไม่พบโปรไฟล์", 404);
    }
  }
  const profile = await profileFor(env.DB, target);
  if (!profile) throw new SocialError("not_found", "ไม่พบโปรไฟล์", 404);
  if (target !== session.user_id) profile.selected_photo_id=await publicPortrait(env.DB,profile.selected_photo_id,target);
  profile.is_online=enabled(env.PRESENCE_ENABLED)?(await safeOnlineStatuses(env,session.user_id,[target]))[target]:false;
  return json({ profile: visibleProfile(profile, target === session.user_id) });
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
  } else if (body.action === "contact_privacy") {
    if (typeof body.enabled !== 'boolean') throw new SocialError('invalid_input','ข้อมูลไม่ถูกต้อง');
    await env.DB.prepare('UPDATE member_profiles SET direct_messages_enabled=?,updated_at=? WHERE user_id=?')
      .bind(body.enabled?1:0,timestamp,session.user_id).run();
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
  await limited(env, "discovery_read_user_10m", session.user_id, 30, 600);
  if (!me.discovery_visible || !me.located_at || Number(me.located_at) <= timestamp - LOCATION_FRESH_SECONDS) {
    return json({ people: [], locationFresh: false });
  }
  const ownLocation = await env.DB.prepare(
    "SELECT latitude, longitude FROM member_profiles WHERE user_id = ?",
  ).bind(session.user_id).first();
  const query=new URL(request.url).searchParams,paged=query.get('paged')==='1',after=query.get('after')||'',search=cleanText(query.get('q'),80),gender=query.get('gender')||'',interest=cleanText(query.get('interest'),100),radius=Number(query.get('radius')||5000),limit=paged?100:500;
  if(after.length>128||(gender&&!ALLOWED_GENDERS.has(gender))||![500,1000,5000].includes(radius))throw new SocialError('invalid_filter','ตัวกรองค้นหาไม่ถูกต้อง');
  const longitudeRange=Math.min(360,0.06/Math.max(0.001,Math.cos(radians(Number(ownLocation.latitude)))));
  const rows = await env.DB.prepare(`
    SELECT p.user_id, p.name, p.gender, p.bio, p.interests, ${publicPortraitColumn},p.direct_messages_enabled,
           p.latitude, p.longitude,
           EXISTS(SELECT 1 FROM identity_verification_requests v WHERE v.user_id = p.user_id AND v.status = 'approved') identity_verified,
           (SELECT AVG(score) FROM proximity_ratings r WHERE r.receiver_user_id = p.user_id) rating,
           (SELECT COUNT(*) FROM proximity_ratings r WHERE r.receiver_user_id = p.user_id) rating_count
    FROM member_profiles p JOIN users u ON u.id = p.user_id
    WHERE p.user_id <> ? AND u.status = 'active' AND p.discovery_visible = 1 AND ${eligibleSql('p.user_id')} AND ${betaTargetSql(env,'p.user_id')}
      AND p.located_at > ? AND p.accuracy <= 50
      AND p.latitude BETWEEN ? AND ?
      AND (ABS(p.longitude-?)<=? OR ABS(p.longitude-?)>=360-?)
      AND p.user_id>? AND (?='' OR instr(lower(p.name||' '||p.bio||' '||p.interests),lower(?))>0)
      AND (?='' OR p.gender=?) AND (?='' OR instr(lower(p.interests),lower(?))>0)
      AND NOT EXISTS (
        SELECT 1 FROM social_blocks b
        WHERE (b.blocker_user_id = ? AND b.blocked_user_id = p.user_id)
           OR (b.blocker_user_id = p.user_id AND b.blocked_user_id = ?)
      )
    ORDER BY p.user_id LIMIT ?
  `).bind(
    session.user_id,
    timestamp - LOCATION_FRESH_SECONDS,
    Number(ownLocation.latitude) - 0.06,
    Number(ownLocation.latitude) + 0.06,
    Number(ownLocation.longitude),longitudeRange,Number(ownLocation.longitude),longitudeRange,
    after,search,search,gender,gender,interest,interest,
    session.user_id,
    session.user_id,
    limit+1,
  ).all();
  const candidates=(rows.results||[]).slice(0,limit);
  const people = candidates.map((person) => {
    const metres = distanceMetres(ownLocation, person);
    const { latitude, longitude, ...safe } = person;
    return { ...safe, _distance: metres, ...privateDistance(metres) };
  }).filter((person) => person._distance <= 5000&&person.distance<=radius)
    .sort((a, b) => a.distance - b.distance || String(a.user_id).localeCompare(String(b.user_id)))
    .map(({ _distance, ...person }) => person);
  if(enabled(env.PRESENCE_ENABLED))for(let start=0;start<people.length;start+=50){const group=people.slice(start,start+50),statuses=await safeOnlineStatuses(env,session.user_id,group.map(p=>p.user_id));for(const person of group)person.is_online=statuses[person.user_id];}
  return json({ people, locationFresh: true,hasMore:(rows.results||[]).length>limit,nextCursor:candidates.at(-1)?.user_id||null });
}

async function relationships(request,env) { capability(env,'SOCIAL_APP_ENABLED');throw new SocialError('feature_removed','ไม่ต้องเพิ่มเพื่อนก่อนเริ่มแชท',410); }

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

async function conversations(request,env) {
  capability(env,'SOCIAL_APP_ENABLED');capability(env,'MESSAGING_ENABLED');
  const session=await authenticated(request,env);
  await requireProfile(env.DB,session.user_id);
  await limited(env,'conversation_read_minute',session.user_id,120,60);
  const offset=Number(new URL(request.url).searchParams.get('offset')||0);
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000) throw new SocialError('invalid_cursor','คำขอไม่ถูกต้อง');
  const rows=await env.DB.prepare(`WITH activity AS (
    SELECT CASE WHEN sender_user_id=? THEN receiver_user_id ELSE sender_user_id END other_user_id,created_at,id activity_id,
      json_object('body',CASE WHEN unsent_at IS NULL THEN body ELSE '' END,
        'media_id',CASE WHEN unsent_at IS NULL THEN media_id ELSE NULL END,
        'sender_user_id',sender_user_id,'unsent_at',unsent_at) payload
    FROM social_messages WHERE sender_user_id=? OR receiver_user_id=?
    UNION ALL SELECT CASE WHEN album_owner_id=? THEN requester_id ELSE album_owner_id END,created_at,id,
      json_object('body','อัลบั้มส่วนตัว','media_id',NULL,'sender_user_id',actor_user_id,'unsent_at',NULL)
    FROM chat_system_events WHERE album_owner_id=? OR requester_id=?
  ) SELECT p.user_id other_user_id,p.name,p.gender,p.bio,p.interests,${publicPortraitColumn},p.direct_messages_enabled,MAX(a.created_at) last_message_at,
    (SELECT recent.payload FROM activity recent WHERE recent.other_user_id=p.user_id
      ORDER BY recent.created_at DESC,recent.activity_id DESC LIMIT 1) last_message_payload,
    (SELECT COUNT(*) FROM social_messages m WHERE m.sender_user_id=p.user_id AND m.receiver_user_id=? AND m.read_at IS NULL AND m.unsent_at IS NULL)
    +(SELECT COUNT(*) FROM chat_system_events e WHERE
      (e.album_owner_id=? AND e.requester_id=p.user_id AND e.owner_read_at IS NULL) OR
      (e.requester_id=? AND e.album_owner_id=p.user_id AND e.requester_read_at IS NULL)) unread_count,
    COALESCE(pref.muted,0) muted
    FROM activity a JOIN member_profiles p ON p.user_id=a.other_user_id
    LEFT JOIN chat_preferences pref ON pref.user_id=? AND pref.other_user_id=p.user_id
    WHERE ${eligibleSql('p.user_id')} AND ${unblockedSql('?','p.user_id')} AND ${betaTargetSql(env,'p.user_id')}
    GROUP BY p.user_id ORDER BY last_message_at DESC,p.user_id LIMIT 51 OFFSET ?`)
    .bind(...Array(10).fill(session.user_id),session.user_id,session.user_id,offset).all();
  const result=(rows.results||[]).slice(0,50);
  for(const p of result){
    const latest=JSON.parse(p.last_message_payload||'null');delete p.last_message_payload;
    if(latest)Object.assign(p,{last_message_body:latest.body,last_message_media_id:latest.media_id,last_message_sender_id:latest.sender_user_id,last_message_unsent_at:latest.unsent_at});
  }
  if(enabled(env.PRESENCE_ENABLED)){const statuses=await safeOnlineStatuses(env,session.user_id,result.map(p=>p.other_user_id));for(const person of result)person.is_online=statuses[person.other_user_id];}
  return json({conversations:result,hasMore:(rows.results||[]).length>50,nextOffset:offset+result.length});
}

async function chatPreferences(request,env){
  capability(env,'SOCIAL_APP_ENABLED');capability(env,'MESSAGING_ENABLED');
  const session=await authenticated(request,env,{csrf:true});
  const body=await readJson(request);pair(session.user_id,identifier(body.target));
  if(typeof body.muted!=='boolean'||!await targetExists(env.DB,body.target)) throw new SocialError('invalid_input','ข้อมูลไม่ถูกต้อง');
  await limited(env,'chat_preferences',session.user_id,30,3600);
  await env.DB.prepare(`INSERT INTO chat_preferences(user_id,other_user_id,muted) VALUES(?,?,?)
    ON CONFLICT(user_id,other_user_id) DO UPDATE SET muted=excluded.muted`).bind(session.user_id,body.target,body.muted?1:0).run();
  return json({ok:true});
}

async function albumAccess(request,env){
  capability(env,'SOCIAL_APP_ENABLED');capability(env,'MESSAGING_ENABLED');
  const session=await authenticated(request,env,{csrf:request.method==='POST'});
  await requireProfile(env.DB,session.user_id);
  if(request.method==='GET'){
    const rows=await env.DB.prepare(`SELECT r.*,p.name requester_name FROM album_access_requests r
      JOIN member_profiles p ON p.user_id=r.requester_id WHERE r.album_owner_id=?
      ORDER BY r.updated_at DESC LIMIT 200`).bind(session.user_id).all();
    return json({requests:rows.results||[]});
  }
  await limited(env,'album_access_hour',session.user_id,30,3600);
  const body=await readJson(request),timestamp=unixTime();
  if(body.action==='request'){
    const owner=identifier(body.owner);
    await requireBetaTarget(env,owner);
    if(!await canContact(env.DB,session.user_id,owner)) throw new SocialError('contact_unavailable','ไม่สามารถขอสิทธิ์บัญชีนี้',403);
    await limited(env,'album_requests_hour',session.user_id,10,3600);
    const result=await env.DB.prepare(`INSERT INTO album_access_requests(id,album_owner_id,requester_id,status,created_at,updated_at)
      SELECT ?,?,?,'pending',?,? WHERE ${eligibleSql('?')} AND ${eligibleSql('?')} AND ${unblockedSql('?','?')}
        AND EXISTS(SELECT 1 FROM member_profiles p WHERE p.user_id=? AND p.direct_messages_enabled=1)
      ON CONFLICT(album_owner_id,requester_id) DO UPDATE SET status='pending',revision=revision+1,
        created_at=excluded.created_at,updated_at=excluded.updated_at,decided_by=NULL
      WHERE album_access_requests.status IN ('rejected','cancelled','revoked') AND album_access_requests.updated_at<=?-3600`)
      .bind(safeUuid(),owner,session.user_id,timestamp,timestamp,owner,session.user_id,owner,session.user_id,session.user_id,owner,owner,timestamp).run();
    if(!result.meta?.changes) throw new SocialError('album_request_conflict','มีคำขอหรือสิทธิ์อยู่แล้ว หรือกรุณารอ 1 ชั่วโมงก่อนขอใหม่',409);
  }else{
    if(!['approve','reject','cancel','revoke'].includes(body.action)||!Number.isSafeInteger(body.revision)) throw new SocialError('invalid_action','คำขอไม่ถูกต้อง');
    const status={approve:'approved',reject:'rejected',cancel:'cancelled',revoke:'revoked'}[body.action];
    const actorColumn=body.action==='cancel'?'requester_id':'album_owner_id';
    const previous=body.action==='revoke'?'approved':'pending';
    if(body.action==='approve'){const target=await env.DB.prepare('SELECT requester_id FROM album_access_requests WHERE id=? AND album_owner_id=?').bind(identifier(body.id),session.user_id).first();if(target)await requireBetaTarget(env,target.requester_id);}
    const result=await env.DB.prepare(`UPDATE album_access_requests SET status=?,revision=revision+1,updated_at=?,decided_by=?
      WHERE id=? AND revision=? AND status=? AND ${actorColumn}=?
      AND (?<>'approved' OR (${eligibleSql('album_owner_id')} AND ${eligibleSql('requester_id')}
        AND ${unblockedSql('album_owner_id','requester_id')}))`)
      .bind(status,timestamp,session.user_id,identifier(body.id),body.revision,previous,session.user_id,status).run();
    if(!result.meta?.changes) throw new SocialError('album_transition_conflict','คำขอเปลี่ยนแปลงแล้วหรือคุณไม่มีสิทธิ์ กรุณาโหลดใหม่',409);
  }
  return json({ok:true});
}

async function messages(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "MESSAGING_ENABLED");
  const session = await authenticated(request, env, { csrf: request.method === "POST" });
  await requireProfile(env.DB, session.user_id);
  if (request.method === "GET") {
    const url = new URL(request.url);
    const target = identifier(url.searchParams.get("target"));
    await requireBetaTarget(env,target);
    if (!await canContact(env.DB, session.user_id, target,{send:false})) throw new SocialError('contact_unavailable','ไม่สามารถติดต่อบัญชีนี้',403);
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
    const events=await env.DB.prepare(`SELECT e.*,r.status request_status,r.revision request_revision
      FROM chat_system_events e JOIN album_access_requests r ON r.id=e.request_id
      WHERE ((e.album_owner_id=? AND e.requester_id=?) OR (e.album_owner_id=? AND e.requester_id=?))
      AND (e.created_at<? OR (e.created_at=? AND e.id<?)) ORDER BY e.created_at DESC,e.id DESC LIMIT 51`)
      .bind(session.user_id,target,target,session.user_id,before,before,beforeId).all();
    const merged=[...(rows.results||[]),...(events.results||[]).map(e=>({...e,system:true}))]
      .sort((a,b)=>b.created_at-a.created_at||b.id.localeCompare(a.id));
    return json({ messages: merged.slice(0,50), hasMore: merged.length>50 });
  }
  await limited(env, "message_write_user_minute", session.user_id, 30, 60);
  if ((request.headers.get("content-type") || "").startsWith("multipart/form-data")) {
    capability(env, "MEDIA_UPLOAD_ENABLED");
    if (!env.MEDIA) throw new Error("missing_media_binding");
    const idempotencyKey = uploadIdempotencyKey(request);
    const form = await request.formData();
    const target = String(form.get("target") || "");
    await requireBetaTarget(env,target);
    if (!await canContact(env.DB, session.user_id, target)) throw new SocialError('contact_unavailable','ไม่สามารถติดต่อบัญชีนี้',403);
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > 8 * 1024 * 1024) {
      throw new SocialError("invalid_file", "รูปภาพต้องมีขนาดไม่เกิน 8 MB");
    }
    let image;
    try { image = sanitizeImage(new Uint8Array(await file.arrayBuffer()), file.type); }
    catch { throw new SocialError("invalid_image", "รองรับเฉพาะ JPG, PNG และ WebP ที่ถูกต้อง"); }
    const reservation = await reserveMediaUpload(env.DB, session.user_id, "chat", idempotencyKey);
    if (reservation.replay) {
      return json({ ok: true, messageId: reservation.result_id, reviewStatus: "pending", idempotentReplay: true }, 201);
    }
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
    const statements = [
      env.DB.prepare(`
        INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,created_at)
        VALUES (?,?,?,'chat',?,?,?)
      `).bind(mediaId, session.user_id, objectKey, contentType, bytes.length, timestamp),
      env.DB.prepare(`
        INSERT INTO social_messages(id,sender_user_id,receiver_user_id,body,media_id,created_at)
        VALUES (?,?,?,'',?,?)
      `).bind(messageId, session.user_id, target, mediaId, timestamp),
      env.DB.prepare(`
        INSERT INTO media_safety_reviews(media_id,status,source,created_at)
        VALUES (?, 'pending', 'manual', ?)
      `).bind(mediaId, timestamp),
      completeMediaUploadStatement(env.DB, session.user_id, "chat", idempotencyKey, mediaId, messageId, timestamp),
    ];
    if (oldest) {
      statements.push(env.DB.prepare("UPDATE social_media SET state = 'pending_deletion' WHERE id = ?").bind(oldest.id));
      statements.push(env.DB.prepare(`
        INSERT OR IGNORE INTO media_deletion_queue(object_key,operation_id,next_attempt_at,created_at) VALUES (?,?,?,?)
      `).bind(oldest.object_key, safeUuid(), timestamp, timestamp));
    }
    try {
      await env.MEDIA.put(objectKey, bytes, { httpMetadata: { contentType }, customMetadata: { purpose: "chat" } });
      await env.DB.batch(statements);
    } catch (error) {
      await env.MEDIA.delete(objectKey).catch(() => {});
      await releaseMediaUpload(env.DB, session.user_id, "chat", idempotencyKey).catch(() => {});
      throw error;
    }
    return json({ ok: true, messageId, reviewStatus: "pending" }, 201);
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
  await requireBetaTarget(env,target);
  if (!await canContact(env.DB, session.user_id, target,{send:body.action!=='read'})) throw new SocialError('contact_unavailable','ไม่สามารถติดต่อบัญชีนี้',403);
  if (body.action === "read") {
    await env.DB.prepare(`UPDATE chat_system_events SET
      owner_read_at=CASE WHEN album_owner_id=? THEN ? ELSE owner_read_at END,
      requester_read_at=CASE WHEN requester_id=? THEN ? ELSE requester_read_at END
      WHERE (album_owner_id=? AND requester_id=?) OR (album_owner_id=? AND requester_id=?)`)
      .bind(session.user_id,unixTime(),session.user_id,unixTime(),session.user_id,target,target,session.user_id).run();
    await env.DB.prepare(`
      UPDATE social_messages SET read_at = ?
      WHERE sender_user_id = ? AND receiver_user_id = ? AND read_at IS NULL AND unsent_at IS NULL
    `).bind(unixTime(), target, session.user_id).run();
  } else if (body.action === "send") {
    const mediaId = String(body.mediaId || "") || null;
    const text = cleanText(body.body, 2000, { required: !mediaId });
    if (mediaId) {
      const reusable = await accessibleChatAsset(env, mediaId, session.user_id);
      if (!reusable) throw new SocialError("media_not_found", "ไม่พบรูปภาพที่ส่งได้", 404);
      await requireBetaTarget(env,reusable.owner_user_id);
      if(reusable.purpose==='gallery'&&!await canViewPhoto(env.DB,target,reusable))throw new SocialError('media_not_found','ผู้รับยังไม่มีสิทธิ์ดูรูปในอัลบั้มนี้',404);
    }
    const requestId=body.clientRequestId===undefined?null:String(body.clientRequestId);
    if(requestId!==null&&!/^[A-Za-z0-9_-]{16,80}$/.test(requestId))throw new SocialError('invalid_request_id','รหัสการส่งไม่ถูกต้อง');
    // Retries use the original durable message, not another INSERT (and therefore
    // do not trigger duplicate-content/spam rules or recreate an unsent message).
    const prior=requestId?await env.DB.prepare('SELECT id,receiver_user_id,body,media_id FROM social_messages WHERE sender_user_id=? AND client_request_id=?').bind(session.user_id,requestId).first():null;
    if(prior){
      if(prior.receiver_user_id!==target||prior.body!==text||prior.media_id!==mediaId)throw new SocialError('idempotency_conflict','คำขอส่งเดิมมีข้อมูลต่างกัน กรุณาเริ่มส่งใหม่',409);
      return json({ok:true,messageId:prior.id,idempotentReplay:true});
    }
    const messageId=safeUuid();
    try{await env.DB.prepare(`
      INSERT INTO social_messages(id, sender_user_id, receiver_user_id, body, media_id, created_at,client_request_id)
      VALUES (?, ?, ?, ?, ?, ?,?)
    `).bind(messageId, session.user_id, target, text, mediaId, unixTime(),requestId).run();}
    catch(error){
      const saved=requestId?await env.DB.prepare('SELECT id,receiver_user_id,body,media_id FROM social_messages WHERE sender_user_id=? AND client_request_id=?').bind(session.user_id,requestId).first():null;
      if(!saved)throw error;
      if(saved.receiver_user_id!==target||saved.body!==text||saved.media_id!==mediaId)throw new SocialError('idempotency_conflict','คำขอส่งเดิมมีข้อมูลต่างกัน',409);
      return json({ok:true,messageId:saved.id,idempotentReplay:true});
    }
    return json({ok:true,messageId});
  } else {
    throw new SocialError("invalid_action", "คำขอไม่ถูกต้อง");
  }
  return json({ ok: true });
}

async function accessibleChatAsset(env, mediaId, userId) {
  const ownedGallery=await env.DB.prepare(`SELECT m.id,m.object_key,m.content_type,m.byte_size,m.created_at,m.purpose,p.owner_user_id,p.visibility
    FROM social_media m JOIN profile_photos p ON p.media_id=m.id JOIN media_safety_reviews r ON r.media_id=m.id
    WHERE m.id=? AND p.owner_user_id=? AND m.state='active' AND m.purpose='gallery' AND r.status='released' AND r.category='general'`).bind(mediaId,userId).first();
  if(ownedGallery)return ownedGallery;
  return env.DB.prepare(`
    SELECT media.id, media.object_key, media.content_type, media.byte_size, media.created_at,media.owner_user_id
    FROM social_media media
    WHERE media.id = ? AND media.purpose = 'chat' AND media.state = 'active'
      AND EXISTS (
        SELECT 1 FROM media_safety_reviews review
        WHERE review.media_id = media.id AND review.status = 'released'
          AND (
            COALESCE(review.category, 'general') = 'general'
            OR (review.category = 'sensitive' AND ? = 1 AND EXISTS (
              SELECT 1 FROM independent_age_assurances assurance
              WHERE assurance.user_id = ? AND assurance.status = 'verified'
                AND assurance.revoked_at IS NULL
                AND (assurance.expires_at IS NULL OR assurance.expires_at > ?)
            ))
          )
      )
      AND (
      media.owner_user_id = ? OR EXISTS (
        SELECT 1 FROM social_messages message
        WHERE message.media_id = media.id AND message.unsent_at IS NULL
          AND (message.sender_user_id = ? OR message.receiver_user_id = ?)
          AND ${eligibleSql('message.sender_user_id')} AND ${eligibleSql('message.receiver_user_id')}
          AND NOT EXISTS (
            SELECT 1 FROM social_blocks blocked
            WHERE (blocked.blocker_user_id = message.sender_user_id AND blocked.blocked_user_id = message.receiver_user_id)
               OR (blocked.blocker_user_id = message.receiver_user_id AND blocked.blocked_user_id = message.sender_user_id)
          )
      )
    )
    LIMIT 1
  `).bind(mediaId, enabled(env.SENSITIVE_CONTENT_ENABLED) ? 1 : 0, userId, unixTime(), userId, userId, userId).first();
}

async function chatAssets(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "MESSAGING_ENABLED");
  const session = await authenticated(request, env);
  await requireProfile(env.DB, session.user_id);
  const rows = await env.DB.prepare(`
    SELECT media.id, media.content_type, media.byte_size, media.created_at FROM social_media media
    WHERE media.purpose = 'chat' AND media.state = 'active' AND ${betaTargetSql(env,'media.owner_user_id')}
      AND EXISTS (
        SELECT 1 FROM media_safety_reviews review
        WHERE review.media_id = media.id AND review.status = 'released'
          AND (
            COALESCE(review.category, 'general') = 'general'
            OR (review.category = 'sensitive' AND ? = 1 AND EXISTS (
              SELECT 1 FROM independent_age_assurances assurance
              WHERE assurance.user_id = ? AND assurance.status = 'verified'
                AND assurance.revoked_at IS NULL
                AND (assurance.expires_at IS NULL OR assurance.expires_at > ?)
            ))
          )
      )
      AND (
      media.owner_user_id = ? OR EXISTS (
        SELECT 1 FROM social_messages message
        WHERE message.media_id = media.id AND message.unsent_at IS NULL
          AND (message.sender_user_id = ? OR message.receiver_user_id = ?)
          AND ${eligibleSql('message.sender_user_id')} AND ${eligibleSql('message.receiver_user_id')}
          AND NOT EXISTS (
            SELECT 1 FROM social_blocks blocked
            WHERE (blocked.blocker_user_id = message.sender_user_id AND blocked.blocked_user_id = message.receiver_user_id)
               OR (blocked.blocker_user_id = message.receiver_user_id AND blocked.blocked_user_id = message.sender_user_id)
          )
      )
    )
    ORDER BY media.created_at DESC, media.id DESC LIMIT 5
  `).bind(enabled(env.SENSITIVE_CONTENT_ENABLED) ? 1 : 0, session.user_id, unixTime(), session.user_id, session.user_id, session.user_id).all();
  const gallery=await env.DB.prepare(`SELECT m.id,m.purpose,m.content_type,p.owner_user_id,p.visibility FROM social_media m
    JOIN profile_photos p ON p.media_id=m.id JOIN media_safety_reviews r ON r.media_id=m.id
    WHERE p.owner_user_id=? AND m.state='active' AND r.status='released' AND r.category='general' ORDER BY m.created_at DESC,m.id LIMIT 12`).bind(session.user_id).all();
  const target=new URL(request.url).searchParams.get('target'),allowed=[];
  if(target)await requireBetaTarget(env,target);
  if(target&&await canContact(env.DB,session.user_id,target))for(const photo of gallery.results||[])if(await canViewPhoto(env.DB,target,photo))allowed.push(photo);
  return json({ assets: rows.results || [],gallery:allowed });
}

async function chatMedia(request, env, id) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "MESSAGING_ENABLED");
  const session = await authenticated(request, env);
  const galleryMessage=await env.DB.prepare(`SELECT 1 ok FROM social_messages m JOIN profile_photos p ON p.media_id=m.media_id
    WHERE m.media_id=? AND m.unsent_at IS NULL AND (m.sender_user_id=? OR m.receiver_user_id=?) LIMIT 1`).bind(id,session.user_id,session.user_id).first();
  if(galleryMessage)return mediaFile(request,env,id);
  await requireProfile(env.DB,session.user_id);
  const media = await accessibleChatAsset(env, id, session.user_id);
  if (!media || !env.MEDIA) {
    throw new SocialError("not_found", "ไม่พบรูปภาพ", 404);
  }
  await requireBetaTarget(env,media.owner_user_id);
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
  const categories = new Set(["harassment", "threat", "ncii", "child_safety", "spam", "impersonation", "sexual_content", "violence", "privacy", "other"]);
  if (!categories.has(body.category)) throw new SocialError("invalid_category", "กรุณาเลือกประเภทการรายงาน");
  const legacyCategory = { threat: "violence", ncii: "sexual_content", child_safety: "sexual_content" }[body.category] || body.category;
  await env.DB.prepare(`
    INSERT INTO social_reports(id, reporter_user_id, subject_user_id, category, reason_code, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(safeUuid(), session.user_id, target, legacyCategory, body.category, cleanText(body.details, 1000, { required: true }), unixTime()).run();
  return json({ ok: true }, 201);
}

async function enforceAdminAccess(request, env, session) {
  try { await requireCloudflareAdminAccess(request, env, session); }
  catch { throw new SocialError('admin_access_required', 'กรุณาเข้าสู่ระบบผู้ดูแลผ่าน Cloudflare Access ด้วยบัญชีที่ได้รับอนุญาต', 403); }
}

async function moderationSession(request, env) {
  if (!standaloneAdminEnabled(env)) return authenticated(request, env, { csrf: request.method === 'POST' });
  let context;
  try { context = await adminAccessContext(request, env); }
  catch { throw new SocialError('admin_access_required', 'กรุณาเข้าสู่ระบบผู้ดูแลผ่าน Cloudflare Access', 403); }
  const session = await getAdminAccessSession(env, context);
  if (!session) throw new SocialError('admin_session_required', 'เซสชันผู้ดูแลหมดอายุ กรุณาออกจาก Cloudflare Access แล้วเข้าสู่ระบบใหม่', 401);
  if (request.method === 'POST') {
    requireSameOrigin(request);
    if (!await adminCsrfValid(request, session, context.actionCsrf)) throw new SocialError('invalid_csrf', 'คำขอหมดอายุ กรุณาลองใหม่', 403);
  }
  return session;
}

async function adminAccessLogin(request, env) {
  capability(env, 'MODERATION_TOOLS_ENABLED');
  if (!standaloneAdminEnabled(env)) throw new SocialError('feature_disabled', 'ขั้นตอนนี้ยังไม่เปิดใช้งาน', 404);
  let context;
  try { context = await adminAccessContext(request, env); }
  catch { throw new SocialError('admin_access_required', 'กรุณาเข้าสู่ระบบผู้ดูแลผ่าน Cloudflare Access ด้วยบัญชีที่ได้รับอนุญาต', 403); }
  let session = await getAdminAccessSession(env, context);
  let body;
  if (request.method === 'POST') { requireSameOrigin(request); body = await readJson(request); }
  // Ending one's own session stays possible even after the role expires.
  if (body?.action === 'logout') {
    // An expired local session is not usable for work, but its owner can still
    // revoke it before leaving Access. Keep subject/JWT/CSRF binding intact.
    if (!session) session = await env.DB.prepare(`SELECT token_hash,csrf_hash,user_id
      FROM cloudflare_admin_sessions WHERE token_hash=? AND user_id=? AND subject_hash=? AND revoked_at IS NULL`)
      .bind(context.tokenHash,context.userId,context.subjectHash).first();
    if (!session || !await adminCsrfValid(request, session, context.actionCsrf)) throw new SocialError('invalid_csrf', 'คำขอไม่ถูกต้อง', 403);
    await env.DB.prepare('UPDATE cloudflare_admin_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL').bind(unixTime(), context.tokenHash).run();
    await auditMediaSafety(env.DB, context.userId, 'queue_view', 'admin_logout', 'cloudflare_admin_session_logout');
    return json({ ok: true, logoutPath: '/cdn-cgi/access/logout' });
  }
  // Access identity never provisions roles, reactivates accounts or revives grants.
  const grant = await env.DB.prepare(`SELECT 1 ok FROM moderation_access_grants
    WHERE user_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)
      AND role IN ('report_reviewer','safety_admin','moderation_admin')`).bind(context.userId, unixTime()).first();
  if (!grant) throw new SocialError('forbidden', 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลที่ใช้งานได้', 403);
  if (request.method === 'POST') {
    if (body.action === 'start') {
      if (!await adminCsrfValid(request, null, context.startCsrf)) throw new SocialError('invalid_csrf', 'คำขอไม่ถูกต้อง', 403);
      await limited(env, 'admin_access_session_start', context.userId, 30, 3600);
      session = await startAdminAccessSession(env, context);
      if (!session) throw new SocialError('admin_session_revoked', 'เซสชันนี้สิ้นสุดแล้ว กรุณาออกจาก Cloudflare Access และเข้าสู่ระบบใหม่', 403);
      await auditMediaSafety(env.DB, context.userId, 'queue_view', 'admin_login', 'cloudflare_admin_session_start');
    } else throw new SocialError('invalid_action', 'คำขอไม่ถูกต้อง');
  }
  return json({ authentication: 'cloudflare_access', authenticated: Boolean(session),
    csrfToken: session ? context.actionCsrf : context.startCsrf,
    expiresAt: session?.expires_at || null, recentlyAuthenticated: session ? hasRecentAuthentication(session) : false });
}

async function moderationAccess(request, env, roles, options = {}) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "MODERATION_TOOLS_ENABLED");
  const session = await moderationSession(request, env);
  let purpose = options.fixedPurpose;
  await enforceAdminAccess(request, env, session);
  if (!purpose) {
    const encodedPurpose = String(request.headers.get("x-moderation-purpose") || "");
    if (encodedPurpose.length > 900) throw new SocialError("purpose_required", "วัตถุประสงค์การเข้าถึงไม่ถูกต้อง");
    let decodedPurpose;
    try { decodedPurpose = decodeURIComponent(encodedPurpose); }
    catch { throw new SocialError("purpose_required", "วัตถุประสงค์การเข้าถึงไม่ถูกต้อง"); }
    purpose = cleanText(decodedPurpose, 300, { required: true });
    if (purpose.length < 10) throw new SocialError("purpose_required", "กรุณาระบุวัตถุประสงค์การเข้าถึงอย่างน้อย 10 ตัวอักษร");
  }
  if (options.requireRecentAuthentication !== false && !hasRecentAuthentication(session)) {
    if (standaloneAdminEnabled(env) && !session.authenticated_at) throw new SocialError('admin_auth_evidence_missing', 'Cloudflare Access ยังไม่ส่งหลักฐานเวลายืนยันตัวตน กรุณาตั้งค่า IdP ให้ส่ง auth_time ก่อนดำเนินการที่มีความเสี่ยงสูง', 403);
    throw new SocialError("recent_authentication_required", "กรุณาเข้าสู่ระบบอีกครั้งก่อนใช้เครื่องมือดูแล", 403);
  }
  const placeholders = roles.map(() => "?").join(",");
  const role = await env.DB.prepare(`
    SELECT role FROM (
      SELECT grant_record.role
      FROM moderation_access_grants grant_record
      WHERE grant_record.user_id = ?
        AND grant_record.revoked_at IS NULL
        AND (grant_record.expires_at IS NULL OR grant_record.expires_at > ?)
      UNION ALL
      SELECT legacy.role
      FROM moderation_roles legacy
      WHERE legacy.user_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM moderation_access_grants recorded
          WHERE recorded.user_id = legacy.user_id AND recorded.role = legacy.role
        )
    ) WHERE role IN (${placeholders}) LIMIT 1
  `).bind(session.user_id, unixTime(), session.user_id, ...roles).first();
  if (!role) throw new SocialError("forbidden", "ไม่มีสิทธิ์เข้าถึงเครื่องมือดูแล", 403);
  return { session, purpose, role: role.role };
}

async function moderationCapabilities(request,env){
  capability(env,'SOCIAL_APP_ENABLED');capability(env,'MODERATION_TOOLS_ENABLED');
  const session=await moderationSession(request,env),now=unixTime();
  await enforceAdminAccess(request,env,session);
  const rows=await env.DB.prepare(`SELECT role FROM moderation_access_grants WHERE user_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)
    UNION SELECT legacy.role FROM moderation_roles legacy WHERE legacy.user_id=? AND NOT EXISTS(
      SELECT 1 FROM moderation_access_grants recorded WHERE recorded.user_id=legacy.user_id AND recorded.role=legacy.role)
    `).bind(session.user_id,now,session.user_id).all();
  const roles=new Set((rows.results||[]).map(row=>row.role));
  return json({canReviewReports:roles.has('report_reviewer')||roles.has('safety_admin'),canReviewMedia:roles.has('safety_admin'),canReviewEligibility:enabled(env.ELIGIBILITY_REVIEW_ENABLED)&&roles.has('safety_admin'),canInspectMembers:roles.has('safety_admin'),canManageRoles:roles.has('moderation_admin'),canReviewIdentity:enabled(env.IDENTITY_VERIFICATION_ENABLED)&&roles.has('identity_reviewer'),canModerateAccounts:enabled(env.ACCOUNT_MODERATION_ENABLED)&&roles.has('safety_admin'),recentAuthentication:hasRecentAuthentication(session)});
}

async function moderationMemberQueues(request, env) {
  const {session,purpose}=await moderationAccess(request,env,['safety_admin']);
  const url=new URL(request.url),view=url.searchParams.get('view')||'members';
  const page=Math.min(1000,Math.max(1,Math.floor(Number(url.searchParams.get('page'))||1))),limit=20,offset=(page-1)*limit;
  let rows;
  if(view==='members'){
    const query=cleanText(url.searchParams.get('q')||'',80);
    // Deliberately exclude email, provider subjects, age bands, coordinates and session identifiers.
    rows=await env.DB.prepare(`SELECT u.id,u.status,u.account_state,u.created_at,
      EXISTS(SELECT 1 FROM member_age_safety_holds h WHERE h.user_id=u.id AND (h.state='held' OR h.age_band<>'20_plus')) age_review_required,
      EXISTS(SELECT 1 FROM beta_account_restrictions r WHERE r.user_id=u.id AND r.status='active') restricted,
      (SELECT status FROM beta_enrollments b WHERE b.user_id=u.id) beta_status
      FROM users u WHERE (?='' OR instr(u.id,?)>0) ORDER BY u.created_at DESC,u.id LIMIT 21 OFFSET ?`).bind(query,query,offset).all();
  }else if(view==='deletions'){
    rows=await env.DB.prepare(`SELECT request_id,user_id,status,requested_at,expires_at,updated_at
      FROM account_deletion_requests ORDER BY requested_at,request_id LIMIT 21 OFFSET ?`).bind(offset).all();
  }else throw new SocialError('invalid_view','ไม่พบคิวที่เรียก');
  await env.DB.prepare('INSERT INTO administration_access_events(id,actor_id,scope,purpose,created_at)VALUES(?,?,?,?,?)')
    .bind(safeUuid(),session.user_id,view==='members'?'member_queue':'deletion_queue',purpose,unixTime()).run();
  return json({items:(rows.results||[]).slice(0,limit),page,hasMore:rows.results.length>limit,readOnly:true});
}

const MODERATION_ROLES = new Set(["moderation_admin", "report_reviewer", "identity_reviewer", "safety_admin"]);
const MAX_ROLE_GRANT_SECONDS = 90 * 24 * 60 * 60;

async function moderationRoleManagement(request, env) {
  const { session, purpose } = await moderationAccess(request, env, ["moderation_admin"]);
  const timestamp = unixTime();
  if (request.method === "GET") {
    const grants = await env.DB.prepare(`
      SELECT grant_record.id, grant_record.user_id, user.display_name, grant_record.role,
             grant_record.granted_at, grant_record.expires_at, grant_record.revoked_at
      FROM moderation_access_grants grant_record
      JOIN users user ON user.id = grant_record.user_id
      WHERE grant_record.revoked_at IS NULL
        AND (grant_record.expires_at IS NULL OR grant_record.expires_at > ?)
      ORDER BY grant_record.role, grant_record.granted_at, grant_record.id
      LIMIT 200
    `).bind(timestamp).all();
    const events = await env.DB.prepare(`
      SELECT id, grant_id, actor_user_id, target_user_id, role, action, reason, created_at
      FROM moderation_role_events ORDER BY created_at DESC, id DESC LIMIT 100
    `).all();
    await env.DB.prepare(`
      INSERT INTO moderation_role_events(
        id, grant_id, actor_user_id, target_user_id, role, action, reason, created_at
      ) VALUES (?, NULL, ?, NULL, 'moderation_admin', 'inspect', ?, ?)
    `).bind(safeUuid(), session.user_id, purpose, timestamp).run();
    return json({ grants: grants.results || [], events: events.results || [] });
  }

  await limited(env, "moderation_role_change_hour", session.user_id, 20, 3600);
  const body = await readJson(request);
  const action = String(body.action || "");
  const reason = cleanText(body.reason, 300, { required: true });
  if (reason.length < 10) throw new SocialError("invalid_reason", "กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร");

  if (action === "grant") {
    const targetUserId = identifier(body.userId, "ไม่พบบัญชีผู้รับสิทธิ์");
    const role = String(body.role || "");
    const expiresAt = Number(body.expiresAt);
    if (!MODERATION_ROLES.has(role)) throw new SocialError("invalid_role", "บทบาทไม่ถูกต้อง");
    if (targetUserId === session.user_id) throw new SocialError("self_grant_forbidden", "ไม่สามารถเพิ่มสิทธิ์ให้บัญชีของตนเอง", 403);
    if (!Number.isInteger(expiresAt) || expiresAt < timestamp + 3600 || expiresAt > timestamp + MAX_ROLE_GRANT_SECONDS) {
      throw new SocialError("invalid_expiry", "สิทธิ์ต้องมีอายุระหว่าง 1 ชั่วโมงถึง 90 วัน");
    }
    const target = await env.DB.prepare(
      "SELECT id FROM users WHERE id=? AND status='active' AND account_state='active'",
    ).bind(targetUserId).first();
    if (!target) throw new SocialError("not_found", "ไม่พบบัญชีผู้รับสิทธิ์", 404);
    const grantId = safeUuid();
    try {
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO moderation_access_grants(
            id,user_id,role,granted_by,grant_reason,granted_at,expires_at
          ) VALUES (?,?,?,?,?,?,?)
        `).bind(grantId, targetUserId, role, session.user_id, reason, timestamp, expiresAt),
        env.DB.prepare(`
          INSERT INTO moderation_role_events(
            id,grant_id,actor_user_id,target_user_id,role,action,reason,created_at
          ) VALUES (?,?,?,?,?,'grant',?,?)
        `).bind(safeUuid(), grantId, session.user_id, targetUserId, role, `${purpose}; ${reason}`.slice(0, 300), timestamp),
      ]);
    } catch (error) {
      if (String(error?.message || "").includes("UNIQUE")) {
        throw new SocialError("role_already_active", "บัญชีนี้มีบทบาทดังกล่าวอยู่แล้ว", 409);
      }
      throw error;
    }
    return json({ ok: true, grantId }, 201);
  }

  if (action === "revoke") {
    const grantId = identifier(body.grantId, "ไม่พบสิทธิ์ที่ต้องการยกเลิก");
    const grant = await env.DB.prepare(`
      SELECT id,user_id,role FROM moderation_access_grants
      WHERE id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)
    `).bind(grantId, timestamp).first();
    if (!grant) throw new SocialError("not_found", "ไม่พบสิทธิ์ที่ต้องการยกเลิก", 404);
    const results = await env.DB.batch([
      env.DB.prepare(`
        UPDATE moderation_access_grants
        SET revoked_at=?,revoked_by=?,revocation_reason=?
        WHERE id=? AND revoked_at IS NULL
      `).bind(timestamp, session.user_id, reason, grantId),
      env.DB.prepare("DELETE FROM moderation_roles WHERE user_id=? AND role=?").bind(grant.user_id, grant.role),
      env.DB.prepare('UPDATE cloudflare_admin_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(timestamp,grant.user_id),
      env.DB.prepare(`
        INSERT INTO moderation_role_events(
          id,grant_id,actor_user_id,target_user_id,role,action,reason,created_at
        )
        SELECT ?,?,?,?,?, 'revoke',?,?
        FROM moderation_access_grants
        WHERE id=? AND revoked_at=? AND revoked_by=?
      `).bind(safeUuid(), grantId, session.user_id, grant.user_id, grant.role, `${purpose}; ${reason}`.slice(0, 300), timestamp, grantId, timestamp, session.user_id),
    ]);
    if (!Number(results[0]?.meta?.changes || 0)) {
      throw new SocialError("decision_conflict", "สิทธิ์นี้ถูกแก้ไขแล้ว", 409);
    }
    return json({ ok: true });
  }

  throw new SocialError("invalid_action", "คำสั่งไม่ถูกต้อง");
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
    const paging=queuePage(request);
    const rows = await env.DB.prepare(`
      SELECT r.id, r.category, r.reason_code, r.details, r.status, r.created_at, r.reviewed_at,r.revision,
             subject.name subject_name, r.subject_user_id
      FROM social_reports r
      JOIN member_profiles subject ON subject.user_id = r.subject_user_id
      WHERE r.status = ? AND (?='' OR instr(r.id,?)>0 OR instr(r.details,?)>0 OR instr(subject.name,?)>0)
      ORDER BY CASE WHEN COALESCE(r.reason_code,r.category) IN ('threat','ncii','child_safety') THEN 0 WHEN COALESCE(r.reason_code,r.category) IN ('violence','privacy','sexual_content') THEN 1 ELSE 2 END,r.created_at,r.id LIMIT ? OFFSET ?
    `).bind(status,paging.q,paging.q,paging.q,paging.q,paging.limit+1,paging.offset).all();
    await auditModeration(env.DB, session.user_id, "report_view", "report", `queue:${status}`, purpose);
    return queueResult(rows,'reports',paging);
  }
  const body = await readJson(request);
  const id = String(body.id || "");
  const status = String(body.status || "");
  if (!["reviewed", "escalated", "closed"].includes(status)) throw new SocialError("invalid_status", "สถานะไม่ถูกต้อง");
  const decisionPurpose = `${purpose}; ${cleanText(body.note, 300, { required: true })}`.slice(0, 300);
  const timestamp = unixTime();
  const current=await env.DB.prepare("SELECT revision FROM social_reports WHERE id=? AND status<>'closed'").bind(id).first();
  if(!current)throw new SocialError('not_found','ไม่พบรายงานที่ดำเนินการได้',404);
  const revision=body.revision??current.revision,nonce=safeUuid();
  if(!Number.isSafeInteger(revision)||revision<0)throw new SocialError('revision_required','กรุณาโหลดรายงานใหม่',409);
  const results = await env.DB.batch([
    env.DB.prepare("UPDATE social_reports SET status=?,reviewed_at=?,revision=revision+1,decision_nonce=? WHERE id=? AND revision=? AND status<>'closed'").bind(status,timestamp,nonce,id,revision),
    env.DB.prepare(`
      INSERT INTO moderation_audit_events(id,actor_user_id,action,subject_type,subject_id,purpose,created_at)
      SELECT ?,?,'report_review','report',?,?,? WHERE EXISTS(
        SELECT 1 FROM social_reports WHERE id = ? AND decision_nonce=?
      )
    `).bind(safeUuid(), session.user_id, id, decisionPurpose, timestamp, id,nonce),
    env.DB.prepare(`INSERT INTO account_safety_notifications(id,user_id,message_code,created_at)
      SELECT ?,reporter_user_id,?,? FROM social_reports WHERE id=? AND decision_nonce=? AND reporter_user_id IS NOT NULL`)
      .bind(safeUuid(),'report_'+status,timestamp,id,nonce),
  ]);
  if (!Number(results[0]?.meta?.changes || 0)) throw new SocialError("decision_conflict", "รายงานถูกแก้ไขแล้ว กรุณาโหลดใหม่", 409);
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

async function auditMediaSafety(db, actor, action, mediaId, purpose) {
  await db.prepare(`
    INSERT INTO media_safety_audit_events(id,actor_user_id,action,media_id,purpose,created_at)
    VALUES (?,?,?,?,?,?)
  `).bind(safeUuid(), actor, action, mediaId, purpose, unixTime()).run();
}

async function moderationMedia(request, env) {
  const { session, purpose } = await moderationAccess(request, env, ["safety_admin"]);
  if (request.method === "GET") {
    const url = new URL(request.url);
    const requestedStatus = url.searchParams.get("status") || "pending";
    const status = requestedStatus === "approved" ? "released" : requestedStatus;
    if (!["pending", "released", "rejected"].includes(status)) throw new SocialError("invalid_status", "สถานะไม่ถูกต้อง");
    const category = String(url.searchParams.get("category") || "");
    if (category && !["general", "sensitive", "prohibited"].includes(category)) throw new SocialError("invalid_category", "หมวดหมู่ไม่ถูกต้อง");
    const search = cleanText(url.searchParams.get("q"), 80);
    const page = Math.max(1, Math.min(1000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
    const limit = 25;
    const offset = (page - 1) * limit;
    const rows = await env.DB.prepare(`
      SELECT review.media_id, review.status, review.category, review.source, review.reason,
             review.created_at, review.reviewed_at, review.revision,
             media.purpose media_purpose, media.content_type, media.byte_size,
             owner.name owner_name,
             (SELECT COUNT(*) FROM media_reports report WHERE report.media_id = media.id AND report.status IN ('pending','escalated')) report_count
      FROM media_safety_reviews review JOIN social_media media ON media.id = review.media_id
      LEFT JOIN member_profiles owner ON owner.user_id = media.owner_user_id
      WHERE review.status = ? AND media.purpose IN ('profile','gallery','chat')
        AND (? = '' OR review.category = ?)
        AND (? = '' OR review.media_id LIKE '%' || ? || '%' OR media.purpose LIKE '%' || ? || '%' OR owner.name LIKE '%' || ? || '%')
      ORDER BY CASE WHEN review.status = 'pending' THEN review.created_at END ASC,
               review.reviewed_at DESC, review.media_id
      LIMIT ? OFFSET ?
    `).bind(status, category, category, search, search, search, search, limit + 1, offset).all();
    await auditMediaSafety(env.DB, session.user_id, "queue_view", `queue:${status}`, purpose);
    const items = rows.results || [];
    return json({ media: items.slice(0, limit), page, hasMore: items.length > limit });
  }
  const body = await readJson(request);
  const mediaId = identifier(body.id, "ไม่พบรูปภาพ");
  const status = String(body.status || "");
  if (!["released", "rejected"].includes(status)) throw new SocialError("invalid_status", "สถานะไม่ถูกต้อง");
  const category = String(body.category || "").toLowerCase();
  if (!["general", "sensitive", "prohibited"].includes(category)) throw new SocialError("invalid_category", "กรุณาเลือกหมวดหมู่รูปภาพ");
  if ((category === "prohibited") !== (status === "rejected")) {
    throw new SocialError("invalid_decision", "รูปต้องห้ามต้องถูกปฏิเสธ และรูปที่อนุมัติต้องไม่ใช่หมวดต้องห้าม");
  }
  const reason = cleanText(body.reason, 300, { required: true });
  if (reason.length < 3) throw new SocialError("invalid_reason", "กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร");
  const expectedRevision = Number(body.revision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new SocialError("revision_required", "ข้อมูลมีการเปลี่ยนแปลง กรุณาโหลดใหม่", 409);
  const timestamp = unixTime();
  const media = await env.DB.prepare(`
    SELECT media.object_key,media.owner_user_id,media.state,review.status,review.category,review.revision
    FROM social_media media JOIN media_safety_reviews review ON review.media_id = media.id
    WHERE media.id = ? AND media.state = 'active' AND media.purpose IN ('profile','gallery','chat')
  `).bind(mediaId).first();
  if (!media) throw new SocialError("not_found", "ไม่พบรูปภาพ", 404);
  if (Number(media.revision) !== expectedRevision) throw new SocialError("decision_conflict", "รายการนี้ถูกแก้ไขแล้ว กรุณาโหลดใหม่", 409);
  if (media.status === "rejected") throw new SocialError("appeal_required", "รูปที่ปฏิเสธแล้วต้องดำเนินการผ่านคำอุทธรณ์", 409);
  const decisionNonce = safeUuid();
  const auditId = safeUuid();
  const nextRevision = expectedRevision + 1;
  const statements = [
    env.DB.prepare(`
      UPDATE media_safety_reviews
      SET status=?,category=?,reason=?,reviewed_at=?,reviewed_by=?,decision_nonce=?,revision=?
      WHERE media_id=? AND revision=? AND status<>'rejected'
    `).bind(status, category, reason, timestamp, session.user_id, decisionNonce, nextRevision, mediaId, expectedRevision),
    env.DB.prepare(`
      INSERT INTO media_safety_audit_events(id,actor_user_id,action,media_id,purpose,created_at)
      SELECT ?,?,'decision',?,?,? FROM media_safety_reviews
      WHERE media_id=? AND decision_nonce=?
    `).bind(auditId, session.user_id, mediaId, `${purpose}; ${reason}`.slice(0, 300), timestamp, mediaId, decisionNonce),
    env.DB.prepare(`
      INSERT INTO media_moderation_decisions(
        id,media_id,actor_user_id,previous_status,new_status,previous_category,new_category,reason,revision,created_at
      ) SELECT ?,?,?,?,?,?,?,?,?,? FROM media_safety_reviews WHERE media_id=? AND decision_nonce=?
    `).bind(safeUuid(), mediaId, session.user_id, media.status, status, media.category, category, reason, nextRevision, timestamp, mediaId, decisionNonce),
    env.DB.prepare(`
      INSERT INTO moderation_notifications(id,user_id,kind,media_id,message_code,created_at)
      SELECT ?,?,'media_decision',?,?,? FROM media_safety_reviews WHERE media_id=? AND decision_nonce=?
    `).bind(safeUuid(), media.owner_user_id, mediaId, status === "released" ? `media_approved_${category}` : "media_rejected_prohibited", timestamp, mediaId, decisionNonce),
  ];
  if (status === "rejected") {
    statements.push(env.DB.prepare(`
      UPDATE social_media SET state='pending_deletion' WHERE id=? AND EXISTS(
        SELECT 1 FROM media_safety_reviews WHERE media_id=? AND decision_nonce=?
      )
    `).bind(mediaId, mediaId, decisionNonce));
    statements.push(env.DB.prepare(`
      INSERT OR IGNORE INTO media_deletion_queue(object_key,operation_id,next_attempt_at,created_at)
      SELECT ?,?,?,? FROM media_safety_reviews WHERE media_id=? AND decision_nonce=?
    `).bind(media.object_key, safeUuid(), timestamp + 7 * 86400, timestamp, mediaId, decisionNonce));
  }
  if (category !== "general") {
    statements.push(env.DB.prepare("UPDATE member_profiles SET selected_photo_id=NULL,updated_at=? WHERE selected_photo_id=? AND EXISTS(SELECT 1 FROM media_safety_reviews WHERE media_id=? AND decision_nonce=?)").bind(timestamp, mediaId,mediaId,decisionNonce));
  }
  const results = await env.DB.batch(statements);
  if (!Number(results[0]?.meta?.changes || 0)) throw new SocialError("decision_conflict", "รายการนี้ถูกแก้ไขแล้ว กรุณาโหลดใหม่", 409);
  return json({ ok: true, revision: nextRevision });
}

async function moderationMediaObject(request, env, id) {
  const { session, purpose } = await moderationAccess(request, env, ["safety_admin"]);
  const mediaId = identifier(id, "ไม่พบรูปภาพ");
  const media = await env.DB.prepare(`
    SELECT media.object_key,media.content_type FROM social_media media
    JOIN media_safety_reviews review ON review.media_id=media.id
    WHERE media.id=? AND media.state IN ('active','pending_deletion') AND media.purpose IN ('profile','gallery','chat')
  `).bind(mediaId).first();
  if (!media || !env.MEDIA) throw new SocialError("not_found", "ไม่พบรูปภาพ", 404);
  const object = await env.MEDIA.get(media.object_key);
  if (!object) throw new SocialError("not_found", "ไม่พบรูปภาพ", 404);
  await auditMediaSafety(env.DB, session.user_id, "object_view", mediaId, purpose);
  return new Response(object.body, { headers: {
    "content-type": media.content_type,
    "cache-control": "private, no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
    "content-disposition": "inline",
  } });
}

async function accountAppeals(request,env){
  capability(env,'SOCIAL_APP_ENABLED');capability(env,'ACCOUNT_MODERATION_ENABLED');
  const session=await authenticated(request,env,{csrf:request.method==='POST',allowRevokedEnrollment:true});
  if(request.method==='GET'){
    const restrictions=await env.DB.prepare(`SELECT r.id,r.status,r.reason,r.created_at,r.resolution_reason,
      a.status appeal_status,a.decision_reason FROM beta_account_restrictions r
      LEFT JOIN beta_account_appeals a ON a.restriction_id=r.id AND a.user_id=?
      WHERE r.user_id=? ORDER BY r.created_at DESC LIMIT 50`).bind(session.user_id,session.user_id).all();
    return json({restrictions:restrictions.results||[]});
  }
  if(!hasRecentAuthentication(session))throw new SocialError('recent_auth_required','กรุณาเข้าสู่ระบบอีกครั้งก่อนยื่นอุทธรณ์',428);
  await limited(env,'account_appeal_day',session.user_id,3,86400);
  const body=await readJson(request),id=identifier(body.id),reason=cleanText(body.reason,1000,{required:true});
  if(reason.length<10)throw new SocialError('invalid_reason','กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร');
  const restriction=await env.DB.prepare("SELECT id FROM beta_account_restrictions WHERE id=? AND user_id=? AND status='active'").bind(id,session.user_id).first();
  if(!restriction)throw new SocialError('not_found','ไม่พบสิทธิ์อุทธรณ์นี้',404);
  const now=unixTime();
  try{await env.DB.batch([
    env.DB.prepare("INSERT INTO beta_account_appeals(id,restriction_id,user_id,reason,created_at) VALUES(?,?,?,?,?)").bind(safeUuid(),id,session.user_id,reason,now),
    env.DB.prepare("INSERT INTO beta_account_moderation_events(id,restriction_id,actor_user_id,action,reason,created_at) VALUES(?,?,?,'appeal','Member submitted authenticated account appeal',?)").bind(safeUuid(),id,session.user_id,now),
  ]);}catch(e){if(String(e.message).includes('UNIQUE'))throw new SocialError('appeal_exists','ส่งคำอุทธรณ์แล้ว',409);throw e;}
  return json({ok:true},201);
}

async function moderationAccounts(request,env){
  capability(env,'ACCOUNT_MODERATION_ENABLED');
  const{session,purpose}=await moderationAccess(request,env,['safety_admin']);
  if(request.method==='GET'){
    const view=new URL(request.url).searchParams.get('view')||'restrictions';
    const paging=queuePage(request);
    let rows;
    if(view==='appeals')rows=await env.DB.prepare(`SELECT a.id,a.restriction_id,a.reason,a.status,a.revision,a.created_at,
      p.name subject_name,r.reason restriction_reason,r.created_by=? AS reviewer_conflict
      FROM beta_account_appeals a JOIN beta_account_restrictions r ON r.id=a.restriction_id
      LEFT JOIN member_profiles p ON p.user_id=a.user_id WHERE a.status='pending' ORDER BY a.created_at,a.id LIMIT ? OFFSET ?`).bind(session.user_id,paging.limit+1,paging.offset).all();
    else if(view==='restrictions')rows=await env.DB.prepare(`SELECT r.id,r.status,r.reason,r.revision,r.created_at,p.name subject_name
      FROM beta_account_restrictions r LEFT JOIN member_profiles p ON p.user_id=r.user_id ORDER BY r.created_at DESC,r.id LIMIT ? OFFSET ?`).bind(paging.limit+1,paging.offset).all();
    else if(view==='history')rows=await env.DB.prepare('SELECT action,reason,revision,created_at FROM beta_account_moderation_events ORDER BY created_at DESC,id LIMIT ? OFFSET ?').bind(paging.limit+1,paging.offset).all();
    else throw new SocialError('invalid_input','คิวไม่ถูกต้อง');
    await env.DB.prepare("INSERT INTO beta_account_moderation_events(id,actor_user_id,action,reason,created_at) VALUES(?,?,'queue_view',?,?)").bind(safeUuid(),session.user_id,purpose,unixTime()).run();
    return queueResult(rows,'items',paging);
  }
  await limited(env,'account_moderation_hour',session.user_id,20,3600);
  const body=await readJson(request),reason=cleanText(body.reason,300,{required:true}),now=unixTime();
  if(reason.length<10)throw new SocialError('invalid_reason','กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร');
  if(body.action==='suspend'){
    const reportId=identifier(body.reportId),report=await env.DB.prepare('SELECT subject_user_id FROM social_reports WHERE id=?').bind(reportId).first();
    if(!report||report.subject_user_id===session.user_id)throw new SocialError('invalid_target','ไม่สามารถระงับบัญชีนี้',403);
    const target=report.subject_user_id;
    const protectedAccount=await env.DB.prepare(`SELECT 1 ok FROM moderation_access_grants WHERE user_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)
      UNION ALL SELECT 1 FROM moderation_roles WHERE user_id=? LIMIT 1`).bind(target,now,target).first();
    if(protectedAccount)throw new SocialError('protected_account','บัญชีผู้ดูแลต้องใช้กระบวนการเพิกถอนสิทธิ์แยกต่างหาก',403);
    const id=safeUuid();let results;
    try{results=await env.DB.batch([
      env.DB.prepare(`INSERT INTO beta_account_restrictions(id,user_id,report_id,reason,created_by,created_at)
        SELECT ?,u.id,?,?,?,? FROM users u
        WHERE u.id=? AND ${eligibleSql('u.id')} AND ${betaTargetSql(env,'u.id')}`).bind(id,reportId,reason,session.user_id,now,target),
      env.DB.prepare("UPDATE beta_enrollments SET status='revoked',revoked_at=? WHERE user_id=? AND EXISTS(SELECT 1 FROM beta_account_restrictions WHERE id=?)").bind(now,target,id),
      env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM beta_account_restrictions WHERE id=?)').bind(now,target,id),
      env.DB.prepare('UPDATE member_profiles SET discovery_visible=0,latitude=NULL,longitude=NULL,accuracy=NULL,located_at=NULL WHERE user_id=? AND EXISTS(SELECT 1 FROM beta_account_restrictions WHERE id=?)').bind(target,id),
      env.DB.prepare('DELETE FROM member_presence_leases WHERE user_id=? AND EXISTS(SELECT 1 FROM beta_account_restrictions WHERE id=?)').bind(target,id),
      env.DB.prepare('UPDATE album_access_grants SET revoked_at=? WHERE (album_owner_id=? OR viewer_id=?) AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM beta_account_restrictions WHERE id=?)').bind(now,target,target,id),
      env.DB.prepare("UPDATE album_access_requests SET status='revoked',revision=revision+1,updated_at=? WHERE (album_owner_id=? OR requester_id=?) AND status='approved' AND EXISTS(SELECT 1 FROM beta_account_restrictions WHERE id=?)").bind(now,target,target,id),
      env.DB.prepare("INSERT INTO beta_account_moderation_events(id,restriction_id,actor_user_id,action,reason,created_at) SELECT ?,id,?,'suspend',?,? FROM beta_account_restrictions WHERE id=?").bind(safeUuid(),session.user_id,`${purpose}; ${reason}`.slice(0,300),now,id),
    ]);}catch(e){if(String(e.message).includes('UNIQUE'))throw new SocialError('decision_conflict','บัญชีนี้ถูกระงับอยู่แล้ว',409);throw e;}
    if(!results[0]?.meta.changes)throw new SocialError('decision_conflict','บัญชีนี้ไม่มีสิทธิ์ Beta ที่ระงับได้',409);
    return json({ok:true},201);
  }
  if(body.action==='lift'||body.action==='resolve_appeal'){
    if(!Number.isSafeInteger(body.revision)||body.revision<0)throw new SocialError('revision_required','กรุณาโหลดสถานะใหม่',409);
    let restriction,appeal;
    if(body.action==='resolve_appeal'){
      if(!['upheld','lifted'].includes(body.decision))throw new SocialError('invalid_action','ผลการอุทธรณ์ไม่ถูกต้อง');
      appeal=await env.DB.prepare("SELECT * FROM beta_account_appeals WHERE id=? AND status='pending' AND revision=?").bind(identifier(body.id),body.revision).first();
      if(!appeal)throw new SocialError('decision_conflict','คำอุทธรณ์ถูกแก้ไขแล้ว',409);
      restriction=await env.DB.prepare("SELECT * FROM beta_account_restrictions WHERE id=? AND status='active'").bind(appeal.restriction_id).first();
    }else restriction=await env.DB.prepare("SELECT * FROM beta_account_restrictions WHERE id=? AND status='active' AND revision=?").bind(identifier(body.id),body.revision).first();
    if(!restriction||!restriction.user_id||restriction.user_id===session.user_id)throw new SocialError('decision_conflict','ไม่พบรายการที่ดำเนินการได้',409);
    if(appeal&&restriction.created_by===session.user_id&&body.conflictAcknowledged!==true)throw new SocialError('reviewer_conflict','ผู้ตัดสินเดิมต้องบันทึกข้อขัดแย้งและยืนยันการทบทวนที่ไม่เป็นอิสระ',409);
    const lift=!appeal||body.decision==='lifted',revision=restriction.revision+1,statements=[],nonce=safeUuid();
    if(appeal)statements.push(env.DB.prepare(`UPDATE beta_account_appeals SET status=?,reviewed_by=?,reviewed_at=?,decision_reason=?,revision=revision+1,decision_nonce=?
      WHERE id=? AND status='pending' AND revision=? AND EXISTS(SELECT 1 FROM beta_account_restrictions WHERE id=? AND status='active' AND revision=?)`).bind(body.decision,session.user_id,now,reason,nonce,appeal.id,body.revision,restriction.id,restriction.revision));
    statements.push(env.DB.prepare(`UPDATE beta_account_restrictions SET status=?,resolved_by=?,resolved_at=?,resolution_reason=?,revision=revision+1,decision_nonce=?
      WHERE id=? AND status='active' AND revision=? AND (? IS NULL OR EXISTS(SELECT 1 FROM beta_account_appeals WHERE id=? AND decision_nonce=?))`).bind(lift?'lifted':'active',session.user_id,now,reason,nonce,restriction.id,restriction.revision,appeal?.id||null,appeal?.id||null,nonce));
    if(lift)statements.push(env.DB.prepare(`UPDATE beta_enrollments SET status='active',revoked_at=NULL
      WHERE user_id=? AND status='revoked' AND EXISTS(SELECT 1 FROM users WHERE id=? AND status='active' AND account_state='active')
        AND EXISTS(SELECT 1 FROM beta_account_restrictions WHERE id=? AND status='lifted' AND decision_nonce=?)`).bind(restriction.user_id,restriction.user_id,restriction.id,nonce));
    statements.push(env.DB.prepare(`INSERT INTO beta_account_moderation_events(id,restriction_id,actor_user_id,action,reason,revision,created_at)
      SELECT ?,id,?,?,?,?,? FROM beta_account_restrictions WHERE id=? AND decision_nonce=?`).bind(safeUuid(),session.user_id,appeal?(lift?'appeal_lifted':'appeal_upheld'):'lift',`${purpose}; ${reason}${appeal&&restriction.created_by===session.user_id?'; original reviewer conflict acknowledged':''}`.slice(0,300),revision,now,restriction.id,nonce));
    const results=await env.DB.batch(statements);if(!results[0]?.meta.changes)throw new SocialError('decision_conflict','ข้อมูลถูกแก้ไขแล้ว',409);
    return json({ok:true});
  }
  throw new SocialError('invalid_action','คำสั่งไม่ถูกต้อง');
}

async function moderationOverview(request, env) {
  const { session, purpose } = await moderationAccess(request, env, ["report_reviewer", "safety_admin"], {
    fixedPurpose: "routine_admin_dashboard_access",
    requireRecentAuthentication: false,
  });
  const since = unixTime() - 86400;
  const counts = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users) members,
      (SELECT COUNT(*) FROM users WHERE status='active' AND account_state='active') activeMembers,
      (SELECT COUNT(*) FROM account_deletion_requests) deletionRequests,
      (SELECT COUNT(*) FROM beta_invitations WHERE status='active' AND use_count<max_uses AND expires_at>unixepoch()) availableInvitations,
      (SELECT COUNT(*) FROM media_safety_reviews WHERE status='pending') pending,
      (SELECT COUNT(*) FROM media_safety_reviews WHERE status='released' AND COALESCE(category,'general')='general') general,
      (SELECT COUNT(*) FROM media_safety_reviews WHERE status='released' AND category='sensitive') sensitive,
      (SELECT COUNT(*) FROM media_safety_reviews WHERE status='rejected') rejected,
      (SELECT COUNT(*) FROM social_reports WHERE status IN ('pending','escalated')) userReports,
      (SELECT COUNT(*) FROM media_reports WHERE status IN ('pending','escalated')) mediaReports,
      ((SELECT COUNT(*) FROM social_reports WHERE status IN ('pending','escalated')) +
       (SELECT COUNT(*) FROM media_reports WHERE status IN ('pending','escalated'))) reports,
      (SELECT COUNT(*) FROM media_appeals WHERE status='pending') appeals,
      ((SELECT COUNT(*) FROM media_reports WHERE status IN ('pending','escalated') AND (status='escalated' OR reason_code IN ('ncii','minor_safety'))) +
       (SELECT COUNT(*) FROM social_reports WHERE status IN ('pending','escalated') AND (status='escalated' OR reason_code IN ('threat','ncii','child_safety')))) critical,
      ((SELECT COUNT(*) FROM media_reports WHERE status IN ('pending','escalated') AND reason_code IN ('violence','privacy','sexual_content')) +
       (SELECT COUNT(*) FROM social_reports WHERE status IN ('pending','escalated') AND reason_code IN ('sexual_content','privacy'))) high
  `).first();
  const daily = await env.DB.prepare(`
    SELECT
      ((SELECT COUNT(*) FROM media_safety_reviews WHERE created_at >= ?) +
       (SELECT COUNT(*) FROM social_reports WHERE created_at >= ?) +
       (SELECT COUNT(*) FROM media_reports WHERE created_at >= ?) +
       (SELECT COUNT(*) FROM media_appeals WHERE created_at >= ?)) newLast24Hours,
      ((SELECT COUNT(*) FROM media_safety_reviews WHERE reviewed_at >= ?) +
       (SELECT COUNT(*) FROM social_reports WHERE reviewed_at >= ?) +
       (SELECT COUNT(*) FROM media_reports WHERE reviewed_at >= ?) +
       (SELECT COUNT(*) FROM media_appeals WHERE reviewed_at >= ?)) resolvedLast24Hours,
      (SELECT MIN(created_at) FROM (
        SELECT created_at FROM media_safety_reviews WHERE status='pending'
        UNION ALL SELECT created_at FROM social_reports WHERE status IN ('pending','escalated')
        UNION ALL SELECT created_at FROM media_reports WHERE status IN ('pending','escalated')
        UNION ALL SELECT created_at FROM media_appeals WHERE status='pending'
      )) oldestOpenAt
  `).bind(since, since, since, since, since, since, since, since).first();
  const cleanup = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END) pending,
      SUM(CASE WHEN completed_at IS NULL AND attempts >= 10 THEN 1 ELSE 0 END) exhausted
    FROM media_deletion_queue
  `).first();
  await auditMediaSafety(env.DB, session.user_id, "queue_view", "overview", purpose);
  return json({
    counts,
    coverage: moderationCoverage(),
    daily: {
      newLast24Hours: Number(daily?.newLast24Hours || 0),
      resolvedLast24Hours: Number(daily?.resolvedLast24Hours || 0),
      oldestOpenAt: daily?.oldestOpenAt || null,
    },
    cleanup: {
      pending: Number(cleanup?.pending || 0),
      exhausted: Number(cleanup?.exhausted || 0),
    },
  });
}

async function reportMedia(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  const session = await authenticated(request, env, { csrf: true });
  await requireProfile(env.DB, session.user_id);
  await limited(env, "media_report_user_day", session.user_id, 12, 86400);
  const body = await readJson(request);
  const mediaId = identifier(body.mediaId, "ไม่พบรูปภาพ");
  const reasons = new Set(["harassment", "ncii", "minor_safety", "sexual_content", "violence", "privacy", "spam", "other"]);
  if (!reasons.has(body.reason)) throw new SocialError("invalid_category", "กรุณาเลือกเหตุผลการรายงาน");
  const media = await env.DB.prepare(`
    SELECT m.owner_user_id,m.state,m.purpose,p.visibility,review.status review_status,review.category review_category
    FROM social_media m JOIN media_safety_reviews review ON review.media_id=m.id
    LEFT JOIN profile_photos p ON p.media_id=m.id
    WHERE m.id=?
  `).bind(mediaId).first();
  if (!media || media.owner_user_id === session.user_id || media.state !== "active"
    || !await approvedMediaForViewer(env, media, session.user_id)
    || !(media.purpose==='chat'?await accessibleChatAsset(env,mediaId,session.user_id):['profile','gallery'].includes(media.purpose)&&await canViewPhoto(env.DB,session.user_id,media))
    || !await mayViewProfile(env.DB, env, session.user_id, media.owner_user_id)) {
    throw new SocialError("not_found", "ไม่พบรูปภาพ", 404);
  }
  try {
    await env.DB.prepare(`
      INSERT INTO media_reports(id,media_id,reporter_user_id,reason_code,details,created_at)
      VALUES (?,?,?,?,?,?)
    `).bind(safeUuid(), mediaId, session.user_id, body.reason, cleanText(body.details, 1000, { required: true }), unixTime()).run();
  } catch (error) {
    if (String(error?.message || "").includes("UNIQUE")) throw new SocialError("already_reported", "คุณรายงานรูปนี้แล้ว", 409);
    throw error;
  }
  return json({ ok: true }, 201);
}

async function moderationMediaReports(request, env) {
  const { session, purpose } = await moderationAccess(request, env, ["report_reviewer", "safety_admin"]);
  if (request.method === "GET") {
    const status = new URL(request.url).searchParams.get("status") || "pending";
    if (!["pending", "reviewed", "escalated", "closed"].includes(status)) throw new SocialError("invalid_status", "สถานะไม่ถูกต้อง");
    const paging=queuePage(request);
    const rows = await env.DB.prepare(`
      SELECT report.id,report.media_id,report.reason_code,report.details,report.status,report.revision,
             report.created_at,report.reviewed_at,media.purpose media_purpose,
             review.status media_status,review.category
      FROM media_reports report
      JOIN social_media media ON media.id=report.media_id
      JOIN media_safety_reviews review ON review.media_id=report.media_id
      WHERE report.status=? AND media.purpose IN ('profile','gallery','chat')
        AND (?='' OR instr(report.id,?)>0 OR instr(report.details,?)>0 OR instr(report.media_id,?)>0)
      ORDER BY CASE WHEN report.reason_code IN ('ncii','minor_safety') THEN 0 WHEN report.reason_code IN ('violence','privacy','sexual_content') THEN 1 ELSE 2 END,report.created_at,report.id LIMIT ? OFFSET ?
    `).bind(status,paging.q,paging.q,paging.q,paging.q,paging.limit+1,paging.offset).all();
    await auditMediaSafety(env.DB, session.user_id, "queue_view", `reports:${status}`, purpose);
    return queueResult(rows,'reports',paging);
  }
  const body = await readJson(request);
  const id = identifier(body.id, "ไม่พบรายงาน");
  const status = String(body.status || "");
  if (!["reviewed", "escalated", "closed"].includes(status)) throw new SocialError("invalid_status", "สถานะไม่ถูกต้อง");
  const note = cleanText(body.note, 300, { required: true });
  const timestamp = unixTime();
  const report = await env.DB.prepare("SELECT report.media_id,report.revision FROM media_reports report JOIN social_media m ON m.id=report.media_id WHERE report.id=? AND report.status<>'closed' AND m.purpose IN ('profile','gallery','chat')").bind(id).first();
  if (!report) throw new SocialError("not_found", "ไม่พบรายงานที่ดำเนินการได้", 404);
  const revision=body.revision??report.revision,nonce=safeUuid();
  if(!Number.isSafeInteger(revision)||revision<0)throw new SocialError('revision_required','กรุณาโหลดรายงานใหม่',409);
  const results=await env.DB.batch([
    env.DB.prepare("UPDATE media_reports SET status=?,reviewed_at=?,reviewed_by=?,revision=revision+1,decision_nonce=? WHERE id=? AND revision=? AND status<>'closed'").bind(status,timestamp,session.user_id,nonce,id,revision),
    env.DB.prepare("INSERT INTO media_safety_audit_events(id,actor_user_id,action,media_id,purpose,created_at) SELECT ?,?,'decision',?,?,? FROM media_reports WHERE id=? AND decision_nonce=?").bind(safeUuid(),session.user_id,report.media_id,`${purpose}; ${note}`.slice(0,300),timestamp,id,nonce),
  ]);
  if (!Number(results[0]?.meta?.changes || 0)) throw new SocialError("decision_conflict", "รายงานนี้ถูกแก้ไขแล้ว", 409);
  return json({ ok: true });
}

async function mediaAppeals(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  const session = await authenticated(request, env, { csrf: request.method === "POST" });
  await requireProfile(env.DB, session.user_id);
  if (request.method === "GET") {
    const rows = await env.DB.prepare(`
      SELECT id,media_id,reason,status,decision_reason,created_at,reviewed_at
      FROM media_appeals WHERE appellant_user_id=? ORDER BY created_at DESC LIMIT 50
    `).bind(session.user_id).all();
    const appealable = await env.DB.prepare(`
      SELECT media.id media_id,review.reason decision_reason,review.reviewed_at
      FROM social_media media JOIN media_safety_reviews review ON review.media_id=media.id
      WHERE media.owner_user_id=? AND review.status='rejected'
        AND NOT EXISTS (
          SELECT 1 FROM media_appeals appeal
          WHERE appeal.media_id=media.id AND appeal.appellant_user_id=? AND appeal.status='pending'
        )
      ORDER BY review.reviewed_at DESC LIMIT 50
    `).bind(session.user_id, session.user_id).all();
    return json({ appeals: rows.results || [], appealable: appealable.results || [] });
  }
  await limited(env, "media_appeal_user_day", session.user_id, 5, 86400);
  const body = await readJson(request);
  const mediaId = identifier(body.mediaId, "ไม่พบรูปภาพ");
  const media = await env.DB.prepare(`
    SELECT media.id FROM social_media media JOIN media_safety_reviews review ON review.media_id=media.id
    WHERE media.id=? AND media.owner_user_id=? AND review.status='rejected'
  `).bind(mediaId, session.user_id).first();
  if (!media) throw new SocialError("not_found", "ไม่พบรูปที่ยื่นอุทธรณ์ได้", 404);
  const reason = cleanText(body.reason, 1000, { required: true });
  if (reason.length < 10) throw new SocialError("invalid_reason", "กรุณาระบุเหตุผลอุทธรณ์อย่างน้อย 10 ตัวอักษร");
  try {
    const id = safeUuid();
    await env.DB.prepare(`
      INSERT INTO media_appeals(id,media_id,appellant_user_id,reason,created_at) VALUES (?,?,?,?,?)
    `).bind(id, mediaId, session.user_id, reason, unixTime()).run();
    return json({ ok: true, id }, 201);
  } catch (error) {
    if (String(error?.message || "").includes("UNIQUE")) throw new SocialError("appeal_pending", "มีคำอุทธรณ์สำหรับรูปนี้แล้ว", 409);
    throw error;
  }
}

async function moderationAppeals(request, env) {
  const { session, purpose } = await moderationAccess(request, env, ["safety_admin"]);
  if (request.method === "GET") {
    const status = new URL(request.url).searchParams.get("status") || "pending";
    if (!["pending", "granted", "denied", "withdrawn"].includes(status)) throw new SocialError("invalid_status", "สถานะไม่ถูกต้อง");
    const paging=queuePage(request);
    const rows = await env.DB.prepare(`
      SELECT appeal.id,appeal.media_id,appeal.reason,appeal.status,appeal.revision,
             appeal.created_at,appeal.reviewed_at,review.category,review.reason decision_reason,review.reviewed_by=? reviewer_conflict
      FROM media_appeals appeal JOIN media_safety_reviews review ON review.media_id=appeal.media_id
      JOIN social_media media ON media.id=appeal.media_id
      WHERE appeal.status=? AND media.purpose IN ('profile','gallery','chat')
        AND (?='' OR instr(appeal.id,?)>0 OR instr(appeal.reason,?)>0 OR instr(appeal.media_id,?)>0)
      ORDER BY appeal.created_at,appeal.id LIMIT ? OFFSET ?
    `).bind(session.user_id,status,paging.q,paging.q,paging.q,paging.q,paging.limit+1,paging.offset).all();
    await auditMediaSafety(env.DB, session.user_id, "queue_view", `appeals:${status}`, purpose);
    return queueResult(rows,'appeals',paging);
  }
  const body = await readJson(request);
  const id = identifier(body.id, "ไม่พบคำอุทธรณ์");
  const decision = String(body.decision || "");
  if (!["granted", "denied"].includes(decision)) throw new SocialError("invalid_status", "ผลอุทธรณ์ไม่ถูกต้อง");
  const reason = cleanText(body.reason, 1000, { required: true });
  const expectedRevision = Number(body.revision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new SocialError("revision_required", "ข้อมูลมีการเปลี่ยนแปลง กรุณาโหลดใหม่", 409);
  const category = decision === "granted" ? String(body.category || "general") : "prohibited";
  if (decision === "granted" && !["general", "sensitive"].includes(category)) throw new SocialError("invalid_category", "หมวดหมู่ไม่ถูกต้อง");
  const appeal = await env.DB.prepare(`
    SELECT appeal.media_id,appeal.appellant_user_id,appeal.revision,media.object_key,
           review.status,review.category,review.reviewed_by,review.revision review_revision
    FROM media_appeals appeal
    JOIN social_media media ON media.id=appeal.media_id
    JOIN media_safety_reviews review ON review.media_id=appeal.media_id
    WHERE appeal.id=? AND appeal.status='pending' AND media.purpose IN ('profile','gallery','chat')
  `).bind(id).first();
  if (!appeal) throw new SocialError("not_found", "ไม่พบคำอุทธรณ์ที่รอตรวจ", 404);
  if(appeal.reviewed_by===session.user_id)throw new SocialError('independent_review_required','คำอุทธรณ์นี้ต้องให้ผู้ตรวจคนอื่นพิจารณา ห้ามผู้ตัดสินเดิมตัดสินซ้ำ',409);
  if (Number(appeal.revision) !== expectedRevision) throw new SocialError("decision_conflict", "คำอุทธรณ์นี้ถูกแก้ไขแล้ว", 409);
  if(appeal.status!=='rejected')throw new SocialError('decision_conflict','สถานะสื่อเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่',409);
  if(decision==='granted'&&(!env.MEDIA||!await (env.MEDIA.head?env.MEDIA.head(appeal.object_key):env.MEDIA.get(appeal.object_key))))throw new SocialError('media_unavailable','ไฟล์ถูกลบหรือไม่พร้อมใช้งาน ไม่สามารถคืนสิทธิ์ได้',409);
  const timestamp = unixTime();
  const decisionNonce=safeUuid();
  const nextAppealRevision = expectedRevision + 1;
  const nextMediaRevision = Number(appeal.review_revision) + 1;
  const statements = [
    env.DB.prepare(`
      UPDATE media_appeals SET status=?,decision_reason=?,reviewed_at=?,reviewed_by=?,revision=?,decision_nonce=?
      WHERE id=? AND status='pending' AND revision=? AND EXISTS(
        SELECT 1 FROM media_safety_reviews r JOIN social_media m ON m.id=r.media_id
        WHERE r.media_id=media_appeals.media_id AND r.status='rejected' AND r.revision=?
          AND m.state IN ('active','pending_deletion')
          AND NOT EXISTS(SELECT 1 FROM media_deletion_queue q WHERE q.object_key=m.object_key AND q.completed_at IS NULL AND q.processing_nonce IS NOT NULL))
    `).bind(decision, reason, timestamp, session.user_id, nextAppealRevision,decisionNonce, id, expectedRevision,appeal.review_revision),
    env.DB.prepare(`
      INSERT INTO moderation_notifications(id,user_id,kind,media_id,appeal_id,message_code,created_at)
      SELECT ?,?,'appeal_decision',?,?,?,? FROM media_appeals WHERE id=? AND decision_nonce=?
    `).bind(safeUuid(), appeal.appellant_user_id, appeal.media_id, id, decision === "granted" ? "appeal_granted" : "appeal_denied", timestamp, id,decisionNonce),
  ];
  if (decision === "granted") {
    statements.push(
      env.DB.prepare("UPDATE social_media SET state='active' WHERE id=? AND EXISTS(SELECT 1 FROM media_appeals WHERE id=? AND decision_nonce=?)").bind(appeal.media_id,id,decisionNonce),
      env.DB.prepare(`UPDATE media_safety_reviews SET status='released',category=?,reason=?,reviewed_at=?,reviewed_by=?,revision=? WHERE media_id=? AND status='rejected' AND EXISTS(SELECT 1 FROM media_appeals WHERE id=? AND decision_nonce=?)`)
        .bind(category, reason, timestamp, session.user_id, nextMediaRevision, appeal.media_id,id,decisionNonce),
      env.DB.prepare("DELETE FROM media_deletion_queue WHERE object_key=? AND completed_at IS NULL AND EXISTS(SELECT 1 FROM media_appeals WHERE id=? AND decision_nonce=?)").bind(appeal.object_key,id,decisionNonce),
    );
  } else {
    statements.push(env.DB.prepare("UPDATE media_deletion_queue SET next_attempt_at=? WHERE object_key=? AND completed_at IS NULL AND EXISTS(SELECT 1 FROM media_appeals WHERE id=? AND decision_nonce=?)").bind(timestamp, appeal.object_key,id,decisionNonce));
  }
  statements.push(env.DB.prepare(`
    INSERT INTO media_moderation_decisions(id,media_id,actor_user_id,previous_status,new_status,previous_category,new_category,reason,revision,created_at)
    SELECT ?,?,?,?,?,?,?,?,?,? FROM media_appeals WHERE id=? AND decision_nonce=?
  `).bind(safeUuid(), appeal.media_id, session.user_id, appeal.status, decision === "granted" ? "released" : "rejected", appeal.category, category, reason, nextMediaRevision, timestamp, id,decisionNonce));
  const results = await env.DB.batch(statements);
  if (!Number(results[0]?.meta?.changes || 0)) throw new SocialError("decision_conflict", "คำอุทธรณ์นี้ถูกแก้ไขแล้ว", 409);
  await auditMediaSafety(env.DB, session.user_id, "decision", appeal.media_id, `${purpose}; ${reason}`.slice(0, 300));
  return json({ ok: true });
}

async function moderationAudit(request, env) {
  const { session, purpose } = await moderationAccess(request, env, ["safety_admin"]);
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = 50;
  const rows = await env.DB.prepare(`
    SELECT id,media_id,actor_user_id,new_status action,new_category category,reason,created_at,revision
    FROM media_moderation_decisions ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?
  `).bind(limit + 1, (page - 1) * limit).all();
  await auditMediaSafety(env.DB, session.user_id, "queue_view", "audit_history", purpose);
  const events = rows.results || [];
  const access = await env.DB.prepare(`SELECT action,purpose,created_at FROM (
    SELECT action,purpose,created_at FROM media_safety_audit_events
    UNION ALL SELECT action,purpose,created_at FROM moderation_audit_events WHERE action NOT IN ('verification_view','verification_decision')
    UNION ALL SELECT scope action,purpose,created_at FROM administration_access_events
    UNION ALL SELECT action,purpose,created_at FROM eligibility_review_events WHERE purpose IS NOT NULL
  ) ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(limit+1,(page-1)*limit).all();
  return json({ events: events.slice(0, limit), accessEvents:(access.results||[]).slice(0,limit), page, hasMore: events.length > limit || (access.results||[]).length>limit });
}

async function moderationNotifications(request, env) {
  const session = await authenticated(request, env, { csrf: request.method === "POST" });
  if (request.method === "GET") {
    const rows = await env.DB.prepare(`
      SELECT id,kind,media_id,appeal_id,message_code,created_at,read_at FROM (
        SELECT id,kind,media_id,appeal_id,message_code,created_at,read_at FROM moderation_notifications WHERE user_id=?
        UNION ALL SELECT id,'account_safety' kind,NULL media_id,NULL appeal_id,message_code,created_at,read_at FROM account_safety_notifications WHERE user_id=?
      ) ORDER BY created_at DESC LIMIT 100
    `).bind(session.user_id,session.user_id).all();
    return json({ notifications: rows.results || [] });
  }
  const body = await readJson(request);
  const id = identifier(body.id, "ไม่พบการแจ้งเตือน");
  await env.DB.batch([
    env.DB.prepare("UPDATE moderation_notifications SET read_at=? WHERE id=? AND user_id=? AND read_at IS NULL").bind(unixTime(),id,session.user_id),
    env.DB.prepare("UPDATE account_safety_notifications SET read_at=? WHERE id=? AND user_id=? AND read_at IS NULL").bind(unixTime(),id,session.user_id),
  ]);
  return json({ ok: true });
}

async function ratings(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  capability(env, "RATINGS_ENABLED");
  const session = await authenticated(request, env, { csrf: request.method === "POST" });
  const me = await requireProfile(env.DB, session.user_id);
  if (request.method === "GET") {
    const paging=queuePage(request);
    const rows = await env.DB.prepare(`
      SELECT r.id, r.score, r.comment, r.created_at, p.name sender_name
      FROM proximity_ratings r JOIN member_profiles p ON p.user_id = r.sender_user_id
      WHERE r.receiver_user_id = ? AND ${unblockedSql('r.sender_user_id','r.receiver_user_id')}
      ORDER BY r.created_at DESC,r.id DESC LIMIT ? OFFSET ?
    `).bind(session.user_id,paging.limit+1,paging.offset).all();
    return queueResult(rows,'ratings',paging);
  }
  await limited(env, "rating_user_day", session.user_id, 30, 86400);
  const body = await readJson(request);
  const target = String(body.target || "");
  if (!target || target === session.user_id) throw new SocialError("invalid_target", "ไม่พบผู้ใช้", 404);
  await requireBetaTarget(env,target);
  if(!await env.DB.prepare(`SELECT 1 ok WHERE ${eligibleSql('?')}`).bind(target).first())throw new SocialError('invalid_target','ไม่พบผู้ใช้',404);
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
  if(enabled(env.BETA_ENROLLMENT_REQUIRED)&&!await db.prepare("SELECT 1 ok FROM beta_enrollments WHERE user_id=? AND status='active'").bind(owner).first())return false;
  if (await isBlocked(db, viewer, owner)) return false;
  if (await albumGrant(db,viewer,owner)) return true;
  if (await canContact(db, viewer, owner)) return true;
  if (!enabled(env.PUBLIC_DISCOVERY_ENABLED)) return false;
  return Boolean(await db.prepare(`
    SELECT 1 visible FROM member_profiles p JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ? AND u.status = 'active' AND ${eligibleSql('p.user_id')} AND p.discovery_visible = 1 AND p.located_at > ?
  `).bind(owner, unixTime() - LOCATION_FRESH_SECONDS).first());
}

async function gallery(request, env) {
  capability(env, "SOCIAL_APP_ENABLED");
  const session = await authenticated(request, env, { csrf: request.method === "POST" });
  await requireProfile(env.DB, session.user_id);
  if (request.method === "GET") {
    const url = new URL(request.url);
    const owner = String(url.searchParams.get("user") || session.user_id);
    const scope = url.searchParams.get('album') || 'public';
    if (!['public','private'].includes(scope)) throw new SocialError('invalid_input','ประเภทอัลบั้มไม่ถูกต้อง');
    if (!await mayViewProfile(env.DB, env, session.user_id, owner)) {
      throw new SocialError("not_found", "ไม่พบแกลเลอรี", 404);
    }
    if (scope === 'private' && session.user_id !== owner && !await albumGrant(env.DB, session.user_id, owner)) {
      throw new SocialError('not_found','ไม่พบแกลเลอรี',404);
    }
    const rows = await env.DB.prepare(`
      SELECT p.media_id id, p.caption, p.visibility, p.created_at, m.content_type, m.byte_size,
             (SELECT status FROM media_safety_reviews WHERE media_id=m.id) review_status,
             mp.selected_photo_id = p.media_id selected,
             (SELECT COUNT(*) FROM photo_likes l WHERE l.media_id = p.media_id) like_count,
             EXISTS(SELECT 1 FROM photo_likes l WHERE l.media_id = p.media_id AND l.user_id = ?) liked
      FROM profile_photos p
      JOIN social_media m ON m.id = p.media_id AND m.state = 'active'
      JOIN member_profiles mp ON mp.user_id = p.owner_user_id
      WHERE p.owner_user_id = ?
        AND p.visibility = ?
        AND ((p.owner_user_id=? AND EXISTS(SELECT 1 FROM media_safety_reviews r WHERE r.media_id=m.id AND r.status IN ('pending','rejected')))
        OR EXISTS (
          SELECT 1 FROM media_safety_reviews review
          WHERE review.media_id = m.id AND review.status = 'released'
            AND (
              COALESCE(review.category, 'general') = 'general'
              OR (review.category = 'sensitive' AND ? = 1 AND EXISTS (
                SELECT 1 FROM independent_age_assurances assurance
                WHERE assurance.user_id = ? AND assurance.status = 'verified'
                  AND assurance.revoked_at IS NULL
                  AND (assurance.expires_at IS NULL OR assurance.expires_at > ?)
              ))
            )
        ))
      ORDER BY p.created_at DESC LIMIT 12
    `).bind(session.user_id, owner, scope, session.user_id, enabled(env.SENSITIVE_CONTENT_ENABLED) ? 1 : 0, session.user_id, unixTime()).all();
    const photos = (rows.results || []).filter(p=>!url.searchParams.get('photo')||p.review_status==='released');
    if (url.searchParams.get("photo")) {
      const id = String(url.searchParams.get("photo"));
      if (!photos.some((photo) => photo.id === id)) throw new SocialError("not_found", "ไม่พบรูปภาพ", 404);
      const comments = await env.DB.prepare(`
        SELECT c.id, c.body, c.created_at, p.user_id sender_user_id, p.name sender_name
        FROM photo_comments c JOIN member_profiles p ON p.user_id = c.sender_user_id
        WHERE c.media_id = ? AND ${unblockedSql('c.sender_user_id','?')} AND ${eligibleSql('c.sender_user_id')} ORDER BY c.created_at ASC,c.id LIMIT 200
      `).bind(id,session.user_id,session.user_id).all();
      return json({ photos, comments: comments.results || [], owner });
    }
    const access=await env.DB.prepare('SELECT id,status,revision FROM album_access_requests WHERE album_owner_id=? AND requester_id=?')
      .bind(owner,session.user_id).first();
    return json({ photos, comments: [], owner,album:{granted:await albumGrant(env.DB,session.user_id,owner),request:access||null} });
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.startsWith("multipart/form-data")) {
    capability(env, "MEDIA_UPLOAD_ENABLED");
    if (!env.MEDIA) throw new Error("missing_media_binding");
    await limited(env,'gallery_upload_attempt_user_hour',session.user_id,60,3600);
    const idempotencyKey = uploadIdempotencyKey(request);
    const form = await request.formData();
    const visibility = String(form.get('visibility') || 'private');
    if (!['public','private'].includes(visibility)) throw new SocialError('invalid_input','ประเภทอัลบั้มไม่ถูกต้อง');
    const file = form.get("file");
    if (!(file instanceof File)) throw new SocialError("invalid_file", "กรุณาเลือกรูปภาพ");
    if (file.size < 1 || file.size > 8 * 1024 * 1024) throw new SocialError("invalid_file_size", "รูปภาพต้องมีขนาดไม่เกิน 8 MB");
    let image;
    try { image = sanitizeImage(new Uint8Array(await file.arrayBuffer()), file.type); }
    catch { throw new SocialError("invalid_image", "รองรับเฉพาะ JPG, PNG และ WebP ที่ถูกต้อง"); }
    const reservation = await reserveMediaUpload(env.DB, session.user_id, "gallery", idempotencyKey);
    if (reservation.replay) {
      const prior = await env.DB.prepare('SELECT visibility FROM profile_photos WHERE media_id=? AND owner_user_id=?').bind(reservation.result_id, session.user_id).first();
      if (prior && prior.visibility !== visibility) throw new SocialError('idempotency_conflict','คำขอนี้ใช้กับอีกอัลบั้มแล้ว',409);
      return json({ id: reservation.result_id, reviewStatus: "pending", idempotentReplay: true }, 201);
    }
    // Cheap early rejection; the D1 trigger remains the atomic race safeguard.
    const count=await env.DB.prepare('SELECT COUNT(*) n FROM profile_photos WHERE owner_user_id=?').bind(session.user_id).first();
    if(Number(count?.n||0)>=12){await releaseMediaUpload(env.DB,session.user_id,'gallery',idempotencyKey);throw new SocialError('gallery_full','อัปโหลดได้สูงสุด 12 รูปรวมทั้งสองอัลบั้ม',409);}
    const { bytes, contentType: detectedType } = image;
    const id = safeUuid();
    const objectKey = `gallery/${safeUuid()}`;
    const timestamp = unixTime();
    try {
      await env.MEDIA.put(objectKey, bytes, { httpMetadata: { contentType: detectedType }, customMetadata: { purpose: "gallery" } });
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO social_media(id, owner_user_id, object_key, purpose, content_type, byte_size, created_at)
          VALUES (?, ?, ?, 'gallery', ?, ?, ?)
        `).bind(id, session.user_id, objectKey, detectedType, bytes.length, timestamp),
        env.DB.prepare(`
          INSERT INTO profile_photos(media_id, owner_user_id, caption, visibility, created_at) VALUES (?, ?, ?, ?, ?)
        `).bind(id, session.user_id, cleanText(form.get("caption"), 300), visibility, timestamp),
        env.DB.prepare(`
          INSERT INTO media_safety_reviews(media_id,status,source,created_at)
          VALUES (?, 'pending', 'manual', ?)
        `).bind(id, timestamp),
        completeMediaUploadStatement(env.DB, session.user_id, "gallery", idempotencyKey, id, id, timestamp),
      ]);
    } catch (error) {
      try{await env.MEDIA.delete(objectKey);}catch{
        // The media transaction rolled back, but R2 may already contain bytes.
        // Persist a retryable deletion even when immediate object cleanup fails.
        await env.DB.prepare(`INSERT OR IGNORE INTO media_deletion_queue(object_key,operation_id,next_attempt_at,created_at) VALUES(?,?,?,?)`)
          .bind(objectKey,safeUuid(),timestamp,timestamp).run();
      }
      await releaseMediaUpload(env.DB, session.user_id, "gallery", idempotencyKey).catch(() => {});
      if(String(error).includes('gallery_capacity_exceeded'))throw new SocialError('gallery_full','อัปโหลดได้สูงสุด 12 รูปรวมทั้งสองอัลบั้ม',409);
      throw error;
    }
    return json({ id, reviewStatus: "pending" }, 201);
  }

  const body = await readJson(request);
  const id = String(body.id || "");
  const photo = await env.DB.prepare(`
    SELECT p.owner_user_id, p.visibility, m.object_key, m.state,
           review.status review_status,review.category review_category
    FROM profile_photos p JOIN social_media m ON m.id = p.media_id
    LEFT JOIN media_safety_reviews review ON review.media_id=m.id
    WHERE p.media_id = ?
  `).bind(id).first();
  if (!photo) throw new SocialError("not_found", "ไม่พบรูปภาพ", 404);
  if (body.album && body.album !== photo.visibility) throw new SocialError('not_found','ไม่พบรูปภาพ',404);
  if(body.action==='visibility'){
    await limited(env,'gallery_visibility_user_hour',session.user_id,60,3600);
    if(photo.owner_user_id!==session.user_id) throw new SocialError('forbidden','ไม่มีสิทธิ์เปลี่ยนรูปภาพ',403);
    if(!['public','private'].includes(body.visibility)) throw new SocialError('invalid_input','ข้อมูลไม่ถูกต้อง');
    // Visibility is not a moderation decision. Quarantined media remains inaccessible.
    await env.DB.prepare('UPDATE profile_photos SET visibility=? WHERE media_id=? AND owner_user_id=?')
      .bind(body.visibility,id,session.user_id).run();
    return json({ok:true});
  }
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
  if (photo.state !== "active" || !await approvedMediaForViewer(env, photo, session.user_id)
    || !await canViewPhoto(env.DB,session.user_id,photo)
    || !await mayViewProfile(env.DB, env, session.user_id, photo.owner_user_id)) {
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
  await requireProfile(env.DB,session.user_id);
  const media = await env.DB.prepare(`
    SELECT m.object_key, m.content_type, m.owner_user_id, m.state, p.visibility,
           review.status review_status, review.category review_category
    FROM social_media m JOIN profile_photos p ON p.media_id = m.id
    LEFT JOIN media_safety_reviews review ON review.media_id = m.id
    WHERE m.id = ?
  `).bind(id).first();
  if (!media || media.state !== "active"
    || !await canViewPhoto(env.DB,session.user_id,media)
    || !await approvedMediaForViewer(env, media, session.user_id)
    || !await mayViewProfile(env.DB, env, session.user_id, media.owner_user_id)) {
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
    if (String(error?.message).includes('direct_chat_contact_denied')) return failure('ไม่สามารถติดต่อบัญชีนี้',403,'contact_unavailable');
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
  const { session, purpose } = await moderationAccess(request, env, ["identity_reviewer"]);
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
  const { session, purpose } = await moderationAccess(request, env, ["identity_reviewer"]);
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
    if (path === '/api/social/moderation/access' && ['GET','POST'].includes(request.method)) return await adminAccessLogin(request,env);
    if (path === '/api/social/online' && ['GET','POST'].includes(request.method)) return await onlinePresence(request,env);
    if (path === '/api/social/conversations' && request.method === 'GET') return await conversations(request,env);
    if (path === '/api/social/albums/access' && ['GET','POST'].includes(request.method)) return await albumAccess(request,env);
    if (path === '/api/social/chat-preferences' && request.method==='POST') return await chatPreferences(request,env);
    if (request.method === "POST" && (path === "/api/social/onboarding/member" || path === "/api/social/onboarding/adult")) {
      return await memberOnboarding(request, env);
    }
    if (path === "/api/social/profile") {
      if (request.method === "GET") return await getProfile(request, env);
      if (request.method === "POST") return await updateProfile(request, env);
    }
    if (path === "/api/social/discovery" && ["GET", "POST"].includes(request.method)) return await discovery(request, env);
    if (path === "/api/social/relationships" && ["GET", "POST"].includes(request.method)) return await relationships(request, env);
    if (path === "/api/social/blocks" && ["GET", "POST"].includes(request.method)) return await blocks(request, env);
    if (path === "/api/social/messages" && ["GET", "POST"].includes(request.method)) return await messages(request, env);
    if (request.method === "GET" && path === "/api/social/chat-assets") return await chatAssets(request, env);
    if (request.method === "GET" && path === "/api/social/upload-quotas") return await uploadQuotas(request, env);
    if (request.method === "GET" && path.startsWith("/api/social/chat/media/")) {
      return await chatMedia(request, env, decodeURIComponent(path.slice("/api/social/chat/media/".length)));
    }
    if (request.method === "POST" && path === "/api/social/reports") return await reports(request, env);
    if (request.method === "POST" && path === "/api/social/reports/media") return await reportMedia(request, env);
    if (path === "/api/social/media/appeals" && ["GET", "POST"].includes(request.method)) return await mediaAppeals(request, env);
    if (path === "/api/social/moderation/notifications" && ["GET", "POST"].includes(request.method)) return await moderationNotifications(request, env);
    if (request.method === "GET" && path === "/api/social/moderation/overview") return await moderationOverview(request, env);
    if(request.method==='GET'&&path==='/api/social/moderation/capabilities')return await moderationCapabilities(request,env);
    if(request.method==='GET'&&path==='/api/social/moderation/members')return await moderationMemberQueues(request,env);
    if (path === '/api/social/moderation/eligibility' && ['GET','POST'].includes(request.method)) {
      return await eligibilityModeration(request, env, await moderationAccess(request, env, ['safety_admin']));
    }
    if (path === '/api/social/account-appeals' && ['GET','POST'].includes(request.method)) return await accountAppeals(request,env);
    if (path === '/api/social/moderation/accounts' && ['GET','POST'].includes(request.method)) return await moderationAccounts(request,env);
    if (path === "/api/social/moderation/roles" && ["GET", "POST"].includes(request.method)) return await moderationRoleManagement(request, env);
    if (path === "/api/social/moderation/reports" && ["GET", "POST"].includes(request.method)) return await moderationReports(request, env);
    if (path === "/api/social/moderation/media-reports" && ["GET", "POST"].includes(request.method)) return await moderationMediaReports(request, env);
    if (path === "/api/social/moderation/appeals" && ["GET", "POST"].includes(request.method)) return await moderationAppeals(request, env);
    if (request.method === "GET" && path === "/api/social/moderation/audit") return await moderationAudit(request, env);
    if (request.method === "GET" && path === "/api/social/moderation/messages") return await moderationMessages(request, env);
    if (request.method === "GET" && path.startsWith("/api/social/moderation/messages/media/")) {
      return await moderationMessageMedia(request, env, decodeURIComponent(path.slice("/api/social/moderation/messages/media/".length)));
    }
    if (path === "/api/social/moderation/media" && ["GET", "POST"].includes(request.method)) return await moderationMedia(request, env);
    if (request.method === "GET" && path.startsWith("/api/social/moderation/media/")) {
      return await moderationMediaObject(request, env, decodeURIComponent(path.slice("/api/social/moderation/media/".length)));
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
    if (/age_safety_contact_denied/u.test(String(error?.message))) return failure('การติดต่อยังไม่ได้รับอนุญาตตามมาตรการช่วงอายุ',403,'age_safety_review_required');
    if (/direct_chat_(recipient_limit|duplicate)/u.test(String(error?.message))) return failure('ส่งข้อความซ้ำหรือติดต่อสมาชิกใหม่บ่อยเกินไป กรุณารอ',429,'chat_spam_limited');
    if (error instanceof RequestError) return failure("คำขอไม่ถูกต้อง", error.status, error.code);
    if (error instanceof SocialError) return failure(error.message, error.status, error.code);
    console.error(JSON.stringify({ event: "social_request_failed", reason: "internal_error", type: error?.name === 'Error' ? 'Error' : 'Unhandled' }));
    return failure("ไม่สามารถดำเนินการได้ กรุณาลองใหม่", 500, "internal_error");
  }
}
