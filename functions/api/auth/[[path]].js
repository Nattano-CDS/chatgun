import { constantTimeEqual, hmac, randomOtp, randomToken, safeUuid, sha256 } from "../../_lib/crypto.js";
import { enabledOAuthProviders } from "../../_lib/oauth-provider-gates.js";
import { eligibilityRequest } from '../../_lib/eligibility-review.js';
import {
  CSRF_COOKIE,
  OAUTH_COOKIE,
  SESSION_COOKIE,
  RequestError,
  appendCookies,
  cookie,
  failure,
  json,
  parseCookies,
  readJson,
  redirect,
  requireSameOrigin,
} from "../../_lib/http.js";
import {
  confirmAccountDeletion,
  createDeletionRequest,
  createVerifiedEmailUser,
  findOrCreateIdentity,
  getSession,
  hasRecentAuthentication,
  issueSession,
  markSessionReauthenticated,
  rateLimit,
  requireCsrf,
  unixTime,
} from "../../_lib/db.js";
import { exchangeCode, providerConfiguration, verifyProviderIdentity } from "../../_lib/oauth.js";
import {
  acceptanceFlowEnabled,
  accountJourney,
  currentAcceptance,
  requiredAcceptanceVersions,
} from "../../_lib/acceptance.js";

const PROVIDERS = new Set(["google", "facebook", "line"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const OAUTH_TTL_SECONDS = 600;
const OTP_TTL_SECONDS = 300;
const OTP_COOLDOWN_SECONDS = 60;
const DELETE_REAUTH_PURPOSE = "account_deletion";
const GENERIC_ERROR = "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง";
const INVITATION_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

function featureEnabled(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function otpDisabled() {
  return failure("ขณะนี้เปิดให้เข้าสู่ระบบด้วย Google, Facebook หรือ LINE เท่านั้น", 404, "otp_disabled");
}

function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || "unknown";
}

function requestHost(request) {
  return new URL(request.url).hostname;
}

function authErrorRedirect(request, code) {
  const target = new URL("/signup.html", request.url);
  target.searchParams.set("auth_error", code);
  return redirect(target.pathname + target.search, [cookie(OAUTH_COOKIE, "", 0)]);
}

function assertEnvironment(env, names) {
  if (!env.DB) throw new Error("missing_db_binding");
  for (const name of names) if (!env[name]) throw new Error(`missing_${name.toLowerCase()}`);
}

async function verifyTurnstile(request, env, token, expectedAction) {
  assertEnvironment(env, ["TURNSTILE_SECRET_KEY"]);
  if (typeof token !== "string" || token.length < 10 || token.length > 2048) return false;
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: clientIp(request),
      idempotency_key: safeUuid(),
    }),
  });
  const outcome = await response.json().catch(() => ({}));
  return response.ok && outcome.success === true
    && outcome.hostname === requestHost(request)
    && outcome.action === expectedAction;
}

