// Production GET/SELECT and stateless denial probes. No personal identifiers emitted.
import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync,writeFileSync} from 'node:fs';
import {approvedOwnerPilot,ownerPilotVars} from './lib/owner-pilot-release.mjs';
import {ownerAdminScope} from './lib/owner-admin-bootstrap.mjs';
const ownerAdmin=ownerAdminScope();
const account='23017b53386fb67fc62a52cdd017454c',db='9738a051-d914-42d0-8e7b-8098ef2b959d',out='docs/production-pilot-20261020',expected=process.env.EXPECTED_PRODUCTION_SHA;
assert.match(expected||'',/^[a-f0-9]{40}$/);
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function api(path,body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.ok(r.ok&&j.success,'Scoped read-only verification failed');return j.result;}
const select=async sql=>{const r=(await api('/d1/database/'+db+'/query',{sql}))[0];assert.equal(r.meta.changed_db,false);return r.results;};
const project=await api('/pages/projects/chatgun'),prod=project.deployment_configs.production;
assert.equal(prod.d1_databases.DB.id,db);assert.deepEqual(prod.r2_buckets,{MEDIA:{name:'chatgun-media-production'}});
for(const[key,value]of Object.entries(ownerPilotVars(approvedOwnerPilot(),{ownerAdmin})))assert.equal(prod.env_vars[key]?.value,value,key);
assert.equal(project.deployment_configs.preview.d1_databases.DB.id,'5bbfd55d-eb22-4324-8a7d-57bef14110ea');assert.equal(project.deployment_configs.preview.r2_buckets.MEDIA.name,'chatgun-media-staging');
const baseline=JSON.parse(readFileSync(out+'/production-before-deployment.json'));
const secretNames=Object.entries(prod.env_vars).filter(([,v])=>v.type==='secret_text').map(([k])=>k).sort();assert.deepEqual(secretNames,baseline.secretNames);
const release=await(await fetch('https://chatgun.social/release.json',{cache:'no-store'})).json();assert.equal(release.commit,expected);assert.equal(project.canonical_deployment.deployment_trigger.metadata.commit_hash,expected);assert.equal(release.releaseMode,'controlled-beta');
const history=await select('SELECT name FROM d1_migrations ORDER BY id');assert.ok([15,17].includes(history.length));assert.equal(history.at(-1).name,history.length===17?'0017_delivery_and_review_claims.sql':'0015_authenticated_online_presence.sql');
const fk=(await select('SELECT COUNT(*) n FROM pragma_foreign_key_check'))[0].n;assert.equal(fk,0);
const counts={};for(const table of ['users','identities','sessions','account_acceptances','member_profiles','beta_invitations','beta_enrollments','moderation_roles','social_messages','social_media'])counts[table]=(await select('SELECT COUNT(*) n FROM '+table))[0].n;
const mismatch=(await select('SELECT COUNT(*) n FROM identities i LEFT JOIN users u ON u.id=i.user_id WHERE u.id IS NULL'))[0].n;assert.equal(mismatch,0);
assert.equal((await api('/r2/buckets/chatgun-media-production/domains/managed')).enabled,false);assert.equal(((await api('/r2/buckets/chatgun-media-production/domains/custom')).domains||[]).filter(d=>d.enabled).length,0);
const denied=[];for(const path of ['/api/social/gallery?album=private','/api/social/media/negative-test','/api/social/online','/api/social/discovery','/api/social/messages','/api/social/moderation']){const r=await fetch('https://chatgun.social'+path);assert.ok([401,403,404,503].includes(r.status),path);denied.push({path,status:r.status});}
const result={checkedAt:new Date().toISOString(),account,productionSha:expected,deployment:project.canonical_deployment.id,productionD1:db,migrationCount:history.length,foreignKeyViolations:fk,counts,identityUserMismatches:mismatch,productionMedia:{binding:'MEDIA',bucket:'chatgun-media-production',publicR2Dev:false,publicCustomDomains:0,uploadsEnabled:false},flags:ownerPilotVars(approvedOwnerPilot(),{ownerAdmin}),secretNamesPreserved:true,previewBindingsPreserved:true,unauthorizedDenials:denied,productionWrites:0,realOAuth:'Not claimed by read-only checks; actual human journey required',ownerAccountCreated:counts.users>0};
writeFileSync(out+'/live-pilot-verification.json',JSON.stringify(result,null,2)+'\n');console.log('Live pilot SHA, exact flags, private binding, D1 integrity, secret metadata and unauthorized denials verified.');
