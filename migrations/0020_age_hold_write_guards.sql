-- Defence in depth for in-flight writes that passed an application eligibility
-- check before a safety hold was inserted. No existing rows are rewritten.
-- Rights requests, deletion, moderation evidence and session revocation remain
-- available. This migration does not enable youth registration or release holds.
CREATE TRIGGER IF NOT EXISTS age_hold_profile_insert_guard BEFORE INSERT ON member_profiles
WHEN NEW.discovery_visible=1 OR NEW.direct_messages_enabled=1 OR NEW.latitude IS NOT NULL
  OR NEW.longitude IS NOT NULL OR NEW.accuracy IS NOT NULL OR NEW.located_at IS NOT NULL BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM member_age_safety_holds WHERE user_id=NEW.user_id
    AND (state='held' OR age_band<>'20_plus'))
    THEN RAISE(ABORT,'age_safety_contact_denied') END;
END;
CREATE TRIGGER IF NOT EXISTS age_hold_profile_update_guard BEFORE UPDATE ON member_profiles
WHEN NEW.discovery_visible=1 OR NEW.direct_messages_enabled=1 OR NEW.latitude IS NOT NULL
  OR NEW.longitude IS NOT NULL OR NEW.accuracy IS NOT NULL OR NEW.located_at IS NOT NULL BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM member_age_safety_holds WHERE user_id=NEW.user_id
    AND (state='held' OR age_band<>'20_plus'))
    THEN RAISE(ABORT,'age_safety_contact_denied') END;
END;
CREATE TRIGGER IF NOT EXISTS age_hold_presence_preference_insert_guard BEFORE INSERT ON member_presence_preferences
WHEN NEW.show_online=1 BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM member_age_safety_holds WHERE user_id=NEW.user_id
    AND (state='held' OR age_band<>'20_plus'))
    THEN RAISE(ABORT,'age_safety_contact_denied') END;
END;
CREATE TRIGGER IF NOT EXISTS age_hold_presence_preference_update_guard BEFORE UPDATE ON member_presence_preferences
WHEN NEW.show_online=1 BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM member_age_safety_holds WHERE user_id=NEW.user_id
    AND (state='held' OR age_band<>'20_plus'))
    THEN RAISE(ABORT,'age_safety_contact_denied') END;
END;
CREATE TRIGGER IF NOT EXISTS age_hold_presence_lease_insert_guard BEFORE INSERT ON member_presence_leases BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM member_age_safety_holds WHERE user_id=NEW.user_id
    AND (state='held' OR age_band<>'20_plus'))
    THEN RAISE(ABORT,'age_safety_contact_denied') END;
END;
CREATE TRIGGER IF NOT EXISTS age_hold_presence_lease_update_guard BEFORE UPDATE ON member_presence_leases BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM member_age_safety_holds WHERE user_id=NEW.user_id
    AND (state='held' OR age_band<>'20_plus'))
    THEN RAISE(ABORT,'age_safety_contact_denied') END;
END;
