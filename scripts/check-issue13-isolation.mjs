// Read-only aggregate/schema checks. No protected member rows or credentials are emitted.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const account='23017b53386fb67fc62a52cdd017454c';
const original='5bbfd55d-eb22-4324-8a7d-57bef14110ea',isolated='275d9820-6aec-494a-8bb5-b7ed9b8b74cc';
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function api(path,body){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok||!d.success)throw Error('Read-only Cloudflare check failed');return d.result;}
async function query(id,sql){const result=await api(`/d1/database/${id}/query`,{sql});assert.ok(!result[0].meta?.changed_db);return result[0].results;}
const protectedCounts={};
for(const table of ['users','identities','member_profiles','social_messages','social_relationships','profile_photos','social_media','synthetic_seed_records','synthetic_seed_objects'])protectedCounts[table]=(await query(original,`SELECT COUNT(*) n FROM ${table}`))[0].n;
assert.equal((await query(original,"SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='album_access_requests'"))[0].n,0,'Protected staging must not be migrated');
const migrations=await query(isolated,'SELECT name FROM d1_migrations ORDER BY id');assert.equal(migrations.length,13);assert.equal(migrations.at(-1).name,'0013_direct_chat_private_albums.sql');
const columns=await query(isolated,"PRAGMA table_info('profile_photos')");assert.equal(columns.find(c=>c.name==='visibility').dflt_value,"'private'");
const triggers=await query(isolated,"SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name IN ('album_request_created','album_request_transition','album_block_revokes','direct_chat_spam_guard')");
const sql=readFileSync('migrations/0013_direct_chat_private_albums.sql','utf8');
const normalize=s=>s.trim().replace(/;$/,'').replace(/\s+/g,' ');
for(const t of triggers){const source=sql.match(new RegExp('CREATE TRIGGER '+t.name+'[\\s\\S]*?\\nEND;'))?.[0];assert.ok(source);assert.equal(normalize(t.sql),normalize(source),t.name);}
assert.equal(triggers.length,4);
const fk=(await query(isolated,'SELECT COUNT(*) n FROM pragma_foreign_key_check'))[0].n;assert.equal(fk,0);
const p=await api('/pages/projects/chatgun'),preview=p.deployment_configs.preview,prod=p.deployment_configs.production;
assert.equal(preview.d1_databases.DB.id,original);assert.equal(preview.r2_buckets.MEDIA.name,'chatgun-media-staging');assert.equal(Object.keys(prod.r2_buckets||{}).length,0);
const managed=await api('/r2/buckets/chatgun-issue13-media/domains/managed');assert.equal(managed.enabled,false);
const evidence={checkedAt:new Date().toISOString(),account,protectedDatabase:original,protectedCounts,protectedAlbumMigrationApplied:false,isolatedDatabase:isolated,isolatedMigrationCount:13,foreignKeyViolations:fk,exactSourceTriggersVerified:4,privateVisibilityDefault:true,managedR2PublicAccess:false,originalBindingsUnchanged:true,productionR2Bindings:0,aggregateFingerprint:createHash('sha256').update(JSON.stringify(protectedCounts)).digest('hex'),databaseWrites:0};
if(process.env.COMPARE_ISOLATION_FILE){const before=JSON.parse(readFileSync(process.env.COMPARE_ISOLATION_FILE));assert.equal(evidence.aggregateFingerprint,before.aggregateFingerprint);evidence.protectedCountsUnchangedSinceBaseline=true;}
const output=process.env.ISOLATION_OUTPUT||'docs/issue-13/isolation-before-release.json';writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
