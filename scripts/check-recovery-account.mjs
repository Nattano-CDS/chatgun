// Read-only account/usage diagnostics; never prints credential values.
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const account='23017b53386fb67fc62a52cdd017454c';
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
const headers={Authorization:`Bearer ${token}`,'content-type':'application/json'};
const now=new Date(),start=new Date(now);start.setUTCHours(0,0,0,0);
const query=`query($account:String!,$start:Time!,$end:Time!){viewer{accounts(filter:{accountTag:$account}){workersInvocationsAdaptive(limit:100,filter:{datetime_geq:$start,datetime_leq:$end},orderBy:[sum_requests_DESC]){dimensions{scriptName status}sum{requests errors}}}}}`;
const graphql=await(await fetch('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers,body:JSON.stringify({query,variables:{account,start:start.toISOString(),end:now.toISOString()}})})).json();
const usage=graphql.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive;
const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/chatgun`,{headers}),j=await r.json();assert.ok(r.ok&&j.success);
const project=j.result;assert.equal(project.account_id||account,account);
const apis=[];for(const origin of ['https://chatgun.social','https://issue13.chatgun-issue13-staging.pages.dev'])for(const path of ['/api/social/config','/api/auth/config']){const response=await fetch(origin+path,{cache:'no-store'});apis.push({origin,path,status:response.status,json:response.headers.get('content-type')?.includes('application/json')===true});}
const result={checkedAt:now.toISOString(),account,windowStart:start.toISOString(),usageIsAdaptiveEstimate:true,usage:usage||null,usageErrors:graphql.errors?.map(e=>e.message)||[],currentApis:apis,currently1046Observed:apis.some(a=>a.status===429),pagesProductionBranch:project.source?.config?.production_branch,liveDeployment:project.canonical_deployment.id,liveSha:project.canonical_deployment.deployment_trigger.metadata.commit_hash,billingChanged:false,exactPlanEntitlement:'Not inferred from adaptive counts; owner billing review required if limit recurs'};
writeFileSync('docs/issue-16/recovery/account-usage.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
