-- Additive, versioned migration. Historical friendship data/messages are retained.
-- Historical photos deliberately become private; selection is not publication.
ALTER TABLE profile_photos ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private','public'));
ALTER TABLE member_profiles ADD COLUMN direct_messages_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (direct_messages_enabled IN (0,1));
CREATE TABLE chat_preferences (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  other_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted INTEGER NOT NULL DEFAULT 0 CHECK(muted IN (0,1)),
  PRIMARY KEY(user_id,other_user_id), CHECK(user_id<>other_user_id)
);
CREATE TABLE chat_initiations (
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_day TEXT NOT NULL,
  PRIMARY KEY(sender_id,receiver_id)
);
CREATE INDEX idx_chat_initiations_daily ON chat_initiations(sender_id,local_day);
CREATE TABLE album_access_requests (
  id TEXT PRIMARY KEY,
  album_owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','cancelled','revoked')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(album_owner_id,requester_id), CHECK(album_owner_id<>requester_id)
);
CREATE TABLE album_access_grants (
  album_owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approved_request_id TEXT NOT NULL REFERENCES album_access_requests(id) ON DELETE CASCADE,
  granted_at INTEGER NOT NULL,
  revoked_at INTEGER,
  revision INTEGER NOT NULL,
  PRIMARY KEY(album_owner_id,viewer_id), CHECK(album_owner_id<>viewer_id)
);
CREATE TABLE chat_system_events (
  id TEXT PRIMARY KEY,
  album_owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL REFERENCES album_access_requests(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('pending','approved','rejected','cancelled','revoked')),
  revision INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  owner_read_at INTEGER,
  requester_read_at INTEGER,
  UNIQUE(request_id,revision)
);
CREATE INDEX idx_album_owner_status ON album_access_requests(album_owner_id,status,updated_at DESC);
CREATE INDEX idx_album_viewer_status ON album_access_requests(requester_id,status,updated_at DESC);
CREATE INDEX idx_chat_events_owner ON chat_system_events(album_owner_id,created_at DESC,id DESC);
CREATE INDEX idx_chat_events_requester ON chat_system_events(requester_id,created_at DESC,id DESC);
CREATE INDEX idx_photo_visibility ON profile_photos(owner_user_id,visibility,created_at DESC);
-- Existing conversations remain existing contacts, not newly initiated recipients.
INSERT OR IGNORE INTO chat_initiations(sender_id,receiver_id,local_day)
  SELECT sender_user_id,receiver_user_id,date(MIN(created_at),'unixepoch','+7 hours')
  FROM social_messages GROUP BY sender_user_id,receiver_user_id;
-- The transition, permission change and event share the same D1 transaction.
CREATE TRIGGER album_request_created AFTER INSERT ON album_access_requests BEGIN
  INSERT INTO chat_system_events(id,album_owner_id,requester_id,request_id,actor_user_id,event_type,revision,created_at)
  VALUES(NEW.id||':'||NEW.revision,NEW.album_owner_id,NEW.requester_id,NEW.id,NEW.requester_id,NEW.status,NEW.revision,NEW.updated_at);
END;
CREATE TRIGGER album_request_transition AFTER UPDATE OF status ON album_access_requests
WHEN NEW.revision<>OLD.revision BEGIN
  INSERT INTO chat_system_events(id,album_owner_id,requester_id,request_id,actor_user_id,event_type,revision,created_at)
  VALUES(NEW.id||':'||NEW.revision,NEW.album_owner_id,NEW.requester_id,NEW.id,COALESCE(NEW.decided_by,NEW.requester_id),NEW.status,NEW.revision,NEW.updated_at);
  INSERT INTO album_access_grants(album_owner_id,viewer_id,approved_request_id,granted_at,revision)
  SELECT NEW.album_owner_id,NEW.requester_id,NEW.id,NEW.updated_at,NEW.revision WHERE NEW.status='approved'
  ON CONFLICT(album_owner_id,viewer_id) DO UPDATE SET granted_at=excluded.granted_at,revoked_at=NULL,revision=excluded.revision;
  UPDATE album_access_grants SET revoked_at=NEW.updated_at,revision=NEW.revision
  WHERE album_owner_id=NEW.album_owner_id AND viewer_id=NEW.requester_id AND NEW.status<>'approved';
END;
CREATE TRIGGER album_block_revokes AFTER INSERT ON social_blocks BEGIN
  UPDATE album_access_requests SET status='revoked',revision=revision+1,
    updated_at=unixepoch(),decided_by=NEW.blocker_user_id
  WHERE status IN ('pending','approved') AND (
    (album_owner_id=NEW.blocker_user_id AND requester_id=NEW.blocked_user_id)
    OR (album_owner_id=NEW.blocked_user_id AND requester_id=NEW.blocker_user_id));
END;
-- Atomic anti-spam checks apply to every message insert, including multipart/media reuse.
CREATE TRIGGER direct_chat_spam_guard BEFORE INSERT ON social_messages BEGIN
  SELECT CASE WHEN (SELECT COUNT(*) FROM users u JOIN member_profiles p ON p.user_id=u.id
    JOIN age_assurance_events a ON a.id=p.age_assurance_id AND a.user_id=u.id
    WHERE u.id IN (NEW.sender_user_id,NEW.receiver_user_id) AND u.status='active' AND u.account_state='active'
      AND a.revoked_at IS NULL AND a.age_band='adult_18_plus'
      AND NOT EXISTS(SELECT 1 FROM beta_enrollments e WHERE e.user_id=u.id AND e.status='revoked'))<>2
    OR EXISTS(SELECT 1 FROM member_profiles WHERE user_id=NEW.receiver_user_id AND direct_messages_enabled=0)
    OR EXISTS(SELECT 1 FROM social_blocks WHERE
      (blocker_user_id=NEW.sender_user_id AND blocked_user_id=NEW.receiver_user_id) OR
      (blocker_user_id=NEW.receiver_user_id AND blocked_user_id=NEW.sender_user_id))
    THEN RAISE(ABORT,'direct_chat_contact_denied') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM chat_initiations WHERE sender_id=NEW.sender_user_id AND receiver_id=NEW.receiver_user_id)
    AND (SELECT COUNT(*) FROM chat_initiations WHERE sender_id=NEW.sender_user_id
      AND local_day=date(NEW.created_at,'unixepoch','+7 hours'))>=10
    THEN RAISE(ABORT,'direct_chat_recipient_limit') END;
  SELECT CASE WHEN length(NEW.body)>0 AND EXISTS(SELECT 1 FROM social_messages
    WHERE sender_user_id=NEW.sender_user_id AND body=NEW.body AND unsent_at IS NULL
      AND created_at>NEW.created_at-30) THEN RAISE(ABORT,'direct_chat_duplicate') END;
  INSERT OR IGNORE INTO chat_initiations(sender_id,receiver_id,local_day)
    VALUES(NEW.sender_user_id,NEW.receiver_user_id,date(NEW.created_at,'unixepoch','+7 hours'));
END;
