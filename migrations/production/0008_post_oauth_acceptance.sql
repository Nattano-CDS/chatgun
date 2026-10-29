ALTER TABLE users ADD COLUMN account_state TEXT NOT NULL DEFAULT 'active'
  CHECK (account_state IN ('pending_acceptance', 'pending_onboarding', 'active', 'disabled'));

CREATE TABLE IF NOT EXISTS account_acceptances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  adult_notice_version TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  adult_declared_at INTEGER NOT NULL,
  terms_accepted_at INTEGER NOT NULL,
  privacy_acknowledged_at INTEGER NOT NULL,
  accepted_at INTEGER NOT NULL,
  UNIQUE(user_id, adult_notice_version, terms_version, privacy_version)
);

CREATE INDEX IF NOT EXISTS idx_account_acceptances_user_accepted
  ON account_acceptances(user_id, accepted_at DESC);
