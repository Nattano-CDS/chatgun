// Offline verifier for the Phase 2 release package. It cannot deploy or apply
// remote migrations and intentionally accepts no Cloudflare credentials.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const production = config.env.production;
assert.equal(production.vars.DEPLOYMENT_ENVIRONMENT, 'production');
assert.equal(production.vars.ADMIN_CLOUDFLARE_ACCESS_REQUIRED, 'true');
for (const flag of ['OAUTH_LOGIN_ENABLED', 'NEW_ACCOUNT_REGISTRATION_ENABLED', 'SOCIAL_APP_ENABLED',
  'MESSAGING_ENABLED', 'MEDIA_UPLOAD_ENABLED', 'MODERATION_TOOLS_ENABLED', 'ACCOUNT_MODERATION_ENABLED']) {
  assert.equal(production.vars[flag], 'false', flag);
}
assert.equal(production.d1_databases[0].migrations_dir, 'migrations/production');

const lane = readdirSync('migrations/production').filter(name => name.endsWith('.sql')).sort();
assert.equal(lane.length, 21);
assert.equal(lane.at(-1), '0021_eligibility_review_requests.sql');
assert.ok(!lane.some(name => name.startsWith('0022_')));
const pending = lane.slice(17).map(name => ({ name, sha256: sha256(`migrations/production/${name}`) }));

for (const [path, enableFlag] of [
  ['wrangler.cleanup-production-prepared.jsonc', 'RETENTION_CLEANUP_ENABLED'],
  ['wrangler.media-cleanup-production-prepared.jsonc', 'MEDIA_CLEANUP_ENABLED'],
]) {
  const worker = JSON.parse(readFileSync(path, 'utf8'));
  assert.deepEqual(worker.triggers.crons, []);
  assert.equal(worker.vars[enableFlag], 'false');
}
const codeql = readFileSync('.github/workflows/codeql.yml', 'utf8');
assert.match(codeql, /github\/codeql-action\/init@[a-f0-9]{40}/u);
assert.match(codeql, /github\/codeql-action\/analyze@[a-f0-9]{40}/u);
assert.equal(JSON.parse(readFileSync('package-lock.json', 'utf8')).packages[''].devDependencies['@playwright/test'], '^1.64.1');

console.log(JSON.stringify({
  result: 'PASS', baseline: 'f1759505fe3b6d99fdfe524ed81091d734b859d3',
  productionWrites: 0, productionFlagsChanged: 0, migrationLane: { from: 17, to: 21, pending },
  cleanupWorkers: 'prepared-inert', access: 'required-fail-closed',
}, null, 2));
