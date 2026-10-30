import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const manifest = json('docs/production-readiness/full-launch-rc/release-manifest.json');
const profile = json('docs/production-readiness/full-launch-rc/release-profile.json');
const wrangler = json('wrangler.jsonc');
const production = wrangler.env.production;

assert.equal(manifest.decision, 'NO-GO');
assert.equal(manifest.verifiedProductionBaseline.schema, 21);
assert.equal(manifest.verifiedProductionBaseline.productionMutationsDuringThisTask, 0);
assert.equal(manifest.database.newMigrationRequired, false);
assert.equal(manifest.database.excludedFromProduction, '0022_always_on_private_uat_cohort.sql');
assert.equal(profile.apply, false);
assert.equal(production.d1_databases[0].migrations_dir, 'migrations/production');
assert.equal(production.vars.FRIEND_REQUESTS_ENABLED, 'false');
for (const key of [
  'PUBLIC_DISCOVERY_ENABLED', 'MESSAGING_ENABLED', 'MEDIA_UPLOAD_ENABLED',
  'PRESENCE_ENABLED', 'RATINGS_ENABLED', 'SENSITIVE_CONTENT_ENABLED',
  'EMAIL_OTP_ENABLED', 'MOBILE_OTP_ENABLED', 'DEMO_MODE_ENABLED',
]) assert.equal(production.vars[key], 'false', key);
assert.ok(manifest.mandatoryBlockers.length >= 8);

console.log(JSON.stringify({
  result: 'PASS',
  decision: manifest.decision,
  productionMutationCount: 0,
  productionSchema: manifest.verifiedProductionBaseline.schema,
  productionFlagsRemainClosed: true,
  launchBlockers: manifest.mandatoryBlockers.length,
}, null, 2));
