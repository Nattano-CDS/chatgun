// Exact manifests from this workstream only. Never resets a database or touches
// pre-existing fixture users/objects. Production is not a selectable target.
import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import{readFileSync,writeFileSync}from'node:fs';import{drainMediaDeletionQueue}from'../workers/media-cleanup.js';
import { DatabaseSync } from 'node:sqlite';
import { chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
if(process.env.CHATGUN_ISOLATED_STAGING!=='issue13')throw Error('Explicit isolated staging acknowledgement required');
const root='docs/development-completion/',result=JSON.parse(readFileSync(root+'full-system-cloud-browser.json'));assert.equal(result.stats.unexpected,0);assert.ok([7,10].includes(result.stats.expected));
const account='23017b53386fb67fc62a52cdd017454c',database='275d9820-6aec-494a-8bb5-b7ed9b8b74cc',bucket='chatgun-issue13-media',origin='https://issue13.chatgun-issue13-staging.pages.dev';
const{token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function cf(path,body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),j=await r.json();assert.ok(r.ok&&j.success,'Scoped fixture request failed');return j.result;}
const p=await cf('/pages/projects/chatgun-issue13-staging');assert.equal(p.deployment_configs.preview.d1_databases.DB.id,database);assert.equal(p.deployment_configs.preview.r2_buckets.MEDIA.name,bucket);
assert.equal((await cf('')).id,account);
const query=async(sql,params=[])=>(await cf('/d1/database/'+database+'/query',{sql,params}))[0];
const db={prepare(sql){let params=[];return{bind(...v){params=v;return this;},parameters(){return{sql,params};},async run(){return query(sql,params);},async all(){return query(sql,params);},async first(){return(await query(sql,params)).results[0]||null;}};},batch:statements=>cf('/d1/database/'+database+'/query',{batch:statements.map(s=>s.parameters())})};
// Only this explicitly selected batch, never a shared historical manifest list.
assert.ok(process.env.CHATGUN_FULL_SYSTEM_BUNDLE,'Exact current manifest required');
const paths=[process.env.CHATGUN_FULL_SYSTEM_BUNDLE],keys=new Set(),ids=new Set();let queued=0,revoked=0,grants=0;const checks=[];
for(const file of paths){assert.ok(file.startsWith('/Users/nattano/.codex/private-backups/chatgun/development-fixtures-')&&file.endsWith('/sessions.json'));const b=JSON.parse(readFileSync(file));assert.equal(b.databaseId,database);assert.equal(b.origin,origin);assert.match(b.run,/^development-[a-f0-9-]{36}$/);assert.ok(b.preserved,'Protected baseline required');
 assert.equal((await(await fetch(origin+'/release.json')).json()).commit,b.applicationSha);
 for(const entry of b.deletionMedia||[]){assert.ok(entry.ownerId.startsWith(b.run+'-'));keys.add(entry.objectKey);}
 for(const s of Object.values(b.sessions)){
  assert.ok(s.userId.startsWith(b.run+'-'));ids.add(s.userId);
  const rows=await query('SELECT id,object_key,state FROM social_media WHERE owner_user_id=?',[s.userId]);
  for(const row of rows.results){keys.add(row.object_key);if(row.state==='pending_deletion'){assert.ok((await query('SELECT object_key FROM media_deletion_queue WHERE object_key=?',[row.object_key])).results.length);continue;}const r=await fetch(origin+'/api/social/gallery',{method:'POST',headers:{cookie:`__Host-cg_session=${s.token}; __Host-cg_csrf=${s.csrf}`,origin,'x-csrf-token':s.csrf,'content-type':'application/json'},body:JSON.stringify({action:'delete',id:row.id})});assert.equal(r.status,200,'Only this workstream fixture media can be queued');queued++;}
  revoked+=Number((await query('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',[Math.floor(Date.now()/1000),s.userId])).meta.changes||0);
  grants+=Number((await query("UPDATE moderation_access_grants SET revoked_at=?,revocation_reason='Isolated automated fixture validation completed' WHERE user_id=? AND revoked_at IS NULL",[Math.floor(Date.now()/1000),s.userId])).meta.changes||0);
  await query("UPDATE beta_enrollments SET status='revoked',revoked_at=? WHERE user_id=? AND status<>'revoked'",[Math.floor(Date.now()/1000),s.userId]);
 }
}
const keyList=[...keys],unrelatedBefore=(await query(`SELECT COUNT(*) n FROM media_deletion_queue WHERE completed_at IS NULL AND object_key NOT IN (${keyList.map(()=>'?').join(',')||'NULL'})`,keyList)).results[0].n;
const cleanup=await drainMediaDeletionQueue({DB:db,MEDIA:{async delete(key){assert.ok(keys.has(key));execFileSync('npx',['wrangler@4.151.1','r2','object','delete',bucket+'/'+key,'--remote'],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'pipe'});}}},Math.floor(Date.now()/1000),{objectKeys:keyList});
assert.equal(cleanup.failed,0);
for(const key of keyList){const row=(await query('SELECT completed_at FROM media_deletion_queue WHERE object_key=?',[key])).results[0];assert.ok(row?.completed_at,'Owned synthetic object deletion must be recorded');}
assert.equal((await query(`SELECT COUNT(*) n FROM media_deletion_queue WHERE completed_at IS NULL AND object_key NOT IN (${keyList.map(()=>'?').join(',')||'NULL'})`,keyList)).results[0].n,unrelatedBefore);
assert.equal((await query('SELECT COUNT(*) n FROM pragma_foreign_key_check')).results[0].n,0);
const memberIds=[...ids],placeholders=memberIds.map(()=>'?').join(',');assert.equal((await query(`SELECT COUNT(*) n FROM sessions WHERE user_id IN (${placeholders}) AND revoked_at IS NULL`,memberIds)).results[0].n,0);assert.equal((await query(`SELECT COUNT(*) n FROM moderation_access_grants WHERE user_id IN (${placeholders}) AND revoked_at IS NULL`,memberIds)).results[0].n,0);
assert.equal((await query(`SELECT COUNT(*) n FROM beta_enrollments WHERE user_id IN (${placeholders}) AND status='active'`,memberIds)).results[0].n,0);
checks.push({name:'Only exact manifest-owned R2 objects deleted; unrelated queues unchanged',status:'PASS'},{name:'All fixture sessions and temporary grants revoked',status:'PASS'},{name:'Foreign keys valid after fixture account deletion and R2 cleanup',status:'PASS'});
const manifest=JSON.parse(readFileSync(paths[0])),after=paths[0].replace('/sessions.json','/isolated-after-fixtures.sql');
execFileSync('npx',['wrangler@4.151.1','d1','export',database,'--remote','--output='+after,'--config=wrangler.issue13.jsonc'],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'pipe'});chmodSync(after,0o600);
const local=new DatabaseSync(':memory:');local.exec('PRAGMA foreign_keys=OFF');local.exec(readFileSync(after,'utf8'));assert.equal(local.prepare('PRAGMA foreign_key_check').all().length,0);
for(const[name,hashes]of Object.entries(manifest.preserved)){
 const current=new Set(local.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all().map(row=>createHash('sha256').update(JSON.stringify(row)).digest('hex')));
 assert.ok(hashes.every(hash=>current.has(hash)),'Existing isolated rows changed in '+name);
}local.close();checks.push({name:'Every pre-existing isolated row preserved by private backup hashes',status:'PASS'});
writeFileSync(root+'cloud-cleanup.json',JSON.stringify({checkedAt:new Date().toISOString(),database,bucket,fixtureBatches:paths.length,manifestFixtureUsers:ids.size,fixtureMediaQueued:queued,objectsCompleted:keyList.length,sessionsRevokedInThisRun:revoked,temporaryGrantsRevokedInThisRun:grants,activeFixtureSessionsRemaining:0,activeFixtureGrantsRemaining:0,unrelatedPendingQueueRowsUnchanged:unrelatedBefore,cleanup,checks,productionWrites:0,existingFixtureUsersDeleted:0,protectedStagingWrites:0},null,2)+'\n');console.log('Exact new-fixture R2 cleanup, session revocation and foreign-key verification completed. Existing fixture accounts preserved.');
