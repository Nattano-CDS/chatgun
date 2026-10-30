PRAGMA foreign_keys = ON;

-- Role administration is separate from case review. A moderation_admin can
-- provision least-privilege access, but cannot inspect reports or private
-- media unless they also hold the corresponding reviewer role.
CREATE TABLE IF NOT EXISTS moderation_access_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('moderation_admin', 'report_reviewer', 'identity_reviewer', 'safety_admin')),
  granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  grant_reason TEXT NOT NULL CHECK (length(grant_reason) BETWEEN 10 AND 300),
  granted_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER,
  revoked_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  revocation_reason TEXT CHECK (revocation_reason IS NULL OR length(revocation_reason) BETWEEN 10 AND 300),
  CHECK (expires_at IS NULL OR expires_at > granted_at),
  CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL)
    OR (revoked_at IS NOT NULL AND revocation_reason IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_moderation_access_active_role
  ON moderation_access_grants(user_id, role) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_moderation_access_expiry
  ON moderation_access_grants(user_id, expires_at, revoked_at);

-- Preserve any explicitly provisioned legacy roles. The runtime prefers these
-- grants and treats a later revoked grant as authoritative over the legacy row.
INSERT OR IGNORE INTO moderation_access_grants(
  id, user_id, role, granted_by, grant_reason, granted_at
)
SELECT 'legacy:' || user_id || ':' || role,
       user_id,
       role,
       NULL,
       'Migrated from the explicit legacy moderation role table',
       created_at
FROM moderation_roles;

CREATE TABLE IF NOT EXISTS moderation_role_events (
  id TEXT PRIMARY KEY,
  grant_id TEXT,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('moderation_admin', 'report_reviewer', 'identity_reviewer', 'safety_admin')),
  action TEXT NOT NULL CHECK (action IN ('grant', 'revoke', 'inspect')),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 10 AND 300),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_role_events_created
  ON moderation_role_events(created_at DESC, actor_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_role_events_target
  ON moderation_role_events(target_user_id, created_at DESC);
