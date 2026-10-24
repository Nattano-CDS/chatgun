// Bounded read-only readiness and fail-closed probes. No identity, token, session
// or authorization transaction is generated; never enables Production OAuth.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assertProductionMediaBinding} from './lib/production-media-binding.mjs';
const account='23017b53386fb67fc62a52cdd017454c',origin='https://chatgun.social';
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
const backupDirectory=readFileSync('/tmp/chatgun-beta-backup-path','utf8').trim();
assert.ok(backupDirectory.startsWith('/Users/nattano/.codex/private-backups/chatgun/production-beta-'));
const output=process.env.BETA_EVIDENCE_DIR||'docs/line-verification';
const recordedBackup=JSON.parse(readFileSync((process.env.BETA_EVIDENCE_DIR||'docs/beta-activation')+'/backup-rehearsal.json'));
assert.equal(createHash('sha256').update(readFileSync(backupDirectory+'/production.sql')).digest('hex'),recordedBackup.backupSha256);
assert.equal(statSync(backupDirectory).mode&0o777,0o700);assert.equal(statSync(backupDirectory+'/production.sql').mode&0o777,0o600);
const recovery=JSON.parse(execFileSync('npx',['wrangler@4.151.1','d1','time-travel','info','chatgun-auth','--env','production','--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.ok(recovery.bookmark,'An actual recovery bookmark is required');
writeFileSync(backupDirectory+'/line-time-travel.json',JSON.stringify(recovery),{mode:0o600});
async function cf(path){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{headers:{Authorization:`Bearer ${token}`}});const j=await r.json();assert.ok(r.ok&&j.success,'Scoped read-only metadata check failed');return j.result;}
const project=await cf('/pages/projects/chatgun'),prod=project.deployment_configs.production,preview=project.deployment_configs.preview;
assert.equal(prod.d1_databases.DB.id,'9738a051-d914-42d0-8e7b-8098ef2b959d');
assert.equal(preview.d1_databases.DB.id,'5bbfd55d-eb22-4324-8a7d-57bef14110ea');
assertProductionMediaBinding(prod.r2_buckets);
const flags={};for(const name of ['OAUTH_LOGIN_ENABLED','NEW_ACCOUNT_REGISTRATION_ENABLED','BETA_INVITATION_REGISTRATION_ENABLED','SOCIAL_APP_ENABLED','MESSAGING_ENABLED','MEDIA_UPLOAD_ENABLED','PRESENCE_ENABLED','LINE_EMAIL_ENABLED','SENSITIVE_CONTENT_ENABLED']){flags[name]=prod.env_vars[name]?.value;assert.equal(flags[name],'false',name);}
const checks=[];
// A single malformed, non-personal token probes only LINE's rejection behavior.
// It is not an authorization code, real identity, credential-pair or login test.
const rejection=await fetch('https://api.line.me/oauth2/v2.1/verify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({id_token:'invalid-negative-test-not-a-real-token',client_id:'2012039306',nonce:'negative-probe'})});
assert.equal(rejection.status,400);
assert.match(rejection.headers.get('content-type'),/application\/json/);
checks.push({name:'Actual LINE verification endpoint rejects a malformed non-personal token',status:'PASS',httpStatus:400,scope:'Negative endpoint probe only; not a genuine OAuth or signature-success test'});
for(const path of ['/api/health','/api/auth/config','/api/social/config']){
  const r=await fetch(origin+path,{redirect:'manual',cache:'no-store'});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/application\/json/);const payload=await r.json();
  if(path==='/api/auth/config')assert.equal(payload.oauthLoginEnabled,false);
  checks.push({path,status:200,json:true});
}
const start=await fetch(origin+'/api/auth/oauth/line/start',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}',redirect:'manual'});
assert.equal(start.status,503);assert.equal((await start.json()).code,'oauth_unavailable');
assert.equal(start.headers.has('set-cookie'),false);checks.push({name:'Production LINE start stays closed before Turnstile or account writes',status:'PASS',httpStatus:503});
for(const query of ['', '?state=invalid&code=invalid']){
  const r=await fetch(origin+'/api/auth/oauth/line/callback'+query,{redirect:'manual'});
  assert.equal(r.status,303);assert.match(r.headers.get('location'),/oauth_unavailable/);
  checks.push({name:query?'Untrusted callback cannot bypass disabled provider':'Missing-state callback cannot bypass disabled provider',status:'PASS',httpStatus:303,scope:'Provider gate only; NOT state validation evidence'});
}
const live=await(await fetch(origin+'/release.json',{cache:'no-store'})).json();
assert.equal(live.commit,process.env.EXPECTED_PRODUCTION_SHA||'6c824ab0ecf5e70f414e7d34d74b7abe7bae3a8c');assert.equal(live.staticPrelaunch,true);assert.equal(live.fictionalDemoEnabled,false);
const managed=await cf('/r2/buckets/chatgun-media-production/domains/managed'),custom=await cf('/r2/buckets/chatgun-media-production/domains/custom');
assert.equal(managed.enabled,false);assert.equal((custom.domains||[]).filter(d=>d.enabled).length,0);
const evidence={checkedAt:new Date().toISOString(),account,productionSha:live.commit,checks,flags,providerAllowlistConfigured:prod.env_vars.OAUTH_ENABLED_PROVIDERS!==undefined,globalProviderGateClosed:true,credentialMetadata:{lineClientIdPresent:Boolean(prod.env_vars.LINE_CLIENT_ID),lineSecretEncrypted:prod.env_vars.LINE_CLIENT_SECRET?.type==='secret_text',clientIdExactMatch:'BLOCKED: encrypted value not retrievable through Pages metadata',secretPairVerified:'BLOCKED: requires approved genuine token exchange; metadata is not credential validation'},backup:{digestVerified:true,permissionsVerified:true,sha256:recordedBackup.backupSha256,currentRecoveryBookmarkAvailable:true,bookmarkRecordedPrivately:true,restoreExecuted:false},productionMediaBound:prod.r2_buckets?.MEDIA?.name==='chatgun-media-production',publicR2DevEnabled:false,publicR2CustomDomains:0,productionD1Writes:0,providerMutation:false,realOAuth:'BLOCKED before authorization initiation by explicit Production gate',scope:'Read-only metadata plus closed API probes; no real identity or session generated'};
mkdirSync(output,{recursive:true});writeFileSync(output+'/production-gates.json',JSON.stringify(evidence,null,2)+'\n');console.log('Production JSON APIs, disabled LINE initiation, isolation and expected private R2 configuration verified.');
