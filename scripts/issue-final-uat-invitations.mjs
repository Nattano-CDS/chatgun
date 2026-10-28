// Issues exactly two 30-minute initial-enrollment invitations for the approved always-on private cohort.
// Raw tokens are written once to a protected local file and are never printed.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { FINAL_UAT_ACCOUNT, FINAL_UAT_DATABASE, FINAL_UAT_ORIGIN, finalUatSocialVars, validateFinalUatSocialApproval } from './lib/final-uat-social-campaign.mjs';

assert.equal(process.env.CHATGUN_FINAL_UAT_INVITATIONS, 'approved-always-on-initial-enrollment');
const approvalFile = resolve(process.env.CHATGUN_UAT_PRIVATE_APPROVAL_FILE || '');
const output = resolve(process.env.CHATGUN_UAT_PRIVATE_INVITATION_FILE || '');
assert.ok(approvalFile.startsWith('/Users/nattano/.codex/private-backups/chatgun/'));
assert.ok(output.startsWith('/Users/nattano/.codex/private-backups/chatgun/'));
const receipt = validateFinalUatSocialApproval(JSON.parse(readFileSync(approvalFile, 'utf8')));
const vars = finalUatSocialVars(receipt);
const nowMs = Date.now();

const { token } = JSON.parse(execFileSync('npx', ['wrangler@4.151.1', 'auth', 'token', '--json'], { encoding: 'utf8' }));
async function cf(path, body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${FINAL_UAT_ACCOUNT}${path}`, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const json = await response.json();
  assert.ok(response.ok && json.success, 'Scoped UAT invitation request failed');
  return json.result;
}
const project = await cf('/pages/projects/chatgun-final-uat');
assert.equal(project.deployment_configs.preview.d1_databases.DB.id, FINAL_UAT_DATABASE);
const current = Object.fromEntries(Object.entries(project.deployment_configs.preview.env_vars || {}).map(([key, value]) => [key, value.value]));
for (const [key, value] of Object.entries(vars)) assert.equal(current[key], value, `UAT flag not active: ${key}`);
const query = async (sql, params = []) => (await cf(`/d1/database/${FINAL_UAT_DATABASE}/query`, { sql, params }))[0];
assert.equal((await query('SELECT COUNT(*) n FROM users')).results[0].n, 0, 'Invitations require the empty pre-campaign cohort');
assert.equal((await query('SELECT COUNT(*) n FROM beta_invitations')).results[0].n, 0, 'Refusing duplicate invitation issuance');
const issuedAt = Math.floor(nowMs / 1000), expiresAt = issuedAt + 1800;
const invitations = receipt.participants.map(participant => {
  const code = randomBytes(32).toString('base64url');
  return { reference: participant.reference, id: randomUUID(), code, tokenHash: createHash('sha256').update(code).digest('base64url'), expiresAt };
});
mkdirSync(dirname(output), { recursive: true });
assert.equal(existsSync(output), false, 'Refusing to overwrite an invitation handoff');
const sql = "INSERT INTO beta_invitations(id,token_hash,label,max_uses,use_count,expires_at,created_at,uat_participant_ref,uat_required_provider,uat_account_reference_sha256) VALUES(?,?,'participant-a',1,0,?,?, 'A',?,?),(?,?,'participant-b',1,0,?,?, 'B',?,?)";
const params = [invitations[0].id, invitations[0].tokenHash, expiresAt, issuedAt, receipt.participants[0].provider, receipt.participants[0].providerAccountReferenceSha256, invitations[1].id, invitations[1].tokenHash, expiresAt, issuedAt, receipt.participants[1].provider, receipt.participants[1].providerAccountReferenceSha256];
const result = await query(sql, params);
assert.equal(result.meta.changes, 2);
for (let index = 0; index < invitations.length; index += 1) {
  const linked = await query('UPDATE uat_authorized_identities SET invitation_id=? WHERE participant_ref=? AND provider=? AND account_reference_sha256=? AND user_id IS NULL AND revoked_at IS NULL', [invitations[index].id, receipt.participants[index].reference, receipt.participants[index].provider, receipt.participants[index].providerAccountReferenceSha256]);
  assert.equal(linked.meta.changes, 1);
}
try {
  writeFileSync(output, JSON.stringify({ origin: FINAL_UAT_ORIGIN, issuedAt, expiresAt, invitations: invitations.map(i => ({ reference: i.reference, id: i.id, url: `${FINAL_UAT_ORIGIN}/signup.html#invite=${i.code}` })) }, null, 2), { flag: 'wx', mode: 0o600 });
  chmodSync(output, 0o600);
} catch (error) {
  await query("UPDATE beta_invitations SET status='revoked',revoked_at=? WHERE id IN (?,?)", [Math.floor(Date.now() / 1000), invitations[0].id, invitations[1].id]);
  throw error;
}
console.log(JSON.stringify({ status: 'ISSUED', count: 2, expiresAt, outputProtected: true, rawTokensPrinted: false }));
