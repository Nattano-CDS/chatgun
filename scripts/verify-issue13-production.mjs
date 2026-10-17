import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const origin='https://chatgun.social',sha=process.env.EXPECTED_SHA;
if(!/^[a-f0-9]{40}$/.test(sha||''))throw Error('Exact deployed SHA required');
const hash=b=>createHash('sha256').update(b).digest('hex');
const release=await(await fetch(origin+'/release.json',{cache:'no-store'})).json();assert.equal(release.commit,sha);
const assets=[];
for(const file of ['app/index.html','app/social.js','app/demo-network.js','app/near-components.js','app/near-components.css','auth-nav.js','assets/demo/network.json']){
  const response=await fetch(origin+'/'+file+'?verify='+sha,{cache:'no-store'});assert.equal(response.status,200,file);
  const actual=Buffer.from(await response.arrayBuffer()),expected=execFileSync('git',['show',sha+':'+file]);
  assert.equal(hash(actual),hash(expected),file);assets.push({file,sha256:hash(actual),matchesCommit:true});
}
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
const p=await(await fetch('https://api.cloudflare.com/client/v4/accounts/23017b53386fb67fc62a52cdd017454c/pages/projects/chatgun',{headers:{Authorization:`Bearer ${token}`}})).json();assert.equal(p.success,true);
const deployment=p.result.canonical_deployment;assert.equal(deployment.deployment_trigger.metadata.commit_hash,sha);assert.equal(deployment.latest_stage.status,'success');
const result={checkedAt:new Date().toISOString(),origin,commit:sha,deploymentId:deployment.id,status:'PASS',assets};
writeFileSync('docs/issue-13/production-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
