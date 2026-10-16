PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS media_upload_quota_attempts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('chat', 'gallery')),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  local_day TEXT NOT NULL CHECK (length(local_day) = 10),
  status TEXT NOT NULL CHECK (status IN ('reserved', 'completed', 'released')),
  media_id TEXT REFERENCES social_media(id) ON DELETE SET NULL,
  result_id TEXT,
  reserved_at INTEGER NOT NULL,
  completed_at INTEGER,
  released_at INTEGER,
  PRIMARY KEY (user_id, category, idempotency_key),
  CHECK (
    (status = 'reserved' AND completed_at IS NULL AND released_at IS NULL)
    OR (status = 'completed' AND completed_at IS NOT NULL AND released_at IS NULL)
    OR (status = 'released' AND completed_at IS NULL AND released_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_media_upload_quota_day
  ON media_upload_quota_attempts(user_id, category, local_day, status, reserved_at);

