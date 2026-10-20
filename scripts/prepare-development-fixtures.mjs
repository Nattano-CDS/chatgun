// Adds only new, distinctly tagged fixtures in the dedicated isolated test project.
// No Production writes; no OAuth identity fabrication; no existing fixture mutation.
import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import{mkdirSync,mkdtempSync,writeFileSync,chmodSync,readFileSync,existsSync}from'node:fs';import{join}from'node:path';import{randomUUID}from'node:crypto';import{issueSession,unixTime}from'../functions/_lib/db.js';
import{ONE_PIXEL_PNG}from'../test/helpers/image.js';
if(process.env.CHATGUN_ISOLATED_STAGING!=='issue13')throw Error('Explicit isolated staging acknowledgement required');
const account='23017b53386fb67fc62a52cdd017454c',databaseId='275d9820-6aec-494a-8bb5-b7ed9b8b74cc',origin='https://issue13.chatgun-issue13-staging.pages.dev';
const{token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function cf(path,body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.ok(r.ok&&j.success,'Scoped Cloudflare request failed');return j.result;}
const project=await cf('/pages/projects/chatgun-issue13-staging');assert.equal(project.deployment_configs.preview.d1_databases.DB.id,databaseId);assert.equal(project.deployment_configs.preview.r2_buckets.MEDIA.name,'chatgun-issue13-media');
const production=await cf('/pages/projects/chatgun');assert.equal(production.canonical_deployment.deployment_trigger.metadata.commit_hash,'b45aa4f9d28ca9bb1ec3e1fb22b31bc8b0f331d7');
for(const key of['NEW_ACCOUNT_REGISTRATION_ENABLED','PUBLIC_DISCOVERY_ENABLED','MESSAGING_ENABLED','PRESENCE_ENABLED','MEDIA_UPLOAD_ENABLED','SENSITIVE_CONTENT_ENABLED'])assert.equal(production.deployment_configs.production.env_vars[key].value,'false');
async function query(sql,params=[]){return(await cf('/d1/database/'+databaseId+'/query',{sql,params}))[0];}
const history=(await query('SELECT COUNT(*) n FROM d1_migrations')).results[0].n;assert.ok([16,17].includes(history));
mkdirSync('/Users/nattano/.codex/private-backups/chatgun',{recursive:true,mode:0o700});const directory=mkdtempSync('/Users/nattano/.codex/private-backups/chatgun/development-fixtures-');chmodSync(directory,0o700);
if(history===16){const backup=join(directory,'isolated-before-0017.sql');execFileSync('npx',['wrangler@4.151.1','d1','export',databaseId,'--remote','--output='+backup,'--config=wrangler.issue13.jsonc'],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'pipe'});chmodSync(backup,0o600);execFileSync('npx',['wrangler@4.151.1','d1','migrations','apply','chatgun-issue13-staging','--remote','--config=wrangler.issue13.jsonc'],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'pipe'});}
assert.equal((await query('SELECT COUNT(*) n FROM d1_migrations')).results[0].n,17);
const db={prepare(sql){let params=[];return{bind(...v){params=v;return this;},async run(){return query(sql,params);},async first(){return(await query(sql,params)).results[0]||null;}};},async batch(statements){return cf('/d1/database/'+databaseId+'/query',{batch:statements.map(s=>s.parameters())});}};
// Parameterized adapter with genuine remote D1 batch semantics.
db.prepare=sql=>{let params=[];return{bind(...v){params=v;return this;},parameters(){return{sql,params};},async run(){return query(sql,params);},async first(){return(await query(sql,params)).results[0]||null;}};};
const run='development-'+randomUUID(),now=unixTime(),sessions={};
for(const width of[390,768,1440])for(const kind of['owner','viewer','moderator','other']){
 const id=run+'-'+kind+width;
 await cf('/d1/database/'+databaseId+'/query',{batch:[
 {sql:"INSERT INTO users(id,display_name,status,created_at,updated_at)VALUES(?,?,'active',?,?)",params:[id,'ระบบทดสอบแยก '+kind,now,now]},
 {sql:"INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at)VALUES(?,?,'adult_18_plus','self_declaration','isolated-automated-fixture',?)",params:[id+'-adult',id,now]},
 {sql:'INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at)VALUES(?,?,?,?,?)',params:[id,id+'-adult','ระบบทดสอบแยก '+kind,now,now]},
 {sql:"INSERT INTO beta_enrollments(user_id,status,created_at,activated_at)VALUES(?,'active',?,?)",params:[id,now,now]},
 ]});
 if(['owner','moderator'].includes(kind))for(const role of['report_reviewer','safety_admin'])await query('INSERT INTO moderation_access_grants(id,user_id,role,grant_reason,granted_at,expires_at)VALUES(?,?,?,?,?,?)',[randomUUID(),id,role,'Isolated automated regression fixture only',now,now+7200]);
 sessions[kind+width]={...await issueSession(db,id),userId:id};
}
const deletionMedia=[];
for(const width of[390,768,1440]){
 const s=sessions['other'+width],form=new FormData();form.set('file',new File([ONE_PIXEL_PNG],'isolated-deletion.png',{type:'image/png'}));form.set('visibility','private');
 const response=await fetch(origin+'/api/social/gallery',{method:'POST',headers:{cookie:`__Host-cg_session=${s.token}; __Host-cg_csrf=${s.csrf}`,origin,'x-csrf-token':s.csrf,'idempotency-key':randomUUID()},body:form});assert.equal(response.status,201);const{id}=await response.json();
 const row=(await query('SELECT object_key FROM social_media WHERE id=? AND owner_user_id=?',[id,s.userId])).results[0];assert.ok(row);deletionMedia.push({width,ownerId:s.userId,mediaId:id,objectKey:row.object_key});
}
const bundle={origin,databaseId,run,sessions,deletionMedia,createdAt:now,syntheticOnly:true};const bundleFile=join(directory,'sessions.json');writeFileSync(bundleFile,JSON.stringify(bundle),{mode:0o600});
const historyFile='/tmp/chatgun-development-fixture-history.json',paths=existsSync(historyFile)?JSON.parse(readFileSync(historyFile)):[];if(existsSync('/tmp/chatgun-development-fixture-path'))paths.push(readFileSync('/tmp/chatgun-development-fixture-path','utf8').trim());paths.push(bundleFile);writeFileSync(historyFile,JSON.stringify([...new Set(paths)]),{mode:0o600});writeFileSync('/tmp/chatgun-development-fixture-path',bundleFile,{mode:0o600});
mkdirSync('docs/development-completion',{recursive:true});writeFileSync('docs/development-completion/cloud-fixture-preparation.json',JSON.stringify({checkedAt:new Date().toISOString(),accountId:account,isolatedDatabase:databaseId,migrations:17,newSyntheticUsers:12,noProviderIdentitiesCreated:true,productionWrites:0,productionSha:production.canonical_deployment.deployment_trigger.metadata.commit_hash,originalStagingUntouched:true,privateSessionHandoff:true,foreignKeyViolations:(await query('SELECT COUNT(*) n FROM pragma_foreign_key_check')).results[0].n},null,2)+'\n');console.log('12 new isolated fixtures prepared. Session bundle stays private; pointer saved locally. No Production writes.');
