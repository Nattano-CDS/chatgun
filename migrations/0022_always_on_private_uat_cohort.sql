PRAGMA foreign_keys = ON;

ALTER TABLE beta_invitations ADD COLUMN uat_identity_ref TEXT CHECK(uat_identity_ref IN ('A','B'));
ALTER TABLE beta_invitations ADD COLUMN uat_required_provider TEXT CHECK(uat_required_provider IN ('google','facebook','line'));
ALTER TABLE beta_invitations ADD COLUMN uat_account_reference_sha256 TEXT CHECK(uat_account_reference_sha256 IS NULL OR length(uat_account_reference_sha256)=64);

CREATE TABLE IF NOT EXISTS uat_authorized_identities (
  identity_ref TEXT PRIMARY KEY CHECK(identity_ref IN ('A','B')),
  provider TEXT NOT NULL UNIQUE CHECK(provider IN ('line','google')),
  account_reference_sha256 TEXT NOT NULL UNIQUE CHECK(length(account_reference_sha256)=64),
  invitation_id TEXT UNIQUE REFERENCES beta_invitations(id) ON DELETE SET NULL,
  user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  provider_subject_sha256 TEXT UNIQUE CHECK(provider_subject_sha256 IS NULL OR length(provider_subject_sha256)=43),
  consented_at INTEGER NOT NULL,
  enrolled_at INTEGER,
  revoked_at INTEGER,
  CHECK((user_id IS NULL AND provider_subject_sha256 IS NULL AND enrolled_at IS NULL)
     OR (user_id IS NOT NULL AND provider_subject_sha256 IS NOT NULL AND enrolled_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_uat_authorized_active_provider
  ON uat_authorized_identities(provider) WHERE revoked_at IS NULL;
