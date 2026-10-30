import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { verifyProductionPreservation } from '../scripts/verify-production-preservation.mjs';

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

test('Production Wrangler configuration preserves the owner pilot and uses the isolated migration lane', () => {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  const production = config.env.production;
  assert.equal(production.d1_databases[0].database_id, '9738a051-d914-42d0-8e7b-8098ef2b959d');
  assert.equal(production.d1_databases[0].migrations_dir, 'migrations/production');
  assert.equal(production.r2_buckets[0].bucket_name, 'chatgun-media-production');
  const fingerprint = JSON.parse(readFileSync('docs/production-readiness/phase6/production-owner-pilot-fingerprint.json', 'utf8'));
  const preservation = verifyProductionPreservation(production.vars, fingerprint);
  assert.equal(preservation.result, 'PASS');
  assert.equal(preservation.totalChecks, 25);
  for (const name of ['ELIGIBILITY_REVIEW_ENABLED', 'ADMIN_ACCESS_STANDALONE_ENABLED', 'DEMO_AUTO_START_ENABLED', 'LINE_EMAIL_ENABLED', 'FACEBOOK_EMAIL_ENABLED']) {
    assert.equal(production.vars[name], 'false', name);
  }
  assert.equal(production.vars.BETA_ENROLLMENT_REQUIRED, undefined);
  assert.equal(production.vars.MEDIA_QUARANTINE_ENABLED, 'true');
  assert.equal(production.vars.ADMIN_CLOUDFLARE_ACCESS_REQUIRED, 'true');
  assert.equal(production.vars.DEPLOYMENT_ENVIRONMENT, 'production');
  assert.equal(production.vars.OAUTH_ENABLED_PROVIDERS, 'line');
});

test('Readiness utilities are verification-only and cannot deploy or apply remote migrations', () => {
  for (const name of ['audit-production-readiness.mjs', 'rehearse-production-migrations.mjs', 'prepare-production-rollback.mjs', 'verify-production-remediation.mjs']) {
    const source = readFileSync(`scripts/${name}`, 'utf8');
    assert.doesNotMatch(source, /pages['"]?\s*,\s*['"]deploy|d1['"]?\s*,\s*['"]migrations['"]?\s*,\s*['"]apply/u, name);
  }
  const audit = readFileSync('scripts/audit-production-readiness.mjs', 'utf8');
  assert.match(audit, /Only read-only D1 statements are allowed/u);
  const rehearsal = readFileSync('scripts/rehearse-production-migrations.mjs', 'utf8');
  assert.match(rehearsal, /excludedFromProduction: \['0022_always_on_private_uat_cohort\.sql'\]/u);
});

test('Prepared Production cleanup Workers are inert and cannot run on a missing enable flag', () => {
  const privacy = JSON.parse(readFileSync('wrangler.cleanup-production-prepared.jsonc', 'utf8'));
  const media = JSON.parse(readFileSync('wrangler.media-cleanup-production-prepared.jsonc', 'utf8'));
  for (const config of [privacy, media]) {
    assert.deepEqual(config.triggers.crons, []);
    assert.equal(config.workers_dev, false);
    assert.equal(config.preview_urls, false);
    assert.equal(config.d1_databases[0].database_id, '9738a051-d914-42d0-8e7b-8098ef2b959d');
  }
  assert.equal(privacy.vars.RETENTION_CLEANUP_ENABLED, 'false');
  assert.equal(media.vars.MEDIA_CLEANUP_ENABLED, 'false');
  assert.equal(media.r2_buckets[0].bucket_name, 'chatgun-media-production');
  assert.match(readFileSync('workers/privacy-cleanup.js', 'utf8'), /RETENTION_CLEANUP_ENABLED !== 'true'/u);
  assert.match(readFileSync('workers/media-cleanup.js', 'utf8'), /MEDIA_CLEANUP_ENABLED !== 'true'/u);
});
