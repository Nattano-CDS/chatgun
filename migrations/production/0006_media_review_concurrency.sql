PRAGMA foreign_keys = ON;

ALTER TABLE media_safety_reviews ADD COLUMN decision_nonce TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_safety_decision_nonce
  ON media_safety_reviews(decision_nonce) WHERE decision_nonce IS NOT NULL;
