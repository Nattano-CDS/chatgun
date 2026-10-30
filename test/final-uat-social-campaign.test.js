import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { finalUatSocialVars, hashAndRemovePrivateIdentityReferences, PROPOSED_POLICY, sanitizedCampaignSummary, validateFinalUatSocialApproval } from '../scripts/lib/final-uat-social-campaign.mjs';

function receipt() {
  const identity=(reference,provider,hash)=>({reference,provider,providerAccountReferencePrivate:'',providerAccountReferenceSha256:hash,operatorControlConfirmed:true,providerTesterEligible:true,uatUseAuthorized:true,mediaConsentUsed:false,chatgunUatIdentityDeletionAuthorized:reference==='B'});
  return {scope:'final-uat-single-operator-dual-account-always-on-private',ownerAuthorizationComment:6473803567,policyApproved:true,applicationSha:'c'.repeat(40),policyVersions:PROPOSED_POLICY.versions,policyFiles:PROPOSED_POLICY.files,operations:{moderationCoverage:'19:00-22:00 Asia/Bangkok daily',no24x7OrBackupModeratorClaim:true,participantAccess:'24x7-until-explicit-owner-close-or-safety-kill-switch',accessRestrictedToModerationHours:false,automatic2200Shutdown:false,mediaEnabled:false,publicRegistrationEnabled:false,youthAdmissionEnabled:false,productionChangesAuthorized:false,retentionDecision:'campaign-plus-7-days-logical-cleanup-with-recovery-caveat',recoveryCaveatAcknowledged:true,auditEvidenceRetentionDays:90,auditEvidenceRetentionStartsAt:'actual-campaign-close',auditEvidenceScope:'strictly-necessary-minimized-security-audit-only',auditEvidencePhysicalBackupLimitClaimed:false,actualCampaignClosedAt:null,auditEvidenceExpiresAt:null,humanOperatorCount:1,authorizedIdentityCount:2,functionalE2EClassification:'single-operator-dual-account-not-independent-two-human-uat',externalProviderAccountDeletionAuthorized:false,productionLineIdentityDeletionAuthorized:false},window:{timezone:'Asia/Bangkok',start:'2026-10-29T19:00:00+07:00',end:'2026-10-29T22:00:00+07:00'},operator:{reference:'owner',singleHumanOperatorConfirmed:true,age20PlusConfirmed:true,dualDeviceControlConfirmed:true,controlsAllAuthorizedIdentitiesConfirmed:true,socialScopeConsent:true,locationScopeConsent:true,chatScopeConsent:true,presenceScopeConsent:true,privacyScopeConsent:true,disposableTestDataConsent:true,alwaysOnAccessConsent:true,outOfHoursModerationAcknowledged:true},identities:[identity('A','line','a'.repeat(64)),identity('B','google','b'.repeat(64))]};
}

test('single-operator dual-account UAT enables only the approved private functional scope',()=>{
  const approved=receipt(),vars=finalUatSocialVars(approved),summary=sanitizedCampaignSummary(approved);
  assert.equal(vars.OAUTH_ENABLED_PROVIDERS,'google,line');
  for(const key of ['OAUTH_LOGIN_ENABLED','BETA_INVITATION_REGISTRATION_ENABLED','ACCEPTANCE_FLOW_ENABLED','ADULT_ONBOARDING_ENABLED','SOCIAL_APP_ENABLED','PUBLIC_DISCOVERY_ENABLED','MESSAGING_ENABLED','PRESENCE_ENABLED'])assert.equal(vars[key],'true',key);
  for(const key of ['NEW_ACCOUNT_REGISTRATION_ENABLED','MEDIA_UPLOAD_ENABLED','MODERATION_TOOLS_ENABLED','ACCOUNT_MODERATION_ENABLED','SENSITIVE_CONTENT_ENABLED','EMAIL_OTP_ENABLED','MOBILE_OTP_ENABLED','IDENTITY_VERIFICATION_ENABLED','DEMO_MODE_ENABLED'])assert.equal(vars[key],'false',key);
  assert.equal(summary.operatorCount,1);assert.equal(summary.identities.length,2);assert.equal(summary.humanEvidenceClassification,'single-operator-dual-account-functional-e2e');
  assert.ok(!JSON.stringify(summary).includes('a'.repeat(64))&&!JSON.stringify(summary).includes('b'.repeat(64)));
});

test('approval rejects the superseded two-human model, third identity, mismatches and unsafe flags',()=>{
  const base=receipt();
  for(const changed of [{...base,policyApproved:false},{...base,participants:[{genuineDistinctAdultConfirmed:true}]},{...base,operator:{...base.operator,singleHumanOperatorConfirmed:false}},{...base,operator:{...base.operator,controlsAllAuthorizedIdentitiesConfirmed:null}},{...base,identities:[...base.identities,{...base.identities[1],reference:'C'}]},{...base,identities:[base.identities[0],{...base.identities[1],provider:'line'}]},{...base,identities:[base.identities[0],{...base.identities[1],providerAccountReferenceSha256:base.identities[0].providerAccountReferenceSha256}]},{...base,identities:[{...base.identities[0],operatorControlConfirmed:null},base.identities[1]]},{...base,identities:[base.identities[0],{...base.identities[1],chatgunUatIdentityDeletionAuthorized:null}]},{...base,operations:{...base.operations,mediaEnabled:true}},{...base,operations:{...base.operations,publicRegistrationEnabled:true}},{...base,operations:{...base.operations,productionChangesAuthorized:true}},{...base,operations:{...base.operations,humanOperatorCount:2}}])assert.throws(()=>validateFinalUatSocialApproval(changed));
  assert.doesNotMatch(JSON.stringify(base),/genuineDistinctAdultConfirmed|individualConsentConfirmed|accountDeletionConsent/u);
});

test('campaign executors remain isolated, exact-head, two-identity and Media-off',()=>{
  const activate=readFileSync('scripts/activate-final-uat-social.mjs','utf8'),issue=readFileSync('scripts/issue-final-uat-invitations.mjs','utf8');
  for(const pattern of [/receipt\.applicationSha/u,/mediaUploadEnabled, false/u,/productionWrites: 0/u,/wrangler\.final-uat-privacy-cleanup\.jsonc/u,/UAT_CAMPAIGN_AUDIT_TABLE_SQL/u])assert.match(activate,pattern);
  for(const pattern of [/randomBytes\(32\)/u,/issuedAt \+ 1800/u,/Refusing duplicate invitation issuance/u,/identity-a-line/u,/identity-b-google/u])assert.match(issue,pattern);
  assert.doesNotMatch(issue,/chatgun-auth|9738a051|chatgun\.social/u);
});

test('private finalizer hashes two owner-controlled identity references and removes plaintext atomically',()=>{
  const privateReceipt=receipt();
  for(const [index,value] of ['private-a@example.test','private-b@example.test'].entries()){privateReceipt.identities[index].providerAccountReferenceSha256=null;privateReceipt.identities[index].providerAccountReferencePrivate=value}
  const finalized=hashAndRemovePrivateIdentityReferences(privateReceipt);
  assert.deepEqual(finalized.identities.map(identity=>identity.providerAccountReferencePrivate),['','']);
  assert.ok(finalized.identities.every(identity=>/^[a-f0-9]{64}$/u.test(identity.providerAccountReferenceSha256)));
  assert.equal(new Set(finalized.identities.map(identity=>identity.providerAccountReferenceSha256)).size,2);
  assert.doesNotMatch(JSON.stringify(finalized),/private-[ab]@example\.test/u);
});
