// Simulate the existing batch cleanup against the protected backup, never remote data.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const directory=readFileSync('/tmp/chatgun-issue16-backup-path','utf8').trim();
assert.ok(directory.startsWith((()=>{const root=process.env.CHATGUN_PRIVATE_ROOT;if(!root)throw new Error('CHATGUN_PRIVATE_ROOT is required');return root;})()+'/issue-16-'));
const backup=directory+'/staging.sql',bytes=readFileSync(backup),db=new DatabaseSync(':memory:');
assert.equal(statSync(backup).mode&0o077,0,'Backup must be private');
db.exec(bytes.toString());db.exec('PRAGMA foreign_keys=ON');
const batch='chatgun-owner-review-v1';
const tracked=db.prepare('SELECT record_type,record_id FROM synthetic_seed_records WHERE batch_id=?').all(batch);
const allowed=new Map();for(const row of tracked){if(!allowed.has(row.record_type))allowed.set(row.record_type,new Set());allowed.get(row.record_type).add(row.record_id);}
const tables=db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name);
const snapshot=()=>Object.fromEntries(tables.map(table=>[table,db.prepare('SELECT * FROM "'+table.replaceAll('"','""')+'"').all()]));
const before=snapshot();db.exec('BEGIN');
db.exec(`DELETE FROM media_deletion_queue WHERE object_key IN(SELECT object_key FROM synthetic_seed_objects WHERE batch_id='${batch}');
DELETE FROM media_moderation_decisions WHERE id IN(SELECT record_id FROM synthetic_seed_records WHERE batch_id='${batch}' AND record_type='media_moderation_decisions');
DELETE FROM users WHERE id IN(SELECT record_id FROM synthetic_seed_records WHERE batch_id='${batch}' AND record_type='users') AND email LIKE '%@synthetic.chatgun.invalid';
DELETE FROM synthetic_seed_batches WHERE id='${batch}';`);
const after=snapshot(),untracked=[];let deleted=0;
for(const table of tables){
  const remaining=new Set(after[table].map(row=>JSON.stringify(row)));
  for(const row of before[table])if(!remaining.has(JSON.stringify(row))){
    deleted++;
    const id=String(row.id||row.token_hash||row.media_id||row.user_id||'');
    if(!table.startsWith('synthetic_seed_')&&!allowed.get(table)?.has(id))untracked.push({table,id});
  }
}
const violations=db.prepare('PRAGMA foreign_key_check').all().length;db.exec('ROLLBACK');db.close();
const summary={checkedAt:new Date().toISOString(),batch,database:'chatgun-auth-staging',databaseId:'5bbfd55d-eb22-4324-8a7d-57bef14110ea',backupBytes:bytes.length,backupSha256:createHash('sha256').update(bytes).digest('hex'),backupMode:'0600',backupLocation:'protected outside repository',trackedRecords:tracked.length,simulatedAffectedRows:deleted,simulatedForeignKeyViolations:violations,untrackedAffectedCounts:Object.fromEntries([...new Set(untracked.map(r=>r.table))].map(t=>[t,untracked.filter(r=>r.table===t).length])),safeToExecute:untracked.length===0,remoteWrites:0};
writeFileSync(directory+'/untracked-cleanup-records.json',JSON.stringify(untracked,null,2),{mode:0o600});
writeFileSync('docs/issue-16/cleanup-audit.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
