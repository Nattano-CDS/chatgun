// Non-destructive preparation: empty private unbound R2 + schema-only rehearsal D1.
// NEVER binds Production media, applies Production migrations, or enables flags.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
if(process.env.CHATGUN_BETA_PREPARE!=='isolated-schema-and-unbound-bucket')throw Error('Explicit isolated preparation acknowledgement required');
const account='23017b53386fb67fc62a52cdd017454c',production='9738a051-d914-42d0-8e7b-8098ef2b959d',staging='5bbfd55d-eb22-4324-8a7d-57bef14110ea';
const directory=readFileSync('/tmp/chatgun-beta-backup-path','utf8').trim();assert.ok(directory.startsWith('/Users/nattano/.codex/private-backups/chatgun/production-beta-'));
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function api(path,body){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.ok(r.ok&&j.success,'Scoped infrastructure preparation failed: '+JSON.stringify(j.errors?.map(e=>({code:e.code,message:e.message}))));return j.result;}
async function query(id,sql){assert.notEqual(id,production);assert.notEqual(id,staging);const result=await api(`/d1/database/${id}/query`,{sql});return result[0].results;}
const project=await api('/pages/projects/chatgun');assert.equal(project.deployment_configs.production.d1_databases.DB.id,production);assert.equal(project.deployment_configs.production.env_vars.MEDIA_UPLOAD_ENABLED.value,'false');assert.equal(Object.keys(project.deployment_configs.production.r2_buckets||{}).length,0);
const bucket='chatgun-media-production',buckets=await api('/r2/buckets');let createdBucket=false;
if(!(buckets.buckets||[]).some(b=>b.name===bucket)){await api('/r2/buckets',{name:bucket});createdBucket=true;}
const managed=await api(`/r2/buckets/${bucket}/domains/managed`),custom=await api(`/r2/buckets/${bucket}/domains/custom`);assert.equal(managed.enabled,false,'Stop: Production R2 must not be public');assert.equal((custom.domains||[]).filter(d=>d.enabled).length,0);
const name=process.env.BETA_REHEARSAL_NAME||'chatgun-beta-rehearsal-20261019';assert.match(name,/^chatgun-beta-rehearsal-\d{8}$/);
const databases=await api('/d1/database');let clone=databases.find(db=>db.name===name),createdDatabase=false;
if(!clone){clone=await api('/d1/database',{name});createdDatabase=true;}
const id=clone.uuid||clone.id;assert.ok(id);assert.notEqual(id,production);assert.notEqual(id,staging);assert.notEqual(id,'275d9820-6aec-494a-8bb5-b7ed9b8b74cc');
const config=directory+'/clone-wrangler.jsonc';writeFileSync(config,JSON.stringify({name:'chatgun-beta-rehearsal',compatibility_date:'2026-10-15',d1_databases:[{binding:'DB',database_name:name,database_id:id,migrations_dir:resolve('migrations')}]},null,2),{mode:0o600});
const tables=await query(id,"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'");
if(!tables.length){try{execFileSync('npx',['wrangler@4.151.1','d1','execute',name,'--remote','--config',config,'--file',directory+'/schema-with-history.sql','--yes'],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'pipe'});}catch{throw Error('Schema-only import failed in isolated rehearsal DB; Production remains untouched. Inspect clone before retrying.');}}
const baseline=await query(id,'SELECT name FROM d1_migrations ORDER BY id');assert.ok([12,15].includes(baseline.length));
const logs=[];for(let attempt=0;attempt<2;attempt++){
  try{logs.push(execFileSync('npx',['wrangler@4.151.1','d1','migrations','apply',name,'--remote','--config',config],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},encoding:'utf8',stdio:'pipe'}));}catch{throw Error('Isolated migration rehearsal failed; no Production migration was executed.');}
}
const history=await query(id,'SELECT name FROM d1_migrations ORDER BY id');assert.equal(history.length,15);assert.equal(history.at(-1).name,'0015_authenticated_online_presence.sql');
assert.match(logs[1],/No migrations to apply/i);
const fk=(await query(id,'SELECT COUNT(*) n FROM pragma_foreign_key_check'))[0].n;assert.equal(fk,0);
const triggers=await query(id,"SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name");assert.deepEqual(triggers.map(t=>t.name),['album_block_revokes','album_request_created','album_request_transition','direct_chat_spam_guard','gallery_capacity_guard']);
const users=(await query(id,'SELECT COUNT(*) n FROM users'))[0].n,identities=(await query(id,'SELECT COUNT(*) n FROM identities'))[0].n;assert.equal(users,0);assert.equal(identities,0);
const live=await api('/pages/projects/chatgun');assert.equal(live.deployment_configs.production.d1_databases.DB.id,production);assert.equal(Object.keys(live.deployment_configs.production.r2_buckets||{}).length,0);assert.equal(live.deployment_configs.preview.d1_databases.DB.id,staging);assert.equal(live.deployment_configs.preview.r2_buckets.MEDIA.name,'chatgun-media-staging');
const evidence={checkedAt:new Date().toISOString(),account,bucket,createdBucket,publicR2DevEnabled:managed.enabled,enabledPublicCustomDomains:0,productionMediaBound:false,productionUploadsEnabled:false,objectsUploaded:0,rehearsalDatabase:name,rehearsalDatabaseId:id,createdDatabase,dataImported:'Production schema and migration history only',productionPersonalRowsImported:0,users,identities,baselineMigrationCount:baseline.length,migrationCount:history.length,secondApply:'No migrations to apply',foreignKeyViolations:fk,securityTriggers:triggers.map(t=>t.name),productionD1Writes:0,protectedStagingWrites:0,applicationBindingsChanged:false,resourceDeletionExecuted:false,retainedForOwnerReview:true};
writeFileSync((process.env.BETA_EVIDENCE_DIR||'docs/beta-activation')+'/infrastructure-rehearsal.json',JSON.stringify(evidence,null,2)+'\n');writeFileSync(directory+'/cloud-rehearsal.log',logs.join('\n'),{mode:0o600});console.log(JSON.stringify(evidence,null,2));
