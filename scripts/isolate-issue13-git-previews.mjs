// Narrowly exclude this branch from the legacy project; use its isolated project instead.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const account='23017b53386fb67fc62a52cdd017454c',branch='codex/issue-13-direct-chat-albums';
if(process.env.CHATGUN_ISOLATED_STAGING!=='issue13')throw Error('Explicit staging acknowledgement required');
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function api(method,body){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/chatgun`,{method,headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok||!d.success)throw Error('Scoped Pages branch configuration failed '+r.status);return d.result;}
const before=await api('GET');assert.equal(before.source.type,'github');assert.equal(before.source.config.production_branch,'main');
const config={...before.source.config};
if(config.preview_deployment_setting==='all'){config.preview_deployment_setting='custom';config.preview_branch_includes=['*'];}
if(config.preview_deployment_setting==='none')throw Error('Do not broaden disabled preview builds');
config.preview_branch_excludes=[...new Set([...(config.preview_branch_excludes||[]),branch])];
await api('PATCH',{source:{type:before.source.type,config}});
const after=await api('GET');assert.deepEqual(after.deployment_configs,before.deployment_configs);assert.equal(after.source.config.production_branch,before.source.config.production_branch);assert.equal(after.source.config.production_deployments_enabled,before.source.config.production_deployments_enabled);assert.ok(after.source.config.preview_branch_excludes.includes(branch));
const evidence={account,project:'chatgun',excludedBranch:branch,previewSetting:after.source.config.preview_deployment_setting,previewIncludes:after.source.config.preview_branch_includes,previewExcludes:after.source.config.preview_branch_excludes,productionConfigurationUnchanged:true,allExistingD1R2BindingsUnchanged:true,isolatedPreview:'https://issue13.chatgun-issue13-staging.pages.dev'};
writeFileSync('docs/issue-13/git-preview-isolation.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
