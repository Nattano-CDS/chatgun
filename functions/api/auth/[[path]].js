import { constantTimeEqual, hmac, randomOtp, randomToken, safeUuid, sha256 } from "../../_lib/crypto.js";
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
  createVerifiedEmailUser,
  findOrCreateIdentity,
  getSession,
  issueSession,
  rateLimit,
  requireCsrf,
  unixTime,
} from "../../_lib/db.js";
import { exchangeCode, providerConfiguration, verifyProviderIdentity } from "../../_lib/oauth.js";

const PROVIDERS = new Set(["google", "facebook", "line"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const OAUTH_TTL_SECONDS = 600;
const OTP_TTL_SECONDS = 300;
const OTP_COOLDOWN_SECONDS = 60;
const GENERIC_ERROR = "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง";

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
    && (!outcome.hostname || outcome.hostname === requestHost(request))
    && (!outcome.action || outcome.action === expectedAction);
}

async function startOtp(request, env) {
  requireSameOrigin(request);
  const body = await readJson(request);
  if (body.channel !== "email" || !featureEnabled(env.EMAIL_OTP_ENABLED)) return otpDisabled();
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

  let linkUserId = null;
  if (body.link === true) {
    const session = await getSession(request, env.DB);
    if (!session) return failure("กรุณาเข้าสู่ระบบก่อนเชื่อมบัญชี", 401, "unauthorized");
    if (!await requireCsrf(request, session)) return failure("คำขอหมดอายุ กรุณาลองใหม่", 403, "invalid_csrf");
    linkUserId = session.user_id;
  }

  const configuration = providerConfiguration(provider, env);
  const state = randomToken();
  const verifier = randomToken(48);
  const nonce = randomToken();
  const timestamp = unixTime();
  await env.DB.prepare(`
    INSERT INTO oauth_flows(state_hash, provider, pkce_verifier, nonce, ip_hash, link_user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    await sha256(state),
    provider,
    verifier,
    nonce,
    await hmac(env.RATE_LIMIT_PEPPER, clientIp(request)),
    linkUserId,
    timestamp,
    timestamp + OAUTH_TTL_SECONDS,
  ).run();

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
  const url = new URL(request.url);
  if (url.searchParams.has("error")) return authErrorRedirect(request, "provider_denied");
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const cookieState = parseCookies(request)[OAUTH_COOKIE] || "";
  if (!state || !code || !constantTimeEqual(state, cookieState) || state.length > 128 || code.length > 2048) {
    return authErrorRedirect(request, "invalid_state");
  }
  const stateHash = await sha256(state);
  const flow = await env.DB.prepare(`
    SELECT provider, pkce_verifier, nonce, link_user_id, expires_at
    FROM oauth_flows WHERE state_hash = ? AND provider = ?
  `).bind(stateHash, provider).first();
  const timestamp = unixTime();
  if (!flow || Number(flow.expires_at) <= timestamp) return authErrorRedirect(request, "oauth_expired");
  const claimed = await env.DB.prepare(
    "DELETE FROM oauth_flows WHERE state_hash = ? AND provider = ? AND expires_at > ?",
  ).bind(stateHash, provider, timestamp).run();
  if (Number(claimed.meta?.changes || 0) !== 1) return authErrorRedirect(request, "oauth_used");

  try {
    const configuration = providerConfiguration(provider, env);
    const callbackUrl = `${url.origin}/api/auth/oauth/${provider}/callback`;
    const token = await exchangeCode(provider, configuration, code, callbackUrl, flow.pkce_verifier);
    const profile = await verifyProviderIdentity(provider, configuration, token, flow.nonce, timestamp);
    if (!profile.subject || profile.subject.length > 255) throw new Error("invalid_subject");
    const userId = await findOrCreateIdentity(env.DB, profile, flow.link_user_id, timestamp);
    const session = await issueSession(env.DB, userId, timestamp);
    return redirect("/account.html", [cookie(OAUTH_COOKIE, "", 0), ...session.cookies]);
  } catch (error) {
    console.error(JSON.stringify({ event: "oauth_callback_failed", provider, reason: error?.message || "unknown" }));
    return authErrorRedirect(request, error?.message === "identity_already_linked" ? "identity_linked" : "oauth_failed");
  }
}

async function currentUser(request, env) {
  const session = await getSession(request, env.DB);
  if (!session) return failure("กรุณาเข้าสู่ระบบ", 401, "unauthorized");
  return json({
    user: {
      id: session.user_id,
      email: session.email,
      displayName: session.display_name,
      avatarUrl: session.avatar_url,
    },
  });
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

export async function onRequest({ request, env }) {
  const requestId = safeUuid();
  try {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/api/auth/config") {
      const emailOtpEnabled = featureEnabled(env.EMAIL_OTP_ENABLED);
      const mobileOtpEnabled = featureEnabled(env.MOBILE_OTP_ENABLED);
      return json({
        turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
        oauthProviders: [...PROVIDERS],
        emailOtpEnabled,
        mobileOtpEnabled,
        smsEnabled: mobileOtpEnabled,
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
    if (request.method === "POST" && path === "/api/auth/logout") return await logout(request, env);
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
    console.error(JSON.stringify({ event: "auth_request_failed", requestId, reason: error?.message || "unknown" }));
    return failure(GENERIC_ERROR, 500, "internal_error", requestId);
  }
}
