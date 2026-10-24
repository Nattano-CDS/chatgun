// Genuine consenting owner only, after live approved LINE pilot checks.
// No identities/users/sessions are fabricated. Never prints a token or URL.
import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,statSync} from 'node:fs';import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {approvedOwnerPilot} from './lib/owner-pilot-release.mjs';
if(process.env.CHATGUN_OWNER_PARTICIPANT_CONFIRMED!=='consenting-owner-line-admin-age20plus')throw Error('Human owner/channel-role/adult eligibility confirmation required; nothing issued');
approvedOwnerPilot();process.umask(0o077);
const account='23017b53386fb67fc62a52cdd017454c',db='9738a051-d914-42d0-8e7b-8098ef2b959d',file='/Users/nattano/.codex/private-backups/chatgun/owner-pilot-invitation-20261020.json';
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function api(path,body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.ok(r.ok&&j.success,'Scoped owner invitation request failed');return j.result;}
const project=await api('/pages/projects/chatgun'),env=project.deployment_configs.production;
assert.equal(env.d1_databases.DB.id,db);assert.equal(env.env_vars.NEW_ACCOUNT_REGISTRATION_ENABLED.value,'false');assert.equal(env.env_vars.OAUTH_ENABLED_PROVIDERS.value,'line');assert.equal(env.env_vars.BETA_INVITATION_REGISTRATION_ENABLED.value,'true');
const auth=await(await fetch('https://chatgun.social/api/auth/config')).json();assert.equal(auth.oauthLoginEnabled,true);assert.deepEqual(auth.oauthProviders,['line']);
const run=(sql,params)=>(api('/d1/database/'+db+'/query',{sql,params}));
const now=Math.floor(Date.now()/1000);let privateRecord;
if(existsSync(file)){assert.equal(statSync(file).mode&0o777,0o600);privateRecord=JSON.parse(readFileSync(file));assert.equal(privateRecord.database,db);}
else{const code=randomBytes(32).toString('base64url');privateRecord={database:db,id:randomUUID(),code,url:'https://chatgun.social/signup#invite='+code,createdAt:now,expiresAt:now+1800,scope:'single consenting owner, self-declared age20plus, actual LINE Admin/Tester; no independent age verification'};writeFileSync(file,JSON.stringify(privateRecord),{mode:0o600,flag:'wx'});}
const digest=createHash('sha256').update(privateRecord.code).digest('base64url');
const existing=(await run('SELECT status,use_count,expires_at FROM beta_invitations WHERE token_hash=?',[digest]))[0].results[0];
if(existing){assert.equal(existing.status,'active');assert.equal(existing.use_count,0,'Invitation consumed; use ordinary login, do not create another account');assert.ok(existing.expires_at>now,'Invitation expired; inspect before replacement');}
else{assert.ok(privateRecord.expiresAt>now);await run('INSERT INTO beta_invitations(id,token_hash,label,max_uses,expires_at,created_at) VALUES(?,?,?,1,?,?)',[privateRecord.id,digest,'approved-owner-pilot-20261020',privateRecord.expiresAt,privateRecord.createdAt]);}
writeFileSync('/tmp/chatgun-owner-invitation-path',file,{mode:0o600});
writeFileSync('docs/production-pilot-20261020/invitation-summary.json',JSON.stringify({issuedAt:new Date().toISOString(),singleUse:true,ttlSeconds:1800,scope:'Human-confirmed consenting owner and LINE role; self-declared age20plus',independentAgeVerification:false,delivery:'Protected local file; fragment scrubbed by signup; never GitHub/log/chat',realAccountsCreatedByIssuer:0,publicRegistration:false,credentialsExposed:false},null,2)+'\n');
console.log('Single-use owner invitation prepared securely; no URL, token, identity or user record printed.');
