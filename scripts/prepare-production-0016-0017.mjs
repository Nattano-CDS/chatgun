// Owner approval: "Approved all", following the exact pending migration preflight.
// Additive D1 preparation only. No deploy, service activation, role or user changes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, chmodSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

assert.equal(process.env.CHATGUN_APPROVED_MIGRATIONS, 'production-0016-0017');
process.umask(0o077);
const account = '23017b53386fb67fc62a52cdd017454c';
const database = '9738a051-d914-42d0-8e7b-8098ef2b959d';
const expectedSha = 'b45aa4f9d28ca9bb1ec3e1fb22b31bc8b0f331d7';
const names = ['0016_beta_account_moderation.sql', '0017_delivery_and_review_claims.sql'];
const hash = value => createHash('sha256').update(value).digest('hex');
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const { token } = JSON.parse(execFileSync('npx', ['wrangler@4.151.1', 'auth', 'token', '--json'], { encoding: 'utf8' }));
async function cf(path, body) {
  const response = await fetch('https://api.cloudflare.com/client/v4/accounts/' + account + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  assert.ok(response.ok && result.success, 'Account-scoped preflight failed');
  return result.result;
}
const query = async sql => (await cf('/d1/database/' + database + '/query', { sql }))[0].results;
assert.equal((await cf('')).id, account);
assert.equal((await cf('/d1/database/' + database)).name, 'chatgun-auth');
const beforeProject = await cf('/pages/projects/chatgun');
assert.equal(beforeProject.canonical_deployment.deployment_trigger.metadata.commit_hash, expectedSha);
assert.equal(beforeProject.deployment_configs.production.d1_databases.DB.id, database);
assert.equal(beforeProject.deployment_configs.production.r2_buckets.MEDIA.name, 'chatgun-media-production');
assert.equal(beforeProject.deployment_configs.preview.d1_databases.DB.id, '5bbfd55d-eb22-4324-8a7d-57bef14110ea');
assert.equal(beforeProject.deployment_configs.preview.r2_buckets.MEDIA.name, 'chatgun-media-staging');
for (const key of ['NEW_ACCOUNT_REGISTRATION_ENABLED', 'ACCOUNT_MODERATION_ENABLED', 'PUBLIC_DISCOVERY_ENABLED', 'MESSAGING_ENABLED', 'PRESENCE_ENABLED', 'MEDIA_UPLOAD_ENABLED', 'SENSITIVE_CONTENT_ENABLED']) assert.equal(beforeProject.deployment_configs.production.env_vars[key]?.value, 'false', 'Unexpected service gate: ' + key);
assert.equal((await cf('/r2/buckets/chatgun-media-production/domains/managed')).enabled, false);
assert.equal(((await cf('/r2/buckets/chatgun-media-production/domains/custom')).domains || []).length, 0);
const history = await query('SELECT name FROM d1_migrations ORDER BY id');
assert.equal(history.length, 15, 'Inspect current history; do not replay a partial migration');
assert.equal(history.at(-1).name, '0015_authenticated_online_presence.sql');
const parent = (()=>{const root=process.env.CHATGUN_PRIVATE_ROOT;if(!root)throw new Error('CHATGUN_PRIVATE_ROOT is required');return root;})()+'';
mkdirSync(parent, { recursive: true, mode: 0o700 });
const directory = mkdtempSync(parent + '/production-0016-0017-');
chmodSync(directory, 0o700);
const config = directory + '/wrangler.jsonc';
writeFileSync(config, JSON.stringify({ name: 'chatgun-production-migration', compatibility_date: '2026-10-15', d1_databases: [{ binding: 'DB', database_name: 'chatgun-auth', database_id: database, migrations_dir: resolve('migrations') }] }), { mode: 0o600 });
const recovery = await cf('/d1/database/' + database + '/time_travel/bookmark');
assert.ok(recovery.bookmark, 'A recovery bookmark is required');
writeFileSync(directory + '/recovery.json', JSON.stringify(recovery), { mode: 0o600 });
const cli = args => execFileSync('npx', ['wrangler@4.151.1', ...args, '--config', config], { env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: account }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 });
const exportDb = name => { cli(['d1', 'export', 'chatgun-auth', '--remote', '--output', directory + '/' + name]); chmodSync(directory + '/' + name, 0o600); return readFileSync(directory + '/' + name, 'utf8'); };
const originalSql = exportDb('before.sql');
const original = new DatabaseSync(':memory:');
original.exec(originalSql);
assert.equal(original.prepare('SELECT COUNT(*) n FROM d1_migrations').get().n, 15);
assert.equal(original.prepare('PRAGMA foreign_key_check').all().length, 0);
const tables = original.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name").all().map(row => row.name);
const columns = Object.fromEntries(tables.map(table => [table, original.prepare('PRAGMA table_info(' + quote(table) + ')').all().map(column => column.name)]));
const projection = db => Object.fromEntries(tables.filter(table => table !== 'd1_migrations').map(table => [table, hash(db.prepare('SELECT ' + columns[table].map(quote).join(',') + ' FROM ' + quote(table)).all().map(row => JSON.stringify(row)).sort().join('\n'))]));
const counts = db => Object.fromEntries(tables.map(table => [table, db.prepare('SELECT COUNT(*) n FROM ' + quote(table)).get().n]));
const beforeProjection = projection(original), beforeCounts = counts(original);
assert.equal(beforeCounts.users, 1, 'Owner account baseline changed; inspect first');
const schemas = () => hash(JSON.stringify(original.prepare('SELECT name,type,sql FROM sqlite_master ORDER BY type,name').all()));
const schemaBefore = schemas();
original.exec('BEGIN');
for (const name of names) original.exec(readFileSync(resolve('migrations', name), 'utf8'));
original.exec('ROLLBACK');
assert.equal(schemas(), schemaBefore, 'Local DDL rollback failed');
assert.equal(hash(JSON.stringify(projection(original))), hash(JSON.stringify(beforeProjection)));
for (const name of names) {
  original.exec('BEGIN');
  original.exec(readFileSync(resolve('migrations', name), 'utf8'));
  original.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(name);
  original.exec('COMMIT');
}
assert.equal(original.prepare('SELECT COUNT(*) n FROM d1_migrations').get().n, 17);
assert.equal(original.prepare('PRAGMA foreign_key_check').all().length, 0);
assert.equal(hash(JSON.stringify(projection(original))), hash(JSON.stringify(beforeProjection)), 'Rehearsal changed existing data');
assert.equal(statSync(directory).mode & 0o777, 0o700);
assert.equal(statSync(directory + '/before.sql').mode & 0o777, 0o600);
// A second protected export detects any owner/background write since the backup.
const immediate = new DatabaseSync(':memory:');
immediate.exec(exportDb('immediate-before.sql'));
assert.equal(hash(JSON.stringify(projection(immediate))), hash(JSON.stringify(beforeProjection)), 'Data changed since backup; stop before migration');
immediate.close();
const evidence = { startedAt: new Date().toISOString(), account, database, authorization: 'Owner: Approved all, following exact 0016/0017 preflight', productionSha: expectedSha, pending: names, backupSha256: hash(originalSql), backupBytes: Buffer.byteLength(originalSql), backupPermissions: '0700 directory / 0600 files', backupStored: 'protected outside Git', recoveryBookmarkAvailable: true, recoveryBookmarkSha256: hash(recovery.bookmark), localRestore: 'PASS', localDdlRollback: 'PASS', localMigrationRehearsal: 'PASS', baselineMigrationCount: 15, originalTableCounts: beforeCounts, migrationHashes: Object.fromEntries(names.map(name => [name, hash(readFileSync(resolve('migrations', name)))])), stage: 'preflight-pass', deployed: false, serviceFlagsChanged: false, userRecordsDeleted: false, humanUatPassed: false };
mkdirSync('docs/production-migrations-0016-0017', { recursive: true });
const save = () => writeFileSync('docs/production-migrations-0016-0017/results.json', JSON.stringify(evidence, null, 2) + '\n');
save();
try {
  const log = cli(['d1', 'migrations', 'apply', 'chatgun-auth', '--remote']);
  writeFileSync(directory + '/apply.log', log, { mode: 0o600 });
  evidence.stage = 'migrations-applied'; save();
  const afterHistory = await query('SELECT name FROM d1_migrations ORDER BY id');
  assert.equal(afterHistory.length, 17);
  assert.equal(hash(JSON.stringify(afterHistory.slice(-2).map(row => row.name))), hash(JSON.stringify(names)));
  const after = new DatabaseSync(':memory:');
  after.exec(exportDb('after.sql'));
  assert.equal(hash(JSON.stringify(projection(after))), hash(JSON.stringify(beforeProjection)), 'Existing record projection changed; inspect privately; do not restore over newer data');
  assert.equal(after.prepare('PRAGMA foreign_key_check').all().length, 0);
  const afterProject = await cf('/pages/projects/chatgun');
  assert.equal(hash(JSON.stringify(afterProject.deployment_configs)), hash(JSON.stringify(beforeProject.deployment_configs)), 'Pages configuration changed');
  assert.equal(afterProject.canonical_deployment.id, beforeProject.canonical_deployment.id);
  const live = await (await fetch('https://chatgun.social/release.json', { cache: 'no-store' })).json();
  assert.equal(live.commit, expectedSha);
  const statuses = {};
  for (const path of ['/api/health', '/api/auth/config', '/api/social/config']) { const r = await fetch('https://chatgun.social' + path, { cache: 'no-store' }); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /application\/json/); statuses[path] = 200; }
  evidence.stage = 'verified'; evidence.completedAt = new Date().toISOString(); evidence.migrationCount = afterHistory.length; evidence.existingRecordProjectionsPreserved = true; evidence.foreignKeyViolations = 0; evidence.apiStatuses = statuses; evidence.productionDeploymentUnchanged = true; evidence.afterTableCounts = counts(after); evidence.releaseBlocker = 'Consolidated genuine-user UAT has not been executed; no successful UAT approval fabricated'; save();
  after.close(); original.close();
  console.log('Production migrations0016/0017 verified. Backup/rehearsal PASS; existing records preserved; FK0; live APIs200JSON; no deploy or service activation.');
} catch (error) {
  evidence.stage = 'manual-inspection-required'; save();
  throw new Error('Migration verification stopped. Inspect protected artifacts; do not reset/restore Production automatically.');
}
