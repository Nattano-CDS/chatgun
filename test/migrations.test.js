import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { TestD1 } from "./helpers/d1.js";

test("migration is idempotent and creates required tables and indexes", () => {
  const database = new TestD1();
  database.exec(readFileSync("migrations/0001_auth.sql", "utf8"));
  database.exec(readFileSync("migrations/0002_privacy_safety.sql", "utf8"));
  database.exec(readFileSync("migrations/0003_social.sql", "utf8"));
  database.exec(readFileSync("migrations/0004_moderation_audit.sql", "utf8"));
  const tables = database.database.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).all().map(({ name }) => name);
  assert.deepEqual(tables, [
    "album_access_grants", "album_access_requests", "chat_initiations", "chat_preferences", "chat_system_events", "account_acceptances", "account_deletion_requests", "age_assurance_events", "beta_enrollments", "beta_invitations", "deletion_receipts", "identities",
    "identity_verification_requests", "independent_age_assurances", "media_appeals", "media_deletion_queue", "media_moderation_decisions", "media_reports",
    "media_safety_audit_events", "media_safety_reviews", "media_upload_quota_attempts", "member_profiles", "moderation_access_grants", "moderation_audit_events", "moderation_notifications", "moderation_role_events", "moderation_roles",
    "oauth_flows", "oauth_reauth_contexts", "otp_challenges",
    "photo_comments", "photo_likes", "profile_photos", "proximity_ratings", "rate_limits",
    "session_auth_evidence", "sessions", "social_blocks", "social_media", "social_messages",
    "social_relationships", "social_reports", "synthetic_seed_batches", "synthetic_seed_objects", "synthetic_seed_records", "users",
  ].sort());
  const indexes = database.database.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name",
  ).all().map(({ name }) => name);
  assert.deepEqual(indexes, [
    "idx_album_owner_status", "idx_album_viewer_status", "idx_chat_events_owner", "idx_chat_events_requester", "idx_chat_initiations_daily", "idx_photo_visibility", "idx_account_acceptances_user_accepted", "idx_age_assurance_user", "idx_beta_enrollments_status", "idx_beta_invitations_available", "idx_blocks_blocked", "idx_deletion_receipts_expiry",
    "idx_deletion_requests_expiry", "idx_identities_user", "idx_independent_age_user_status", "idx_media_appeals_status_created", "idx_media_decisions_actor_created",
    "idx_media_decisions_media_created", "idx_media_deletion_due", "idx_media_owner_created", "idx_media_reports_media_status", "idx_media_reports_status_created",
    "idx_media_safety_audit_created", "idx_media_safety_decision_nonce", "idx_media_safety_queue", "idx_media_safety_status_category", "idx_media_upload_quota_day",
    "idx_messages_receiver_unread", "idx_messages_sender_receiver", "idx_moderation_access_active_role", "idx_moderation_access_expiry", "idx_moderation_audit_created", "idx_moderation_notifications_user",
    "idx_moderation_role_events_created", "idx_moderation_role_events_target",
    "idx_oauth_expiry", "idx_oauth_reauth_expiry", "idx_otp_email_created", "idx_otp_expiry",
    "idx_otp_ip_created", "idx_photo_comments_created", "idx_profile_photos_owner",
    "idx_profiles_discovery", "idx_rate_limits_expiry", "idx_ratings_receiver",
    "idx_relationships_high_status", "idx_relationships_low_status", "idx_reports_reason_status", "idx_reports_status",
    "idx_session_auth_evidence_expiry", "idx_sessions_expiry", "idx_sessions_user", "idx_synthetic_seed_objects_media", "idx_synthetic_seed_records_type",
  ].sort());
  assert.throws(() => database.database.prepare(
    "INSERT INTO identities(provider, subject, user_id, created_at, last_login_at) VALUES ('evil', 'x', 'x', 1, 1)",
  ).run());
  assert.throws(() => database.database.prepare(
    "INSERT INTO social_relationships(id, user_low, user_high, requested_by, status, created_at, updated_at) VALUES ('r', 'z', 'a', 'z', 'pending', 1, 1)",
  ).run());
  assert.throws(() => database.database.prepare(
    "INSERT INTO social_media(id, owner_user_id, object_key, purpose, content_type, byte_size, created_at) VALUES ('m', 'x', 'k', 'game', 'image/png', 1, 1)",
  ).run());
  database.close();
});
