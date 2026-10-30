import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const manifest = JSON.parse(readFileSync('docs/production-readiness/master-release-manifest.json', 'utf8'));
const report = readFileSync('docs/production-readiness/master-production-release-gate.md', 'utf8');

test('master release package remains non-authorizing and NO-GO', () => {
  assert.equal(manifest.decision, 'NO-GO');
  assert.equal(manifest.productionMutationCount, 0);
  assert.equal(manifest.observedProduction.writesDuringAssessment, 0);
  assert.equal(manifest.exactCandidateSha.mustEqualPrHead, true);
  assert.equal(manifest.exactCandidateSha.mustEqualDeploymentArtifact, true);
  for (const forbidden of [
    'production-deployment', 'production-migration', 'production-restore',
    'production-role-grant', 'cloudflare-access-policy-change', 'pull-request-merge',
  ]) assert.ok(manifest.forbiddenWithoutSeparateApproval.includes(forbidden));
});

test('master manifest pins the exact approved migration lane and excludes schema 22', () => {
  assert.equal(manifest.observedProduction.schema, 17);
  assert.equal(manifest.targetSchema, 21);
  const expected = new Map(manifest.migrations.map(({ file, sha256 }) => [file, sha256]));
  for (const [file, expectedHash] of expected) {
    const actual = createHash('sha256').update(readFileSync(`migrations/${file}`)).digest('hex');
    assert.equal(actual, expectedHash, file);
  }
  assert.equal(manifest.excludedMigration, '0022_always_on_private_uat_cohort.sql');
  assert.ok(!expected.has(manifest.excludedMigration));
});

test('master report separates genuine, simulated, blocked, and not-run evidence', () => {
  for (const phrase of [
    'NO-GO for Production change',
    'Physical iPhone Safari | NOT RUN',
    'Production OAuth journey | NOT RUN',
    'bare `/api/admin` path is not covered',
    'Google — NOT APPLICABLE',
    'Meta — NOT APPLICABLE',
    'Production mutations performed by this execution: **0**',
    'restore Production without new approval',
  ]) assert.ok(report.includes(phrase), phrase);
  assert.doesNotMatch(report, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/u);
  assert.doesNotMatch(report, /\b(?:[0-9a-f]{8}-){4}[0-9a-f]{12}\b/iu);
});

test('restricted owner-pilot feature manifest remains fail-closed', () => {
  const profile = JSON.parse(readFileSync(manifest.releaseProfile, 'utf8'));
  assert.equal(profile.vars.OAUTH_ENABLED_PROVIDERS, 'line');
  assert.equal(profile.vars.NEW_ACCOUNT_REGISTRATION_ENABLED, 'false');
  for (const key of [
    'PUBLIC_DISCOVERY_ENABLED', 'MESSAGING_ENABLED', 'MEDIA_UPLOAD_ENABLED',
    'PRESENCE_ENABLED', 'RATINGS_ENABLED', 'SENSITIVE_CONTENT_ENABLED',
    'EMAIL_OTP_ENABLED', 'MOBILE_OTP_ENABLED', 'DEMO_MODE_ENABLED',
    'ACCOUNT_MODERATION_ENABLED', 'IDENTITY_VERIFICATION_ENABLED',
  ]) assert.equal(profile.vars[key], 'false', key);
});

test('master verifier derives the candidate identity from Git instead of stale phase metadata', () => {
  const source = readFileSync('scripts/verify-master-production-release.mjs', 'utf8');
  assert.match(source, /rev-parse', 'HEAD'/u);
  assert.doesNotMatch(source, /cfb94c92190a17ebb73983cef4017ca227df5d42/u);
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(packageJson.scripts['verify:master-production-release'], 'node scripts/verify-master-production-release.mjs');
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().length, 40);
});
