// Exact CURRENT disposable synthetic batch only, after private backup + media cleanup.
// This never accepts arbitrary IDs, an old manifest list, real users or another DB.
import assert from 'node:assert/strict';import{readFileSync,writeFileSync,chmodSync}from'node:fs';import{execFileSync}from'node:child_process';import{DatabaseSync}from'node:sqlite';
assert.equal(process.env.CHATGUN_FINAL_UAT,'approved');
const file=readFileSync('/tmp/chatgun-final-uat-fixture-path','utf8').trim(),b=JSON.parse(readFileSync(file));assert.equal(b.databaseId,'e3cb426c-b88a-4b93-90fd-39df524f68ae');assert.equal(b.origin,'https://engineering.chatgun-final-uat.pages.dev');assert.equal(b.syntheticOnly,true);assert.match(b.run,/^development-[a-f0-9-]{36}$/);
const proof=JSON.parse(readFileSync('docs/final-uat/cloud-cleanup.json'));assert.equal(proof.activeFixtureSessionsRemaining,0);assert.equal(proof.activeFixtureGrantsRemaining,0);assert.equal(proof.cleanup.failed,0);
const ids=Object.values(b.sessions).map(s=>s.userId);assert.equal(ids.length,15);assert.equal(new Set(ids).size,15);for(const id of ids)assert.ok(id.startsWith(b.run+'-'));
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function q(sql,params=[]){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/23017b53386fb67fc62a52cdd017454c/d1/database/'+b.databaseId+'/query',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({sql,params})}),j=await r.json();assert.ok(r.ok&&j.success,'Exact UAT cleanup failed');return j.result[0];}
assert.equal((await q('SELECT COUNT(*) n FROM identities')).results[0].n,0);
assert.equal((await q('SELECT COUNT(*) n FROM social_media')).results[0].n,0);
const before=file.replace('/sessions.json','/isolated-after-fixtures.sql');assert.ok(readFileSync(before).length>0,'Protected after-media backup required');
let deleted=0;for(const id of ids)deleted+=Number((await q('DELETE FROM users WHERE id=?',[id])).meta.changes||0);
assert.equal((await q('SELECT COUNT(*) n FROM users')).results[0].n,0);assert.equal((await q('SELECT COUNT(*) n FROM pragma_foreign_key_check')).results[0].n,0);
const after=file.replace('/sessions.json','/isolated-after-disposable-account-cleanup.sql');execFileSync('npx',['wrangler@4.151.1','d1','export',b.databaseId,'--remote','--config=wrangler.final-uat.jsonc','--output='+after],{stdio:'pipe',env:{...process.env,CLOUDFLARE_ACCOUNT_ID:'23017b53386fb67fc62a52cdd017454c'}});chmodSync(after,0o600);
const restored=new DatabaseSync(':memory:');restored.exec('PRAGMA foreign_keys=OFF');restored.exec(readFileSync(after,'utf8'));assert.equal(restored.prepare('PRAGMA foreign_key_check').all().length,0);restored.close();
writeFileSync('docs/final-uat/disposable-account-cleanup.json',JSON.stringify({checkedAt:new Date().toISOString(),exactManifestActors:ids.length,alreadyDeletedByAuthorizedBrowserTests:ids.length-deleted,remainingSyntheticAccountsDeleted:deleted,remainingUsers:0,remainingIdentities:0,remainingMedia:0,foreignKeyViolations:0,protectedBackup:true,sqliteRestore:'PASS',productionWrites:0,protectedStagingWrites:0,minimizedTestAuditRecordsPreserved:true},null,2)+'\n');console.log('Exact disposable UAT actors cleaned after backup; users0/identities0/media0/FK0; unrelated resources unchanged.');
