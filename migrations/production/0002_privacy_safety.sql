PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS session_auth_evidence (
  token_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  authenticated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at >= authenticated_at)
);

CREATE TABLE IF NOT EXISTS oauth_reauth_contexts (
  state_hash TEXT PRIMARY KEY REFERENCES oauth_flows(state_hash) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose = 'account_deletion'),
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  request_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  confirmation_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing')),
  operation_id TEXT UNIQUE,
  requested_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (expires_at > requested_at)
);

CREATE TABLE IF NOT EXISTS deletion_receipts (
  request_id TEXT PRIMARY KEY,
  completed_at INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  implementation_version TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome = 'deleted'),
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > completed_at)
);

CREATE INDEX IF NOT EXISTS idx_session_auth_evidence_expiry
  ON session_auth_evidence(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_reauth_expiry
  ON oauth_reauth_contexts(expires_at);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_expiry
  ON account_deletion_requests(expires_at, status);
CREATE INDEX IF NOT EXISTS idx_deletion_receipts_expiry
  ON deletion_receipts(expires_at);
