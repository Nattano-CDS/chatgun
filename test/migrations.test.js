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
    "account_deletion_requests", "age_assurance_events", "deletion_receipts", "identities",
    "identity_verification_requests", "media_deletion_queue", "member_profiles", "moderation_audit_events",
    "moderation_roles", "oauth_flows", "oauth_reauth_contexts", "otp_challenges",
    "photo_comments", "photo_likes", "profile_photos", "proximity_ratings", "rate_limits",
    "session_auth_evidence", "sessions", "social_blocks", "social_media", "social_messages",
    "social_relationships", "social_reports", "users",
  ]);
  const indexes = database.database.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name",
  ).all().map(({ name }) => name);
  assert.deepEqual(indexes, [
    "idx_age_assurance_user", "idx_blocks_blocked", "idx_deletion_receipts_expiry",
    "idx_deletion_requests_expiry", "idx_identities_user", "idx_media_deletion_due",
    "idx_media_owner_created", "idx_messages_receiver_unread", "idx_messages_sender_receiver", "idx_moderation_audit_created",
    "idx_oauth_expiry", "idx_oauth_reauth_expiry", "idx_otp_email_created", "idx_otp_expiry",
    "idx_otp_ip_created", "idx_photo_comments_created", "idx_profile_photos_owner",
    "idx_profiles_discovery", "idx_rate_limits_expiry", "idx_ratings_receiver",
    "idx_relationships_high_status", "idx_relationships_low_status", "idx_reports_status",
    "idx_session_auth_evidence_expiry", "idx_sessions_expiry", "idx_sessions_user",
  ]);
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
