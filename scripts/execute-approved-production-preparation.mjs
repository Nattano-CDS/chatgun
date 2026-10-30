// Owner authorization 2026-10-20: additive 0013-15 and private MEDIA binding only.
// NO signup, personal-data collection, service activation, roles or provider publishing.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
if(process.env.CHATGUN_PRODUCTION_PREPARATION!=='approved-additive-migrations-private-binding')throw Error('Exact authorized preparation acknowledgement required');
process.umask(0o077);
const account='23017b53386fb67fc62a52cdd017454c',database='9738a051-d914-42d0-8e7b-8098ef2b959d',bucket='chatgun-media-production',output='docs/production-pilot-20261020';
const backup=JSON.parse(readFileSync(output+'/backup-rehearsal.json')),rehearsal=JSON.parse(readFileSync(output+'/infrastructure-rehearsal.json'));
assert.ok(Date.now()-Date.parse(backup.checkedAt)<30*60*1000,'A fresh backup is mandatory');
assert.equal(backup.database,database);assert.equal(backup.account,account);assert.equal(backup.recoveryBookmarkAvailable,true);assert.equal(backup.existingRecordProjectionsPreserved,true);
assert.equal(rehearsal.account,account);assert.equal(rehearsal.migrationCount,15);assert.equal(rehearsal.foreignKeyViolations,0);assert.equal(rehearsal.productionPersonalRowsImported,0);
assert.notEqual(rehearsal.rehearsalDatabaseId,database);
const names=['0013_direct_chat_private_albums.sql','0014_gallery_capacity.sql','0015_authenticated_online_presence.sql'];
const hash=value=>createHash('sha256').update(value).digest('hex');
for(const name of names)assert.equal(hash(readFileSync(resolve('migrations',name))),backup.migrationHashes[name],'SQL changed after rehearsal');
const directory=readFileSync('/tmp/chatgun-beta-backup-path','utf8').trim();assert.ok(directory.startsWith((()=>{const root=process.env.CHATGUN_PRIVATE_ROOT;if(!root)throw new Error('CHATGUN_PRIVATE_ROOT is required');return root;})()+'/production-beta-'));
assert.equal(statSync(directory).mode&0o777,0o700);assert.equal(statSync(directory+'/production.sql').mode&0o777,0o600);
assert.equal(hash(readFileSync(directory+'/production.sql')),backup.backupSha256);
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function api(path,body,method){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:method||(body?'POST':'GET'),headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.ok(r.ok&&j.success,'Scoped Production preparation request failed; inspect private evidence');return j.result;}
async function select(sql){const r=(await api('/d1/database/'+database+'/query',{sql}))[0];assert.equal(r.meta.changed_db,false);return r.results;}
assert.equal((await api('')).id,account);assert.equal((await api('/d1/database/'+database)).name,'chatgun-auth');
const project=await api('/pages/projects/chatgun'),prod=project.deployment_configs.production,preview=project.deployment_configs.preview;
assert.equal(prod.d1_databases.DB.id,database);assert.equal(preview.d1_databases.DB.id,'5bbfd55d-eb22-4324-8a7d-57bef14110ea');assert.equal(preview.r2_buckets.MEDIA.name,'chatgun-media-staging');
for(const key of ['OAUTH_LOGIN_ENABLED','SOCIAL_APP_ENABLED','BETA_INVITATION_REGISTRATION_ENABLED','NEW_ACCOUNT_REGISTRATION_ENABLED','MESSAGING_ENABLED','PUBLIC_DISCOVERY_ENABLED','MEDIA_UPLOAD_ENABLED','MODERATION_TOOLS_ENABLED','PRESENCE_ENABLED','SENSITIVE_CONTENT_ENABLED'])assert.equal(prod.env_vars[key].value,'false',key);
assert.equal((await api('/r2/buckets/'+bucket+'/domains/managed')).enabled,false);
assert.equal(((await api('/r2/buckets/'+bucket+'/domains/custom')).domains||[]).filter(d=>d.enabled).length,0);
const history=await select('SELECT name FROM d1_migrations ORDER BY id');assert.equal(history.length,12,'Stop and inspect existing history rather than replaying a partial operation');assert.equal(history.at(-1).name,'0012_synthetic_seed_batches.sql');
const db=new DatabaseSync(':memory:');db.exec(readFileSync(directory+'/production.sql','utf8'));
const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'").all().map(t=>t.name);
const quote=s=>'"'+s.replaceAll('"','""')+'"';
for(let i=0;i<tables.length;i+=10){const group=tables.slice(i,i+10),[row]=await select('SELECT '+group.map((name,index)=>`(SELECT COUNT(*) FROM ${quote(name)}) AS c${index}`).join(','));for(const [index,name]of group.entries())assert.equal(row['c'+index],backup.originalTableCounts[name],'Records changed since backup');}
const recovery=await api('/d1/database/'+database+'/time_travel/bookmark');assert.ok(recovery.bookmark);writeFileSync(directory+'/immediate-before-migration-time-travel.json',JSON.stringify(recovery),{mode:0o600});
const config=directory+'/authorized-migration-wrangler.jsonc';writeFileSync(config,JSON.stringify({name:'chatgun-production-migration',compatibility_date:'2026-10-15',d1_databases:[{binding:'DB',database_name:'chatgun-auth',database_id:database,migrations_dir:resolve('migrations')}]}),{mode:0o600});
const evidence={startedAt:new Date().toISOString(),account,database,authorization:'Owner full technical execution authorization 2026-10-20',backupSha256:backup.backupSha256,migrationHashes:backup.migrationHashes,rehearsalDatabase:rehearsal.rehearsalDatabaseId,recoveryBookmarkAvailable:true,baselineMigrations:12,stage:'preflight-pass',productionPersonalDataDeleted:false,realServicesEnabled:false};
const save=()=>writeFileSync(output+'/production-preparation.json',JSON.stringify(evidence,null,2)+'\n');save();
try{
  const log=execFileSync('npx',['wrangler@4.151.1','d1','migrations','apply','chatgun-auth','--remote','--config',config],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},encoding:'utf8',stdio:['ignore','pipe','pipe']});
  writeFileSync(directory+'/authorized-migration.log',log,{mode:0o600});evidence.stage='migrations-applied';save();
  const afterHistory=await select('SELECT name FROM d1_migrations ORDER BY id');assert.equal(afterHistory.length,15);assert.deepEqual(afterHistory.slice(-3).map(r=>r.name),names);
  execFileSync('npx',['wrangler@4.151.1','d1','export','chatgun-auth','--remote','--config',config,'--output',directory+'/after-migration.sql'],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'pipe'});
  const after=new DatabaseSync(':memory:');after.exec(readFileSync(directory+'/after-migration.sql','utf8'));
  for(const table of tables.filter(name=>name!=='d1_migrations')){const cols=db.prepare('PRAGMA table_info('+quote(table)+')').all().map(c=>quote(c.name));const sql='SELECT '+cols.join(',')+' FROM '+quote(table);const rows=d=>d.prepare(sql).all().map(row=>JSON.stringify(row)).sort();assert.deepEqual(rows(after),rows(db),'Existing record projection changed: '+table);}
  assert.equal(after.prepare('PRAGMA foreign_key_check').all().length,0);
  const normalize=s=>s.trim().replace(/;$/,'').replace(/IF NOT EXISTS /g,'').replace(/\s+/g,' ');
  const expectedTriggers=['album_block_revokes','album_request_created','album_request_transition','direct_chat_spam_guard','gallery_capacity_guard'];
  const actual=after.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all();assert.deepEqual(actual.map(r=>r.name),expectedTriggers);
  for(const trigger of actual){const source=readFileSync('migrations/'+(trigger.name==='gallery_capacity_guard'?names[1]:names[0]),'utf8');const match=source.match(new RegExp('CREATE TRIGGER (?:IF NOT EXISTS )?'+trigger.name+'[\\s\\S]*?\\nEND;'));assert.ok(match);assert.equal(normalize(trigger.sql),normalize(match[0]));}
  assert.equal(after.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='index' AND name IN('idx_presence_user_fresh','idx_presence_expiry')").get().n,2);
  assert.equal(after.prepare("PRAGMA table_info('profile_photos')").all().find(c=>c.name==='visibility').dflt_value,"'private'");
  evidence.migrationCount=15;evidence.applied=names;evidence.existingRecordProjectionsPreserved=true;evidence.foreignKeyViolations=0;evidence.sourceExactTriggers=5;evidence.presenceIndexes=2;evidence.privateVisibilityDefault=true;after.close();db.close();
  const again=execFileSync('npx',['wrangler@4.151.1','d1','migrations','apply','chatgun-auth','--remote','--config',config],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},encoding:'utf8',stdio:['ignore','pipe','pipe']});assert.match(again,/No migrations to apply/i);evidence.versionedSecondApply='No migrations to apply';evidence.stage='migrations-verified';save();
  const bindings=prod.r2_buckets||{};assert.ok(Object.keys(bindings).length===0||Object.keys(bindings).length===1&&bindings.MEDIA?.name===bucket);
  await api('/pages/projects/chatgun',{deployment_configs:{production:{r2_buckets:{MEDIA:{name:bucket}}}}},'PATCH');
  const final=await api('/pages/projects/chatgun');assert.deepEqual(final.deployment_configs.production.r2_buckets,{MEDIA:{name:bucket}});assert.deepEqual(final.deployment_configs.production.d1_databases,prod.d1_databases);assert.deepEqual(final.deployment_configs.production.env_vars,prod.env_vars);assert.deepEqual(final.deployment_configs.preview,preview);
  evidence.productionMediaBinding={MEDIA:{name:bucket}};evidence.previewPreserved=true;evidence.productionFlagsAndSecretsMetadataUnchanged=true;evidence.publicR2DevEnabled=false;evidence.enabledPublicCustomDomains=0;evidence.stage='PASS';evidence.completedAt=new Date().toISOString();save();console.log('PASS: versioned Production migrations 13–15 and private MEDIA configuration verified; user records and closed flags preserved.');
}catch{evidence.outcome='STOP: inspect recorded stage and private logs; no automatic raw SQL replay or destructive rollback';save();throw Error(evidence.outcome);}
