import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';
import {approvedOwnerPilot,ownerPilotVars} from '../scripts/lib/owner-pilot-release.mjs';
import {execFileSync} from 'node:child_process';
import {providerConfiguration} from '../functions/_lib/oauth.js';
import {onRequest} from '../functions/api/auth/[[path]].js';
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
test('owner pilot pins the intended LINE channel before authorization and reveals only a boolean diagnostic',async()=>{
  const env={LINE_CLIENT_ID:'unit-channel',LINE_CLIENT_SECRET:'unit-secret',LINE_EXPECTED_CLIENT_ID:'unit-channel',OAUTH_LOGIN_ENABLED:'true',OAUTH_ENABLED_PROVIDERS:'line'};
  assert.equal(providerConfiguration('line',env).clientId,'unit-channel');
  assert.throws(()=>providerConfiguration('line',{...env,LINE_CLIENT_ID:'different-channel'}),/line_channel_mismatch/);
  const r=await onRequest({env,request:new Request('https://chatgun.social/api/auth/config')}),body=await r.json();assert.equal(body.lineChannelMatchesExpected,true);assert.ok(!JSON.stringify(body).includes('unit-channel')&&!JSON.stringify(body).includes('unit-secret'));
});
test('approved public policy pages opt out of edge email rewriting without changing authorization headers',()=>{
  const headers=readFileSync('_headers','utf8');
  for(const path of ['/privacy*','/terms*','/data-deletion*','/beta-notice*','/canary-notice*'])assert.ok(headers.includes(path+'\n  Cache-Control: no-cache, no-transform'));
  assert.match(headers,/Content-Security-Policy: default-src 'self'/);assert.match(headers,/X-Frame-Options: DENY/);
});
test('Production invitation issuer refuses to act before specific human eligibility confirmation',()=>{
  assert.throws(()=>execFileSync(process.execPath,['scripts/issue-production-owner-invitation.mjs'],{env:{...process.env,CHATGUN_OWNER_PARTICIPANT_CONFIRMED:''},stdio:'pipe'}),error=>error.stderr.toString().includes('Human owner/channel-role/adult eligibility confirmation required'));
});
test('LINE-only pilot permits onboarding but never discovery/chat/media/moderation/presence or public signup',()=>{
  const vars=ownerPilotVars(approvedOwnerPilot());assert.equal(vars.OAUTH_ENABLED_PROVIDERS,'line');assert.equal(vars.BETA_INVITATION_REGISTRATION_ENABLED,'true');assert.equal(vars.ACCEPTANCE_FLOW_ENABLED,'true');
  for(const key of ['NEW_ACCOUNT_REGISTRATION_ENABLED','LINE_EMAIL_ENABLED','PUBLIC_DISCOVERY_ENABLED','MESSAGING_ENABLED','MEDIA_UPLOAD_ENABLED','MODERATION_TOOLS_ENABLED','PRESENCE_ENABLED','SENSITIVE_CONTENT_ENABLED','EMAIL_OTP_ENABLED','MOBILE_OTP_ENABLED','IDENTITY_VERIFICATION_ENABLED','DEMO_MODE_ENABLED'])assert.equal(vars[key],'false');
  assert.equal(vars.MEDIA_QUARANTINE_ENABLED,'true');assert.doesNotMatch(JSON.stringify(vars),/pending-owner-approval/);
});
