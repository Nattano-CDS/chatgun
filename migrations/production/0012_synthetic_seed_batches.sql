PRAGMA foreign_keys = ON;

-- Owner-review fixtures are tracked independently from product data so a future
-- cleanup can target exactly one approved staging batch. These tables do not
-- expose a runtime seeding API.
CREATE TABLE IF NOT EXISTS synthetic_seed_batches (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  scope TEXT NOT NULL CHECK (scope = 'staging_owner_review'),
  manifest_sha256 TEXT NOT NULL CHECK (length(manifest_sha256) = 64),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cleaned')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS synthetic_seed_records (
  batch_id TEXT NOT NULL REFERENCES synthetic_seed_batches(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (length(record_type) BETWEEN 1 AND 60),
  record_id TEXT NOT NULL CHECK (length(record_id) BETWEEN 1 AND 200),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (batch_id, record_type, record_id)
);

CREATE TABLE IF NOT EXISTS synthetic_seed_objects (
  batch_id TEXT NOT NULL REFERENCES synthetic_seed_batches(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  media_id TEXT REFERENCES social_media(id) ON DELETE SET NULL,
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (batch_id, object_key),
  UNIQUE (object_key)
);

CREATE INDEX IF NOT EXISTS idx_synthetic_seed_records_type
  ON synthetic_seed_records(batch_id, record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_synthetic_seed_objects_media
  ON synthetic_seed_objects(batch_id, media_id);