async function startOtp(request, env) {
  requireSameOrigin(request);
  const body = await readJson(request);
  if (body.channel !== "email" || !featureEnabled(env.EMAIL_OTP_ENABLED)) return otpDisabled();
  if (!featureEnabled(env.NEW_ACCOUNT_REGISTRATION_ENABLED)) {
    return failure("ขณะนี้ยังไม่เปิดรับสมัครบัญชีใหม่", 403, "registration_closed");
  }
  assertEnvironment(env, ["OTP_PEPPER", "RATE_LIMIT_PEPPER", "RESEND_API_KEY", "EMAIL_FROM"]);
  if (typeof body.destination !== "string") return failure("กรุณากรอกอีเมลให้ถูกต้อง", 400, "invalid_email");
  const email = body.destination.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return failure("กรุณากรอกอีเมลให้ถูกต้อง", 400, "invalid_email");
  }
  if (!await verifyTurnstile(request, env, body.turnstileToken, "auth_start")) {
    return failure("กรุณายืนยันว่าคุณไม่ใช่โปรแกรมอัตโนมัติ", 403, "turnstile_failed");
  }

  const timestamp = unixTime();
  const emailAllowed = await rateLimit(env.DB, "otp_email_hour", email, 5, 3600, env.RATE_LIMIT_PEPPER, timestamp);
  const ipAllowed = await rateLimit(env.DB, "otp_ip_hour", clientIp(request), 20, 3600, env.RATE_LIMIT_PEPPER, timestamp);
  if (!emailAllowed || !ipAllowed) {
    return failure("ขอรหัสบ่อยเกินไป กรุณาลองใหม่ภายหลัง", 429, "rate_limited");
  }
  const latest = await env.DB.prepare(
    "SELECT created_at FROM otp_challenges WHERE email = ? ORDER BY created_at DESC LIMIT 1",
  ).bind(email).first();
  if (latest && Number(latest.created_at) > timestamp - OTP_COOLDOWN_SECONDS) {
    return failure("กรุณารอ 60 วินาทีก่อนขอรหัสใหม่", 429, "cooldown");
  }

  const challengeId = safeUuid();
  const otp = randomOtp();
  const ipHash = await hmac(env.RATE_LIMIT_PEPPER, clientIp(request));
  const codeHash = await hmac(env.OTP_PEPPER, `${challengeId}:${otp}`);
  await env.DB.prepare(`
    INSERT INTO otp_challenges(id, email, code_hash, ip_hash, expires_at, created_at, attempts)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).bind(challengeId, email, codeHash, ipHash, timestamp + OTP_TTL_SECONDS, timestamp).run();

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "idempotency-key": `chatgun-otp-${challengeId}`,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: "รหัสยืนยัน ChatGun",
      text: `รหัสยืนยัน ChatGun ของคุณคือ ${otp}\nรหัสนี้จะหมดอายุใน 5 นาที หากคุณไม่ได้ขอรหัสนี้ โปรดเพิกเฉยต่ออีเมลฉบับนี้`,
    }),
  });
  if (!sent.ok) {
    await env.DB.prepare("UPDATE otp_challenges SET used_at = ? WHERE id = ?").bind(timestamp, challengeId).run();
    return failure("ยังไม่สามารถส่งอีเมลได้ กรุณาลองใหม่ภายหลัง", 502, "email_delivery_failed");
  }
  return json({ challengeId, expiresIn: OTP_TTL_SECONDS, resendAfter: OTP_COOLDOWN_SECONDS });
}

async function verifyOtp(request, env) {
  requireSameOrigin(request);
  if (!featureEnabled(env.EMAIL_OTP_ENABLED)) return otpDisabled();
  assertEnvironment(env, ["OTP_PEPPER", "RATE_LIMIT_PEPPER"]);
  const body = await readJson(request);
  if (typeof body.challengeId !== "string" || body.challengeId.length > 64 || !/^\d{6}$/u.test(body.code || "")) {
    return failure("รหัส OTP ไม่ถูกต้อง", 400, "invalid_otp");
  }
  const timestamp = unixTime();
  const allowed = await rateLimit(
    env.DB,
    "otp_verify_ip_10m",
    clientIp(request),
    30,
    600,
    env.RATE_LIMIT_PEPPER,
    timestamp,
  );
  if (!allowed) return failure("ลองรหัสบ่อยเกินไป กรุณารอสักครู่", 429, "rate_limited");

  const row = await env.DB.prepare(`
    SELECT id, email, code_hash, expires_at, attempts, used_at
    FROM otp_challenges WHERE id = ?
  `).bind(body.challengeId).first();
  if (!row || row.used_at || Number(row.expires_at) <= timestamp || Number(row.attempts) >= 5) {
    return failure("รหัส OTP หมดอายุหรือถูกใช้แล้ว", 400, "otp_unavailable");
  }
  const suppliedHash = await hmac(env.OTP_PEPPER, `${body.challengeId}:${body.code}`);
  if (!constantTimeEqual(suppliedHash, row.code_hash)) {
    await env.DB.prepare(`
      UPDATE otp_challenges SET attempts = attempts + 1
      WHERE id = ? AND used_at IS NULL AND expires_at > ? AND attempts < 5
    `).bind(body.challengeId, timestamp).run();
    return failure("รหัส OTP ไม่ถูกต้อง", 400, "invalid_otp");
  }
  const claimed = await env.DB.prepare(`
    UPDATE otp_challenges SET used_at = ?
    WHERE id = ? AND code_hash = ? AND used_at IS NULL AND expires_at > ? AND attempts < 5
  `).bind(timestamp, body.challengeId, suppliedHash, timestamp).run();
  if (Number(claimed.meta?.changes || 0) !== 1) {
    return failure("รหัส OTP หมดอายุหรือถูกใช้แล้ว", 400, "otp_unavailable");
  }
  let userId;
  try {
    userId = await createVerifiedEmailUser(env.DB, row.email, timestamp);
  } catch (error) {
    if (error?.message === "account_disabled") return failure("บัญชีนี้ไม่พร้อมใช้งาน", 403, "account_disabled");
    throw error;
  }
  const session = await issueSession(env.DB, userId, timestamp);
  return appendCookies(json({ authenticated: true, redirectUrl: "/account.html" }), session.cookies);
}

async function startOauth(request, env, provider) {
  requireSameOrigin(request);
  if (!enabledOAuthProviders(env).includes(provider)) return failure("ChatGun กำลังเตรียมเปิดให้บริการ ยังไม่เปิดใช้งานการเข้าสู่บัญชี", 503, "oauth_unavailable");
  assertEnvironment(env, ["RATE_LIMIT_PEPPER"]);
  const body = await readJson(request);
  if (!await verifyTurnstile(request, env, body.turnstileToken, "auth_start")) {
    return failure("กรุณายืนยันว่าคุณไม่ใช่โปรแกรมอัตโนมัติ", 403, "turnstile_failed");
  }
  const allowed = await rateLimit(
    env.DB,
    "oauth_ip_10m",
    clientIp(request),
    20,
    600,
    env.RATE_LIMIT_PEPPER,
  );
  if (!allowed) return failure("เข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่", 429, "rate_limited");

  const reauthPurpose = body.purpose === DELETE_REAUTH_PURPOSE ? DELETE_REAUTH_PURPOSE : null;
  let linkUserId = null;
  let reauthSession = null;
  if (body.link === true || reauthPurpose) {
    const session = await getSession(request, env.DB);
    if (!session) return failure("กรุณาเข้าสู่ระบบก่อนดำเนินการ", 401, "unauthorized");
    if (!await requireCsrf(request, session)) return failure("คำขอหมดอายุ กรุณาลองใหม่", 403, "invalid_csrf");
    if (body.link === true && acceptanceFlowEnabled(env)) {
      const journey = await accountJourney(env.DB, session.user_id, env);
      if (journey.nextPath !== "/app/") {
        return failure("กรุณายอมรับข้อกำหนดและสร้างโปรไฟล์ให้เสร็จก่อนเชื่อมบัญชี", 403, "account_setup_required");
      }
    }
    linkUserId = session.user_id;
    if (reauthPurpose) {
      const linked = await env.DB.prepare(
        "SELECT 1 linked FROM identities WHERE user_id = ? AND provider = ?",
      ).bind(session.user_id, provider).first();
      if (!linked) return failure("บัญชีผู้ให้บริการนี้ไม่ได้เชื่อมกับ ChatGun", 400, "identity_not_linked");
      reauthSession = session;
    }
  }

  let invitationId = null;
  if (!linkUserId && typeof body.invitationCode === "string" && body.invitationCode.trim()) {
    if (!featureEnabled(env.BETA_INVITATION_REGISTRATION_ENABLED)) {
      return failure("รหัสเชิญไม่ถูกต้องหรือหมดอายุ", 403, "invitation_invalid");
    }
    const invitationCode = body.invitationCode.trim();
    const invitationAllowed = await rateLimit(
      env.DB,
      "beta_invitation_ip_10m",
      clientIp(request),
      10,
      600,
      env.RATE_LIMIT_PEPPER,
    );
    if (!invitationAllowed) return failure("ลองรหัสเชิญบ่อยเกินไป กรุณารอสักครู่", 429, "rate_limited");
    if (!INVITATION_PATTERN.test(invitationCode)) {
      return failure("รหัสเชิญไม่ถูกต้องหรือหมดอายุ", 403, "invitation_invalid");
    }
    const invitation = await env.DB.prepare(`
      SELECT id FROM beta_invitations
      WHERE token_hash = ? AND status = 'active' AND max_uses = 1
        AND expires_at > ? AND use_count < max_uses
    `).bind(await sha256(invitationCode), unixTime()).first();
    if (!invitation) return failure("รหัสเชิญไม่ถูกต้องหรือหมดอายุ", 403, "invitation_invalid");
    invitationId = invitation.id;
  }

  const configuration = providerConfiguration(provider, env);
  const state = randomToken();
  const verifier = randomToken(48);
  const nonce = randomToken();
  const timestamp = unixTime();
  const flowStatement = env.DB.prepare(`
    INSERT INTO oauth_flows(
      state_hash, provider, pkce_verifier, nonce, ip_hash, link_user_id, invitation_id, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    await sha256(state),
    provider,
    verifier,
    nonce,
    await hmac(env.RATE_LIMIT_PEPPER, clientIp(request)),
    linkUserId,
    invitationId,
    timestamp,
    timestamp + OAUTH_TTL_SECONDS,
  );
  if (reauthPurpose) {
    await env.DB.batch([
      flowStatement,
      env.DB.prepare(`
        INSERT INTO oauth_reauth_contexts(
          state_hash, session_token_hash, user_id, purpose, expires_at
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        await sha256(state),
        reauthSession.token_hash,
        reauthSession.user_id,
        reauthPurpose,
        timestamp + OAUTH_TTL_SECONDS,
      ),
    ]);
  } else {
    await flowStatement.run();
  }

  const callbackUrl = `${new URL(request.url).origin}/api/auth/oauth/${provider}/callback`;
  const authorization = new URL(configuration.authorizationUrl);
  authorization.searchParams.set("client_id", configuration.clientId);
  authorization.searchParams.set("redirect_uri", callbackUrl);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", configuration.scope);
  authorization.searchParams.set("state", state);
  if (provider !== "facebook") authorization.searchParams.set("nonce", nonce);
  if (configuration.pkce) {
    authorization.searchParams.set("code_challenge", await sha256(verifier));
    authorization.searchParams.set("code_challenge_method", "S256");
  }
  return appendCookies(
    json({ authorizationUrl: authorization.toString() }),
    [cookie(OAUTH_COOKIE, state, OAUTH_TTL_SECONDS, { httpOnly: true, sameSite: "Lax" })],
  );
}

async function oauthCallback(request, env, provider) {
  if (!enabledOAuthProviders(env).includes(provider)) return authErrorRedirect(request, "oauth_unavailable");
  const url = new URL(request.url);
  const providerDenied = url.searchParams.has("error");
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const cookieState = parseCookies(request)[OAUTH_COOKIE] || "";
  if (!state || (!providerDenied && !code) || !constantTimeEqual(state, cookieState)
    || state.length > 128 || code.length > 2048) {
    return authErrorRedirect(request, "invalid_state");
  }
  const stateHash = await sha256(state);
  const flow = await env.DB.prepare(`
    SELECT f.provider, f.pkce_verifier, f.nonce, f.link_user_id, f.invitation_id, f.expires_at,
           r.session_token_hash, r.user_id AS reauth_user_id, r.purpose AS reauth_purpose
    FROM oauth_flows f
    LEFT JOIN oauth_reauth_contexts r ON r.state_hash = f.state_hash
    WHERE f.state_hash = ? AND f.provider = ?
  `).bind(stateHash, provider).first();
  const timestamp = unixTime();
  if (!flow || Number(flow.expires_at) <= timestamp) return authErrorRedirect(request, "oauth_expired");
  const claimed = await env.DB.prepare(
    "DELETE FROM oauth_flows WHERE state_hash = ? AND provider = ? AND expires_at > ?",
  ).bind(stateHash, provider, timestamp).run();
  if (Number(claimed.meta?.changes || 0) !== 1) return authErrorRedirect(request, "oauth_used");
  if (providerDenied) return authErrorRedirect(request, "provider_denied");

  try {
    const configuration = providerConfiguration(provider, env);
    const callbackUrl = `${url.origin}/api/auth/oauth/${provider}/callback`;
    const token = await exchangeCode(provider, configuration, code, callbackUrl, flow.pkce_verifier);
    const profile = await verifyProviderIdentity(provider, configuration, token, flow.nonce, timestamp);
    if (!profile.subject || profile.subject.length > 255) throw new Error("invalid_subject");
    if (flow.reauth_purpose === DELETE_REAUTH_PURPOSE) {
      const currentSession = await getSession(request, env.DB, timestamp);
      if (!currentSession
        || currentSession.user_id !== flow.reauth_user_id
        || currentSession.token_hash !== flow.session_token_hash) {
        throw new Error("reauth_session_mismatch");
      }
      const identity = await env.DB.prepare(`
        SELECT 1 matched FROM identities
        WHERE provider = ? AND subject = ? AND user_id = ?
      `).bind(provider, profile.subject, flow.reauth_user_id).first();
      if (!identity) throw new Error("reauth_identity_mismatch");
      if (!await markSessionReauthenticated(env.DB, currentSession.token_hash, currentSession.user_id, timestamp)) {
        throw new Error("reauth_session_expired");
      }
      return redirect("/account.html?reauth=account_deletion", [cookie(OAUTH_COOKIE, "", 0)]);
    }
    const userId = await findOrCreateIdentity(
      env.DB,
      profile,
      flow.link_user_id,
      timestamp,
      {
        allowRegistration: featureEnabled(env.NEW_ACCOUNT_REGISTRATION_ENABLED),
        allowInvitationRegistration: featureEnabled(env.BETA_INVITATION_REGISTRATION_ENABLED),
        invitationId: flow.invitation_id,
      },
    );
    const session = await issueSession(env.DB, userId, timestamp);
    if (flow.link_user_id) {
      return redirect("/account.html", [cookie(OAUTH_COOKIE, "", 0), ...session.cookies]);
    }
    const journey = await accountJourney(env.DB, userId, env);
    return redirect(journey.nextPath, [cookie(OAUTH_COOKIE, "", 0), ...session.cookies]);
  } catch (error) {
    const safeReason=['identity_already_linked','registration_closed','invitation_unavailable','reauth_session_mismatch','reauth_identity_mismatch','reauth_session_expired'].includes(error?.message)?error.message:'provider_or_validation_failed';
    console.error(JSON.stringify({ event: "oauth_callback_failed", provider, reason: safeReason }));
    const redirectCode = error?.message === "identity_already_linked"
      ? "identity_linked"
      : error?.message === "registration_closed" ? "registration_closed"
        : error?.message === "invitation_unavailable" ? "invitation_unavailable" : "oauth_failed";
    return authErrorRedirect(request, redirectCode);
  }
}

async function currentUser(request, env) {
  const session = await getSession(request, env.DB);
  if (!session) return failure("กรุณาเข้าสู่ระบบ", 401, "unauthorized");
  const identities = await env.DB.prepare(
    "SELECT provider FROM identities WHERE user_id = ? ORDER BY provider",
  ).bind(session.user_id).all();
  const journey = await accountJourney(env.DB, session.user_id, env);
  return json({
    user: {
      id: session.user_id,
      email: session.email,
      displayName: session.display_name,
      avatarUrl: session.avatar_url,
      accountState: journey.accountState || session.account_state || "active",
    },
    providers: (identities.results || []).map(({ provider }) => provider),
    recentlyAuthenticated: hasRecentAuthentication(session),
    acceptanceRequired: journey.acceptanceRequired,
    nextPath: journey.nextPath,
    ageSafetyReviewRequired: journey.ageSafetyReviewRequired === true,
    canLinkAccounts: journey.nextPath === "/app/",
  });
}

async function acceptanceStatus(request, env) {
  const session = await getSession(request, env.DB);
  if (!session) return failure("กรุณาเข้าสู่ระบบ", 401, "unauthorized");
  if (!acceptanceFlowEnabled(env)) return failure("ขั้นตอนนี้ยังไม่เปิดใช้งาน", 404, "feature_disabled");
  const acceptance = await currentAcceptance(env.DB, session.user_id, env);
  const journey = await accountJourney(env.DB, session.user_id, env);
  return json({
    accepted: acceptance.accepted,
    required: acceptance.required,
    versions: acceptance.versions,
    acceptedAt: acceptance.acceptedAt,
    accountState: journey.accountState,
    nextPath: journey.nextPath,
    user: { displayName: session.display_name },
  });
}

async function acceptRequirements(request, env) {
  requireSameOrigin(request);
  const session = await getSession(request, env.DB);
  if (!session) return failure("กรุณาเข้าสู่ระบบ", 401, "unauthorized");
  if (!acceptanceFlowEnabled(env)) return failure("ขั้นตอนนี้ยังไม่เปิดใช้งาน", 404, "feature_disabled");
  if (!await requireCsrf(request, session)) return failure("คำขอหมดอายุ กรุณาลองใหม่", 403, "invalid_csrf");
  const body = await readJson(request);
  const versions = requiredAcceptanceVersions(env);
  const ageHold = await env.DB.prepare("SELECT 1 held FROM member_age_safety_holds WHERE user_id=? AND (state='held' OR age_band<>'20_plus')").bind(session.user_id).first();
  if (ageHold) return failure('บัญชีนี้อยู่ระหว่างตรวจสอบสิทธิ์ตามช่วงอายุ ไม่สามารถใช้การยืนยัน 18+ เพื่อเปิดสิทธิ์แทนได้',403,'age_safety_review_required');
  if (body.confirmedAdult !== true) {
    return failure("ผู้ที่มีอายุต่ำกว่า 18 ปีไม่สามารถเข้าร่วม ChatGun Beta ได้", 403, "underage_not_eligible");
  }
  if (body.acceptedTerms !== true || body.acknowledgedPrivacy !== true
    || body.adultNoticeVersion !== versions.adultNotice
    || body.termsVersion !== versions.terms
    || body.privacyVersion !== versions.privacy) {
    return failure("กรุณายืนยันข้อกำหนดและนโยบายฉบับปัจจุบัน", 400, "acceptance_required");
  }
  const current = await currentAcceptance(env.DB, session.user_id, env);
  if (current.accepted) {
    const journey = await accountJourney(env.DB, session.user_id, env);
    return json({ accepted: true, nextPath: journey.nextPath, alreadyAccepted: true });
  }
  const user = await env.DB.prepare(
    "SELECT account_state FROM users WHERE id = ? AND status = 'active'",
  ).bind(session.user_id).first();
  if (!user || user.account_state === "disabled") {
    return failure("บัญชีนี้ไม่พร้อมใช้งาน", 403, "account_disabled");
  }
  const timestamp = unixTime();
  const profile = await env.DB.prepare("SELECT 1 present FROM member_profiles WHERE user_id = ?").bind(session.user_id).first();
  const nextState = profile ? "active" : "pending_onboarding";
  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO account_acceptances(
          id, user_id, adult_notice_version, terms_version, privacy_version,
          adult_declared_at, terms_accepted_at, privacy_acknowledged_at, accepted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(safeUuid(), session.user_id, versions.adultNotice, versions.terms, versions.privacy,
        timestamp, timestamp, timestamp, timestamp),
      env.DB.prepare(`
        INSERT INTO age_assurance_events(id, user_id, age_band, method, notice_version, declared_at)
        SELECT ?, ?, 'adult_18_plus', 'self_declaration', ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM age_assurance_events
          WHERE user_id = ? AND notice_version = ? AND revoked_at IS NULL
        )
      `).bind(safeUuid(), session.user_id, versions.adultNotice, timestamp,
        session.user_id, versions.adultNotice),
      env.DB.prepare(`
        UPDATE users SET account_state = ?, updated_at = ?
        WHERE id = ? AND status = 'active' AND account_state != 'disabled'
      `).bind(nextState, timestamp, session.user_id),
    ]);
  } catch (error) {
    const accepted = await currentAcceptance(env.DB, session.user_id, env);
    if (!accepted.accepted) throw error;
  }
  return json({ accepted: true, nextPath: profile ? "/app/" : "/app/?onboarding=1" });
}

async function declineAcceptance(request, env) {
  requireSameOrigin(request);
  const session = await getSession(request, env.DB);
  if (!session) return failure("กรุณาเข้าสู่ระบบ", 401, "unauthorized");
  if (!await requireCsrf(request, session)) return failure("คำขอหมดอายุ กรุณาลองใหม่", 403, "invalid_csrf");
  await env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ?")
    .bind(unixTime(), session.token_hash).run();
  return appendCookies(json({ declined: true, redirectUrl: "/" }), [
    cookie(SESSION_COOKIE, "", 0),
    cookie(CSRF_COOKIE, "", 0, { httpOnly: false }),
    cookie(OAUTH_COOKIE, "", 0),
  ]);
}

async function requestAccountDeletion(request, env) {
  requireSameOrigin(request);
  const session = await getSession(request, env.DB);
  if (!session) return failure("กรุณาเข้าสู่ระบบ", 401, "unauthorized");
  if (!await requireCsrf(request, session)) return failure("คำขอหมดอายุ กรุณาลองใหม่", 403, "invalid_csrf");
  const body = await readJson(request);
  if (body.acknowledged !== true) {
    return failure("กรุณายืนยันว่าคุณเข้าใจผลของการลบบัญชี", 400, "deletion_not_acknowledged");
  }
  if (!hasRecentAuthentication(session)) {
    return failure("กรุณายืนยันตัวตนอีกครั้งก่อนลบบัญชี", 428, "recent_auth_required");
  }
  assertEnvironment(env, ["RATE_LIMIT_PEPPER"]);
  const allowed = await rateLimit(
    env.DB,
    "account_deletion_user_hour",
    session.user_id,
    5,
    3600,
    env.RATE_LIMIT_PEPPER,
  );
  if (!allowed) return failure("ส่งคำขอลบบัญชีบ่อยเกินไป กรุณาลองใหม่ภายหลัง", 429, "rate_limited");
  const deletion = await createDeletionRequest(env.DB, session.user_id);
  return json({
    requestId: deletion.requestId,
    confirmationToken: deletion.confirmationToken,
    expiresAt: deletion.expiresAt,
  });
}

async function confirmDeletion(request, env) {
  requireSameOrigin(request);
  const session = await getSession(request, env.DB);
  if (!session) return failure("กรุณาเข้าสู่ระบบ", 401, "unauthorized");
  if (!await requireCsrf(request, session)) return failure("คำขอหมดอายุ กรุณาลองใหม่", 403, "invalid_csrf");
  if (!hasRecentAuthentication(session)) {
    return failure("กรุณายืนยันตัวตนอีกครั้งก่อนลบบัญชี", 428, "recent_auth_required");
  }
  const body = await readJson(request);
  if (typeof body.requestId !== "string" || body.requestId.length > 64
    || typeof body.confirmationToken !== "string" || body.confirmationToken.length > 256
    || body.confirmText !== "ลบบัญชีถาวร") {
    return failure("ข้อมูลยืนยันการลบบัญชีไม่ถูกต้อง", 400, "invalid_deletion_confirmation");
  }
  const receipt = await confirmAccountDeletion(
    env.DB,
    session.user_id,
    body.requestId,
    body.confirmationToken,
  );
  if (!receipt) return failure("คำขอลบบัญชีหมดอายุหรือถูกใช้แล้ว", 409, "deletion_request_unavailable");
  return appendCookies(json({
    deleted: receipt.mediaDeletionPending === 0,
    accountAccessRevoked: true,
    mediaDeletionPending: receipt.mediaDeletionPending,
    receipt: { requestId: receipt.requestId, completedAt: receipt.completedAt },
  }), [
    cookie(SESSION_COOKIE, "", 0),
    cookie(CSRF_COOKIE, "", 0, { httpOnly: false }),
    cookie(OAUTH_COOKIE, "", 0),
  ]);
}

async function logout(request, env) {
  requireSameOrigin(request);
  const session = await getSession(request, env.DB);
  if (!session) {
    return appendCookies(json({ ok: true }), [
      cookie(SESSION_COOKIE, "", 0),
      cookie(CSRF_COOKIE, "", 0, { httpOnly: false }),
    ]);
  }
  if (!await requireCsrf(request, session)) return failure("คำขอหมดอายุ กรุณาลองใหม่", 403, "invalid_csrf");
  await env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ?").bind(unixTime(), session.token_hash).run();
  return appendCookies(json({ ok: true }), [
    cookie(SESSION_COOKIE, "", 0),
    cookie(CSRF_COOKIE, "", 0, { httpOnly: false }),
  ]);
}

async function accountSessions(request,env){
  const session=await getSession(request,env.DB);
  if(!session)return failure('กรุณาเข้าสู่ระบบ',401,'unauthorized');
  const now=unixTime();
  if(request.method==='POST'){
    requireSameOrigin(request);
    if(!await requireCsrf(request,session))return failure('คำขอหมดอายุ กรุณาลองใหม่',403,'invalid_csrf');
    if(!hasRecentAuthentication(session))return failure('กรุณาเข้าสู่ระบบใหม่ก่อนเพิกถอนเซสชัน',428,'recent_auth_required');
    if(!await rateLimit(env.DB,'session_management',session.user_id,20,3600,env.RATE_LIMIT_PEPPER))return failure('ดำเนินการบ่อยเกินไป กรุณารอ',429,'rate_limited');
    const body=await readJson(request);
    if(body.action!=='revoke_others')return failure('คำขอไม่ถูกต้อง',400,'invalid_action');
    const result=await env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=? AND token_hash<>? AND revoked_at IS NULL AND expires_at>?').bind(now,session.user_id,session.token_hash,now).run();
    return json({ok:true,revoked:Number(result.meta?.changes||0)});
  }
  const rows=await env.DB.prepare('SELECT token_hash,created_at,expires_at FROM sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 101').bind(session.user_id,now).all();
  return json({sessions:await Promise.all((rows.results||[]).slice(0,100).map(async row=>({id:await sha256('session-display:'+session.user_id+':'+row.token_hash),createdAt:row.created_at,expiresAt:row.expires_at,current:row.token_hash===session.token_hash}))),hasMore:(rows.results||[]).length>100});
}

export async function onRequest({ request, env }) {
  const requestId = safeUuid();
  try {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/api/auth/config") {
      const emailOtpEnabled = featureEnabled(env.EMAIL_OTP_ENABLED);
      const mobileOtpEnabled = featureEnabled(env.MOBILE_OTP_ENABLED);
      return json({
        turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
        oauthLoginEnabled: String(env.OAUTH_LOGIN_ENABLED).toLowerCase() !== "false",
        oauthProviders: enabledOAuthProviders(env),
        lineChannelMatchesExpected: env.LINE_EXPECTED_CLIENT_ID ? String(env.LINE_CLIENT_ID) === String(env.LINE_EXPECTED_CLIENT_ID) : null,
        emailOtpEnabled,
        mobileOtpEnabled,
        smsEnabled: mobileOtpEnabled,
        newAccountRegistrationEnabled: featureEnabled(env.NEW_ACCOUNT_REGISTRATION_ENABLED),
        invitationOnlyRegistrationEnabled: featureEnabled(env.BETA_INVITATION_REGISTRATION_ENABLED),
        safety: {
          publicDiscoveryEnabled: false,
          unsolicitedMessagingEnabled: false,
          minorRegistrationEnabled: false,
        },
      });
    }
    if (request.method === "POST" && path === "/api/auth/otp/start") return await startOtp(request, env);
    if (request.method === "POST" && path === "/api/auth/otp/verify") return await verifyOtp(request, env);
    const oauthMatch = path.match(/^\/api\/auth\/oauth\/(google|facebook|line)\/(start|callback)$/u);
    if (oauthMatch) {
      const [, provider, action] = oauthMatch;
      if (!PROVIDERS.has(provider)) return failure("ไม่พบผู้ให้บริการ", 404, "not_found");
      if (action === "start" && request.method === "POST") return await startOauth(request, env, provider);
      if (action === "callback" && request.method === "GET") return await oauthCallback(request, env, provider);
      return failure("ไม่อนุญาตวิธีเรียกนี้", 405, "method_not_allowed");
    }
    if (request.method === "GET" && path === "/api/auth/me") return await currentUser(request, env);
    if (path === '/api/auth/eligibility-review' && ['GET','POST'].includes(request.method)) return await eligibilityRequest(request, env);
    if (request.method === "GET" && path === "/api/auth/acceptance") return await acceptanceStatus(request, env);
    if (request.method === "POST" && path === "/api/auth/acceptance") return await acceptRequirements(request, env);
    if (request.method === "POST" && path === "/api/auth/acceptance/decline") return await declineAcceptance(request, env);
    if (request.method === "POST" && path === "/api/auth/logout") return await logout(request, env);
    if(path==='/api/auth/sessions'&&['GET','POST'].includes(request.method))return await accountSessions(request,env);
    if (request.method === "POST" && path === "/api/auth/account-deletion/request") {
      return await requestAccountDeletion(request, env);
    }
    if (request.method === "POST" && path === "/api/auth/account-deletion/confirm") {
      return await confirmDeletion(request, env);
    }
    return failure("ไม่พบหน้าที่เรียก", 404, "not_found");
  } catch (error) {
    if (error instanceof RequestError) {
      const messages = {
        invalid_origin: "คำขอไม่ถูกต้อง",
        invalid_content_type: "รูปแบบข้อมูลไม่ถูกต้อง",
        invalid_json: "รูปแบบข้อมูลไม่ถูกต้อง",
        body_too_large: "ข้อมูลมีขนาดใหญ่เกินไป",
      };
      return failure(messages[error.code] || "คำขอไม่ถูกต้อง", error.status, error.code, requestId);
    }
    console.error(JSON.stringify({ event: "auth_request_failed", requestId, reason: "internal_error" }));
    return failure(GENERIC_ERROR, 500, "internal_error", requestId);
  }
}
