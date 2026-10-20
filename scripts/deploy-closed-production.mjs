// Explicitly authorized closed frontend recovery only; no migrations, R2 or billing changes.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,cpSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assertProductionMediaBinding} from './lib/production-media-binding.mjs';
if(process.env.CHATGUN_DEPLOY_APPROVED!=='closed-prelaunch')throw Error('Explicit closed-prelaunch deployment acknowledgement required');
const account='23017b53386fb67fc62a52cdd017454c',sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
execFileSync('git',['diff','--exit-code','HEAD','--','app','assets','functions','scripts','test','_headers','_redirects','_routes.json','wrangler.jsonc'],{stdio:'pipe'});
const release=JSON.parse(readFileSync('dist/release.json'));assert.equal(release.commit,sha);assert.equal(release.staticPrelaunch,true);assert.equal(release.fictionalDemoEnabled,false);
const evidenceDirectory=process.env.CLOSED_RELEASE_EVIDENCE_DIR||'docs/issue-16/recovery';
for(const stage of ['local','preview']){const t=JSON.parse(readFileSync(`${evidenceDirectory}/${stage}-static-tests.json`));assert.equal(t.commit,sha);assert.equal(t.failed,0);assert.ok(t.passed>=35);}
const cfg=JSON.parse(readFileSync('wrangler.jsonc')),production=cfg.env.production;
assert.equal(production.d1_databases[0].database_id,'9738a051-d914-42d0-8e7b-8098ef2b959d');
assert.deepEqual(production.r2_buckets,[{binding:'MEDIA',bucket_name:'chatgun-media-production'}]);
for(const name of ['OAUTH_LOGIN_ENABLED','SOCIAL_APP_ENABLED','NEW_ACCOUNT_REGISTRATION_ENABLED','MEDIA_UPLOAD_ENABLED','MODERATION_TOOLS_ENABLED','SENSITIVE_CONTENT_ENABLED','MESSAGING_ENABLED','PUBLIC_DISCOVERY_ENABLED','PRESENCE_ENABLED','DEMO_MODE_ENABLED','DEMO_AUTO_START_ENABLED'])assert.equal(production.vars[name],'false',name);
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/chatgun`,{headers:{Authorization:`Bearer ${token}`}}),j=await r.json();assert.ok(r.ok&&j.success);const project=j.result;
assert.equal(project.source.config.production_branch,'main');assert.equal(project.deployment_configs.production.d1_databases.DB.id,production.d1_databases[0].database_id);assertProductionMediaBinding(project.deployment_configs.production.r2_buckets,'private-bound');
for(const [name,value] of Object.entries(project.deployment_configs.production.env_vars))if(value.type==='plain_text'&&name.endsWith('_ENABLED')&&!['DEMO_MODE_ENABLED','DEMO_AUTO_START_ENABLED'].includes(name))assert.equal(production.vars[name],value.value,'Unexpected live flag change: '+name);
assert.equal(project.deployment_configs.preview.d1_databases.DB.id,'5bbfd55d-eb22-4324-8a7d-57bef14110ea');assert.equal(project.deployment_configs.preview.r2_buckets.MEDIA.name,'chatgun-media-staging');
const directory=mkdtempSync(join(tmpdir(),'chatgun-closed-production-'));chmodSync(directory,0o700);
const publicCheck=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/chatgun-media-production/domains/managed`,{headers:{Authorization:`Bearer ${token}`}});const managed=await publicCheck.json();assert.ok(managed.success&&managed.result.enabled===false);
cpSync('dist',join(directory,'dist'),{recursive:true});cpSync('functions',join(directory,'functions'),{recursive:true});
// Do not carry the top-level staging bindings into a Production deployment cwd.
// Pages accepts the account via CLOUDFLARE_ACCOUNT_ID, not an account_id config key.
const deployConfig={name:'chatgun',pages_build_output_dir:'dist',compatibility_date:cfg.compatibility_date,...production};
writeFileSync(join(directory,'wrangler.jsonc'),JSON.stringify(deployConfig,null,2),{mode:0o600});
writeFileSync('/tmp/chatgun-closed-production-package-path',directory,{mode:0o600});
writeFileSync(evidenceDirectory+'/release-authorization.json',JSON.stringify({checkedAt:new Date().toISOString(),account,sha,releaseMode:'closed-prelaunch',productionBranch:'main',gitMerge:false,realServicesEnabled:false,productionD1Migrations:'separately authorized/executed; not performed by this deploy script',productionR2:'preserve authorized private MEDIA binding',privateRollbackPackage:'protected outside Git; exact validated closed build and functions, never old demo',priorDeployment:project.canonical_deployment.id},null,2)+'\n');
execFileSync('npx',['wrangler@4.151.1','pages','deploy','dist','--project-name=chatgun','--branch=main',`--commit-hash=${sha}`,'--commit-dirty=true'],{cwd:directory,env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'inherit'});
