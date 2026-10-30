// Read-only Production validation. This file intentionally has no write query path.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import {
  PRODUCTION_RBAC_SCHEMA, PRODUCTION_RBAC_TTL_SECONDS,
  assertCloudflareAccountIdentity, assertCloudflareD1DatabaseIdentity,
  assertCloudflarePagesD1Binding,
  assertProductionGrantInventory, assertProductionOwnerEligibility,
  productionGrantInventorySql, productionOwnerEligibilitySql, productionRbacBootstrapBatch,
} from './lib/production-rbac-bootstrap.mjs';

const account = '23017b53386fb67fc62a52cdd017454c';
const database = '9738a051-d914-42d0-8e7b-8098ef2b959d';
const expectedSha = 'c9327e7913ea09577c06b8a0f70f953f21d0aecb';
const privateVerifier = (()=>{const root=process.env.CHATGUN_PRIVATE_ROOT;if(!root)throw new Error('CHATGUN_PRIVATE_ROOT is required');return root;})()+'/production-admin-config-F9eVom/production-admin-verifier.json';
const privateOwner = (()=>{const root=process.env.CHATGUN_PRIVATE_ROOT;if(!root)throw new Error('CHATGUN_PRIVATE_ROOT is required');return root;})()+'/verified-owner-account-20261020.json';
const token = process.env.CLOUDFLARE_API_TOKEN;
const backupDirectory = process.env.CHATGUN_RBAC_BACKUP_DIR;
const output = process.env.CHATGUN_RBAC_PREFLIGHT_OUTPUT;
assert.ok(token && backupDirectory && output);
for (const file of [privateVerifier, privateOwner]) assert.equal(statSync(file).mode & 0o777, 0o600);
assert.equal(statSync(backupDirectory).mode & 0o777, 0o700);
const verifier = JSON.parse(readFileSync(privateVerifier));
const owner = JSON.parse(readFileSync(privateOwner));
const userId = verifier.values.ADMIN_ACCESS_OWNER_USER_ID;
assert.equal(userId, owner.userId);

