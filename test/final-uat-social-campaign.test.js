import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { finalUatSocialVars, hashAndRemovePrivateParticipantReferences, PROPOSED_POLICY, sanitizedCampaignSummary, validateFinalUatSocialApproval } from '../scripts/lib/final-uat-social-campaign.mjs';

function receipt() {
  const participant = (reference, provider, hash) => ({ reference, provider, providerAccountReferencePrivate: '', providerAccountReferenceSha256: hash, genuineDistinctAdultConfirmed: true, age20PlusConfirmed: true, individualConsentConfirmed: true, providerTesterEligible: true, socialScopeConsent: true, locationScopeConsent: true, chatScopeConsent: true, presenceScopeConsent: true, privacyScopeConsent: true, disposableTestDataConsent: true, mediaConsentUsed: false, accountDeletionConsent: reference === 'B' });
  return {
    scope: 'final-uat-social-location-chat-privacy', ownerAuthorizationComment: 6470727761, policyApproved: true,
    policyVersions: PROPOSED_POLICY.versions, policyFiles: PROPOSED_POLICY.files,
    operations: { moderationCoverage: '19:00-22:00 Asia/Bangkok daily', no24x7OrBackupModeratorClaim: true, mediaEnabled: false, publicRegistrationEnabled: false, youthAdmissionEnabled: false, productionChangesAuthorized: false, retentionDecision: 'campaign-plus-7-days-logical-cleanup-with-recovery-caveat', recoveryCaveatAcknowledged: true, auditEvidenceRetentionDays: 90, auditEvidenceRetentionStartsAt: 'actual-campaign-close', auditEvidenceScope: 'strictly-necessary-minimized-security-audit-only', auditEvidencePhysicalBackupLimitClaimed: false, actualCampaignClosedAt: null, auditEvidenceExpiresAt: null, ownerAccountDeletionAuthorized: false },
    window: { timezone: 'Asia/Bangkok', start: '2026-10-29T19:00:00+07:00', end: '2026-10-29T22:00:00+07:00' },
    participants: [participant('A', 'line', 'a'.repeat(64)), participant('B', 'google', 'b'.repeat(64))],
  };
}

test('approved two-adult UAT scope enables only Social Location Chat and Privacy', () => {
  const vars = finalUatSocialVars(receipt());
  assert.equal(vars.OAUTH_ENABLED_PROVIDERS, 'google,line');
  for (const key of ['OAUTH_LOGIN_ENABLED', 'BETA_INVITATION_REGISTRATION_ENABLED', 'ACCEPTANCE_FLOW_ENABLED', 'ADULT_ONBOARDING_ENABLED', 'SOCIAL_APP_ENABLED', 'PUBLIC_DISCOVERY_ENABLED', 'MESSAGING_ENABLED', 'PRESENCE_ENABLED']) assert.equal(vars[key], 'true', key);
  for (const key of ['NEW_ACCOUNT_REGISTRATION_ENABLED', 'MEDIA_UPLOAD_ENABLED', 'MODERATION_TOOLS_ENABLED', 'ACCOUNT_MODERATION_ENABLED', 'SENSITIVE_CONTENT_ENABLED', 'EMAIL_OTP_ENABLED', 'MOBILE_OTP_ENABLED', 'IDENTITY_VERIFICATION_ENABLED', 'DEMO_MODE_ENABLED']) assert.equal(vars[key], 'false', key);
  const summary = sanitizedCampaignSummary(receipt());
  assert.equal(vars.UAT_AUDIT_RETENTION_DAYS, '90');
  assert.equal(vars.UAT_AUDIT_RETENTION_START_MODE, 'actual-campaign-close');
  assert.ok(!JSON.stringify(summary).includes('a'.repeat(64)) && !JSON.stringify(summary).includes('b'.repeat(64)));
});

test('UAT gate rejects missing policy approval, duplicate people, media, public/youth/Production and out-of-coverage windows', () => {
  const base = receipt();
  for (const changed of [
    { ...base, policyApproved: false },
    { ...base, participants: [base.participants[0], { ...base.participants[1], providerAccountReferenceSha256: base.participants[0].providerAccountReferenceSha256 }] },
    { ...base, operations: { ...base.operations, mediaEnabled: true } },
    { ...base, operations: { ...base.operations, publicRegistrationEnabled: true } },
    { ...base, operations: { ...base.operations, youthAdmissionEnabled: true } },
    { ...base, operations: { ...base.operations, productionChangesAuthorized: true } },
    { ...base, operations: { ...base.operations, auditEvidenceRetentionDays: 91 } },
    { ...base, operations: { ...base.operations, auditEvidenceRetentionStartsAt: base.window.end } },
    { ...base, operations: { ...base.operations, actualCampaignClosedAt: base.window.end } },
    { ...base, participants: [{ ...base.participants[0], presenceScopeConsent: null }, base.participants[1]] },
    { ...base, window: { timezone: 'Asia/Bangkok', start: '2026-10-29T18:00:00+07:00', end: '2026-10-29T20:00:00+07:00' } },
  ]) assert.throws(() => validateFinalUatSocialApproval(changed));
});

test('campaign executors remain UAT-only, time-bounded, hashed and Media-off', () => {
  const activate = readFileSync('scripts/activate-final-uat-social.mjs', 'utf8');
  const issue = readFileSync('scripts/issue-final-uat-invitations.mjs', 'utf8');
  assert.match(activate, /FINAL_UAT_APPLICATION_SHA/u);
  assert.match(activate, /mediaUploadEnabled, false/u);
  assert.match(activate, /productionWrites: 0/u);
  assert.match(activate, /prepare-final-uat\.mjs deploy/u);
  assert.match(activate, /wrangler\.final-uat-privacy-cleanup\.jsonc/u);
  assert.match(activate, /UAT_CAMPAIGN_AUDIT_TABLE_SQL/u);
  assert.match(issue, /randomBytes\(32\)/u);
  assert.match(issue, /createHash\('sha256'\)/u);
  assert.match(issue, /issuedAt \+ 1800/u);
  assert.match(issue, /max_uses,use_count/u);
  assert.match(issue, /Refusing duplicate invitation issuance/u);
  assert.doesNotMatch(issue, /chatgun-auth|9738a051|chatgun\.social/u);
});

test('authorized private finalizer hashes distinct provider references and removes plaintext atomically', () => {
  const privateReceipt = receipt();
  privateReceipt.participants[0].providerAccountReferenceSha256 = null;
  privateReceipt.participants[1].providerAccountReferenceSha256 = null;
  privateReceipt.participants[0].providerAccountReferencePrivate = 'private-a@example.test';
  privateReceipt.participants[1].providerAccountReferencePrivate = 'private-b@example.test';
  const finalized = hashAndRemovePrivateParticipantReferences(privateReceipt);
  assert.deepEqual(finalized.participants.map(p => p.providerAccountReferencePrivate), ['', '']);
  assert.ok(finalized.participants.every(p => /^[a-f0-9]{64}$/u.test(p.providerAccountReferenceSha256)));
  assert.equal(new Set(finalized.participants.map(p => p.providerAccountReferenceSha256)).size, 2);
  assert.doesNotMatch(JSON.stringify(finalized), /private-[ab]@example\.test/u);
});
