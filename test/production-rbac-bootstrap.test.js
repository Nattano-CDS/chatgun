import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { TestD1 } from './helpers/d1.js';
import {
  PRODUCTION_RBAC_SCHEMA, PRODUCTION_RBAC_TTL_SECONDS,
  assertCloudflareAccountIdentity, assertCloudflareD1DatabaseIdentity,
  assertCloudflarePagesD1Binding,
  assertProductionGrantInventory, assertProductionOwnerEligibility,
  productionGrantInventorySql, productionOwnerEligibilitySql, productionRbacBootstrapBatch,
} from '../scripts/lib/production-rbac-bootstrap.mjs';

const accountId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const databaseUuid = '11111111-2222-4333-8444-555555555555';

test('Cloudflare identity guards accept the actual account, D1, and Pages binding response fields', () => {
  assert.equal(assertCloudflareAccountIdentity({ id: accountId }, accountId), true);
  assert.equal(assertCloudflareD1DatabaseIdentity({ uuid: databaseUuid, name: 'chatgun-auth' }, databaseUuid, 'chatgun-auth'), true);
  assert.equal(assertCloudflarePagesD1Binding({ id: databaseUuid }, databaseUuid), true);
});

for (const [condition, response] of [
  ['missing UUID', { name: 'chatgun-auth' }],
  ['malformed UUID', { uuid: 'not-a-uuid', name: 'chatgun-auth' }],
  ['unexpected UUID', { uuid: 'db9c1d58-b34d-4a61-a2d1-b43642570f1e', name: 'chatgun-auth' }],
  ['unexpected name', { uuid: databaseUuid, name: 'different-database' }],
  ['ambiguous identifiers', { uuid: databaseUuid, id: 'db9c1d58-b34d-4a61-a2d1-b43642570f1e', name: 'chatgun-auth' }],
]) {
  test(`Cloudflare D1 identity guard fails closed for ${condition}`, () => {
    assert.throws(() => assertCloudflareD1DatabaseIdentity(response, databaseUuid, 'chatgun-auth'));
  });
}

test('related Cloudflare account and Pages binding guards fail closed for invalid fields', () => {
  assert.throws(() => assertCloudflareAccountIdentity({ uuid: accountId }, accountId));
  assert.throws(() => assertCloudflarePagesD1Binding({ uuid: databaseUuid }, databaseUuid));
  assert.throws(() => assertCloudflarePagesD1Binding({ id: 'invalid' }, databaseUuid));
});

async function fixture() {
  const db = new TestD1({ throughMigration: '0021_eligibility_review_requests.sql' });
  const userId = randomUUID(), now = 1_800_000_000, assuranceId = randomUUID();
  await db.prepare("INSERT INTO users(id,status,account_state,created_at,updated_at)VALUES(?,'active','active',?,?)").bind(userId, now, now).run();
  await db.prepare("INSERT INTO identities(provider,subject,user_id,created_at,last_login_at)VALUES('line',?,?,?,?)").bind('local-subject', userId, now, now).run();
  await db.prepare("INSERT INTO beta_enrollments(user_id,status,created_at,activated_at)VALUES(?,'active',?,?)").bind(userId, now, now).run();
  await db.prepare("INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at)VALUES(?,?,'adult_18_plus','self_declaration','v1',?)").bind(assuranceId, userId, now).run();
  await db.prepare("INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at)VALUES(?,?,'Local owner',?,?)").bind(userId, assuranceId, now, now).run();
  await db.prepare("INSERT INTO account_acceptances(id,user_id,adult_notice_version,terms_version,privacy_version,adult_declared_at,terms_accepted_at,privacy_acknowledged_at,accepted_at)VALUES(?,?,'a','t','p',?,?,?,?)").bind(randomUUID(), userId, now, now, now, now).run();
  return { db, userId, now, assuranceId };
}
async function eligibility(db, userId) { return db.prepare(productionOwnerEligibilitySql).bind(userId).first(); }
async function inventory(db, userId, now) { return db.prepare(productionGrantInventorySql).bind(now, now, userId, now, userId, userId).first(); }
async function apply(db, userId, now) {
  const ids = [randomUUID(), randomUUID()];
  const statements = productionRbacBootstrapBatch({ userId, grantId: ids[0], eventId: ids[1], now }).map(item => db.prepare(item.sql).bind(...item.params));
  return db.batch(statements);
}

