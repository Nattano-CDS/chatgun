// Additive migrations ONLY on the disposable issue13 test database. No account,
// Production, protected staging, R2, user, role or fixture mutations are allowed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

assert.equal(process.env.CHATGUN_AGE_ADMIN_STAGING_MIGRATIONS, 'approved');
const account='23017b53386fb67fc62a52cdd017454c',database='275d9820-6aec-494a-8bb5-b7ed9b8b74cc';
const config=JSON.parse(readFileSync('wrangler.issue13.jsonc','utf8'));
assert.equal(config.name,'chatgun-issue13-staging');assert.equal(config.d1_databases[0].database_id,database);
assert.equal(config.r2_buckets[0].bucket_name,'chatgun-issue13-media');
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function cf(path,body){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const j=await r.json();assert.ok(r.ok&&j.success,'Scoped Cloudflare request failed');return j.result;
}
assert.equal((await cf('')).id,account);
const query=async sql=>{const r=(await cf('/d1/database/'+database+'/query',{sql}))[0];assert.equal(r.meta.changed_db,false);return r.results;};
const applied=(await query('SELECT name FROM d1_migrations ORDER BY id')).map(r=>r.name);
const source=readdirSync('migrations').filter(n=>/^\d{4}.*\.sql$/u.test(n)).sort();assert.equal(source.length,21);
assert.ok([17,19,20,21].includes(applied.length),'Unexpected isolated migration state');assert.deepEqual(applied,source.slice(0,applied.length));
if(applied.length===21){assert.equal((await query('SELECT COUNT(*) n FROM pragma_foreign_key_check'))[0].n,0);console.log('Isolated schema21 already applied; FK0; no migration or data changes');process.exit(0);}
assert.deepEqual(source.slice(17),['0018_cloudflare_admin_sessions.sql','0019_member_age_safety_holds.sql','0020_age_hold_write_guards.sql','0021_eligibility_review_requests.sql']);
const pending=source.slice(applied.length);
const directory=mkdtempSync((()=>{const root=process.env.CHATGUN_PRIVATE_ROOT;if(!root)throw new Error('CHATGUN_PRIVATE_ROOT is required');return root;})()+'/age-admin-isolated-schema-');chmodSync(directory,0o700);
function exported(name){
 const file=directory+'/'+name+'.sql';
 execFileSync('npx',['wrangler@4.151.1','d1','export','chatgun-issue13-staging','--remote','--config','wrangler.issue13.jsonc','--output',file],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'pipe'});chmodSync(file,0o600);
 const local=new DatabaseSync(':memory:');local.exec('PRAGMA foreign_keys=OFF');local.exec(readFileSync(file,'utf8'));
 assert.equal(local.prepare('PRAGMA foreign_key_check').all().length,0);return{local,file};
}
function fingerprints(db){const result={};for(const{name}of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'d1_migrations'").all()){
 const rows=db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all().map(r=>JSON.stringify(r)).sort();
 result[name]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
}return result;}
const before=exported('before'),old=fingerprints(before.local);
// Rehearse against the protected export before touching isolated D1.
for(const name of pending)before.local.exec(readFileSync('migrations/'+name,'utf8'));
assert.equal(before.local.prepare('PRAGMA foreign_key_check').all().length,0);
for(const[name,value]of Object.entries(old))assert.deepEqual(fingerprints(before.local)[name],value);
execFileSync('npx',['wrangler@4.151.1','d1','migrations','apply','chatgun-issue13-staging','--remote','--config','wrangler.issue13.jsonc'],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'pipe'});
const after=exported('after'),current=fingerprints(after.local);
for(const[name,value]of Object.entries(old))assert.deepEqual(current[name],value,'Existing isolated table changed: '+name);
if(!old.cloudflare_admin_sessions)assert.equal(current.cloudflare_admin_sessions.count,0);
if(!old.member_age_safety_holds)assert.equal(current.member_age_safety_holds.count,0);
assert.equal((await query('SELECT COUNT(*) n FROM d1_migrations'))[0].n,21);assert.equal((await query('SELECT COUNT(*) n FROM pragma_foreign_key_check'))[0].n,0);
writeFileSync(directory+'/verification.json',JSON.stringify({account,database,migrations:pending,old,current,foreignKeyViolations:0,productionWrites:0,protectedStagingWrites:0},null,2),{mode:0o600});
console.log(JSON.stringify({database,migrationsApplied:pending.length,migrationCount:21,foreignKeyViolations:0,oldTablesPreserved:Object.keys(old).length,backupProtected:true,productionWrites:0,protectedStagingWrites:0}));
before.local.close();after.local.close();
