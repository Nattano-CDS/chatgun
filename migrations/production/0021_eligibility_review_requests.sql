-- Review requests do not clear age holds or confer admission rights.
CREATE TABLE IF NOT EXISTS eligibility_review_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','withdrawn','upheld','deferred')),
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decision_reason TEXT CHECK(decision_reason IS NULL OR length(decision_reason) BETWEEN 10 AND 300)
);
CREATE UNIQUE INDEX IF NOT EXISTS eligibility_one_pending ON eligibility_review_requests(user_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS eligibility_review_queue ON eligibility_review_requests(status,created_at,id);
CREATE TABLE IF NOT EXISTS eligibility_review_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES eligibility_review_requests(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK(action IN ('requested','withdrawn','upheld','deferred')),
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000),
  purpose TEXT CHECK(purpose IS NULL OR length(purpose) BETWEEN 10 AND 300),
  revision INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(request_id,revision)
);
CREATE TABLE IF NOT EXISTS administration_access_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  scope TEXT NOT NULL CHECK(scope IN ('eligibility_queue','member_queue','deletion_queue')),
  purpose TEXT NOT NULL CHECK(length(purpose) BETWEEN 10 AND 300),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS administration_access_created ON administration_access_events(created_at);
CREATE TABLE IF NOT EXISTS account_safety_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_code TEXT NOT NULL CHECK(message_code IN ('report_reviewed','report_escalated','report_closed','eligibility_upheld','eligibility_deferred')),
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX IF NOT EXISTS account_safety_notifications_user ON account_safety_notifications(user_id,created_at DESC);
