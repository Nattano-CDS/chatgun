-- Additive development migration. Do not apply to Production without separate approval.
ALTER TABLE social_messages ADD COLUMN client_request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_request
  ON social_messages(sender_user_id,client_request_id) WHERE client_request_id IS NOT NULL;
ALTER TABLE media_appeals ADD COLUMN decision_nonce TEXT;
ALTER TABLE beta_account_restrictions ADD COLUMN decision_nonce TEXT;
ALTER TABLE beta_account_appeals ADD COLUMN decision_nonce TEXT;
ALTER TABLE social_reports ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE social_reports ADD COLUMN decision_nonce TEXT;
ALTER TABLE media_reports ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media_reports ADD COLUMN decision_nonce TEXT;
ALTER TABLE media_deletion_queue ADD COLUMN processing_nonce TEXT;
ALTER TABLE media_deletion_queue ADD COLUMN lease_until INTEGER;
CREATE INDEX IF NOT EXISTS idx_discovery_candidates ON member_profiles(discovery_visible,located_at,user_id);
