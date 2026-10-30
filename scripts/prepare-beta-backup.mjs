// Authorized Production SELECT/export only. Migrations execute solely on a private local clone.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
if(process.env.CHATGUN_BETA_PREPARE!=='backup-rehearsal')throw Error('Explicit backup/local rehearsal acknowledgement required');
process.umask(0o077);
const account='23017b53386fb67fc62a52cdd017454c',database='9738a051-d914-42d0-8e7b-8098ef2b959d',root=(()=>{const root=process.env.CHATGUN_PRIVATE_ROOT;if(!root)throw new Error('CHATGUN_PRIVATE_ROOT is required');return root;})()+'';
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function api(path){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{headers:{Authorization:`Bearer ${token}`}});const j=await r.json();assert.ok(r.ok&&j.success,'Scoped backup metadata check failed');return j.result;}
const project=await api('/pages/projects/chatgun');assert.equal(project.deployment_configs.production.d1_databases.DB.id,database);assert.equal(project.deployment_configs.production.env_vars.OAUTH_LOGIN_ENABLED.value,'false');assert.equal(project.deployment_configs.production.env_vars.SOCIAL_APP_ENABLED.value,'false');
assert.equal((await api(`/d1/database/${database}`)).name,'chatgun-auth');
const recovery=await api(`/d1/database/${database}/time_travel/bookmark`);assert.ok(typeof recovery.bookmark==='string'&&recovery.bookmark.length>10);
mkdirSync(root,{recursive:true,mode:0o700});const directory=mkdtempSync(root+'/production-beta-');
const config=directory+'/wrangler.jsonc';writeFileSync(config,JSON.stringify({name:'chatgun-beta-backup',compatibility_date:'2026-10-15',d1_databases:[{binding:'DB',database_name:'chatgun-auth',database_id:database}]},null,2),{mode:0o600});
writeFileSync(directory+'/time-travel.json',JSON.stringify({checkedAt:new Date().toISOString(),database,...recovery},null,2),{mode:0o600});
for(const [file,options]of [['production.sql',[]],['schema.sql',['--no-data']]]){
  try{execFileSync('npx',['wrangler@4.151.1','d1','export','chatgun-auth','--remote','--config',config,'--output',directory+'/'+file,...options],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'pipe'});}catch{throw Error('Protected Production export failed; no migration was attempted. Inspect private directory locally.');}
  assert.equal(statSync(directory+'/'+file).mode&0o077,0);
}
const bytes=readFileSync(directory+'/production.sql'),db=new DatabaseSync(':memory:');db.exec(bytes.toString());db.exec('PRAGMA foreign_keys=ON');
const hash=value=>createHash('sha256').update(value).digest('hex'),quote=id=>'"'+id.replaceAll('"','""')+'"';
const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name").all().map(row=>row.name);
const columns=Object.fromEntries(tables.map(table=>[table,db.prepare(`PRAGMA table_info(${quote(table)})`).all().map(c=>c.name)]));
const fingerprints=()=>Object.fromEntries(tables.map(table=>[table,hash(db.prepare(`SELECT ${columns[table].map(quote).join(',')} FROM ${quote(table)}`).all().map(row=>JSON.stringify(row)).sort().join('\n'))]));
const counts=Object.fromEntries(tables.map(table=>[table,db.prepare(`SELECT COUNT(*) n FROM ${quote(table)}`).get().n]));
const before=fingerprints(),history=db.prepare('SELECT * FROM d1_migrations ORDER BY id').all();assert.equal(history.length,12);assert.equal(history.at(-1).name,'0012_synthetic_seed_batches.sql');
const originalSchema=db.prepare("SELECT name,type,sql FROM sqlite_master ORDER BY type,name").all();
db.exec('BEGIN');db.exec(readFileSync('migrations/0013_direct_chat_private_albums.sql','utf8'));db.exec('ROLLBACK');assert.deepEqual(db.prepare("SELECT name,type,sql FROM sqlite_master ORDER BY type,name").all(),originalSchema);assert.deepEqual(fingerprints(),before);
const applied=[];function migrate(){for(const name of ['0013_direct_chat_private_albums.sql','0014_gallery_capacity.sql','0015_authenticated_online_presence.sql']){
  if(db.prepare('SELECT 1 ok FROM d1_migrations WHERE name=?').get(name))continue;
  db.exec('BEGIN IMMEDIATE');try{db.exec(readFileSync(resolve('migrations',name),'utf8'));db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(name);db.exec('COMMIT');applied.push(name);}catch(error){db.exec('ROLLBACK');throw error;}
}}
migrate();const projected=fingerprints();delete projected.d1_migrations;const expected={...before};delete expected.d1_migrations;assert.deepEqual(projected,expected,'Existing Production record projections must remain identical');
const firstCount=applied.length;migrate();assert.equal(applied.length,firstCount);assert.equal(firstCount,3);
const foreignKeys=db.prepare('PRAGMA foreign_key_check').all().length;assert.equal(foreignKeys,0);assert.equal(db.prepare("SELECT COUNT(*) n FROM profile_photos WHERE visibility<>'private'").get().n,0);
const sqlValue=value=>value===null?'NULL':typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
// Remote rehearsal receives schema + migration history only, never Production personal rows.
const schema=readFileSync(directory+'/schema.sql','utf8')+'\n'+history.map(row=>`INSERT INTO d1_migrations(${Object.keys(row).map(quote).join(',')}) VALUES(${Object.values(row).map(sqlValue).join(',')});`).join('\n');
writeFileSync(directory+'/schema-with-history.sql',schema,{mode:0o600});
const migrationHashes=Object.fromEntries(applied.map(name=>[name,hash(readFileSync(resolve('migrations',name)))]));
const summary={checkedAt:new Date().toISOString(),account,database,productionWrites:0,backupBytes:bytes.length,backupSha256:hash(bytes),migrationHashes,directoryMode:'0700',fileMode:'0600',backupStored:'protected outside Git',recoveryBookmarkAvailable:true,recoveryBookmarkSha256:hash(recovery.bookmark),recoveryRestoreExecuted:false,recoveryRetention:'Actual account window must be rechecked before migration; no retention duration invented',baselineMigrationCount:history.length,localMigrationCount:15,applied,originalTableCounts:counts,existingRecordProjectionsPreserved:true,existingDataFingerprint:hash(JSON.stringify(expected)),foreignKeyViolations:foreignKeys,versionedSecondRunApplied:0,rawAlterReplaySupported:false,transactionalDdlRollbackTest:'PASS on local clone; not a Production restore',remoteRehearsalDataScope:'schema and migration history only; no member rows',productionMigrationGate:'BACKUP/REHEARSAL ONLY; migration not executed by this script'};
const output=process.env.BETA_EVIDENCE_DIR||'docs/beta-activation';mkdirSync(output,{recursive:true});writeFileSync(output+'/backup-rehearsal.json',JSON.stringify(summary,null,2)+'\n');writeFileSync('/tmp/chatgun-beta-backup-path',directory,{mode:0o600});db.close();console.log('Protected Production exports and local migration rehearsal verified; Production unchanged.');
