// Retire only disposable deployment artifacts created in this NEW project during this workstream.
// No database/user/object deletion and no existing project is selectable.
import assert from 'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';import{execFileSync}from'node:child_process';
assert.equal(process.env.CHATGUN_FINAL_UAT,'approved');const s=JSON.parse(readFileSync('docs/final-uat/environment.json'));
assert.equal(s.project,'chatgun-final-uat');assert.equal(s.account,'23017b53386fb67fc62a52cdd017454c');assert.equal(s.syntheticEngineering.closed,true);
const{token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function cf(path,method='GET'){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+s.account+path,{method,headers:{authorization:'Bearer '+token}}),j=await r.json();assert.ok(r.ok&&j.success,'Scoped deployment retirement failed');return j.result;}
assert.equal((await cf('')).id,s.account);
const prefix='/pages/projects/'+s.project,all=await cf(prefix+'/deployments'),keep=new Set([s.deploymentId,s.syntheticEngineering.deploymentId]);
const scope=all.filter(d=>!keep.has(d.id));
for(const d of scope){assert.equal(d.environment,'preview');assert.equal(d.deployment_trigger.metadata.commit_hash,s.candidate);assert.ok(['uat','engineering'].includes(d.deployment_trigger.metadata.branch));assert.ok(Date.parse(d.created_on)>=Date.parse(s.createdAt));}
const proof={checkedAt:new Date().toISOString(),project:s.project,retained:[...keep],retired:[],dataChanges:0};
for(const d of scope){await cf(prefix+'/deployments/'+d.id+'?force=true','DELETE');proof.retired.push(d.id);}
assert.ok((await cf(prefix+'/deployments')).every(d=>keep.has(d.id)));
for(const origin of[s.origin,s.syntheticEngineering.origin]){const auth=await(await fetch(origin+'/api/auth/config')).json(),social=await(await fetch(origin+'/api/social/config')).json();assert.equal(auth.oauthLoginEnabled,false);assert.equal(social.socialAppEnabled,false);}
writeFileSync('docs/final-uat/deployment-retirement.json',JSON.stringify(proof,null,2)+'\n');console.log('Disposable intermediate deployments retired; both remaining aliases are closed. No user data changed.');
