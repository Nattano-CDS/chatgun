// Records the actual close only after live UAT flags are closed; stores no raw participant identifier or content.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FINAL_UAT_ACCOUNT, FINAL_UAT_DATABASE, FINAL_UAT_ORIGIN, PROPOSED_POLICY, validateFinalUatSocialApproval } from './lib/final-uat-social-campaign.mjs';
import { UAT_AUDIT_RETENTION_SECONDS, UAT_CAMPAIGN_AUDIT_TABLE_SQL } from '../functions/_lib/retention.js';

assert.equal(process.env.CHATGUN_FINAL_UAT_SOCIAL, 'record-actual-close');
const file = resolve(process.env.CHATGUN_UAT_PRIVATE_APPROVAL_FILE || '');
assert.ok(file.startsWith('/Users/nattano/.codex/private-backups/chatgun/'));
assert.equal(statSync(file).mode & 0o777, 0o600);
const receipt = JSON.parse(readFileSync(file, 'utf8'));
validateFinalUatSocialApproval(receipt);
const now = Math.floor(Date.now() / 1000);
const auth = await (await fetch(`${FINAL_UAT_ORIGIN}/api/auth/config`, { cache: 'no-store' })).json();
const social = await (await fetch(`${FINAL_UAT_ORIGIN}/api/social/config`, { cache: 'no-store' })).json();
assert.equal(auth.oauthLoginEnabled, false); assert.equal(auth.newAccountRegistrationEnabled, false); assert.equal(auth.invitationOnlyRegistrationEnabled, false);
for (const key of ['socialAppEnabled', 'publicDiscoveryEnabled', 'messagingEnabled', 'mediaUploadEnabled', 'onlineStatusEnabled']) assert.equal(social[key], false, `${key} must be closed first`);
const { token } = JSON.parse(execFileSync('npx', ['wrangler@4.151.1', 'auth', 'token', '--json'], { encoding: 'utf8' }));
async function cf(path, body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${FINAL_UAT_ACCOUNT}${path}`, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const json = await response.json(); assert.ok(response.ok && json.success, 'UAT close evidence request failed'); return json.result;
}
const query = async (sql, params = []) => (await cf(`/d1/database/${FINAL_UAT_DATABASE}/query`, { sql, params }))[0];
await query(UAT_CAMPAIGN_AUDIT_TABLE_SQL);
const cohort = (await query('SELECT participant_ref,user_id FROM uat_authorized_identities ORDER BY participant_ref')).results;
assert.deepEqual(cohort.map(row => row.participant_ref), ['A', 'B'], 'Explicit close requires the exact two-person cohort');
assert.ok(cohort.every(row => row.user_id), 'Both authorized participants must be enrolled before campaign close');
assert.equal((await query('SELECT COUNT(*) n FROM users')).results[0].n, 2, 'Refusing broad cleanup outside the isolated two-user UAT');
const expiresAt = now + UAT_AUDIT_RETENTION_SECONDS;
const minimized = { scope: receipt.scope, policyVersions: PROPOSED_POLICY.versions, policyFiles: PROPOSED_POLICY.files, window: receipt.window, closedAt: now, participantCount: 2, participants: receipt.participants.map(p => ({ reference: p.reference, provider: p.provider, eligibleAndConsented: true, accountDeletionConsent: p.reference === 'B' ? p.accountDeletionConsent : false })), mediaEnabled: false, productionWrites: 0 };
const evidenceSha256 = createHash('sha256').update(JSON.stringify(minimized)).digest('hex');
const campaignId = createHash('sha256').update(`always-on-private-uat\0${now}\0${evidenceSha256}`).digest('hex');
const inserted = await query('INSERT INTO uat_campaign_audit_evidence(campaign_id,closed_at,expires_at,evidence_sha256,policy_versions_json,policy_files_json,participant_count,participant_b_deletion_consent,created_at) VALUES(?,?,?,?,?,?,?,?,?)', [campaignId, now, expiresAt, evidenceSha256, JSON.stringify(PROPOSED_POLICY.versions), JSON.stringify(PROPOSED_POLICY.files), 2, receipt.participants[1].accountDeletionConsent ? 1 : 0, now]);
assert.equal(inserted.meta.changes, 1);
// Access is revoked immediately at explicit close. The isolated UAT contains only
// these two users, so disposable Social data can be removed immediately (within
// the promised seven-day maximum) while preserving both provider accounts.
for (const [sql, params = []] of [
  ["UPDATE beta_invitations SET status='revoked',revoked_at=COALESCE(revoked_at,?) WHERE status='active'", [now]],
  ["UPDATE beta_enrollments SET status='revoked',revoked_at=COALESCE(revoked_at,?) WHERE status<>'revoked'", [now]],
  ['UPDATE sessions SET revoked_at=COALESCE(revoked_at,?) WHERE revoked_at IS NULL', [now]],
  ['UPDATE uat_authorized_identities SET revoked_at=COALESCE(revoked_at,?) WHERE revoked_at IS NULL', [now]],
  ['DELETE FROM member_presence_leases'],
  ['DELETE FROM member_presence_preferences'],
  ['DELETE FROM proximity_ratings'],
  ['DELETE FROM social_messages'],
  ['DELETE FROM social_reports'],
  ['DELETE FROM social_blocks'],
  ['DELETE FROM social_relationships'],
  ['DELETE FROM chat_system_events'],
  ['DELETE FROM chat_preferences'],
  ['DELETE FROM chat_initiations'],
  ['DELETE FROM member_profiles'],
]) await query(sql, params);
assert.equal((await query('SELECT COUNT(*) n FROM sessions WHERE revoked_at IS NULL')).results[0].n, 0);
assert.equal((await query("SELECT COUNT(*) n FROM beta_enrollments WHERE status<>'revoked'")).results[0].n, 0);
assert.equal((await query('SELECT COUNT(*) n FROM uat_authorized_identities WHERE revoked_at IS NULL')).results[0].n, 0);
for (const table of ['member_presence_leases','member_presence_preferences','proximity_ratings','social_messages','social_reports','social_blocks','social_relationships','chat_system_events','chat_preferences','chat_initiations','member_profiles']) assert.equal((await query(`SELECT COUNT(*) n FROM ${table}`)).results[0].n, 0, `${table} logical cleanup failed`);
await query('DELETE FROM uat_authorized_identities WHERE revoked_at IS NOT NULL');
assert.equal((await query('SELECT COUNT(*) n FROM uat_authorized_identities')).results[0].n, 0, 'Private allowlist hashes must be removed at close');
receipt.operations.actualCampaignClosedAt = new Date(now * 1000).toISOString();
receipt.operations.auditEvidenceExpiresAt = new Date(expiresAt * 1000).toISOString();
writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 }); chmodSync(file, 0o600);
console.log(JSON.stringify({ status: 'ACTUAL_CLOSE_RECORDED_AND_LOGICALLY_CLEANED', closedAt: receipt.operations.actualCampaignClosedAt, auditEvidenceExpiresAt: receipt.operations.auditEvidenceExpiresAt, accessRevoked: true, socialDataRemoved: true, participantAAccountDeleted: false, participantBDeletionRequiresSeparateConfirmedAccountDeletionFlow: true, retainedEvidence: 'minimized-digest-and-policy-proof', rawAccountReferencesStored: false, chatOrLocationStored: false, productionWrites: 0 }));
