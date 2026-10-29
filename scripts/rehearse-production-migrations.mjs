// Offline-only migration and rollback rehearsal from a protected Production export.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const backupPath = process.env.CHATGUN_PRODUCTION_EXPORT;
assert.ok(backupPath?.startsWith('/Users/nattano/.codex/private-backups/chatgun/production-readiness-'));
assert.equal(statSync(backupPath).mode & 0o777, 0o600);
const exportBytes = readFileSync(backupPath);
const exportSql = exportBytes.toString('utf8');
const productionMigrationFiles = [
  '0018_cloudflare_admin_sessions.sql',
  '0019_member_age_safety_holds.sql',
  '0020_age_hold_write_guards.sql',
  '0021_eligibility_review_requests.sql',
];
assert.ok(!productionMigrationFiles.includes('0022_always_on_private_uat_cohort.sql'));

function restore() {
  const database = new DatabaseSync(':memory:');
  database.exec(exportSql);
  return database;
}
function scalar(database, sql) {
  return database.prepare(sql).get().n;
}
function counts(database) {
  return Object.fromEntries(['users', 'identities', 'sessions', 'social_messages', 'social_media', 'moderation_access_grants']
    .map(table => [table, scalar(database, `SELECT COUNT(*) n FROM ${table}`)]));
}

const candidate = restore();
assert.equal(scalar(candidate, 'SELECT COUNT(*) n FROM d1_migrations'), 17);
assert.equal(candidate.prepare('PRAGMA foreign_key_check').all().length, 0);
const beforeCounts = counts(candidate);
const applied = [];
for (const name of productionMigrationFiles) {
  const sql = readFileSync(`migrations/${name}`, 'utf8');
  candidate.exec('BEGIN IMMEDIATE');
  try {
    candidate.exec(sql);
    const nextId = scalar(candidate, 'SELECT COALESCE(MAX(id),0)+1 n FROM d1_migrations');
    candidate.prepare('INSERT INTO d1_migrations(id,name,applied_at) VALUES(?,?,?)')
      .run(nextId, name, new Date().toISOString());
    candidate.exec('COMMIT');
  } catch (error) {
    candidate.exec('ROLLBACK');
    throw error;
  }
  assert.equal(candidate.prepare('PRAGMA foreign_key_check').all().length, 0, `${name} introduced an FK violation`);
  applied.push({ name, sha256: createHash('sha256').update(sql).digest('hex') });
}
assert.equal(scalar(candidate, 'SELECT COUNT(*) n FROM d1_migrations'), 21);
assert.deepEqual(counts(candidate), beforeCounts, 'Migration rehearsal changed existing row counts');
for (const table of ['cloudflare_admin_sessions', 'member_age_safety_holds', 'eligibility_review_requests', 'eligibility_review_events', 'administration_access_events', 'account_safety_notifications']) {
  assert.equal(scalar(candidate, `SELECT COUNT(*) n FROM ${table}`), 0, `${table} must start empty`);
}
assert.equal(scalar(candidate, "SELECT COUNT(*) n FROM sqlite_master WHERE name='uat_authorized_identities'"), 0, 'UAT-only schema must not enter Production');
const candidateSchema = candidate.prepare("SELECT type,name FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
candidate.close();

const rollback = restore();
assert.equal(scalar(rollback, 'SELECT COUNT(*) n FROM d1_migrations'), 17);
assert.deepEqual(counts(rollback), beforeCounts);
assert.equal(rollback.prepare('PRAGMA foreign_key_check').all().length, 0);
assert.equal(scalar(rollback, "SELECT COUNT(*) n FROM sqlite_master WHERE name='cloudflare_admin_sessions'"), 0);
rollback.close();

const evidence = {
  checkedAt: new Date().toISOString(),
  sourceExportSha256: createHash('sha256').update(exportBytes).digest('hex'),
  sourceExportBytes: exportBytes.length,
  sourcePermissions: '0600',
  sourceSchema: 17,
  targetSchema: 21,
  applied,
  excludedFromProduction: ['0022_always_on_private_uat_cohort.sql'],
  existingRowCountsPreserved: true,
  foreignKeyViolations: 0,
  candidateSchemaObjectCounts: Object.fromEntries(['table', 'index', 'trigger'].map(type => [type, candidateSchema.filter(row => row.type === type).length])),
  rollbackRestore: 'PASS schema17, row counts and FK0',
  productionWrites: 0,
};
mkdirSync('docs/production-readiness', { recursive: true });
writeFileSync('docs/production-readiness/migration-rehearsal.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
