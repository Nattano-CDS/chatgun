PRAGMA foreign_keys = ON;

-- Same-operator reconsideration is intentionally separate from independent appeals.
-- Applying this migration does not enable the feature or publish policy text.
CREATE TABLE IF NOT EXISTS account_reconsiderations (
  id TEXT PRIMARY KEY,
  restriction_id TEXT NOT NULL REFERENCES beta_account_restrictions(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000),
  evidence_text TEXT CHECK(evidence_text IS NULL OR length(evidence_text) BETWEEN 10 AND 2000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','upheld','lifted')),
  restriction_revision INTEGER NOT NULL CHECK(restriction_revision >= 0),
  created_at INTEGER NOT NULL,
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at INTEGER,
  decision_reason TEXT CHECK(decision_reason IS NULL OR length(decision_reason) BETWEEN 10 AND 300),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  decision_nonce TEXT UNIQUE,
  UNIQUE(restriction_id,user_id)
);

CREATE INDEX IF NOT EXISTS idx_account_reconsiderations_queue
  ON account_reconsiderations(status,created_at,id);

-- Minimal append-only audit history. It deliberately excludes report identities and evidence text.
CREATE TABLE IF NOT EXISTS account_reconsideration_events (
  id TEXT PRIMARY KEY,
  reconsideration_id TEXT REFERENCES account_reconsiderations(id) ON DELETE SET NULL,
  restriction_id TEXT REFERENCES beta_account_restrictions(id) ON DELETE SET NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK(action IN ('requested','upheld','lifted','queue_view')),
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 10 AND 300),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  created_at INTEGER NOT NULL,
  UNIQUE(reconsideration_id,action,revision)
);

CREATE INDEX IF NOT EXISTS idx_account_reconsideration_events_created
  ON account_reconsideration_events(created_at,id);

CREATE TRIGGER IF NOT EXISTS account_reconsideration_events_no_update
BEFORE UPDATE ON account_reconsideration_events
BEGIN
  SELECT RAISE(ABORT,'account_reconsideration_audit_is_append_only');
END;

CREATE TRIGGER IF NOT EXISTS account_reconsideration_events_no_delete
BEFORE DELETE ON account_reconsideration_events
BEGIN
  SELECT RAISE(ABORT,'account_reconsideration_audit_is_append_only');
END;