test('schema 21 contains every table and column used by Production RBAC SQL', () => {
  const db = new TestD1({ throughMigration: '0021_eligibility_review_requests.sql' });
  for (const [table, required] of Object.entries(PRODUCTION_RBAC_SCHEMA)) {
    const columns = db.database.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
    for (const column of required) assert.ok(columns.includes(column), `${table}.${column}`);
  }
  assert.doesNotThrow(() => db.database.prepare(productionOwnerEligibilitySql));
  assert.doesNotThrow(() => db.database.prepare(productionGrantInventorySql));
  for (const item of productionRbacBootstrapBatch({ userId: randomUUID(), grantId: randomUUID(), eventId: randomUUID(), now: 1_800_000_000 })) assert.doesNotThrow(() => db.database.prepare(item.sql));
  db.close();
});

test('eligible owner receives exactly one moderation_admin grant and matching audit for 3600 seconds', async () => {
  const { db, userId, now } = await fixture();
  assertProductionOwnerEligibility(await eligibility(db, userId), userId);
  assertProductionGrantInventory(await inventory(db, userId, now));
  const result = await apply(db, userId, now);
  assert.deepEqual(result.map(item => item.meta.changes), [1, 1]);
  const grant = await db.prepare('SELECT role,expires_at-granted_at ttl FROM moderation_access_grants').first();
  assert.equal(grant.role, 'moderation_admin');
  assert.equal(grant.ttl, PRODUCTION_RBAC_TTL_SECONDS);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM moderation_role_events WHERE role='moderation_admin' AND action='grant'").first()).n, 1);
  db.close();
});

for (const condition of ['missing-assurance', 'revoked-assurance', 'mismatched-assurance', 'inactive-user', 'restricted-user', 'unsafe-age-hold']) {
  test(`eligibility fails closed for ${condition}`, async () => {
    const { db, userId, assuranceId, now } = await fixture();
    if (condition === 'missing-assurance') await db.prepare('DELETE FROM member_profiles WHERE user_id=?').bind(userId).run();
    if (condition === 'revoked-assurance') await db.prepare('UPDATE age_assurance_events SET revoked_at=? WHERE id=?').bind(now, assuranceId).run();
    if (condition === 'mismatched-assurance') {
      const otherUser = randomUUID(), otherAssurance = randomUUID();
      await db.prepare("INSERT INTO users(id,status,account_state,created_at,updated_at)VALUES(?,'active','active',?,?)").bind(otherUser, now, now).run();
      await db.prepare("INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at)VALUES(?,?,'adult_18_plus','self_declaration','v1',?)").bind(otherAssurance, otherUser, now).run();
      await db.prepare('UPDATE member_profiles SET age_assurance_id=? WHERE user_id=?').bind(otherAssurance, userId).run();
    }
    if (condition === 'inactive-user') await db.prepare("UPDATE users SET status='disabled' WHERE id=?").bind(userId).run();
    if (condition === 'restricted-user') await db.prepare("INSERT INTO beta_account_restrictions(id,user_id,status,reason,created_at)VALUES(?,?,'active','Local restriction fixture',?)").bind(randomUUID(), userId, now).run();
    if (condition === 'unsafe-age-hold') await db.prepare("INSERT INTO member_age_safety_holds(user_id,age_band,state,notice_version,declared_at,updated_at)VALUES(?,'18_19','held','v1',?,?)").bind(userId, now, now).run();
    const row = await eligibility(db, userId);
    assert.throws(() => assertProductionOwnerEligibility(row, userId));
    const results = await apply(db, userId, now);
    assert.deepEqual(results.map(item => item.meta.changes), [0, 0]);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM moderation_access_grants').first()).n, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM moderation_role_events').first()).n, 0);
    db.close();
  });
}

test('existing unrevoked moderation_admin blocks renewal and preserves other roles', async () => {
  const { db, userId, now } = await fixture();
  await db.prepare("INSERT INTO moderation_access_grants(id,user_id,role,grant_reason,granted_at,expires_at)VALUES(?,?,'moderation_admin','Existing local grant',?,?)").bind(randomUUID(), userId, now - 7200, now - 3600).run();
  await db.prepare("INSERT INTO moderation_access_grants(id,user_id,role,grant_reason,granted_at,expires_at)VALUES(?,?,'report_reviewer','Separate local role',?,?)").bind(randomUUID(), userId, now, now + 100).run();
  const existing = await inventory(db, userId, now);
  assert.throws(() => assertProductionGrantInventory(existing));
  const result = await apply(db, userId, now);
  assert.deepEqual(result.map(item => item.meta.changes), [0, 0]);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM moderation_access_grants WHERE role='report_reviewer'").first()).n, 1);
  db.close();
});
