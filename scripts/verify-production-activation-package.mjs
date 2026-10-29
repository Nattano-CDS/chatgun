import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const manifest = JSON.parse(readFileSync('docs/production-readiness/phase3-release-manifest.json', 'utf8'));
const consoleEvidence = JSON.parse(readFileSync('docs/production-readiness/phase3-console-verification.json', 'utf8'));
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8')).env.production;
assert.equal(manifest.candidateApplicationSha, 'cfb94c92190a17ebb73983cef4017ca227df5d42');
assert.equal(manifest.candidateGitTreeSha, '4214e4bce20e52bc1c519927774b38c4f536c19c');
assert.equal(consoleEvidence.candidateReleaseSha, manifest.candidateApplicationSha);
assert.equal(manifest.verdict, 'NO-GO');
assert.equal(manifest.productionSchemaCurrent, 17);
assert.equal(manifest.productionSchemaTarget, 21);
assert.equal(manifest.isolatedMigrationRehearsal.schema22Excluded, true);
assert.equal(manifest.authorization.deploymentAuthorized, false);
assert.equal(manifest.authorization.migrationAuthorized, false);
assert.equal(manifest.authorization.productionAuthenticationAuthorized, false);
assert.equal(manifest.authorization.publicFeatureActivationAuthorized, false);
assert.equal(manifest.productionAccess.issuerConfigured, false);
assert.equal(manifest.productionAccess.audienceConfigured, false);
assert.deepEqual(manifest.cleanupWorkers.productionSchedules, []);
assert.equal(consoleEvidence.cloudflare.productionAccessApplicationVerified, false);
assert.equal(consoleEvidence.providers.google.publishingStatus, 'Testing');
assert.equal(consoleEvidence.providers.meta.publishingStatus, 'Unpublished');
assert.equal(consoleEvidence.providers.line.consoleReadbackCompleted, false);
assert.equal(consoleEvidence.github.mainProtected, false);
assert.equal(consoleEvidence.github.dependabotAlertsEnabled, false);

for (const [name, expected] of Object.entries(manifest.migrationHashes)) {
  assert.equal(sha256(`migrations/${name}`), expected, name);
  assert.equal(sha256(`migrations/production/${name}`), expected, `production/${name}`);
}
for (const flag of [
  'OAUTH_LOGIN_ENABLED', 'NEW_ACCOUNT_REGISTRATION_ENABLED', 'BETA_INVITATION_REGISTRATION_ENABLED',
  'ACCEPTANCE_FLOW_ENABLED', 'SOCIAL_APP_ENABLED', 'PUBLIC_DISCOVERY_ENABLED', 'MESSAGING_ENABLED',
  'PRESENCE_ENABLED', 'MEDIA_UPLOAD_ENABLED', 'SENSITIVE_CONTENT_ENABLED', 'MODERATION_TOOLS_ENABLED',
  'ACCOUNT_MODERATION_ENABLED', 'IDENTITY_VERIFICATION_ENABLED', 'ELIGIBILITY_REVIEW_ENABLED',
  'EMAIL_OTP_ENABLED', 'MOBILE_OTP_ENABLED', 'DEMO_MODE_ENABLED', 'DEMO_AUTO_START_ENABLED',
  'PUBLIC_DEMO_CANARY_ENABLED', 'ADMIN_ACCESS_STANDALONE_ENABLED'
]) assert.equal(config.vars[flag], 'false', flag);
assert.equal(config.vars.ADMIN_CLOUDFLARE_ACCESS_REQUIRED, 'true');
assert.equal(config.vars.OAUTH_ENABLED_PROVIDERS, '');
assert.equal(config.d1_databases[0].migrations_dir, 'migrations/production');
assert.equal(config.r2_buckets[0].bucket_name, 'chatgun-media-production');

console.log(JSON.stringify({
  result: 'PASS', candidateApplicationSha: manifest.candidateApplicationSha,
  migrationHashesVerified: 4, productionClosedFlagsVerified: 20,
  verdict: manifest.verdict, productionMutations: 0,
}, null, 2));
