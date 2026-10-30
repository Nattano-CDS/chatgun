export const DELETION_RECEIPT_TTL_SECONDS = 7 * 24 * 60 * 60;
export const REVOKED_SESSION_GRACE_SECONDS = 24 * 60 * 60;
export const STALE_PRESENCE_GRACE_SECONDS = 24 * 60 * 60;
export const BETA_INVITATION_AUDIT_SECONDS = 7 * 24 * 60 * 60;
export const UAT_AUDIT_RETENTION_DAYS = 90;
export const UAT_AUDIT_RETENTION_SECONDS = UAT_AUDIT_RETENTION_DAYS * 24 * 60 * 60;
export const UAT_AUDIT_RETENTION_START_MODE = "actual-campaign-close";
export const UAT_CAMPAIGN_AUDIT_TABLE_SQL = `CREATE TABLE IF NOT EXISTS uat_campaign_audit_evidence(
  campaign_id TEXT PRIMARY KEY,
  closed_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64),
  policy_versions_json TEXT NOT NULL,
  policy_files_json TEXT NOT NULL,
  operator_count INTEGER NOT NULL CHECK(operator_count=1),
  identity_count INTEGER NOT NULL CHECK(identity_count=2),
  google_chatgun_identity_deletion_authorized INTEGER NOT NULL CHECK(google_chatgun_identity_deletion_authorized IN(0,1)),
  created_at INTEGER NOT NULL,
  CHECK(expires_at=closed_at+${UAT_AUDIT_RETENTION_SECONDS})
)`;

export async function cleanupUatCampaignAuditEvidence(db, timestamp, env = {}, batchSize = 100) {
  const days = String(env.UAT_AUDIT_RETENTION_DAYS || "");
  const startMode = String(env.UAT_AUDIT_RETENTION_START_MODE || "");
  if (!days && !startMode) return { configured: false, tablePresent: false, deleted: 0 };
  if (days !== String(UAT_AUDIT_RETENTION_DAYS) || startMode !== UAT_AUDIT_RETENTION_START_MODE) throw new Error("invalid_uat_audit_retention_configuration");
  const table = await db.prepare("SELECT 1 ok FROM sqlite_master WHERE type='table' AND name='uat_campaign_audit_evidence'").first();
  if (!table) return { configured: true, tablePresent: false, deleted: 0 };
  const limit = Math.max(1, Math.min(Number(batchSize) || 100, 500));
  const result = await db.prepare(`DELETE FROM uat_campaign_audit_evidence WHERE rowid IN (
    SELECT rowid FROM uat_campaign_audit_evidence WHERE expires_at<=? ORDER BY expires_at LIMIT ?
  )`).bind(timestamp, limit).run();
  return { configured: true, tablePresent: true, deleted: Number(result.meta?.changes || 0) };
}

const CLEANUP_TARGETS = [
  {
    name: 'closedEligibilityReviews',
    sql: `DELETE FROM eligibility_review_requests WHERE id IN (
      SELECT id FROM eligibility_review_requests WHERE status<>'pending' AND updated_at<=? LIMIT ?
    )`,
    values: (now, limit) => [now - 90*86400, limit],
  },
  {
    name: 'administrationAccessEvents',
    sql: 'DELETE FROM administration_access_events WHERE id IN (SELECT id FROM administration_access_events WHERE created_at<=? LIMIT ?)',
    values: (now, limit) => [now - 90*86400, limit],
  },
  {
    name: 'accountSafetyNotifications',
    sql: 'DELETE FROM account_safety_notifications WHERE id IN (SELECT id FROM account_safety_notifications WHERE created_at<=? LIMIT ?)',
    values: (now, limit) => [now - 90*86400, limit],
  },
  {
    name: "oauthFlows",
    sql: "DELETE FROM oauth_flows WHERE rowid IN (SELECT rowid FROM oauth_flows WHERE expires_at <= ? LIMIT ?)",
    values: (now, limit) => [now, limit],
  },
  {
    name: "betaInvitations",
    sql: `DELETE FROM beta_invitations WHERE rowid IN (
      SELECT rowid FROM beta_invitations
      WHERE expires_at <= ?
         OR (consumed_at IS NOT NULL AND consumed_at <= ?)
         OR (revoked_at IS NOT NULL AND revoked_at <= ?)
      LIMIT ?
    )`,
    values: (now, limit) => [
      now - BETA_INVITATION_AUDIT_SECONDS,
      now - BETA_INVITATION_AUDIT_SECONDS,
      now - BETA_INVITATION_AUDIT_SECONDS,
      limit,
    ],
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
  {
    name: "stalePresence",
    sql: `UPDATE member_profiles
      SET discovery_visible = 0, latitude = NULL, longitude = NULL,
          accuracy = NULL, located_at = NULL, updated_at = ?
      WHERE rowid IN (
        SELECT rowid FROM member_profiles
        WHERE located_at IS NOT NULL AND located_at <= ? LIMIT ?
      )`,
    values: (now, limit) => [now, now - STALE_PRESENCE_GRACE_SECONDS, limit],
  },
  {
    name:'expiredOnlineLeases',
    sql:'DELETE FROM member_presence_leases WHERE rowid IN (SELECT rowid FROM member_presence_leases WHERE touched_at<=? LIMIT ?)',
    values:(now,limit)=>[now-90,limit],
  },
  {
    name: "revokedAgeAssurance",
    sql: `DELETE FROM age_assurance_events WHERE rowid IN (
      SELECT rowid FROM age_assurance_events
      WHERE revoked_at IS NOT NULL AND revoked_at <= ? LIMIT ?
    )`,
    values: (now, limit) => [now - REVOKED_SESSION_GRACE_SECONDS, limit],
  },
  {
    name: "completedMediaQueue",
    sql: `DELETE FROM media_deletion_queue WHERE rowid IN (
      SELECT rowid FROM media_deletion_queue
      WHERE completed_at IS NOT NULL AND completed_at <= ? LIMIT ?
    )`,
    values: (now, limit) => [now - DELETION_RECEIPT_TTL_SECONDS, limit],
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
