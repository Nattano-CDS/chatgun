PRAGMA foreign_keys = ON;

ALTER TABLE social_reports ADD COLUMN reason_code TEXT;

UPDATE social_reports SET reason_code = category WHERE reason_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_reports_reason_status
  ON social_reports(reason_code, status, created_at);

CREATE TABLE IF NOT EXISTS media_safety_reviews (
  media_id TEXT PRIMARY KEY REFERENCES social_media(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'released', 'rejected')),
  source TEXT NOT NULL CHECK (source IN ('manual', 'scanner', 'staging_bypass')),
  reason TEXT NOT NULL DEFAULT '' CHECK (length(reason) <= 300),
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_media_safety_queue
  ON media_safety_reviews(status, created_at);

CREATE TABLE IF NOT EXISTS media_safety_audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('queue_view', 'object_view', 'decision')),
  media_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (length(purpose) BETWEEN 10 AND 300),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_safety_audit_created
  ON media_safety_audit_events(created_at DESC, actor_user_id);
