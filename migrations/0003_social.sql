PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS age_assurance_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  age_band TEXT NOT NULL CHECK (age_band = 'adult_18_plus'),
  method TEXT NOT NULL CHECK (method IN ('self_declaration')),
  notice_version TEXT NOT NULL,
  declared_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS member_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age_assurance_id TEXT NOT NULL REFERENCES age_assurance_events(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  gender TEXT NOT NULL DEFAULT 'ไม่ระบุ',
  bio TEXT NOT NULL DEFAULT '' CHECK (length(bio) <= 250),
  interests TEXT NOT NULL DEFAULT '' CHECK (length(interests) <= 100),
  selected_photo_id TEXT,
  discovery_visible INTEGER NOT NULL DEFAULT 0 CHECK (discovery_visible IN (0, 1)),
  latitude REAL,
  longitude REAL,
  accuracy REAL,
  located_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (discovery_visible = 0)
    OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
        AND accuracy >= 0 AND located_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS social_relationships (
  id TEXT PRIMARY KEY,
  user_low TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_low, user_high),
  CHECK (user_low < user_high),
  CHECK (requested_by = user_low OR requested_by = user_high)
);

CREATE TABLE IF NOT EXISTS social_blocks (
  blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);

CREATE TABLE IF NOT EXISTS social_media (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('profile', 'gallery', 'chat', 'verification_id', 'verification_selfie')),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 8388608),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'pending_deletion')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_photos (
  media_id TEXT PRIMARY KEY REFERENCES social_media(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption TEXT NOT NULL DEFAULT '' CHECK (length(caption) <= 300),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS photo_likes (
  media_id TEXT NOT NULL REFERENCES profile_photos(media_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (media_id, user_id)
);

CREATE TABLE IF NOT EXISTS photo_comments (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL REFERENCES profile_photos(media_id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS social_messages (
  id TEXT PRIMARY KEY,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 2000),
  media_id TEXT REFERENCES social_media(id) ON DELETE SET NULL,
  unsent_at INTEGER,
  read_at INTEGER,
  created_at INTEGER NOT NULL,
  CHECK (sender_user_id <> receiver_user_id),
  CHECK (length(body) > 0 OR media_id IS NOT NULL OR unsent_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS proximity_ratings (
  id TEXT PRIMARY KEY,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_day TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '' CHECK (length(comment) <= 500),
  created_at INTEGER NOT NULL,
  UNIQUE (sender_user_id, receiver_user_id, local_day),
  CHECK (sender_user_id <> receiver_user_id)
);

CREATE TABLE IF NOT EXISTS social_reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('harassment', 'spam', 'impersonation', 'sexual_content', 'violence', 'privacy', 'other')),
  details TEXT NOT NULL CHECK (length(details) BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'escalated', 'closed')),
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  CHECK (reporter_user_id <> subject_user_id)
);

CREATE TABLE IF NOT EXISTS moderation_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('report_reviewer', 'identity_reviewer', 'safety_admin')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS identity_verification_requests (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  id_media_id TEXT REFERENCES social_media(id) ON DELETE SET NULL,
  selfie_media_id TEXT REFERENCES social_media(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT NOT NULL DEFAULT '' CHECK (length(reason) <= 300),
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS media_deletion_queue (
  object_key TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  last_error_code TEXT
);

CREATE INDEX IF NOT EXISTS idx_age_assurance_user ON age_assurance_events(user_id, declared_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_discovery ON member_profiles(discovery_visible, latitude, located_at);
CREATE INDEX IF NOT EXISTS idx_relationships_low_status ON social_relationships(user_low, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationships_high_status ON social_relationships(user_high, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON social_blocks(blocked_user_id, blocker_user_id);
CREATE INDEX IF NOT EXISTS idx_media_owner_created ON social_media(owner_user_id, state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_photos_owner ON profile_photos(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_comments_created ON photo_comments(media_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON social_messages(sender_user_id, receiver_user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON social_messages(receiver_user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_receiver ON proximity_ratings(receiver_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON social_reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_media_deletion_due ON media_deletion_queue(completed_at, next_attempt_at);
