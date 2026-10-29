PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS beta_invitations (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '' CHECK (length(label) <= 80),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses BETWEEN 1 AND 20),
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count BETWEEN 0 AND max_uses),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  consumed_at INTEGER,
  revoked_at INTEGER,
  last_claim_nonce TEXT UNIQUE,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_beta_invitations_available
  ON beta_invitations(status, expires_at, use_count);

CREATE TABLE IF NOT EXISTS beta_enrollments (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  invitation_id TEXT REFERENCES beta_invitations(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_age', 'active', 'revoked')),
  created_at INTEGER NOT NULL,
  activated_at INTEGER,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_beta_enrollments_status
  ON beta_enrollments(status, created_at);

ALTER TABLE oauth_flows ADD COLUMN invitation_id TEXT
  REFERENCES beta_invitations(id) ON DELETE SET NULL;
