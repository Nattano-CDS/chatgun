// New UAT front-door only. Does not grant any ChatGun D1 role or modify organization settings.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
assert.equal(process.env.CHATGUN_FINAL_UAT,'approved');
const s=JSON.parse(readFileSync('docs/final-uat/environment.json'));
assert.equal(s.account,'23017b53386fb67fc62a52cdd017454c');assert.equal(s.project,'chatgun-final-uat');
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
const proof={checkedAt:new Date().toISOString(),host:new URL(s.origin).hostname,roleGrantsIssued:0,organizationChanges:0,genuineMfa:'NOT RUN',checks:[]};
async function request(path,body){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+s.account+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();
 proof.checks.push({path,status:r.status,success:j.success,errorCodes:j.errors?.map(e=>e.code)});
 if(!r.ok||!j.success)throw new Error('Scoped Access API rejected '+r.status);return j.result;
}
try{
 assert.equal((await request('')).id,s.account);
 const apps=await request('/access/apps');let app=apps.find(a=>a.name==='ChatGun Final UAT Admin');
 if(!app)app=await request('/access/apps',{
  name:'ChatGun Final UAT Admin',type:'self_hosted',domain:proof.host+'/app/moderation',session_duration:'10m',app_launcher_visible:false,
  destinations:[{type:'public',uri:proof.host+'/app/moderation*'},{type:'public',uri:proof.host+'/api/admin/*'}],
  mfa_config:{mfa_disabled:false,allowed_authenticators:['totp'],session_duration:'0m'},
  policies:[{name:'Confirmed owner only; MFA required',decision:'allow',precedence:1,include:[{email:{email:'natttano@outlook.com'}}],require:[{auth_method:{auth_method:'mfa'}}],exclude:[]}]
 });
 const verified=await request('/access/apps/'+app.id);
 proof.application={id:verified.id,aud:verified.aud,domain:verified.domain,destinations:verified.destinations,mfa_config:verified.mfa_config,session_duration:verified.session_duration};
 const policies=await request('/access/apps/'+app.id+'/policies');
 proof.policies=policies.map(p=>({name:p.name,decision:p.decision,require:p.require,ownerEmailOnly:p.include?.length===1&&p.include[0]?.email?.email==='natttano@outlook.com'}));
 proof.identityProviders=(await request('/access/identity_providers')).map(p=>({id:p.id,type:p.type,name:p.name}));
 proof.status='BLOCKED';proof.remaining='Front-door config requires live challenge verification, MFA enrollment, exact authenticated UAT subject/user mapping and separately authorized least-privilege D1 grant. No Admin access is activated.';
}catch(e){proof.status='BLOCKED';proof.remaining=e.message+'; finish the dedicated UAT application/policy in ChatGun Zero Trust. No account-wide changes or role grants made.';}
writeFileSync('docs/final-uat/access-verification.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({status:proof.status,applicationCreated:Boolean(proof.application),checks:proof.checks,roleGrantsIssued:0}));
