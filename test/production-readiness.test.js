import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const productionMigrations = readdirSync('migrations/production').filter(name => name.endsWith('.sql')).sort();
const expectedProductionMigrations = readdirSync('migrations')
  .filter(name => /^00(?:0[1-9]|1[0-9]|20|21)_.*\.sql$/u.test(name))
  .sort();

test('Production migration lane is byte-exact through schema21 and excludes UAT schema22', () => {
  assert.equal(productionMigrations.length, 21);
  assert.deepEqual(productionMigrations, expectedProductionMigrations);
  assert.ok(!productionMigrations.includes('0022_always_on_private_uat_cohort.sql'));
  for (const name of productionMigrations) {
    assert.deepEqual(readFileSync(`migrations/production/${name}`), readFileSync(`migrations/${name}`), name);
  }
});

test('Production Wrangler configuration is fail-closed and uses the isolated migration lane', () => {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  const production = config.env.production;
  assert.equal(production.d1_databases[0].database_id, '9738a051-d914-42d0-8e7b-8098ef2b959d');
  assert.equal(production.d1_databases[0].migrations_dir, 'migrations/production');
  assert.equal(production.r2_buckets[0].bucket_name, 'chatgun-media-production');
  for (const name of [
    'OAUTH_LOGIN_ENABLED', 'NEW_ACCOUNT_REGISTRATION_ENABLED', 'BETA_INVITATION_REGISTRATION_ENABLED',
    'ACCEPTANCE_FLOW_ENABLED', 'SOCIAL_APP_ENABLED', 'ADULT_ONBOARDING_ENABLED',
    'PUBLIC_DISCOVERY_ENABLED', 'FRIEND_REQUESTS_ENABLED', 'MESSAGING_ENABLED', 'PRESENCE_ENABLED',
    'MEDIA_UPLOAD_ENABLED', 'SENSITIVE_CONTENT_ENABLED', 'RATINGS_ENABLED', 'IDENTITY_VERIFICATION_ENABLED',
    'MODERATION_TOOLS_ENABLED', 'ACCOUNT_MODERATION_ENABLED', 'ELIGIBILITY_REVIEW_ENABLED',
    'ADMIN_ACCESS_STANDALONE_ENABLED', 'DEMO_MODE_ENABLED', 'DEMO_AUTO_START_ENABLED',
    'PUBLIC_DEMO_CANARY_ENABLED', 'EMAIL_OTP_ENABLED', 'MOBILE_OTP_ENABLED', 'LINE_EMAIL_ENABLED',
  ]) assert.equal(production.vars[name], 'false', name);
  assert.equal(production.vars.BETA_ENROLLMENT_REQUIRED, 'true');
  assert.equal(production.vars.MEDIA_QUARANTINE_ENABLED, 'true');
  assert.equal(production.vars.ADMIN_CLOUDFLARE_ACCESS_REQUIRED, 'true');
  assert.equal(production.vars.OAUTH_ENABLED_PROVIDERS, '');
});

test('Readiness utilities are verification-only and cannot deploy or apply remote migrations', () => {
  for (const name of ['audit-production-readiness.mjs', 'rehearse-production-migrations.mjs', 'prepare-production-rollback.mjs']) {
    const source = readFileSync(`scripts/${name}`, 'utf8');
    assert.doesNotMatch(source, /pages['"]?\s*,\s*['"]deploy|d1['"]?\s*,\s*['"]migrations['"]?\s*,\s*['"]apply/u, name);
  }
  const audit = readFileSync('scripts/audit-production-readiness.mjs', 'utf8');
  assert.match(audit, /Only read-only D1 statements are allowed/u);
  const rehearsal = readFileSync('scripts/rehearse-production-migrations.mjs', 'utf8');
  assert.match(rehearsal, /excludedFromProduction: \['0022_always_on_private_uat_cohort\.sql'\]/u);
});
