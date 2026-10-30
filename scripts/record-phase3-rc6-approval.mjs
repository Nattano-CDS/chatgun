import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { RC6_POLICY, validateFinalUatRc6Approval } from './lib/final-uat-rc6.mjs';

assert.equal(process.env.CHATGUN_RC6_APPROVAL, 'record-exact-owner-approval');
const path = resolve(process.env.CHATGUN_UAT_PRIVATE_APPROVAL_FILE || '');
assert.equal(path, (()=>{const root=process.env.CHATGUN_PRIVATE_ROOT;if(!root)throw new Error('CHATGUN_PRIVATE_ROOT is required');return root;})()+'/final-uat-social-handoff-20261028.json');
const approvalText = 'I approve all four corrected exact rc6a versions and SHA-256 hashes listed above for isolated private UAT only, including mutual-friend state processing for my owner-controlled LINE A and Google B identities.';
const receipt = JSON.parse(readFileSync(path, 'utf8'));
assert.equal(receipt.identities?.length, 2);
assert.ok(receipt.identities.every(identity => !identity.providerAccountReferencePrivate));
receipt.applicationSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
receipt.policyVersions = RC6_POLICY.versions;
receipt.policyFiles = RC6_POLICY.files;
receipt.operator.mutualFriendsConsent = true;
receipt.rc6Approval = {
  scope: 'isolated-private-uat-only', bothOwnerControlledIdentities: true,
  approvedAt: new Date().toISOString(), approvalTextSha256: createHash('sha256').update(approvalText).digest('hex'),
};
validateFinalUatRc6Approval(receipt);
const backup = `${path}.pre-rc6-${Date.now()}`;
copyFileSync(path, backup); chmodSync(backup, 0o600);
const temp = `${path}.tmp-rc6`;
writeFileSync(temp, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
renameSync(temp, path); chmodSync(path, 0o600); chmodSync(dirname(path), 0o700);
console.log(JSON.stringify({ status: 'RECORDED', applicationSha: receipt.applicationSha, policyVersions: receipt.policyVersions, privateReferencesPlaintext: false, permissions: '0600' }));
