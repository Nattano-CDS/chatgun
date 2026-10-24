// Sole approved first-owner bootstrap. No public endpoint, credentials or identifiers printed.
import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';
import{readFileSync,writeFileSync,mkdtempSync,existsSync,statSync}from'node:fs';import{randomUUID,createHash}from'node:crypto';import{DatabaseSync}from'node:sqlite';
import{ownerAdminStatements,OWNER_ADMIN_ROLES}from'./lib/owner-admin-bootstrap.mjs';
if(process.env.CHATGUN_OWNER_ADMIN_APPROVAL!=='confirmed-private-owner-report-safety-seven-days')throw Error('Exact account/role/duration approval required; no grant made');
process.umask(0o077);const account='23017b53386fb67fc62a52cdd017454c',database='9738a051-d914-42d0-8e7b-8098ef2b959d',out='docs/production-pilot-20261020';
const receipt='/Users/nattano/.codex/private-backups/chatgun/owner-admin-approval-20261020.json';
assert.ok(!existsSync(receipt),'Existing operation requires inspection, never grant again blindly');
const privateFile='/Users/nattano/.codex/private-backups/chatgun/verified-owner-account-20261020.json';assert.equal(statSync(privateFile).mode&511,384);const{userId}=JSON.parse(readFileSync(privateFile));
const{token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function api(path,body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.ok(r.ok&&j.success,'Scoped owner bootstrap failed; no sensitive response printed');return j.result;}
async function select(sql,params=[]){const r=(await api('/d1/database/'+database+'/query',{sql,params}))[0];assert.equal(r.meta.changed_db,false);return r.results;}
assert.equal((await api('')).id,account);assert.equal((await api('/d1/database/'+database)).name,'chatgun-auth');const project=await api('/pages/projects/chatgun'),prod=project.deployment_configs.production;
assert.equal(prod.d1_databases.DB.id,database);assert.equal(prod.r2_buckets.MEDIA.name,'chatgun-media-production');
for(const flag of ['NEW_ACCOUNT_REGISTRATION_ENABLED','MESSAGING_ENABLED','PUBLIC_DISCOVERY_ENABLED','PRESENCE_ENABLED','MEDIA_UPLOAD_ENABLED','MODERATION_TOOLS_ENABLED','SENSITIVE_CONTENT_ENABLED'])assert.equal(prod.env_vars[flag].value,'false',flag);
const now=Math.floor(Date.now()/1000);const target=(await select(`SELECT u.id,
 EXISTS(SELECT 1 FROM sessions s JOIN session_auth_evidence a ON a.token_hash=s.token_hash WHERE s.user_id=u.id AND s.revoked_at IS NULL AND s.expires_at>? AND a.expires_at>? AND a.authenticated_at>=?-600) recent,
 (SELECT COUNT(*) FROM moderation_access_grants) grants,
 (SELECT COUNT(*) FROM moderation_roles) legacy,
 (SELECT COUNT(*) FROM moderation_role_events) events
 FROM users u JOIN beta_enrollments e ON e.user_id=u.id AND e.status='active' JOIN identities i ON i.user_id=u.id AND i.provider='line'
 WHERE u.id=? AND u.status='active' AND u.account_state='active'`,[now,now,now,userId]))[0];assert.equal(target?.id,userId);assert.equal(target.recent,1,'Owner must reauthenticate within ten minutes before bootstrap; no grant made');assert.equal(target.grants,0);assert.equal(target.legacy,0);assert.equal(target.events,0);
const dir=mkdtempSync('/Users/nattano/.codex/private-backups/chatgun/pre-owner-admin-');const cfg=dir+'/wrangler.jsonc';writeFileSync(cfg,JSON.stringify({name:'chatgun-owner-admin-backup',compatibility_date:'2026-10-15',d1_databases:[{binding:'DB',database_name:'chatgun-auth',database_id:database}]}),{mode:0o600});
execFileSync('npx',['wrangler@4.151.1','d1','export','chatgun-auth','--remote','--config',cfg,'--output',dir+'/production.sql'],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'pipe'});
const backup=readFileSync(dir+'/production.sql');const local=new DatabaseSync(':memory:');local.exec(backup.toString());assert.equal(local.prepare('PRAGMA foreign_key_check').all().length,0);assert.equal(local.prepare('SELECT COUNT(*) n FROM users').get().n,1);assert.equal(local.prepare('SELECT COUNT(*) n FROM moderation_access_grants').get().n,0);local.close();
writeFileSync(dir+'/time-travel.json',JSON.stringify(await api('/d1/database/'+database+'/time_travel/bookmark')),{mode:0o600});
// D1 REST supports parameterized batch, not shell-interpolated real user identifiers.
const statements=ownerAdminStatements({userId,now:Math.floor(Date.now()/1000),ids:Array.from({length:4},randomUUID)});
const result=await api('/d1/database/'+database+'/query',{batch:statements});assert.equal(result.length,4);assert.ok(result.every(r=>r.success&&Number(r.meta.changes)===1),'Inspect partial operation privately; never retry blindly');
const grants=await select('SELECT id,role,expires_at FROM moderation_access_grants WHERE user_id=? ORDER BY role',[userId]);assert.deepEqual(grants.map(g=>g.role),OWNER_ADMIN_ROLES);assert.equal((await select('SELECT COUNT(*) n FROM moderation_role_events WHERE target_user_id=?',[userId]))[0].n,2);
writeFileSync(receipt,JSON.stringify({ownerApproved:true,scope:'owner-admin-seven-days',account,database,userId,roles:OWNER_ADMIN_ROLES,grants,expiresAt:grants[0].expires_at,createdAt:new Date().toISOString(),backupDirectory:dir,moderationToolsApproved:true,publicRegistrationApproved:false,broaderServicesApproved:false},null,2),{mode:0o600,flag:'wx'});
writeFileSync(out+'/owner-admin-bootstrap.json',JSON.stringify({checkedAt:new Date().toISOString(),account,database,roles:OWNER_ADMIN_ROLES,days:7,expiresAt:grants[0].expires_at,grantCount:2,auditEvents:2,ownerPrivateUuidReconfirmed:true,backupSha256:createHash('sha256').update(backup).digest('hex'),backupPermissions:'0700 directory / 0600 files',backupRestoredLocally:true,rolesExcluded:['moderation_admin','identity_reviewer'],otherFeatureFlagsUnchanged:true,existingUserPreserved:true},null,2)+'\n');
console.log('Approved seven-day report/safety grants and two audit events verified. Backup protected; no IDs printed. Moderation feature flag remains off until tested deployment.');
