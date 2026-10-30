import { CSRF_COOKIE, SESSION_COOKIE, cookie, parseCookies } from "./http.js";
import { constantTimeEqual, randomToken, sha256, safeUuid } from "./crypto.js";
import { DELETION_RECEIPT_TTL_SECONDS } from "./retention.js";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const RECENT_AUTH_TTL_SECONDS = 10 * 60;
export const DELETION_REQUEST_TTL_SECONDS = 10 * 60;

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
  const tokenHash = await sha256(token);
  const expiresAt = timestamp + SESSION_TTL_SECONDS;
  await db.batch([
    db.prepare(`
    INSERT INTO sessions(token_hash, user_id, csrf_hash, created_at, expires_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?)
    `).bind(tokenHash, userId, await sha256(csrf), timestamp, expiresAt, timestamp),
    db.prepare(`
      INSERT INTO session_auth_evidence(token_hash, user_id, authenticated_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).bind(tokenHash, userId, timestamp, expiresAt),
  ]);
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
           sae.authenticated_at,
           u.email, u.display_name, u.avatar_url, u.status, u.account_state
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN session_auth_evidence sae ON sae.token_hash = s.token_hash
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.status = 'active'
  `).bind(await sha256(token), timestamp).first();
}

export function hasRecentAuthentication(session, timestamp = unixTime()) {
  const authenticatedAt = Number(session?.authenticated_at || 0);
  return authenticatedAt > 0 && authenticatedAt >= timestamp - RECENT_AUTH_TTL_SECONDS;
}

export async function markSessionReauthenticated(db, tokenHash, userId, timestamp = unixTime()) {
  const updated = await db.prepare(`
    UPDATE session_auth_evidence
    SET authenticated_at = ?
    WHERE token_hash = ? AND user_id = ? AND expires_at > ?
  `).bind(timestamp, tokenHash, userId, timestamp).run();
  return Number(updated.meta?.changes || 0) === 1;
}

export async function createDeletionRequest(db, userId, timestamp = unixTime()) {
  const requestId = safeUuid();
  const confirmationToken = randomToken();
  const confirmationHash = await sha256(confirmationToken);
  const expiresAt = timestamp + DELETION_REQUEST_TTL_SECONDS;
  await db.prepare(`
    INSERT INTO account_deletion_requests(
      request_id, user_id, confirmation_hash, status, operation_id,
      requested_at, expires_at, updated_at
    ) VALUES (?, ?, ?, 'pending', NULL, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      request_id = excluded.request_id,
      confirmation_hash = excluded.confirmation_hash,
      status = 'pending',
      operation_id = NULL,
      requested_at = excluded.requested_at,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
  `).bind(
    requestId,
    userId,
    confirmationHash,
    timestamp,
    expiresAt,
    timestamp,
  ).run();
  return { requestId, confirmationToken, expiresAt };
}

export async function confirmAccountDeletion(
  db,
  userId,
  requestId,
  confirmationToken,
  timestamp = unixTime(),
) {
  const operationId = safeUuid();
  const confirmationHash = await sha256(confirmationToken);
  const receiptExpiresAt = timestamp + DELETION_RECEIPT_TTL_SECONDS;
  const results = await db.batch([
    db.prepare(`
      UPDATE account_deletion_requests
      SET status = 'processing', operation_id = ?, updated_at = ?
      WHERE request_id = ? AND user_id = ? AND confirmation_hash = ?
        AND status = 'pending' AND expires_at > ?
    `).bind(operationId, timestamp, requestId, userId, confirmationHash, timestamp),
    db.prepare(`
      UPDATE users SET status = 'disabled', updated_at = ?
      WHERE id = (
        SELECT user_id FROM account_deletion_requests
        WHERE request_id = ? AND operation_id = ? AND status = 'processing'
      )
    `).bind(timestamp, requestId, operationId),
    db.prepare(`
      UPDATE sessions SET revoked_at = COALESCE(revoked_at, ?)
      WHERE user_id = (
        SELECT user_id FROM account_deletion_requests
        WHERE request_id = ? AND operation_id = ? AND status = 'processing'
      )
    `).bind(timestamp, requestId, operationId),
    db.prepare(`
      DELETE FROM identities WHERE user_id = (
        SELECT user_id FROM account_deletion_requests
        WHERE request_id = ? AND operation_id = ? AND status = 'processing'
      )
    `).bind(requestId, operationId),
    db.prepare(`
      DELETE FROM oauth_flows WHERE link_user_id = (
        SELECT user_id FROM account_deletion_requests
        WHERE request_id = ? AND operation_id = ? AND status = 'processing'
      )
    `).bind(requestId, operationId),
    db.prepare(`
      INSERT OR IGNORE INTO media_deletion_queue(
        object_key, operation_id, attempts, next_attempt_at, created_at
      )
      SELECT object_key, ?, 0, ?, ? FROM social_media
      WHERE owner_user_id = (
        SELECT user_id FROM account_deletion_requests
        WHERE request_id = ? AND operation_id = ? AND status = 'processing'
      ) AND state IN ('active', 'pending_deletion')
    `).bind(operationId, timestamp, timestamp, requestId, operationId),
    db.prepare(`UPDATE social_messages SET unsent_at=COALESCE(unsent_at,?)
      WHERE body='' AND media_id IN(SELECT id FROM social_media WHERE owner_user_id=(
        SELECT user_id FROM account_deletion_requests WHERE request_id=? AND operation_id=? AND status='processing'))
    `).bind(timestamp,requestId,operationId),
    db.prepare(`
      INSERT INTO deletion_receipts(
        request_id, completed_at, policy_version, implementation_version, outcome, expires_at
      )
      SELECT request_id, ?, 'technical-draft-v1', 'near-migration-v1', 'deleted', ?
      FROM account_deletion_requests
      WHERE request_id = ? AND operation_id = ? AND status = 'processing'
    `).bind(timestamp, receiptExpiresAt, requestId, operationId),
    db.prepare(`
      DELETE FROM users WHERE id = (
        SELECT user_id FROM account_deletion_requests
        WHERE request_id = ? AND operation_id = ? AND status = 'processing'
      )
    `).bind(requestId, operationId),
  ]);
  if (Number(results[0]?.meta?.changes || 0) !== 1) return null;
  return {
    requestId,
    completedAt: timestamp,
    receiptExpiresAt,
    mediaDeletionPending: Number(results[5]?.meta?.changes || 0),
  };
}

export async function requireCsrf(request, session) {
  const cookieToken = parseCookies(request)[CSRF_COOKIE] || "";
  const headerToken = request.headers.get("x-csrf-token") || "";
  if (!cookieToken || !headerToken || !constantTimeEqual(cookieToken, headerToken)) return false;
  return constantTimeEqual(await sha256(headerToken), session.csrf_hash);
}

export async function findOrCreateIdentity(
  db,
  profile,
  linkUserId,
  timestamp = unixTime(),
  { allowRegistration = true, allowInvitationRegistration = false, invitationId = null, authorizedCohort = false } = {},
) {
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

  const invitedRegistration = !linkUserId && allowInvitationRegistration && Boolean(invitationId);
  if (!linkUserId && !allowRegistration && !invitedRegistration) throw new Error("registration_closed");

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
    if (invitedRegistration) {
      const claimNonce = safeUuid();
      let results;
      try {
        results = await db.batch([
        db.prepare(`
          UPDATE beta_invitations
          SET use_count = use_count + 1,
              consumed_at = CASE WHEN use_count + 1 = max_uses THEN ? ELSE consumed_at END,
              last_claim_nonce = ?
          WHERE id = ? AND status = 'active' AND max_uses = 1
            AND expires_at > ? AND use_count < max_uses
            AND (? = 0 OR EXISTS (
              SELECT 1 FROM uat_authorized_identities authorized
              WHERE authorized.identity_ref = beta_invitations.uat_identity_ref
                AND authorized.provider = ?
                AND authorized.account_reference_sha256 = beta_invitations.uat_account_reference_sha256
                AND authorized.user_id IS NULL AND authorized.revoked_at IS NULL
            ))
        `).bind(timestamp, claimNonce, invitationId, timestamp, authorizedCohort ? 1 : 0, profile.provider),
        db.prepare(`
          INSERT INTO users(id, email, email_verified_at, display_name, avatar_url, status, account_state, created_at, updated_at)
          SELECT ?, ?, ?, ?, ?, 'active', 'pending_acceptance', ?, ?
          WHERE EXISTS (
            SELECT 1 FROM beta_invitations WHERE id = ? AND last_claim_nonce = ?
          )
        `).bind(
          userId,
          safeEmail,
          safeEmail ? timestamp : null,
          profile.name || null,
          profile.picture || null,
          timestamp,
          timestamp,
          invitationId,
          claimNonce,
        ),
        db.prepare(`
          INSERT INTO identities(provider, subject, user_id, provider_email, email_verified, created_at, last_login_at)
          SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
        `).bind(
          profile.provider,
          profile.subject,
          userId,
          profile.email || null,
          profile.emailVerified ? 1 : 0,
          timestamp,
          timestamp,
          userId,
        ),
        db.prepare(`
          INSERT INTO beta_enrollments(user_id, invitation_id, status, created_at)
          SELECT ?, ?, 'pending_age', ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
        `).bind(userId, invitationId, timestamp, userId),
        db.prepare(`
          UPDATE uat_authorized_identities
          SET invitation_id = ?, user_id = ?, provider_subject_sha256 = ?, enrolled_at = COALESCE(enrolled_at, ?)
          WHERE ? = 1 AND identity_ref = (SELECT uat_identity_ref FROM beta_invitations WHERE id = ?)
            AND provider = ?
            AND account_reference_sha256 = (SELECT uat_account_reference_sha256 FROM beta_invitations WHERE id = ?)
            AND user_id IS NULL AND revoked_at IS NULL
        `).bind(invitationId, userId, await sha256(profile.subject), timestamp, authorizedCohort ? 1 : 0, invitationId, profile.provider, invitationId),
        ]);
      } catch (error) {
        // A concurrent callback for the same provider subject rolls this batch back.
        // Trust only a winner that is already attached to an active account.
        const winner = await db.prepare(`
          SELECT i.user_id, u.status FROM identities i JOIN users u ON u.id = i.user_id
          WHERE i.provider = ? AND i.subject = ?
        `).bind(profile.provider, profile.subject).first();
        if (!winner || winner.status !== "active") throw error;
        return winner.user_id;
      }
      if (Number(results[0]?.meta?.changes || 0) !== 1) throw new Error("invitation_unavailable");
      if (authorizedCohort && Number(results[4]?.meta?.changes || 0) !== 1) throw new Error("uat_cohort_denied");
      return userId;
    }
    // Public registration has no invitation claim, but account + identity must
    // still commit together. A failed/duplicate callback must leave no orphan.
    try {
      await db.batch([
        db.prepare(`
          INSERT INTO users(id,email,email_verified_at,display_name,avatar_url,status,account_state,created_at,updated_at)
          VALUES(?,?,?,?,?,'active','pending_acceptance',?,?)
        `).bind(userId,safeEmail,safeEmail?timestamp:null,profile.name||null,profile.picture||null,timestamp,timestamp),
        db.prepare(`
          INSERT INTO identities(provider,subject,user_id,provider_email,email_verified,created_at,last_login_at)
          VALUES(?,?,?,?,?,?,?)
        `).bind(profile.provider,profile.subject,userId,profile.email||null,profile.emailVerified?1:0,timestamp,timestamp),
      ]);
    } catch (error) {
      const winner=await db.prepare(`SELECT i.user_id,u.status FROM identities i JOIN users u ON u.id=i.user_id
        WHERE i.provider=? AND i.subject=?`).bind(profile.provider,profile.subject).first();
      if(!winner||winner.status!=='active')throw error;
      return winner.user_id;
    }
    return userId;
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
      INSERT INTO users(id, email, email_verified_at, status, account_state, created_at, updated_at)
      VALUES (?, ?, ?, 'active', 'pending_acceptance', ?, ?)
    `).bind(userId, email, timestamp, timestamp, timestamp).run();
    return userId;
  } catch (error) {
    const winner = await db.prepare("SELECT id, status FROM users WHERE email = ?").bind(email).first();
    if (!winner) throw error;
    if (winner.status !== "active") throw new Error("account_disabled");
    return winner.id;
  }
}
