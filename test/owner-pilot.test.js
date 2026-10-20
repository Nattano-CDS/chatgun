import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';
import {approvedOwnerPilot,ownerPilotVars} from '../scripts/lib/owner-pilot-release.mjs';
test('controlled owner pilot requires recorded owner/reviewer confirmation, exact legal hashes and effective date',()=>{
  const receipt=approvedOwnerPilot('.',Date.parse('2026-10-20T01:00:00Z'));assert.equal(receipt.scope,'line-owner-pilot');
  const folder=mkdtempSync(tmpdir()+'/chatgun-policy-guard-');
  try{for(const file of Object.keys(receipt.files))copyFileSync(file,folder+'/'+file);
    for(const patch of [{ownerApproved:false},{qualifiedReviewConfirmedByOwner:false},{effectiveDate:'2099-01-01'},{scope:'public-launch'}]){
      writeFileSync(folder+'/policy-release.json',JSON.stringify({...receipt,...patch}));assert.throws(()=>approvedOwnerPilot(folder));
    }
    writeFileSync(folder+'/policy-release.json',JSON.stringify(receipt));writeFileSync(folder+'/privacy.html','unapproved changed text');assert.throws(()=>approvedOwnerPilot(folder),/Approved legal text changed/);
  }finally{rmSync(folder,{recursive:true});}
});
test('LINE-only pilot permits onboarding but never discovery/chat/media/moderation/presence or public signup',()=>{
  const vars=ownerPilotVars(approvedOwnerPilot());assert.equal(vars.OAUTH_ENABLED_PROVIDERS,'line');assert.equal(vars.BETA_INVITATION_REGISTRATION_ENABLED,'true');assert.equal(vars.ACCEPTANCE_FLOW_ENABLED,'true');
  for(const key of ['NEW_ACCOUNT_REGISTRATION_ENABLED','LINE_EMAIL_ENABLED','PUBLIC_DISCOVERY_ENABLED','MESSAGING_ENABLED','MEDIA_UPLOAD_ENABLED','MODERATION_TOOLS_ENABLED','PRESENCE_ENABLED','SENSITIVE_CONTENT_ENABLED','EMAIL_OTP_ENABLED','MOBILE_OTP_ENABLED','IDENTITY_VERIFICATION_ENABLED','DEMO_MODE_ENABLED'])assert.equal(vars[key],'false');
  assert.equal(vars.MEDIA_QUARANTINE_ENABLED,'true');assert.doesNotMatch(JSON.stringify(vars),/pending-owner-approval/);
});
