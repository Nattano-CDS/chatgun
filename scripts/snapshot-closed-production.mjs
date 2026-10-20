// SELECT/GET only. Counts, schema and binding fingerprints, no personal records.
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {assertProductionMediaBinding} from './lib/production-media-binding.mjs';
const account='23017b53386fb67fc62a52cdd017454c',db='9738a051-d914-42d0-8e7b-8098ef2b959d';
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function api(path,body){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.ok(r.ok&&j.success,JSON.stringify(j.errors?.map(e=>({code:e.code,message:e.message}))));return j.result;}
async function select(sql){const r=await api(`/d1/database/${db}/query`,{sql});assert.equal(r[0].meta.changed_db,false);return r[0].results;}
const project=await api('/pages/projects/chatgun'),prod=project.deployment_configs.production,preview=project.deployment_configs.preview;
assert.equal(prod.d1_databases.DB.id,db);assert.equal(preview.d1_databases.DB.id,'5bbfd55d-eb22-4324-8a7d-57bef14110ea');assertProductionMediaBinding(prod.r2_buckets);
const names=await select("SELECT name,type,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY type,name");
const tables=names.filter(n=>n.type==='table'),counts=[];
// Scalar subqueries avoid D1's restricted compound-SELECT allowance.
for(let i=0;i<tables.length;i+=10){const group=tables.slice(i,i+10);const [row]=await select('SELECT '+group.map((n,index)=>`(SELECT COUNT(*) FROM "${n.name.replaceAll('"','""')}") AS c${index}`).join(','));counts.push(...group.map((n,index)=>({name:n.name,count:row['c'+index]})));}
const flags=Object.fromEntries(Object.entries(prod.env_vars).filter(([key,value])=>key.endsWith('_ENABLED')&&value.type==='plain_text').map(([key,value])=>[key,value.value]));
for(const key of ['OAUTH_LOGIN_ENABLED','SOCIAL_APP_ENABLED','NEW_ACCOUNT_REGISTRATION_ENABLED','MEDIA_UPLOAD_ENABLED','MODERATION_TOOLS_ENABLED','SENSITIVE_CONTENT_ENABLED','MESSAGING_ENABLED','PUBLIC_DISCOVERY_ENABLED'])assert.equal(flags[key],'false',key);
const domains=await api('/pages/projects/chatgun/domains');assert.equal(domains.find(d=>d.name==='chatgun.social')?.status,'active');
const result={checkedAt:new Date().toISOString(),account,database:db,counts,schemaSha256:createHash('sha256').update(JSON.stringify(names)).digest('hex'),foreignKeyViolations:(await select('SELECT COUNT(*) count FROM pragma_foreign_key_check'))[0].count,flags,productionD1:prod.d1_databases,productionR2:prod.r2_buckets||{},previewD1:preview.d1_databases,previewR2:preview.r2_buckets,secretNames:Object.entries(prod.env_vars).filter(([,value])=>value.type==='secret_text').map(([key])=>key).sort(),customDomain:'active',deployment:project.canonical_deployment.id,sha:project.canonical_deployment.deployment_trigger.metadata.commit_hash,productionWrites:0};
writeFileSync(process.argv[2]||'docs/issue-16/recovery/production-before.json',JSON.stringify(result,null,2)+'\n');console.log('Production schema, aggregate counts, closed gates and isolated bindings verified read-only.');
