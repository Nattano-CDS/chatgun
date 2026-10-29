-- Isolated Admin sessions: never issue or reuse a member-session cookie.
-- Feature-gated; applying this migration does not grant any role or enable Access.
CREATE TABLE IF NOT EXISTS cloudflare_admin_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_hash TEXT NOT NULL,
  csrf_hash TEXT NOT NULL,
  authenticated_at INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  assertion_expires_at INTEGER NOT NULL CHECK (assertion_expires_at >= expires_at),
  revoked_at INTEGER,
  CHECK (authenticated_at IS NULL OR authenticated_at <= created_at)
);
CREATE INDEX IF NOT EXISTS idx_cloudflare_admin_sessions_user
  ON cloudflare_admin_sessions(user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_cloudflare_admin_sessions_expiry
  ON cloudflare_admin_sessions(expires_at);
