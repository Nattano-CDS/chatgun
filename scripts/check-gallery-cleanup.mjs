// Only the separately isolated synthetic D1/R2 environment. Never Production.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {drainMediaDeletionQueue} from '../workers/media-cleanup.js';
const account='23017b53386fb67fc62a52cdd017454c',database='275d9820-6aec-494a-8bb5-b7ed9b8b74cc',bucket='chatgun-issue13-media';
if(process.env.CHATGUN_ISOLATED_STAGING!=='issue13')throw Error('Isolated staging acknowledgement required');
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function cf(path,body){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok||!d.success)throw Error('Isolated cleanup check failed');return d.result;}
const p=await cf('/pages/projects/chatgun-issue13-staging');assert.equal(p.deployment_configs.preview.d1_databases.DB.id,database);assert.equal(p.deployment_configs.preview.r2_buckets.MEDIA.name,bucket);
async function query(sql,params=[]){return (await cf(`/d1/database/${database}/query`,{sql,params}))[0];}
// Diagnostic REST adapter only; application D1.batch atomicity is covered by
// Worker integration tests. Retry operations here are intentionally idempotent.
const db={async batch(statements){const results=[];for(const statement of statements)results.push(await statement.run());return results;},prepare(sql){let params=[];return {bind(...v){params=v;return this;},async first(){return (await query(sql,params)).results[0]||null;},async all(){return query(sql,params);},async run(){return query(sql,params);}};}};
const cleanup=await drainMediaDeletionQueue({DB:db,MEDIA:{async delete(key){assert.match(key,/^(gallery|chat)\/[a-f0-9-]+$/);execFileSync('npx',['wrangler@4.151.1','r2','object','delete',bucket+'/'+key,'--remote'],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'pipe'});}}});
assert.equal(cleanup.failed,0);
const bundle=JSON.parse(readFileSync('/tmp/chatgun-issue13-sessions.json'));
const rows=(await query("SELECT object_key,byte_size FROM social_media WHERE owner_user_id=? AND state='active'",[bundle.ids.owner])).results;
for(const row of rows){const bytes=execFileSync('npx',['wrangler@4.151.1','r2','object','get',bucket+'/'+row.object_key,'--remote','--pipe'],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:['ignore','pipe','pipe']});assert.equal(bytes.length,row.byte_size);}
const fk=(await query('SELECT count(*) n FROM pragma_foreign_key_check')).results[0].n;assert.equal(fk,0);
const pending=(await query('SELECT count(*) n FROM media_deletion_queue WHERE completed_at IS NULL')).results[0].n;assert.equal(pending,0);
const result={checkedAt:new Date().toISOString(),database,bucket,cleanup,knownActiveRunObjectsVerified:rows.length,pendingDeletions:pending,foreignKeyViolations:fk,protectedStagingTouched:false,productionTouched:false,scope:'known synthetic test-run objects and scheduled deletion queue; not an exhaustive bucket inventory'};
writeFileSync('docs/gallery-approved/cleanup-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
