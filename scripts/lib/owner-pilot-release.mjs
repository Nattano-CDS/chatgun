import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function approvedOwnerPilot(root='.',now=Date.now()){
  const approval=JSON.parse(readFileSync(root+'/policy-release.json'));
  assert.equal(approval.scope,'line-owner-pilot');assert.equal(approval.ownerApproved,true);assert.equal(approval.qualifiedReviewConfirmedByOwner,true);
  assert.equal(approval.timezone,'Asia/Bangkok');assert.match(approval.effectiveDate,/^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Date.parse(approval.effectiveDate+'T00:00:00+07:00')<=now,'Approved effective date is in the future');
  assert.deepEqual(Object.keys(approval.files).sort(),['beta-notice.html','data-deletion.html','privacy.html','terms.html']);
  for(const [file,digest] of Object.entries(approval.files))assert.equal(createHash('sha256').update(readFileSync(root+'/'+file)).digest('hex'),digest,'Approved legal text changed: '+file);
  for(const name of ['adultNotice','terms','privacy','beta']){assert.ok(approval.versions[name]);assert.doesNotMatch(approval.versions[name],/pending|draft|unapproved|tbd/i);}
  return approval;
}
export function ownerPilotVars(approval,{ownerAdmin=false}={}){
  return {OAUTH_LOGIN_ENABLED:'true',OAUTH_ENABLED_PROVIDERS:'line',LINE_EXPECTED_CLIENT_ID:'2012039306',LINE_EMAIL_ENABLED:'false',NEW_ACCOUNT_REGISTRATION_ENABLED:'false',BETA_INVITATION_REGISTRATION_ENABLED:'true',ACCEPTANCE_FLOW_ENABLED:'true',ADULT_ONBOARDING_ENABLED:'true',SOCIAL_APP_ENABLED:'true',ADULT_NOTICE_VERSION:approval.versions.adultNotice,TERMS_VERSION:approval.versions.terms,PRIVACY_VERSION:approval.versions.privacy,PUBLIC_DISCOVERY_ENABLED:'false',MESSAGING_ENABLED:'false',MEDIA_UPLOAD_ENABLED:'false',MEDIA_QUARANTINE_ENABLED:'true',MODERATION_TOOLS_ENABLED:ownerAdmin?'true':'false',ACCOUNT_MODERATION_ENABLED:'false',PRESENCE_ENABLED:'false',RATINGS_ENABLED:'false',SENSITIVE_CONTENT_ENABLED:'false',EMAIL_OTP_ENABLED:'false',MOBILE_OTP_ENABLED:'false',IDENTITY_VERIFICATION_ENABLED:'false',DEMO_MODE_ENABLED:'false',DEMO_AUTO_START_ENABLED:'false',PUBLIC_DEMO_CANARY_ENABLED:'false',FRIEND_REQUESTS_ENABLED:'false'};
}
