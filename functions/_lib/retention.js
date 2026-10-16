export const DELETION_RECEIPT_TTL_SECONDS = 7 * 24 * 60 * 60;
export const REVOKED_SESSION_GRACE_SECONDS = 24 * 60 * 60;

const CLEANUP_TARGETS = [
  {
    name: "oauthFlows",
    sql: "DELETE FROM oauth_flows WHERE rowid IN (SELECT rowid FROM oauth_flows WHERE expires_at <= ? LIMIT ?)",
    values: (now, limit) => [now, limit],
  },
  {
    name: "sessions",
    sql: `DELETE FROM sessions WHERE rowid IN (
      SELECT rowid FROM sessions
      WHERE expires_at <= ? OR (revoked_at IS NOT NULL AND revoked_at <= ?)
      LIMIT ?
    )`,
    values: (now, limit) => [now, now - REVOKED_SESSION_GRACE_SECONDS, limit],
  },
  {
    name: "rateLimits",
    sql: "DELETE FROM rate_limits WHERE rowid IN (SELECT rowid FROM rate_limits WHERE expires_at <= ? LIMIT ?)",
    values: (now, limit) => [now, limit],
  },
  {
    name: "otpChallenges",
    sql: `DELETE FROM otp_challenges WHERE rowid IN (
      SELECT rowid FROM otp_challenges
      WHERE expires_at <= ?
         OR (used_at IS NOT NULL AND used_at <= ?)
         OR (attempts >= 5 AND created_at <= ?)
      LIMIT ?
    )`,
    values: (now, limit) => [now, now - REVOKED_SESSION_GRACE_SECONDS, now - REVOKED_SESSION_GRACE_SECONDS, limit],
  },
  {
    name: "authEvidence",
    sql: `DELETE FROM session_auth_evidence WHERE rowid IN (
      SELECT rowid FROM session_auth_evidence WHERE expires_at <= ? LIMIT ?
    )`,
    values: (now, limit) => [now, limit],
  },
  {
    name: "deletionRequests",
    sql: `DELETE FROM account_deletion_requests WHERE rowid IN (
      SELECT rowid FROM account_deletion_requests WHERE expires_at <= ? LIMIT ?
    )`,
    values: (now, limit) => [now, limit],
  },
  {
    name: "deletionReceipts",
    sql: `DELETE FROM deletion_receipts WHERE rowid IN (
      SELECT rowid FROM deletion_receipts WHERE expires_at <= ? LIMIT ?
    )`,
    values: (now, limit) => [now, limit],
  },
];

export async function runRetentionCleanup(db, timestamp, batchSize = 500) {
  const safeBatchSize = Math.max(1, Math.min(Number(batchSize) || 500, 1000));
  const statements = CLEANUP_TARGETS.map((target) => (
    db.prepare(target.sql).bind(...target.values(timestamp, safeBatchSize))
  ));
  const results = await db.batch(statements);
  return Object.fromEntries(CLEANUP_TARGETS.map((target, index) => [
    target.name,
    Number(results[index]?.meta?.changes || 0),
  ]));
}
