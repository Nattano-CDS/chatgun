PRAGMA foreign_keys = ON;

-- Classification is intentionally separate from the moderation lifecycle.
-- Existing released media is treated as GENERAL; existing rejected media as PROHIBITED.
ALTER TABLE media_safety_reviews ADD COLUMN category TEXT
  CHECK (category IS NULL OR category IN ('general', 'sensitive', 'prohibited'));
ALTER TABLE media_safety_reviews ADD COLUMN revision INTEGER NOT NULL DEFAULT 0
  CHECK (revision >= 0);

UPDATE media_safety_reviews SET category = 'general'
WHERE status = 'released' AND category IS NULL;
UPDATE media_safety_reviews SET category = 'prohibited'
WHERE status = 'rejected' AND category IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_safety_status_category
  ON media_safety_reviews(status, category, created_at, media_id);

CREATE TABLE IF NOT EXISTS media_moderation_decisions (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  previous_status TEXT CHECK (previous_status IS NULL OR previous_status IN ('pending', 'released', 'rejected')),
  new_status TEXT NOT NULL CHECK (new_status IN ('released', 'rejected')),
  previous_category TEXT CHECK (previous_category IS NULL OR previous_category IN ('general', 'sensitive', 'prohibited')),
  new_category TEXT NOT NULL CHECK (new_category IN ('general', 'sensitive', 'prohibited')),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 3 AND 300),
  revision INTEGER NOT NULL CHECK (revision > 0),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_decisions_media_created
  ON media_moderation_decisions(media_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_decisions_actor_created
  ON media_moderation_decisions(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS media_reports (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL REFERENCES social_media(id) ON DELETE CASCADE,
  reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL CHECK (reason_code IN ('harassment', 'ncii', 'minor_safety', 'sexual_content', 'violence', 'privacy', 'spam', 'other')),
  details TEXT NOT NULL CHECK (length(details) BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'escalated', 'closed')),
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(media_id, reporter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_media_reports_status_created
  ON media_reports(status, created_at, id);
CREATE INDEX IF NOT EXISTS idx_media_reports_media_status
  ON media_reports(media_id, status);

CREATE TABLE IF NOT EXISTS media_appeals (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL REFERENCES social_media(id) ON DELETE CASCADE,
  appellant_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 10 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'granted', 'denied', 'withdrawn')),
  decision_reason TEXT NOT NULL DEFAULT '' CHECK (length(decision_reason) <= 1000),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(media_id, appellant_user_id, status)
);

CREATE INDEX IF NOT EXISTS idx_media_appeals_status_created
  ON media_appeals(status, created_at, id);

-- Self-declaration is deliberately excluded. Only separately approved methods can
-- unlock sensitive content, and the runtime feature flag still defaults closed.
CREATE TABLE IF NOT EXISTS independent_age_assurances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('document_review', 'external_provider')),
  status TEXT NOT NULL CHECK (status IN ('verified', 'revoked')),
  verified_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  CHECK (expires_at IS NULL OR expires_at > verified_at)
);

CREATE INDEX IF NOT EXISTS idx_independent_age_user_status
  ON independent_age_assurances(user_id, status, expires_at);

CREATE TABLE IF NOT EXISTS moderation_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('media_decision', 'appeal_decision', 'media_restricted')),
  media_id TEXT,
  appeal_id TEXT,
  message_code TEXT NOT NULL CHECK (length(message_code) BETWEEN 1 AND 80),
  created_at INTEGER NOT NULL,
  read_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_moderation_notifications_user
  ON moderation_notifications(user_id, read_at, created_at DESC);
