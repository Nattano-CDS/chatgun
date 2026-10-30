PRAGMA foreign_keys = ON;
-- Independent, opt-in presence. No IP, coordinates, or public last-seen history.
CREATE TABLE IF NOT EXISTS member_presence_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  show_online INTEGER NOT NULL DEFAULT 0 CHECK(show_online IN (0,1))
);
CREATE TABLE IF NOT EXISTS member_presence_leases (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
  tab_id TEXT NOT NULL CHECK(length(tab_id) BETWEEN 16 AND 64),
  touched_at INTEGER NOT NULL,
  PRIMARY KEY(session_token_hash,tab_id)
);
CREATE INDEX IF NOT EXISTS idx_presence_user_fresh ON member_presence_leases(user_id,touched_at);
CREATE INDEX IF NOT EXISTS idx_presence_expiry ON member_presence_leases(touched_at);