async function api(path, body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, {
    method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  assert.ok(response.ok && payload.success, 'Read-only Cloudflare preflight failed');
  return payload.result;
}
async function select(sql, params = []) {
  assert.match(sql.trim(), /^(?:SELECT|PRAGMA|WITH)\b/iu, 'Production preflight accepts read-only SQL only');
  const [result] = await api(`/d1/database/${database}/query`, { sql, params });
  assert.equal(result.success, true);
  assert.equal(result.meta.changed_db, false);
  assert.equal(Number(result.meta.rows_written), 0);
  return result.results;
}

assertCloudflareAccountIdentity(await api(''), account);
assertCloudflareD1DatabaseIdentity(await api(`/d1/database/${database}`), database, 'chatgun-auth');
const project = await api('/pages/projects/chatgun');
assert.equal(project.canonical_deployment.deployment_trigger.metadata.commit_hash, expectedSha);
assertCloudflarePagesD1Binding(project.deployment_configs.production.d1_databases.DB, database);
for (const [table, required] of Object.entries(PRODUCTION_RBAC_SCHEMA)) {
  const columns = (await select(`PRAGMA table_info(${table})`)).map(column => column.name);
  for (const column of required) assert.ok(columns.includes(column), `${table}.${column} missing`);
}
const indexes = await select("SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_moderation_access_active_role','idx_moderation_access_expiry','idx_moderation_role_events_target')");
assert.equal(indexes.length, 3);
const schema = Number((await select('SELECT MAX(id) n FROM d1_migrations'))[0].n);
const fk = Number((await select('SELECT COUNT(*) n FROM pragma_foreign_key_check'))[0].n);
assert.equal(schema, 21);
assert.equal(fk, 0);
const now = Math.floor(Date.now() / 1000);
const inventory = (await select(productionGrantInventorySql, [now, now, userId, now, userId, userId]))[0];
assertProductionGrantInventory(inventory);
assert.equal(Number(inventory.grants), 2);
assert.equal(Number(inventory.events), 2);
const eligibility = (await select(productionOwnerEligibilitySql, [userId]))[0];
assertProductionOwnerEligibility(eligibility, userId);

const backupSqlPath = `${backupDirectory}/production.sql`;
const verificationPath = `${backupDirectory}/verification.json`;
assert.equal(statSync(backupSqlPath).mode & 0o777, 0o600);
assert.equal(statSync(verificationPath).mode & 0o777, 0o600);
const backup = readFileSync(backupSqlPath);
const backupVerification = JSON.parse(readFileSync(verificationPath));
assert.equal(createHash('sha256').update(backup).digest('hex'), backupVerification.sha256);
assert.equal(backupVerification.localRecoveryPass, true);
assert.equal(backupVerification.schema, 21);
assert.equal(backupVerification.fk, 0);
const local = new DatabaseSync(':memory:');
local.exec(backup.toString());
const before = local.prepare('SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM identities) identities,(SELECT COUNT(*) FROM moderation_access_grants) grants,(SELECT COUNT(*) FROM moderation_role_events) events').get();
const grantId = randomUUID(), eventId = randomUUID();
const batch = productionRbacBootstrapBatch({ userId, grantId, eventId, now });
local.exec('BEGIN IMMEDIATE');
try {
  for (const statement of batch) assert.equal(Number(local.prepare(statement.sql).run(...statement.params).changes), 1);
  local.exec('COMMIT');
} catch (error) {
  local.exec('ROLLBACK');
  throw error;
}
const localGrant = local.prepare(`SELECT role,expires_at-granted_at ttl,revoked_at FROM moderation_access_grants WHERE id=? AND user_id=?`).get(grantId, userId);
assert.equal(localGrant.role, 'moderation_admin');
assert.equal(localGrant.ttl, PRODUCTION_RBAC_TTL_SECONDS);
assert.equal(localGrant.revoked_at, null);
assert.equal(local.prepare("SELECT COUNT(*) n FROM moderation_role_events WHERE grant_id=? AND target_user_id=? AND role='moderation_admin' AND action='grant'").get(grantId, userId).n, 1);
const after = local.prepare('SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM identities) identities,(SELECT COUNT(*) FROM moderation_access_grants) grants,(SELECT COUNT(*) FROM moderation_role_events) events').get();
assert.equal(after.users, before.users);
assert.equal(after.identities, before.identities);
assert.equal(after.grants, before.grants + 1);
assert.equal(after.events, before.events + 1);
assert.equal(local.prepare('SELECT COUNT(*) n FROM pragma_foreign_key_check').get().n, 0);
local.close();

const result = {
  checkedAt: new Date().toISOString(), result: 'PASS', productionWrites: 0,
  productionSha: expectedSha, schema, foreignKeyViolations: fk,
  schemaTablesChecked: Object.keys(PRODUCTION_RBAC_SCHEMA).length,
  ownerBindingVerifiedPrivately: true, ownerEligible: true,
  recordCounts: { users: Number(inventory.users), identities: Number(inventory.identities), sessions: Number(inventory.sessions) },
  grantInventory: { totalGrants: Number(inventory.grants), totalEvents: Number(inventory.events),
    active: Number(inventory.active_grants), expired: Number(inventory.expired_grants), revoked: Number(inventory.revoked_grants), activeModerationAdmin: 0 },
  protectedBackupVerified: true, isolatedRecoveryVerified: true,
  isolatedBatchDryRun: { grantRowsAdded: 1, auditRowsAdded: 1, role: 'moderation_admin', ttlSeconds: PRODUCTION_RBAC_TTL_SECONDS, otherRolesChanged: 0, otherAccountsChanged: 0 },
  privateIdentifiersIncluded: false,
};
writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify(result));
