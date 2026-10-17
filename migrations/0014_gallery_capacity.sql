-- Shared Public + Private capacity. Independent of the Bangkok daily quota.
-- Enforced in the same D1 transaction as media insertion/quota completion.
-- No existing records are changed. Apply to isolated staging only.
CREATE TRIGGER IF NOT EXISTS gallery_capacity_guard
BEFORE INSERT ON profile_photos
WHEN (SELECT COUNT(*) FROM profile_photos WHERE owner_user_id=NEW.owner_user_id) >= 12
BEGIN
  SELECT RAISE(ABORT, 'gallery_capacity_exceeded');
END;
