PRAGMA foreign_keys = ON;
-- Controlled-Beta restrictions; no deletion, no invented age status and no automatic expiry.
CREATE TABLE IF NOT EXISTS beta_account_restrictions (
 id TEXT PRIMARY KEY,
 user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 report_id TEXT REFERENCES social_reports(id) ON DELETE SET NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','lifted')),
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 10 AND 300),
 created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 created_at INTEGER NOT NULL,
 resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 resolved_at INTEGER,
 resolution_reason TEXT CHECK(resolution_reason IS NULL OR length(resolution_reason) BETWEEN 10 AND 300),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_restriction_active ON beta_account_restrictions(user_id) WHERE status='active';
CREATE TABLE IF NOT EXISTS beta_account_appeals (
 id TEXT PRIMARY KEY,
 restriction_id TEXT NOT NULL REFERENCES beta_account_restrictions(id) ON DELETE CASCADE,
 user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','upheld','lifted')),
 created_at INTEGER NOT NULL,
 reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 reviewed_at INTEGER,
 decision_reason TEXT CHECK(decision_reason IS NULL OR length(decision_reason) BETWEEN 10 AND 300),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 UNIQUE(restriction_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_beta_appeals_queue ON beta_account_appeals(status,created_at);
CREATE TABLE IF NOT EXISTS beta_account_moderation_events (
 id TEXT PRIMARY KEY,
 restriction_id TEXT REFERENCES beta_account_restrictions(id) ON DELETE SET NULL,
 actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 action TEXT NOT NULL CHECK(action IN ('suspend','lift','appeal','appeal_upheld','appeal_lifted','queue_view')),
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 10 AND 300),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 UNIQUE(restriction_id,action,revision)
);
