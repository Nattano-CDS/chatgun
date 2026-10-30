import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROPOSED_POLICY, finalUatSocialVars, sanitizedCampaignSummary, validateFinalUatSocialApproval } from './lib/final-uat-social-campaign.mjs';

const file = resolve(process.env.CHATGUN_UAT_PRIVATE_APPROVAL_FILE || '');
assert.ok(file.startsWith((()=>{const root=process.env.CHATGUN_PRIVATE_ROOT;if(!root)throw new Error('CHATGUN_PRIVATE_ROOT is required');return root;})()+'/'), 'Private approval must stay in the protected ChatGun directory');
const receipt = validateFinalUatSocialApproval(JSON.parse(readFileSync(file, 'utf8')));
for (const [name, digest] of Object.entries(PROPOSED_POLICY.files)) assert.equal(createHash('sha256').update(readFileSync(name)).digest('hex'), digest, `Policy artifact changed: ${name}`);
const vars = finalUatSocialVars(receipt);
console.log(JSON.stringify({ status: 'READY_FOR_SCHEDULED_ACTIVATION', summary: sanitizedCampaignSummary(receipt), flags: vars }, null, 2));
