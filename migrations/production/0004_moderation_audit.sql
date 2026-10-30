PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS moderation_audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('report_view', 'report_review', 'message_audit_view', 'verification_view', 'verification_decision')),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('report', 'message_audit', 'verification')),
  subject_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (length(purpose) BETWEEN 10 AND 300),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_audit_created
  ON moderation_audit_events(created_at DESC, actor_user_id);

