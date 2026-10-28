// Hashes private provider references and atomically removes their plaintext only after every gate validates.
import assert from 'node:assert/strict';
import { chmodSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { hashAndRemovePrivateParticipantReferences, sanitizedCampaignSummary } from './lib/final-uat-social-campaign.mjs';

assert.equal(process.env.CHATGUN_FINAL_UAT_HANDOFF, 'hash-and-validate');
const file = resolve(process.env.CHATGUN_UAT_PRIVATE_APPROVAL_FILE || '');
assert.ok(file.startsWith('/Users/nattano/.codex/private-backups/chatgun/'));
assert.equal(statSync(file).mode & 0o777, 0o600);
const finalized = hashAndRemovePrivateParticipantReferences(JSON.parse(readFileSync(file, 'utf8')));
const temporary = join(dirname(file), `.${process.pid}-final-uat-handoff.tmp`);
writeFileSync(temporary, JSON.stringify(finalized, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
chmodSync(temporary, 0o600);
renameSync(temporary, file);
assert.equal(statSync(file).mode & 0o777, 0o600);
console.log(JSON.stringify({ status: 'VALIDATED_PRIVATE_REFERENCES_HASHED_PLAINTEXT_REMOVED', summary: sanitizedCampaignSummary(finalized), mode: '0600' }));
