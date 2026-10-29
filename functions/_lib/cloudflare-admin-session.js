import { constantTimeEqual, hmac, sha256 } from './crypto.js';
import { cloudflareAdminPrincipal } from './cloudflare-admin-access.js';

export function standaloneAdminEnabled(env) {
  return env.ADMIN_ACCESS_STANDALONE_ENABLED === 'true';
}

export async function adminAccessContext(request, env) {
  if (!standaloneAdminEnabled(env)) throw new Error('standalone_admin_disabled');
  if (String(env.RATE_LIMIT_PEPPER || '').length < 24) throw new Error('missing_admin_csrf_secret');
  const principal = await cloudflareAdminPrincipal(request, env);
  const user = await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active' AND account_state='active'").bind(principal.userId).first();
  if (!user) throw new Error('admin_account_inactive');
  const restriction = await env.DB.prepare("SELECT 1 blocked FROM beta_account_restrictions WHERE user_id=? AND status='active'").bind(principal.userId).first();
  if (restriction) throw new Error('admin_account_restricted');
  const ageHold = await env.DB.prepare("SELECT 1 held FROM member_age_safety_holds WHERE user_id=? AND (state='held' OR age_band<>'20_plus')").bind(principal.userId).first();
  if (ageHold) throw new Error('admin_age_safety_hold');
  return {
    userId: principal.userId,
    tokenHash: await sha256('cloudflare-admin:v1:' + principal.token),
    subjectHash: await sha256(principal.subject),
    expiresAt: principal.expiresAt,
    authenticatedAt: principal.authenticatedAt,
    startCsrf: await hmac(env.RATE_LIMIT_PEPPER, 'admin-start:v1:' + principal.token),
    actionCsrf: await hmac(env.RATE_LIMIT_PEPPER, 'admin-action:v1:' + principal.token),
  };
}

export async function getAdminAccessSession(env, context, now = Math.floor(Date.now() / 1000)) {
  return env.DB.prepare(`SELECT token_hash,csrf_hash,user_id,authenticated_at,expires_at
    FROM cloudflare_admin_sessions WHERE token_hash=? AND user_id=? AND subject_hash=?
      AND revoked_at IS NULL AND expires_at>?`)
    .bind(context.tokenHash, context.userId, context.subjectHash, now).first();
}

export async function startAdminAccessSession(env, context, now = Math.floor(Date.now() / 1000)) {
  const expiresAt = Math.min(context.expiresAt, now + 3600);
  if (expiresAt <= now) throw new Error('admin_assertion_expired');
  // Never renew a logged-out token or refresh its authentication evidence.
  await env.DB.prepare(`INSERT INTO cloudflare_admin_sessions(
    token_hash,user_id,subject_hash,csrf_hash,authenticated_at,created_at,expires_at,assertion_expires_at
  ) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(token_hash) DO NOTHING`)
    .bind(context.tokenHash, context.userId, context.subjectHash, await sha256(context.actionCsrf),
      context.authenticatedAt, now, expiresAt, context.expiresAt).run();
  return getAdminAccessSession(env, context, now);
}

export async function adminCsrfValid(request, session, expected) {
  const supplied = request.headers.get('x-cg-admin-csrf') || '';
  return Boolean(supplied && constantTimeEqual(supplied, expected)
    && (!session || constantTimeEqual(await sha256(supplied), session.csrf_hash)));
}

export async function cleanupAdminAccessSessions(db, now, batchSize = 100) {
  const limit = Math.max(1, Math.min(Number(batchSize) || 100, 500));
  // Revoked-token tombstones remain through token expiry to prevent replay.
  const result = await db.prepare(`DELETE FROM cloudflare_admin_sessions WHERE token_hash IN (
    SELECT token_hash FROM cloudflare_admin_sessions WHERE assertion_expires_at<=? ORDER BY assertion_expires_at LIMIT ?
  )`).bind(now, limit).run();
  return Number(result.meta?.changes || 0);
}
