import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync("scripts/fixtures/social-owner-review-v1.json", "utf8"));
const seed = readFileSync("scripts/seed-social-staging.mjs", "utf8");
const cleanup = readFileSync("scripts/cleanup-social-staging.mjs", "utf8");

test("owner-review manifest contains complete fictional Thai social fixtures", () => {
  assert.equal(manifest.profiles.length, 20);
  assert.equal(new Set(manifest.profiles.map((profile) => profile.slug)).size, 20);
  assert.equal(new Set(manifest.profiles.map((profile) => profile.name)).size, 20);
  assert.equal(manifest.conversations.length, 10);
  assert.ok(manifest.conversations.every((conversation) => conversation.messages.length >= 10));
  assert.ok(manifest.conversations.reduce((count, conversation) => count + conversation.messages.length, 0) >= 100);
  assert.match(manifest.license, /Original fictional illustration fixtures/u);
  assert.ok(Array.from({ length: 20 }, (_, index) => readFileSync(`scripts/fixtures/portraits/${String(index + 1).padStart(2, "0")}.png`)).every((bytes) => bytes.length > 10_000));
  assert.ok(manifest.profiles.every((profile) => profile.bio && profile.interests));
});

test("seed infrastructure is staging-only, batch-traceable, and not a public quota bypass", () => {
  assert.match(seed, /chatgun-auth-staging/u);
  assert.match(seed, /chatgun-media-staging/u);
  assert.match(seed, /23017b53386fb67fc62a52cdd017454c/u);
  assert.doesNotMatch(seed, /const DATABASE = "chatgun-auth";/u);
  assert.doesNotMatch(seed, /INSERT INTO identities|INSERT OR IGNORE INTO identities/u);
  assert.doesNotMatch(seed, /media_upload_quota_attempts/u);
  assert.match(seed, /synthetic_seed_records/u);
  assert.match(seed, /synthetic_seed_objects/u);
  assert.match(seed, /--dry-run/u);
  assert.match(seed, /email NOT LIKE '%@synthetic\.chatgun\.invalid'/u);
});

test("cleanup defaults to dry-run and requires exact confirmation for deletion", () => {
  assert.match(cleanup, /const execute = process\.argv\.includes\("--execute"\)/u);
  assert.match(cleanup, /execute && confirmation !== batchId/u);
  assert.match(cleanup, /Dry run only\. No D1 rows or R2 objects were changed/u);
  assert.match(cleanup, /objectKey\.startsWith\(`synthetic\/\$\{batchId\}\/`\)/u);
  assert.match(cleanup, /email LIKE '%@synthetic\.chatgun\.invalid'/u);
});
