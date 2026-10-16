import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { TestD1 } from "./helpers/d1.js";

test("migration is idempotent and creates required tables and indexes", () => {
  const database = new TestD1();
  database.exec(readFileSync("migrations/0001_auth.sql", "utf8"));
  database.exec(readFileSync("migrations/0002_privacy_safety.sql", "utf8"));
  const tables = database.database.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).all().map(({ name }) => name);
  assert.deepEqual(tables, [
    "account_deletion_requests", "deletion_receipts", "identities", "oauth_flows",
    "oauth_reauth_contexts", "otp_challenges", "rate_limits", "session_auth_evidence",
    "sessions", "users",
  ]);
  const indexes = database.database.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name",
  ).all().map(({ name }) => name);
  assert.deepEqual(indexes, [
    "idx_deletion_receipts_expiry", "idx_deletion_requests_expiry", "idx_identities_user",
    "idx_oauth_expiry", "idx_oauth_reauth_expiry", "idx_otp_email_created", "idx_otp_expiry",
    "idx_otp_ip_created", "idx_rate_limits_expiry", "idx_session_auth_evidence_expiry",
    "idx_sessions_expiry", "idx_sessions_user",
  ]);
  assert.throws(() => database.database.prepare(
    "INSERT INTO identities(provider, subject, user_id, created_at, last_login_at) VALUES ('evil', 'x', 'x', 1, 1)",
  ).run());
  database.close();
});
