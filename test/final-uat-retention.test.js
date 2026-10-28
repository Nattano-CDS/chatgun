import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanupUatCampaignAuditEvidence, UAT_AUDIT_RETENTION_SECONDS } from '../functions/_lib/retention.js';
import { TestD1 } from './helpers/d1.js';

const config = { UAT_AUDIT_RETENTION_DAYS: '90', UAT_AUDIT_RETENTION_START_MODE: 'actual-campaign-close' };

test('UAT audit evidence expires exactly 90 days after actual campaign closure', async () => {
  const db = new TestD1();
  db.database.exec(`CREATE TABLE uat_campaign_audit_evidence(
    campaign_id TEXT PRIMARY KEY, closed_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    evidence_sha256 TEXT NOT NULL, CHECK(expires_at=closed_at+${UAT_AUDIT_RETENTION_SECONDS})
  )`);
  const closedAt = 1_800_000_000, expiresAt = closedAt + UAT_AUDIT_RETENTION_SECONDS;
  db.database.prepare('INSERT INTO uat_campaign_audit_evidence VALUES(?,?,?,?)').run('campaign', closedAt, expiresAt, 'a'.repeat(64));
  assert.deepEqual(await cleanupUatCampaignAuditEvidence(db, expiresAt - 1, config), { configured: true, tablePresent: true, deleted: 0 });
  assert.equal(db.database.prepare('SELECT COUNT(*) n FROM uat_campaign_audit_evidence').get().n, 1);
  assert.deepEqual(await cleanupUatCampaignAuditEvidence(db, expiresAt, config), { configured: true, tablePresent: true, deleted: 1 });
  assert.equal(db.database.prepare('SELECT COUNT(*) n FROM uat_campaign_audit_evidence').get().n, 0);
  db.close();
});

test('UAT audit cleanup is optional elsewhere and fails closed on altered retention', async () => {
  const db = new TestD1();
  assert.deepEqual(await cleanupUatCampaignAuditEvidence(db, 1, {}), { configured: false, tablePresent: false, deleted: 0 });
  assert.deepEqual(await cleanupUatCampaignAuditEvidence(db, 1, config), { configured: true, tablePresent: false, deleted: 0 });
  await assert.rejects(cleanupUatCampaignAuditEvidence(db, 1, { ...config, UAT_AUDIT_RETENTION_DAYS: '91' }), /invalid_uat_audit_retention_configuration/u);
  await assert.rejects(cleanupUatCampaignAuditEvidence(db, 1, { ...config, UAT_AUDIT_RETENTION_START_MODE: 'scheduled-window-end' }), /invalid_uat_audit_retention_configuration/u);
  db.close();
});
