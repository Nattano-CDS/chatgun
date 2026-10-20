// Explicit owner authorization + owner-reported qualified policy approval required.
import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,cpSync,chmodSync,existsSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {approvedOwnerPilot,ownerPilotVars} from './lib/owner-pilot-release.mjs';
import {ownerAdminScope} from './lib/owner-admin-bootstrap.mjs';
if(process.env.CHATGUN_DEPLOY_APPROVED!=='line-owner-pilot')throw Error('Explicit LINE owner pilot deployment required');
const receipt=approvedOwnerPilot(),account='23017b53386fb67fc62a52cdd017454c',db='9738a051-d914-42d0-8e7b-8098ef2b959d',out='docs/production-pilot-20261020';
const ownerAdmin=ownerAdminScope(),targetVars=ownerPilotVars(receipt,{ownerAdmin});
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
execFileSync('git',['diff','--exit-code','HEAD','--','app','assets','functions','scripts','test','wrangler.jsonc','policy-release.json','privacy.html','terms.html','data-deletion.html','beta-notice.html','acceptance.html'],{stdio:'pipe'});
const release=JSON.parse(readFileSync('dist/release.json'));assert.equal(release.commit,sha);assert.equal(release.releaseMode,'controlled-beta');
const tested=JSON.parse(readFileSync(out+'/preview-pilot-checks.json'));assert.equal(tested.commit,sha);assert.equal(tested.failed,0);
const ci=JSON.parse(readFileSync(out+'/pilot-ci.json'));assert.equal(ci.headSha,sha);assert.equal(ci.conclusion,'success');
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function api(path,body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.ok(r.ok&&j.success,'Scoped pilot preflight failed');return j.result;}
assert.equal((await api('')).id,account);const project=await api('/pages/projects/chatgun'),prod=project.deployment_configs.production;
assert.equal(prod.d1_databases.DB.id,db);assert.deepEqual(prod.r2_buckets,{MEDIA:{name:'chatgun-media-production'}});assert.equal(prod.env_vars.NEW_ACCOUNT_REGISTRATION_ENABLED.value,'false');
if(prod.env_vars.OAUTH_LOGIN_ENABLED.value==='true'){
  for(const [key,value]of Object.entries(ownerPilotVars(receipt))){
    if(key==='ACCOUNT_MODERATION_ENABLED'&&prod.env_vars[key]===undefined)continue; // Additive closed gate; migration16 stays isolated.
    if(key==='MODERATION_TOOLS_ENABLED'&&ownerAdmin&&prod.env_vars[key]?.value==='true')continue;
    if(key==='LINE_EXPECTED_CLIENT_ID'&&prod.env_vars[key]===undefined)continue; // Additive runtime channel pin, not a wider service flag.
    assert.equal(prod.env_vars[key]?.value,value,'Unexpected pilot flag before corrected redeployment: '+key);
  }
}else assert.equal(prod.env_vars.OAUTH_LOGIN_ENABLED.value,'false');
assert.equal(project.deployment_configs.preview.d1_databases.DB.id,'5bbfd55d-eb22-4324-8a7d-57bef14110ea');assert.equal(project.deployment_configs.preview.r2_buckets.MEDIA.name,'chatgun-media-staging');
assert.equal((await api('/r2/buckets/chatgun-media-production/domains/managed')).enabled,false);assert.equal(((await api('/r2/buckets/chatgun-media-production/domains/custom')).domains||[]).filter(d=>d.enabled).length,0);
const query=async sql=>(await api('/d1/database/'+db+'/query',{sql}))[0].results;
if(ownerAdmin){
  const approval=JSON.parse(readFileSync('/Users/nattano/.codex/private-backups/chatgun/owner-admin-approval-20261020.json'));
  const result=(await api('/d1/database/'+db+'/query',{sql:'SELECT role,expires_at FROM moderation_access_grants WHERE user_id=? AND revoked_at IS NULL AND expires_at>unixepoch() ORDER BY role',params:[approval.userId]}))[0].results;
  assert.deepEqual(result.map(r=>r.role),approval.roles);assert.ok(result.every(r=>r.expires_at===approval.expiresAt));
}
const history=await query('SELECT name FROM d1_migrations ORDER BY id');assert.equal(history.length,15);assert.equal(history.at(-1).name,'0015_authenticated_online_presence.sql');assert.equal((await query('SELECT COUNT(*) n FROM pragma_foreign_key_check'))[0].n,0);
const prior=readFileSync('/tmp/chatgun-closed-production-package-path','utf8').trim();assert.ok(prior.startsWith(tmpdir()+'/chatgun-closed-production-'));
if(existsSync('/tmp/chatgun-owner-pilot-package-path')){const path=readFileSync('/tmp/chatgun-owner-pilot-package-path','utf8').trim();assert.ok(path.startsWith(tmpdir()+'/chatgun-owner-pilot-'));if(JSON.parse(readFileSync(path+'/dist/release.json')).commit===project.canonical_deployment.deployment_trigger.metadata.commit_hash){const copy=mkdtempSync('/Users/nattano/.codex/private-backups/chatgun/last-safe-owner-pilot-');cpSync(path,copy,{recursive:true});writeFileSync('/tmp/chatgun-last-safe-owner-pilot-path',copy,{mode:0o600});}}
const rollback=mkdtempSync('/Users/nattano/.codex/private-backups/chatgun/closed-prepilot-');chmodSync(rollback,0o700);cpSync(prior,rollback,{recursive:true});writeFileSync('/tmp/chatgun-owner-pilot-rollback-path',rollback,{mode:0o600});
const base=JSON.parse(readFileSync('wrangler.jsonc')),vars={...base.env.production.vars,...targetVars},cfg={name:'chatgun',pages_build_output_dir:'dist',compatibility_date:base.compatibility_date,...base.env.production,vars};
const directory=mkdtempSync(join(tmpdir(),'chatgun-owner-pilot-'));chmodSync(directory,0o700);cpSync('dist',join(directory,'dist'),{recursive:true});cpSync('functions',join(directory,'functions'),{recursive:true});writeFileSync(join(directory,'wrangler.jsonc'),JSON.stringify(cfg,null,2),{mode:0o600});writeFileSync('/tmp/chatgun-owner-pilot-package-path',directory,{mode:0o600});
writeFileSync(out+'/pilot-authorization.json',JSON.stringify({checkedAt:new Date().toISOString(),account,sha,scope:'line-owner-pilot',policyVersions:receipt.versions,effectiveDate:receipt.effectiveDate,qualifiedReview:'Owner confirmed completion; no independent compliance certification by agent',vars,priorDeployment:project.canonical_deployment.id,priorSha:project.canonical_deployment.deployment_trigger.metadata.commit_hash,rollback:'Protected durable closed-prepilot package, preserve DB/R2, no schema rollback',rolesGranted:0,publicRegistration:false,realInvitationsIssuedByDeployment:0},null,2)+'\n');
execFileSync('npx',['wrangler@4.151.1','pages','deploy','dist','--project-name=chatgun','--branch=main','--commit-hash='+sha,'--commit-dirty=true'],{cwd:directory,env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'inherit'});
