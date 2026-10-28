import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {accountCleanupCounts} from '../scripts/lib/uat-cleanup-counts.mjs';
const c=JSON.parse(readFileSync('wrangler.final-uat.jsonc'));
test('cleanup counts accounts rather than D1 cascade-inclusive write changes',()=>{
 assert.deepEqual(accountCleanupCounts({manifestActors:15,usersBefore:9,usersAfter:0,d1WriteChanges:180}),{exactManifestActors:15,alreadyDeletedByAuthorizedBrowserTests:6,remainingSyntheticAccountsDeleted:9,d1CascadeInclusiveWriteChanges:180,remainingUsers:0});
 assert.throws(()=>accountCleanupCounts({manifestActors:15,usersBefore:180,usersAfter:0,d1WriteChanges:180}));
});
test('dedicated UAT cannot select Production, original staging or issue13 bindings',()=>{
 assert.equal(c.name,'chatgun-final-uat');assert.equal(c.d1_databases[0].database_id,'e3cb426c-b88a-4b93-90fd-39df524f68ae');assert.equal(c.r2_buckets[0].bucket_name,'chatgun-final-uat-media');
 for(const file of ['wrangler.final-uat-privacy-cleanup.jsonc','wrangler.final-uat-media-cleanup.jsonc']){const worker=JSON.parse(readFileSync(file));assert.equal(worker.d1_databases[0].database_id,c.d1_databases[0].database_id);assert.equal(worker.workers_dev,false);assert.equal(worker.preview_urls,false);}
 const privacy=JSON.parse(readFileSync('wrangler.final-uat-privacy-cleanup.jsonc'));assert.equal(privacy.vars.UAT_AUDIT_RETENTION_DAYS,'90');assert.equal(privacy.vars.UAT_AUDIT_RETENTION_START_MODE,'actual-campaign-close');
});
test('UAT deployment explicitly serializes closed flags and real site key into Wrangler config',()=>{
 for(const k of ['OAUTH_LOGIN_ENABLED','NEW_ACCOUNT_REGISTRATION_ENABLED','BETA_INVITATION_REGISTRATION_ENABLED','SENSITIVE_CONTENT_ENABLED','IDENTITY_VERIFICATION_ENABLED','EMAIL_OTP_ENABLED','MOBILE_OTP_ENABLED','DEMO_MODE_ENABLED','MESSAGING_ENABLED','PRESENCE_ENABLED','MEDIA_UPLOAD_ENABLED'])assert.equal(c.vars[k],'false',k);
 assert.equal(c.vars.BETA_ENROLLMENT_REQUIRED,'true');assert.equal(c.vars.ADMIN_CLOUDFLARE_ACCESS_REQUIRED,'true');assert.equal(c.vars.OAUTH_ENABLED_PROVIDERS,'');assert.match(c.vars.TURNSTILE_SITE_KEY,/^0x4/);
 const deployer=readFileSync('scripts/prepare-final-uat.mjs','utf8');assert.match(deployer,/wrangler\.jsonc',JSON\.stringify\(config\(\)\)/);assert.match(deployer,/assert\.equal\(auth\.oauthLoginEnabled,false\)/);
 assert.ok(!Object.keys(c.vars).some(k=>/SECRET|PEPPER|CLIENT_ID/.test(k)),'Secrets must not be version controlled');
});
test('all 21 UAT migration history checksums match the frozen source files',()=>{
 const proof=JSON.parse(readFileSync('docs/final-uat/schema-verification.json'));
 const files=readdirSync('migrations').filter(n=>/^\d{4}.*\.sql$/.test(n)).sort();assert.equal(files.length,21);assert.equal(proof.migrationCount,21);assert.equal(proof.foreignKeyViolations,0);
 assert.deepEqual(proof.checksums,files.map(name=>({name,sha256:createHash('sha256').update(readFileSync('migrations/'+name)).digest('hex')})));
});
