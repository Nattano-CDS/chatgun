// Isolated synthetic sessions, NOT genuine OAuth or youth registration evidence.
// Never targets Production/protected staging; never deletes a pre-existing actor.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,chmodSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
import {assertYouthFixtureScope,issueYouthFixtureSession} from './lib/youth-fixture-scope.mjs';

assert.equal(process.env.CHATGUN_ISOLATED_STAGING,'issue13');
const mode=process.argv[2];assert.ok(['prepare','verify'].includes(mode));
const account='23017b53386fb67fc62a52cdd017454c',database='275d9820-6aec-494a-8bb5-b7ed9b8b74cc';
const origin='https://issue13.chatgun-issue13-staging.pages.dev',privateRoot='/Users/nattano/.codex/private-backups/chatgun/';
const pointer='/tmp/chatgun-youth-e2e-manifest-path';
const config=JSON.parse(readFileSync('wrangler.issue13.jsonc','utf8'));
assert.equal(config.name,'chatgun-issue13-staging');assert.equal(config.d1_databases[0].database_id,database);
assert.equal(config.r2_buckets[0].bucket_name,'chatgun-issue13-media');
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function cf(path,body){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const j=await r.json();if(!r.ok||!j.success)throw Error('Scoped Cloudflare check failed');return j.result;
}
assert.equal((await cf('')).id,account);
const p=await cf('/pages/projects/chatgun-issue13-staging');
assert.equal(p.deployment_configs.preview.d1_databases.DB.id,database);
assert.equal(p.deployment_configs.preview.r2_buckets.MEDIA.name,'chatgun-issue13-media');
const query=async(sql,params=[])=>{const r=(await cf('/d1/database/'+database+'/query',{sql,params}))[0];assert.equal(r.success,true);return r;};
assert.equal((await query('SELECT COUNT(*) n FROM d1_migrations')).results[0].n,20);
assert.equal((await query('SELECT COUNT(*) n FROM pragma_foreign_key_check')).results[0].n,0);
const release=await(await fetch(origin+'/release.json')).json();
assert.equal(release.requiredD1MigrationNumber,20);
const auth=await(await fetch(origin+'/api/auth/config')).json();assert.equal(auth.oauthLoginEnabled,false);assert.equal(auth.newAccountRegistrationEnabled,false);
const productionRelease=await(await fetch('https://chatgun.social/release.json')).json();
const productionAuth=await(await fetch('https://chatgun.social/api/auth/config')).json();assert.equal(productionAuth.newAccountRegistrationEnabled,false);
const productionConfig=await(await fetch('https://chatgun.social/api/social/config')).json();
for(const key of ['publicDiscoveryEnabled','messagingEnabled','onlineStatusEnabled','mediaUploadEnabled','sensitiveContentEnabled'])assert.equal(productionConfig[key],false);
const db={prepare(sql){let params=[];return {bind(...v){params=v;return this;},async run(){return query(sql,params);}};},async batch(statements){const results=[];for(const s of statements)results.push(await s.run());return results;}};
function backup(directory,name){
 const path=directory+'/'+name+'.sql';
 execFileSync('npx',['wrangler@4.151.1','d1','export','chatgun-issue13-staging','--remote','--config','wrangler.issue13.jsonc','--output',path],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'pipe'});chmodSync(path,0o600);
 const local=new DatabaseSync(':memory:');local.exec('PRAGMA foreign_keys=OFF');local.exec(readFileSync(path,'utf8'));assert.equal(local.prepare('PRAGMA foreign_key_check').all().length,0);return local;
}
function rows(local){
 const snapshot={};for(const {name} of local.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()){
  snapshot[name]=local.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all().map(r=>createHash('sha256').update(JSON.stringify(r)).digest('hex'));
 }return snapshot;
}
if(mode==='prepare'){
 assert.match(process.env.EXPECTED_SHA||'',/^[a-f0-9]{40}$/);assert.equal(release.commit,process.env.EXPECTED_SHA);
 const directory=mkdtempSync(privateRoot+'youth-e2e-');chmodSync(directory,0o700);
 const before=backup(directory,'before');const preserved=rows(before);before.close();
 const run='youth-e2e-'+randomUUID(),actors=[],now=Math.floor(Date.now()/1000);
 const manifest={syntheticOnly:true,run,database,origin,applicationSha:release.commit,productionSha:productionRelease.commit,createdAt:now,actors,preserved};
 const path=directory+'/manifest.json';const save=()=>writeFileSync(path,JSON.stringify(manifest),{mode:0o600});save();writeFileSync(pointer,path,{mode:0o600});
 for(const band of ['under_13','13_17','18_19','control'])for(const width of (band==='control'?[390]:[390,768,1440])){
  const id=run+'-'+band+'-'+width,actor={id,band,width};actors.push(actor);save();
  await query("INSERT INTO users(id,display_name,status,account_state,created_at,updated_at)VALUES(?,?,'active','pending_acceptance',?,?)",[id,'บัญชีสังเคราะห์สำหรับทดสอบความปลอดภัย',now,now]);
  await query("INSERT INTO member_age_safety_holds(user_id,age_band,state,notice_version,declared_at,updated_at)VALUES(?,?,'held','synthetic-cloud-e2e-v1',?,?)",[id,band==='control'?'13_17':band,now,now]);
  actor.session=await issueYouthFixtureSession(db,id,{now});actor.other=await issueYouthFixtureSession(db,id,{now});
  if(band==='control'){
   actor.stale=await issueYouthFixtureSession(db,id,{now,authenticatedAt:now-660});actor.expired=await issueYouthFixtureSession(db,id,{now,expired:true});
  }
  save();
 }
 assertYouthFixtureScope(manifest);
 console.log('Prepared10 new isolated synthetic held accounts;30-minute sessions and manifest stored privately; no OAuth identities, profiles, R2 or Production writes.');
}else{
 const path=readFileSync(pointer,'utf8');assert.match(path,/^\/Users\/nattano\/\.codex\/private-backups\/chatgun\/youth-e2e-[^/]+\/manifest\.json$/);
 const m=assertYouthFixtureScope(JSON.parse(readFileSync(path)));assert.equal(release.commit,m.applicationSha);assert.equal(productionRelease.commit,m.productionSha);
 assert.equal(m.actors.length,10);let deleted=0,retained=0;
 assert.match(m.run,/^youth-e2e-[a-f0-9-]{36}$/);
 // Revoke every exact new-fixture session even if a subsequent E2E assertion failed.
 for(const a of m.actors){
  assert.ok(a.id.startsWith(m.run+'-'));
  await query('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',[Math.floor(Date.now()/1000),a.id]);
 }
 for(const a of m.actors){
  assert.ok(a.id.startsWith(m.run+'-'));
  const exists=(await query('SELECT 1 present FROM users WHERE id=?',[a.id])).results.length;
  if(a.band!=='control'){assert.equal(exists,0,'Expected synthetic deletion E2E did not complete');deleted++;}
  else{assert.equal(exists,1);retained++;}
  assert.equal((await query('SELECT COUNT(*) n FROM identities WHERE user_id=?',[a.id])).results[0].n,0);
  assert.equal((await query('SELECT COUNT(*) n FROM social_media WHERE owner_user_id=?',[a.id])).results[0].n,0);
  assert.equal((await query('SELECT COUNT(*) n FROM sessions WHERE user_id=? AND revoked_at IS NULL',[a.id])).results[0].n,0);
 }
 const after=backup(path.slice(0,path.lastIndexOf('/')),'after');const current=rows(after);after.close();
 for(const [table,hashes] of Object.entries(m.preserved)){
  const remaining=new Set(current[table]);assert.ok(hashes.every(h=>remaining.has(h)),'Pre-existing rows changed in '+table);
 }
 const summary={applicationSha:m.applicationSha,syntheticAccountsCreated:10,syntheticAccountsDeletedByAuthenticatedWorkflow:deleted,newHeldControlAccountsRetained:retained,activeFixtureSessions:0,providerIdentitiesCreated:0,mediaObjectsCreated:0,preExistingTablesVerified:Object.keys(m.preserved).length,preExistingRowsUnchanged:true,foreignKeyViolations:0,protectedBackups:true,productionUnchanged:true,productionWrites:0,protectedStagingWrites:0};
 writeFileSync('test-results/youth-cloud-integrity.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
}
