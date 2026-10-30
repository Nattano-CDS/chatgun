import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const origin='https://chatgun.social',checks=[];
// The new health route can only be required after the candidate is deployed.
const paths=['/api/social/config','/api/auth/config'];
if(process.argv.includes('--post-deploy'))paths.push('/api/health');
for(const path of paths){
  const r=await fetch(origin+path,{cache:'no-store',redirect:'manual'});
  const json=r.headers.get('content-type')?.includes('application/json');
  let payload;try{if(json)payload=await r.json();}catch{}
  checks.push({path,status:r.status,json:Boolean(json),valid:r.status===200&&Boolean(payload),...(path==='/api/social/config'&&payload?{onlineStatusEnabled:payload.onlineStatusEnabled,socialAppEnabled:payload.socialAppEnabled}: {})});
}
const ready=checks.every(check=>check.valid);
writeFileSync('docs/issue-16/production-api-gate.json',JSON.stringify({checkedAt:new Date().toISOString(),origin,ready,checks,productionDeploymentAuthorizedByThisScript:false},null,2)+'\n');
assert.ok(ready,'Production deployment blocked: Functions JSON API health has not passed');
console.log('API availability gate passed; separate infrastructure/security checks are still required.');
