import { CSRF_COOKIE, SESSION_COOKIE, cookie, parseCookies } from "./http.js";
import { constantTimeEqual, randomToken, sha256, safeUuid } from "./crypto.js";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function unixTime() {
  return Math.floor(Date.now() / 1000);
}

export async function rateLimit(db, scope, rawKey, limit, windowSeconds, secret, timestamp = unixTime()) {
  const windowStart = Math.floor(timestamp / windowSeconds) * windowSeconds;
  const keyHash = await sha256(`${secret}:${scope}:${rawKey}`);
  const row = await db.prepare(`
    INSERT INTO rate_limits(scope, key_hash, window_start, count, expires_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(scope, key_hash, window_start)
    DO UPDATE SET count = count + 1, expires_at = excluded.expires_at
    RETURNING count
  `).bind(scope, keyHash, windowStart, windowStart + windowSeconds * 2).first();
  return Number(row?.count || 1) <= limit;
}

export async function issueSession(db, userId, timestamp = unixTime()) {
  const token = randomToken();
  const csrf = randomToken();
  await db.prepare(`
    INSERT INTO sessions(token_hash, user_id, csrf_hash, created_at, expires_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(await sha256(token), userId, await sha256(csrf), timestamp, timestamp + SESSION_TTL_SECONDS, timestamp).run();
  return {
    token,
    csrf,
    cookies: [
      cookie(SESSION_COOKIE, token, SESSION_TTL_SECONDS, { httpOnly: true, sameSite: "Lax" }),
      cookie(CSRF_COOKIE, csrf, SESSION_TTL_SECONDS, { httpOnly: false, sameSite: "Lax" }),
    ],
  };
}

export async function getSession(request, db, timestamp = unixTime()) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  return db.prepare(`
    SELECT s.token_hash, s.csrf_hash, s.user_id, s.expires_at,
           u.email, u.display_name, u.avatar_url, u.status
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.status = 'active'
  `).bind(await sha256(token), timestamp).first();
}

export async function requireCsrf(request, session) {
  const cookieToken = parseCookies(request)[CSRF_COOKIE] || "";
  const headerToken = request.headers.get("x-csrf-token") || "";
  if (!cookieToken || !headerToken || !constantTimeEqual(cookieToken, headerToken)) return false;
  return constantTimeEqual(await sha256(headerToken), session.csrf_hash);
}

export async function findOrCreateIdentity(db, profile, linkUserId, timestamp = unixTime()) {
  const existing = await db.prepare(
    `SELECT i.user_id, u.status FROM identities i JOIN users u ON u.id = i.user_id
     WHERE i.provider = ? AND i.subject = ?`,
  ).bind(profile.provider, profile.subject).first();

  if (existing) {
    if (existing.status !== "active") throw new Error("account_disabled");
    if (linkUserId && existing.user_id !== linkUserId) throw new Error("identity_already_linked");
    await db.prepare(`
      UPDATE identities SET last_login_at = ?, provider_email = ?, email_verified = ?
      WHERE provider = ? AND subject = ?
    `).bind(timestamp, profile.email, profile.emailVerified ? 1 : 0, profile.provider, profile.subject).run();
    return existing.user_id;
  }

  let userId = linkUserId || null;
  if (!userId && profile.email && profile.emailVerified) {
    const user = await db.prepare(
      "SELECT id FROM users WHERE email = ? AND email_verified_at IS NOT NULL AND status = 'active'",
    ).bind(profile.email).first();
    userId = user?.id || null;
  }

  if (!userId) {
    userId = safeUuid();
    const safeEmail = profile.email && profile.emailVerified ? profile.email : null;
    await db.prepare(`
      INSERT INTO users(id, email, email_verified_at, display_name, avatar_url, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(
      userId,
      safeEmail,
      safeEmail ? timestamp : null,
      profile.name || null,
      profile.picture || null,
      timestamp,
      timestamp,
    ).run();
  }

  try {
    await db.prepare(`
      INSERT INTO identities(provider, subject, user_id, provider_email, email_verified, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      profile.provider,
      profile.subject,
      userId,
      profile.email || null,
      profile.emailVerified ? 1 : 0,
      timestamp,
      timestamp,
    ).run();
  } catch (error) {
    // A concurrent callback can win the unique constraint. Trust only the stored identity.
    const winner = await db.prepare(
      "SELECT user_id FROM identities WHERE provider = ? AND subject = ?",
    ).bind(profile.provider, profile.subject).first();
    if (!winner || (linkUserId && winner.user_id !== linkUserId)) throw error;
    userId = winner.user_id;
  }
  return userId;
}

export async function createVerifiedEmailUser(db, email, timestamp = unixTime()) {
  const existing = await db.prepare("SELECT id, status FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    if (existing.status !== "active") throw new Error("account_disabled");
    await db.prepare(`
      UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ?
      WHERE id = ? AND status = 'active'
    `).bind(timestamp, timestamp, existing.id).run();
    return existing.id;
  }
  const userId = safeUuid();
  try {
    await db.prepare(`
      INSERT INTO users(id, email, email_verified_at, status, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?)
    `).bind(userId, email, timestamp, timestamp, timestamp).run();
    return userId;
  } catch (error) {
    const winner = await db.prepare("SELECT id, status FROM users WHERE email = ?").bind(email).first();
    if (!winner) throw error;
    if (winner.status !== "active") throw new Error("account_disabled");
    return winner.id;
  }
}
