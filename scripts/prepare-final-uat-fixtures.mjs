// Dedicated final-UAT synthetic engineering campaign; NOT genuine OAuth or MFA evidence.
// Adds only new, distinctly tagged fixtures in the dedicated isolated test project.
// No Production writes; no OAuth identity fabrication; no existing fixture mutation.
import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import{mkdirSync,mkdtempSync,writeFileSync,chmodSync,readFileSync,existsSync}from'node:fs';import{join}from'node:path';import{randomUUID}from'node:crypto';import{issueSession,unixTime}from'../functions/_lib/db.js';
import{ONE_PIXEL_PNG}from'../test/helpers/image.js';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { issueDevelopmentFixtureSession } from './lib/youth-fixture-scope.mjs';
if(process.env.CHATGUN_ISOLATED_STAGING!=='final-uat')throw Error('Explicit isolated staging acknowledgement required');
const account='23017b53386fb67fc62a52cdd017454c',databaseId='e3cb426c-b88a-4b93-90fd-39df524f68ae',origin='https://engineering.chatgun-final-uat.pages.dev';
const{token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function cf(path,body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.ok(r.ok&&j.success,'Scoped Cloudflare request failed');return j.result;}
assert.equal((await cf('')).id,account);
const project=await cf('/pages/projects/chatgun-final-uat');assert.equal(project.deployment_configs.preview.d1_databases.DB.id,databaseId);assert.equal(project.deployment_configs.preview.r2_buckets.MEDIA.name,'chatgun-final-uat-media');
const production=await cf('/pages/projects/chatgun');assert.equal(production.canonical_deployment.deployment_trigger.metadata.commit_hash,'a73ff21c615dabb6a0c19c0a22685c2370958ca1');
for(const key of['NEW_ACCOUNT_REGISTRATION_ENABLED','PUBLIC_DISCOVERY_ENABLED','MESSAGING_ENABLED','PRESENCE_ENABLED','MEDIA_UPLOAD_ENABLED','SENSITIVE_CONTENT_ENABLED'])assert.equal(production.deployment_configs.production.env_vars[key].value,'false');
async function query(sql,params=[]){return(await cf('/d1/database/'+databaseId+'/query',{sql,params}))[0];}
const history=(await query('SELECT COUNT(*) n FROM d1_migrations')).results[0].n;assert.equal(history,21);
const release=await(await fetch(origin+'/release.json')).json();assert.equal(release.commit,process.env.EXPECTED_SHA);assert.match(process.env.EXPECTED_SHA||'',/^[a-f0-9]{40}$/u);assert.equal(release.requiredD1MigrationNumber,21);
const liveAuth=await(await fetch(origin+'/api/auth/config')).json(),liveSocial=await(await fetch(origin+'/api/social/config')).json();
assert.equal(liveAuth.oauthLoginEnabled,false);assert.equal(liveAuth.newAccountRegistrationEnabled,false);assert.equal(liveAuth.invitationOnlyRegistrationEnabled,false);
assert.equal(liveSocial.socialAppEnabled,true,'Do not seed into a retired/closed deployment');
assert.equal((await query('SELECT COUNT(*) n FROM identities')).results[0].n,0,'Genuine identities forbid this synthetic setup');
assert.equal((await query('SELECT COUNT(*) n FROM beta_invitations')).results[0].n,0);
mkdirSync('/Users/nattano/.codex/private-backups/chatgun',{recursive:true,mode:0o700});const directory=mkdtempSync('/Users/nattano/.codex/private-backups/chatgun/development-fixtures-');chmodSync(directory,0o700);
const backup=join(directory,'isolated-before-fixtures.sql');execFileSync('npx',['wrangler@4.151.1','d1','export',databaseId,'--remote','--output='+backup,'--config=wrangler.final-uat.jsonc'],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'pipe'});chmodSync(backup,0o600);
const local=new DatabaseSync(':memory:');local.exec('PRAGMA foreign_keys=OFF');local.exec(readFileSync(backup,'utf8'));assert.equal(local.prepare('PRAGMA foreign_key_check').all().length,0);
const preserved={};for(const{name}of local.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all())preserved[name]=local.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all().map(row=>createHash('sha256').update(JSON.stringify(row)).digest('hex'));local.close();
const db={prepare(sql){let params=[];return{bind(...v){params=v;return this;},async run(){return query(sql,params);},async first(){return(await query(sql,params)).results[0]||null;}};},async batch(statements){return cf('/d1/database/'+databaseId+'/query',{batch:statements.map(s=>s.parameters())});}};
// Parameterized adapter with genuine remote D1 batch semantics.
db.prepare=sql=>{let params=[];return{bind(...v){params=v;return this;},parameters(){return{sql,params};},async run(){return query(sql,params);},async first(){return(await query(sql,params)).results[0]||null;}};};
const run='development-'+randomUUID(),now=unixTime(),sessions={};
for(const width of[390,768,1440])for(const kind of['owner','viewer','moderator','other','held']){
 const id=run+'-'+kind+width;
 await cf('/d1/database/'+databaseId+'/query',{batch:[
 {sql:"INSERT INTO users(id,display_name,status,created_at,updated_at)VALUES(?,?,'active',?,?)",params:[id,'ระบบทดสอบแยก '+kind,now,now]},
 {sql:"INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at)VALUES(?,?,'adult_18_plus','self_declaration','isolated-automated-fixture',?)",params:[id+'-adult',id,now]},
 {sql:'INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at)VALUES(?,?,?,?,?)',params:[id,id+'-adult','ระบบทดสอบแยก '+kind,now,now]},
 {sql:"INSERT INTO beta_enrollments(user_id,status,created_at,activated_at)VALUES(?,'active',?,?)",params:[id,now,now]},
 ]});
 if(kind==='held')await query("INSERT INTO member_age_safety_holds VALUES(?,'13_17','held','isolated-automated-fixture',?,?)",[id,now,now]);
 if(['owner','moderator'].includes(kind))for(const role of['report_reviewer','safety_admin'])await query('INSERT INTO moderation_access_grants(id,user_id,role,grant_reason,granted_at,expires_at)VALUES(?,?,?,?,?,?)',[randomUUID(),id,role,'Isolated automated regression fixture only',now,now+1800]);
 if(kind==='moderator')await query("INSERT INTO moderation_access_grants(id,user_id,role,grant_reason,granted_at,expires_at)VALUES(?,?,'moderation_admin','Isolated automated role UI verification only',?,?)",[randomUUID(),id,now,now+1800]);
 sessions[kind+width]={...await issueDevelopmentFixtureSession(db,id,{now}),userId:id};
}
const deletionMedia=[];
for(const width of[390,768,1440]){
 const s=sessions['other'+width],form=new FormData();form.set('file',new File([ONE_PIXEL_PNG],'isolated-deletion.png',{type:'image/png'}));form.set('visibility','private');
 const response=await fetch(origin+'/api/social/gallery',{method:'POST',headers:{cookie:`__Host-cg_session=${s.token}; __Host-cg_csrf=${s.csrf}`,origin,'x-csrf-token':s.csrf,'idempotency-key':randomUUID()},body:form});assert.equal(response.status,201);const{id}=await response.json();
 const row=(await query('SELECT object_key FROM social_media WHERE id=? AND owner_user_id=?',[id,s.userId])).results[0];assert.ok(row);deletionMedia.push({width,ownerId:s.userId,mediaId:id,objectKey:row.object_key});
}
const bundle={origin,databaseId,run,sessions,deletionMedia,preserved,applicationSha:release.commit,createdAt:now,syntheticOnly:true};const bundleFile=join(directory,'sessions.json');writeFileSync(bundleFile,JSON.stringify(bundle),{mode:0o600});
writeFileSync('/tmp/chatgun-final-uat-fixture-path',bundleFile,{mode:0o600});
mkdirSync('docs/final-uat',{recursive:true});writeFileSync('docs/final-uat/cloud-fixture-preparation.json',JSON.stringify({checkedAt:new Date().toISOString(),accountId:account,isolatedDatabase:databaseId,migrations:21,newSyntheticUsers:15,noProviderIdentitiesCreated:true,productionWrites:0,productionSha:production.canonical_deployment.deployment_trigger.metadata.commit_hash,originalStagingUntouched:true,privateSessionHandoff:true,foreignKeyViolations:(await query('SELECT COUNT(*) n FROM pragma_foreign_key_check')).results[0].n},null,2)+'\n');console.log('15 new isolated fixtures prepared. Session bundle stays private; pointer saved locally. No Production writes.');
