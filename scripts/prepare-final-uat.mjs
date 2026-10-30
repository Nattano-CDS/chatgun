// Dedicated UAT infrastructure only. Never reads/copies existing environment secrets.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,chmodSync,mkdtempSync,cpSync,readdirSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

assert.equal(process.env.CHATGUN_FINAL_UAT,'approved');
const account='23017b53386fb67fc62a52cdd017454c';
const project='chatgun-final-uat',bucket='chatgun-final-uat-media',name='chatgun-final-uat';
const candidate='4a7dee32c52bc474ee3cc50d13e293e66e771c1a';
const report='docs/final-uat';mkdirSync(report,{recursive:true});
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function cf(path,body,method=body?'POST':'GET'){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const j=await r.json();assert.ok(r.ok&&j.success,`Cloudflare ${method} ${path}: ${r.status}; codes ${(j.errors||[]).map(e=>e.code).join(',')}`);return j.result;
}
assert.equal((await cf('')).id,account);
const mode=process.argv[2];assert.ok(['create','migrate','deploy','deploy-engineering','retire-engineering','verify'].includes(mode));
let state;
try{state=JSON.parse(readFileSync(report+'/environment.json'));}catch{assert.equal(mode,'create');state={account,project,bucket,candidate,createdAt:new Date().toISOString()};}
assert.equal(state.account,account);assert.equal(state.project,project);assert.equal(state.candidate,candidate);
const save=()=>writeFileSync(report+'/environment.json',JSON.stringify(state,null,2)+'\n');
const env={...process.env,CLOUDFLARE_ACCOUNT_ID:account};
async function query(sql,params=[]){assert.ok(state.databaseId);return(await cf('/d1/database/'+state.databaseId+'/query',{sql,params}))[0];}
function config(){
 const vars={...state.flags,TURNSTILE_SITE_KEY:state.turnstileSiteKey};
 if(mode==='deploy-engineering'){
  for(const k of['SOCIAL_APP_ENABLED','MESSAGING_ENABLED','PUBLIC_DISCOVERY_ENABLED','PRESENCE_ENABLED','MEDIA_UPLOAD_ENABLED','RATINGS_ENABLED','MODERATION_TOOLS_ENABLED','ACCOUNT_MODERATION_ENABLED'])vars[k]='true';
  vars.ADULT_ONBOARDING_ENABLED='false';vars.ADMIN_CLOUDFLARE_ACCESS_REQUIRED='false';
 }
 return {$schema:'node_modules/wrangler/config-schema.json',name:project,pages_build_output_dir:'dist',compatibility_date:'2026-10-15',d1_databases:[{binding:'DB',database_name:name,database_id:state.databaseId,migrations_dir:'migrations'}],r2_buckets:[{binding:'MEDIA',bucket_name:bucket}],vars};
}
if(mode==='create'){
 const projects=await cf('/pages/projects');
 if(!projects.some(p=>p.name===project))await cf('/pages/projects',{name:project,production_branch:'reserved-no-production'});
 const p=await cf('/pages/projects/'+project);assert.equal(p.production_branch,'reserved-no-production');
 state.origin='https://uat.'+p.subdomain;state.projectSubdomain=p.subdomain;save();
 const dbs=await cf('/d1/database');const found=dbs.find(d=>d.name===name);
 if(found){assert.equal(state.databaseId,found.uuid,'Refusing to adopt an unrecorded existing database');}else{state.databaseId=(await cf('/d1/database',{name})).uuid;save();}
 assert.ok(!['9738a051-d914-42d0-8e7b-8098ef2b959d','5bbfd55d-eb22-4324-8a7d-57bef14110ea','275d9820-6aec-494a-8bb5-b7ed9b8b74cc'].includes(state.databaseId));
 const r2=await cf('/r2/buckets');if(!r2.buckets.some(b=>b.name===bucket))await cf('/r2/buckets',{name:bucket});
 assert.equal((await cf('/r2/buckets/'+bucket+'/domains/managed')).enabled,false);
 assert.equal((await cf('/r2/buckets/'+bucket+'/domains/custom')).domains.length,0);
 let vars=p.deployment_configs?.preview?.env_vars||{};
 const flags={OAUTH_LOGIN_ENABLED:'false',OAUTH_ENABLED_PROVIDERS:'',NEW_ACCOUNT_REGISTRATION_ENABLED:'false',BETA_INVITATION_REGISTRATION_ENABLED:'false',BETA_ENROLLMENT_REQUIRED:'true',ACCEPTANCE_FLOW_ENABLED:'false',ADULT_ONBOARDING_ENABLED:'true',SOCIAL_APP_ENABLED:'false',MESSAGING_ENABLED:'false',PUBLIC_DISCOVERY_ENABLED:'false',PRESENCE_ENABLED:'false',MEDIA_UPLOAD_ENABLED:'false',MEDIA_QUARANTINE_ENABLED:'true',RATINGS_ENABLED:'false',MODERATION_TOOLS_ENABLED:'false',ACCOUNT_MODERATION_ENABLED:'false',ELIGIBILITY_REVIEW_ENABLED:'true',IDENTITY_VERIFICATION_ENABLED:'false',SENSITIVE_CONTENT_ENABLED:'false',EMAIL_OTP_ENABLED:'false',MOBILE_OTP_ENABLED:'false',LINE_EMAIL_ENABLED:'false',FACEBOOK_EMAIL_ENABLED:'false',FRIEND_REQUESTS_ENABLED:'false',DEMO_MODE_ENABLED:'false',DEMO_AUTO_START_ENABLED:'false',PUBLIC_DEMO_CANARY_ENABLED:'false',ADMIN_ACCESS_STANDALONE_ENABLED:'false',ADMIN_CLOUDFLARE_ACCESS_REQUIRED:'true'};
 for(const[k,v]of Object.entries(flags))vars[k]={type:'plain_text',value:v};
 for(const k of['RATE_LIMIT_PEPPER','OTP_PEPPER'])if(!vars[k])vars[k]={type:'secret_text',value:randomBytes(48).toString('base64url')};
 const widgets=await cf('/challenges/widgets');
 if(!state.turnstileSiteKey){
  assert.ok(!widgets.some(w=>w.name==='ChatGun Final UAT'),'Do not adopt an unrecorded widget');
  const w=await cf('/challenges/widgets',{name:'ChatGun Final UAT',domains:[new URL(state.origin).hostname],mode:'managed',clearance_level:'no_clearance',bot_fight_mode:false});
  // Recoverable only in a protected local file if Pages save fails. Never emit secret.
  const dir=mkdtempSync((()=>{const root=process.env.CHATGUN_PRIVATE_ROOT;if(!root)throw new Error('CHATGUN_PRIVATE_ROOT is required');return root;})()+'/final-uat-credentials-');chmodSync(dir,0o700);
  writeFileSync(dir+'/turnstile.json',JSON.stringify({sitekey:w.sitekey,secret:w.secret}),{mode:0o600});
  vars.TURNSTILE_SITE_KEY={type:'plain_text',value:w.sitekey};vars.TURNSTILE_SECRET_KEY={type:'secret_text',value:w.secret};
  state.turnstileSiteKey=w.sitekey;state.turnstileHostname=new URL(state.origin).hostname;
 }
 await cf('/pages/projects/'+project,{deployment_configs:{preview:{compatibility_date:'2026-10-15',d1_databases:{DB:{id:state.databaseId}},r2_buckets:{MEDIA:{name:bucket}},env_vars:vars}}},'PATCH');
 state.flags=flags;state.secretsCreated=['RATE_LIMIT_PEPPER','OTP_PEPPER','TURNSTILE_SECRET_KEY'];state.publicAdmission=false;save();
 writeFileSync('wrangler.final-uat.jsonc',JSON.stringify(config(),null,2)+'\n');
 console.log('Dedicated UAT resources created; admission and services closed. Secret values were not emitted.');
}
if(mode==='migrate'){
 const c=JSON.parse(readFileSync('wrangler.final-uat.jsonc'));assert.equal(c.d1_databases[0].database_id,state.databaseId);assert.equal(c.r2_buckets[0].bucket_name,bucket);
	 const files=readdirSync('migrations').filter(n=>/^\d{4}.*\.sql$/.test(n)).sort();assert.equal(files.length,22);
 const rehearsal=new DatabaseSync(':memory:');for(const f of files)rehearsal.exec(readFileSync('migrations/'+f,'utf8'));
 assert.equal(rehearsal.prepare('PRAGMA foreign_key_check').all().length,0);rehearsal.close();
 execFileSync('npx',['wrangler@4.151.1','d1','migrations','apply',name,'--remote','--config=wrangler.final-uat.jsonc'],{env,stdio:'pipe'});
 const history=(await query('SELECT name FROM d1_migrations ORDER BY id')).results.map(r=>r.name);assert.deepEqual(history,files);
 await query('CREATE TABLE IF NOT EXISTS uat_migration_checksums(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL CHECK(length(sha256)=64))');
 const checksums=files.map(f=>({name:f,sha256:createHash('sha256').update(readFileSync('migrations/'+f)).digest('hex')}));
 for(const c of checksums)await query('INSERT OR IGNORE INTO uat_migration_checksums VALUES(?,?)',[c.name,c.sha256]);
 assert.deepEqual((await query('SELECT * FROM uat_migration_checksums ORDER BY name')).results,checksums);
 const dir=mkdtempSync((()=>{const root=process.env.CHATGUN_PRIVATE_ROOT;if(!root)throw new Error('CHATGUN_PRIVATE_ROOT is required');return root;})()+'/final-uat-schema-');chmodSync(dir,0o700);
	 const file=dir+'/schema22.sql';execFileSync('npx',['wrangler@4.151.1','d1','export',name,'--remote','--config=wrangler.final-uat.jsonc','--output='+file],{env,stdio:'pipe'});chmodSync(file,0o600);
 const restored=new DatabaseSync(':memory:');restored.exec('PRAGMA foreign_keys=OFF');restored.exec(readFileSync(file,'utf8'));assert.equal(restored.prepare('PRAGMA foreign_key_check').all().length,0);
 const objects=(await query("SELECT type,name FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type,name")).results;
 assert.equal((await query('SELECT COUNT(*) n FROM users')).results[0].n,0);
 const proof={checkedAt:new Date().toISOString(),databaseId:state.databaseId,migrationCount:history.length,checksums,objects,foreignKeyViolations:0,protectedBackup:true,sqliteRestoreRehearsal:'PASS',productionWrites:0,protectedStagingWrites:0};
	 writeFileSync(report+'/schema-verification.json',JSON.stringify(proof,null,2)+'\n');restored.close();state.schema=22;save();console.log('New UAT schema22, checksums, FK0 and protected SQLite restore rehearsal PASS.');
}
if(mode==='deploy'||mode==='deploy-engineering'||mode==='retire-engineering'){
	 assert.equal(state.schema,22);
 if(mode==='deploy-engineering'){
  const p=await cf('/pages/projects/'+project);
  assert.ok(!['LINE_CLIENT_SECRET','GOOGLE_CLIENT_SECRET','FACEBOOK_CLIENT_SECRET'].some(k=>p.deployment_configs.preview.env_vars?.[k]),'Synthetic engineering is forbidden after genuine credentials are provisioned');
  assert.equal((await query('SELECT COUNT(*) n FROM identities')).results[0].n,0);
  assert.equal((await query('SELECT COUNT(*) n FROM beta_invitations')).results[0].n,0);
 }
 const dir=mkdtempSync('/tmp/chatgun-final-uat-build-');
 execFileSync('git',['clone','--shared','--no-checkout',process.cwd(),dir],{stdio:'pipe'});execFileSync('git',['checkout','--detach',candidate],{cwd:dir,stdio:'pipe'});
 // Unapproved expanded-UAT policies must not be published as accepted policy text.
 execFileSync('node',['scripts/build-pages.mjs'],{cwd:dir,env:{...env,CHATGUN_RELEASE_MODE:'default',CHATGUN_CANARY_BUILD:'true'},stdio:'pipe'});
 assert.equal(JSON.parse(readFileSync(dir+'/dist/release.json')).commit,candidate);
 writeFileSync(dir+'/wrangler.jsonc',JSON.stringify(config()));
 const branch=mode==='deploy'?'uat':'engineering';
 execFileSync('npx',['wrangler@4.151.1','pages','deploy','dist','--project-name='+project,'--branch='+branch,'--commit-hash='+candidate,'--commit-dirty=true'],{cwd:dir,env,stdio:'pipe'});
 const p=await cf('/pages/projects/'+project);const d=p.latest_deployment;assert.equal(d.deployment_trigger.metadata.commit_hash,candidate);assert.equal(d.environment,'preview');
 if(branch==='uat'){state.deploymentId=d.id;state.immutableUrl=d.url;state.deployedSha=candidate;state.deployedAt=new Date().toISOString();}
 else state.syntheticEngineering={deploymentId:d.id,immutableUrl:d.url,origin:'https://engineering.'+p.subdomain,sha:candidate,genuineAdmission:false,accessMfaEvidence:false,closed:mode==='retire-engineering'};
 save();console.log('Frozen candidate deployed to dedicated '+branch+' Preview only.');
}
if(mode==='verify'){
 const p=await cf('/pages/projects/'+project);assert.equal(p.deployment_configs.preview.d1_databases.DB.id,state.databaseId);assert.equal(p.deployment_configs.preview.r2_buckets.MEDIA.name,bucket);
 const release=await(await fetch(state.origin+'/release.json',{cache:'no-store'})).json();assert.equal(release.commit,candidate);
 assert.equal((await cf('/r2/buckets/'+bucket+'/domains/managed')).enabled,false);assert.equal((await cf('/r2/buckets/'+bucket+'/domains/custom')).domains.length,0);
 const widget=(await cf('/challenges/widgets')).find(w=>w.sitekey===state.turnstileSiteKey);assert.deepEqual(widget.domains,[new URL(state.origin).hostname]);
 const auth=await(await fetch(state.origin+'/api/auth/config')).json();assert.equal(auth.oauthLoginEnabled,false);assert.deepEqual(auth.oauthProviders,[]);assert.equal(auth.turnstileSiteKey,state.turnstileSiteKey);assert.equal(auth.newAccountRegistrationEnabled,false);assert.equal(auth.invitationOnlyRegistrationEnabled,false);
 state.verifiedAt=new Date().toISOString();state.r2Private=true;state.turnstileConfigured=true;state.credentialMetadata=Object.fromEntries(['TURNSTILE_SECRET_KEY','RATE_LIMIT_PEPPER','OTP_PEPPER','LINE_CLIENT_ID','LINE_CLIENT_SECRET','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','FACEBOOK_CLIENT_ID','FACEBOOK_CLIENT_SECRET'].map(k=>[k,{present:Boolean(p.deployment_configs.preview.env_vars?.[k]),encrypted:p.deployment_configs.preview.env_vars?.[k]?.type==='secret_text'}]));save();console.log('Live UAT exact SHA, isolated bindings, private R2 and Turnstile hostname PASS.');
}
