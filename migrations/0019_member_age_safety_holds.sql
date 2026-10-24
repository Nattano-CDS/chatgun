-- Preparatory, privacy-minimizing age holds. No DOB or parent contact stored.
-- Does NOT activate youth admission or relabel existing adult declarations.
CREATE TABLE IF NOT EXISTS member_age_safety_holds (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age_band TEXT NOT NULL CHECK (age_band IN ('under_13','13_17','18_19','20_plus')),
  state TEXT NOT NULL DEFAULT 'held' CHECK (state IN ('held','cleared')),
  notice_version TEXT NOT NULL CHECK (length(notice_version) BETWEEN 1 AND 100),
  declared_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (state='held' OR age_band='20_plus')
);
CREATE TRIGGER IF NOT EXISTS age_hold_message_guard BEFORE INSERT ON social_messages BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM member_age_safety_holds
    WHERE user_id IN (NEW.sender_user_id,NEW.receiver_user_id)
      AND (state='held' OR age_band<>'20_plus'))
    THEN RAISE(ABORT,'age_safety_contact_denied') END;
END;
CREATE TRIGGER IF NOT EXISTS age_hold_album_request_guard BEFORE INSERT ON album_access_requests BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM member_age_safety_holds
    WHERE user_id IN (NEW.requester_id,NEW.album_owner_id)
      AND (state='held' OR age_band<>'20_plus'))
    THEN RAISE(ABORT,'age_safety_contact_denied') END;
END;
CREATE TRIGGER IF NOT EXISTS age_hold_album_grant_guard BEFORE INSERT ON album_access_grants BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM member_age_safety_holds
    WHERE user_id IN (NEW.viewer_id,NEW.album_owner_id)
      AND (state='held' OR age_band<>'20_plus'))
    THEN RAISE(ABORT,'age_safety_contact_denied') END;
END;
CREATE TRIGGER IF NOT EXISTS age_hold_album_request_update_guard BEFORE UPDATE ON album_access_requests
WHEN NEW.status IN ('pending','approved') BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM member_age_safety_holds
    WHERE user_id IN (NEW.requester_id,NEW.album_owner_id) AND (state='held' OR age_band<>'20_plus'))
    THEN RAISE(ABORT,'age_safety_contact_denied') END;
END;
CREATE TRIGGER IF NOT EXISTS age_hold_album_grant_update_guard BEFORE UPDATE ON album_access_grants
WHEN NEW.revoked_at IS NULL BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM member_age_safety_holds
    WHERE user_id IN (NEW.viewer_id,NEW.album_owner_id) AND (state='held' OR age_band<>'20_plus'))
    THEN RAISE(ABORT,'age_safety_contact_denied') END;
END;
CREATE TRIGGER IF NOT EXISTS age_hold_privacy_insert AFTER INSERT ON member_age_safety_holds
WHEN NEW.state='held' OR NEW.age_band<>'20_plus' BEGIN
  UPDATE member_profiles SET discovery_visible=0,direct_messages_enabled=0,
    latitude=NULL,longitude=NULL,accuracy=NULL,located_at=NULL,updated_at=NEW.updated_at
    WHERE user_id=NEW.user_id;
  UPDATE member_presence_preferences SET show_online=0 WHERE user_id=NEW.user_id;
  DELETE FROM member_presence_leases WHERE user_id=NEW.user_id;
  UPDATE album_access_requests SET status='revoked',revision=revision+1,updated_at=NEW.updated_at
    WHERE (requester_id=NEW.user_id OR album_owner_id=NEW.user_id) AND status IN ('pending','approved');
  UPDATE album_access_grants SET revoked_at=NEW.updated_at
    WHERE (viewer_id=NEW.user_id OR album_owner_id=NEW.user_id) AND revoked_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS age_hold_privacy_update AFTER UPDATE ON member_age_safety_holds
WHEN NEW.state='held' OR NEW.age_band<>'20_plus' BEGIN
  UPDATE member_profiles SET discovery_visible=0,direct_messages_enabled=0,
    latitude=NULL,longitude=NULL,accuracy=NULL,located_at=NULL,updated_at=NEW.updated_at
    WHERE user_id=NEW.user_id;
  UPDATE member_presence_preferences SET show_online=0 WHERE user_id=NEW.user_id;
  DELETE FROM member_presence_leases WHERE user_id=NEW.user_id;
  UPDATE album_access_requests SET status='revoked',revision=revision+1,updated_at=NEW.updated_at
    WHERE (requester_id=NEW.user_id OR album_owner_id=NEW.user_id) AND status IN ('pending','approved');
  UPDATE album_access_grants SET revoked_at=NEW.updated_at
    WHERE (viewer_id=NEW.user_id OR album_owner_id=NEW.user_id) AND revoked_at IS NULL;
END;
