// SELECT-only verification. Private identifiers never enter the public evidence.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {approvedOwnerPilot,ownerPilotVars} from './lib/owner-pilot-release.mjs';
process.umask(0o077);
const account='23017b53386fb67fc62a52cdd017454c',db='9738a051-d914-42d0-8e7b-8098ef2b959d';
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function api(path,body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.ok(r.ok&&j.success,'Scoped read-only query failed');return j.result;}
async function select(sql,params=[]){const result=(await api('/d1/database/'+db+'/query',{sql,params}))[0];assert.equal(result.meta.changed_db,false);return result.results;}
const approval=approvedOwnerPilot(),project=await api('/pages/projects/chatgun'),env=project.deployment_configs.production;
assert.equal(env.d1_databases.DB.id,db);for(const[k,v]of Object.entries(ownerPilotVars(approval)))assert.equal(env.env_vars[k]?.value,v,k);
const schema={};for(const table of ['beta_invitations','beta_enrollments','users','identities','sessions','account_acceptances','member_profiles','age_assurance_events','member_presence_preferences'])schema[table]=await select('PRAGMA table_info('+table+')');
const invitation=JSON.parse(readFileSync('/Users/nattano/.codex/private-backups/chatgun/owner-pilot-invitation-20261020.json'));
const rows=await select(`SELECT i.id,i.use_count,i.max_uses,i.consumed_at,e.user_id,e.status enrollment_status,u.status,u.account_state,
  (SELECT COUNT(*) FROM identities x WHERE x.user_id=u.id AND x.provider='line') line_identities,
  (SELECT COUNT(*) FROM account_acceptances a WHERE a.user_id=u.id AND a.adult_notice_version=? AND a.terms_version=? AND a.privacy_version=? AND a.adult_declared_at>0 AND a.terms_accepted_at>0 AND a.privacy_acknowledged_at>0) approved_acceptances,
  (SELECT COUNT(*) FROM member_profiles p WHERE p.user_id=u.id) profiles,
  (SELECT COUNT(*) FROM age_assurance_events a WHERE a.user_id=u.id AND a.method='self_declaration' AND a.revoked_at IS NULL) age_declarations,
  (SELECT COUNT(*) FROM sessions s WHERE s.user_id=u.id AND s.revoked_at IS NULL AND s.expires_at>unixepoch()) active_sessions,
  (SELECT COUNT(*) FROM sessions s WHERE s.user_id=u.id AND s.revoked_at IS NOT NULL) revoked_sessions
  FROM beta_invitations i LEFT JOIN beta_enrollments e ON e.invitation_id=i.id LEFT JOIN users u ON u.id=e.user_id WHERE i.token_hash=?`,[approval.versions.adultNotice,approval.versions.terms,approval.versions.privacy,createHash('sha256').update(invitation.code).digest('base64url')]);
assert.equal(rows.length,1,'Invitation must correlate to exactly one enrollment');const owner=rows[0];assert.ok(owner.user_id,'No genuine enrollment found');
const profile=(await select(`SELECT name,gender,bio,interests,discovery_visible,latitude IS NOT NULL OR longitude IS NOT NULL AS precise_location_stored,direct_messages_enabled FROM member_profiles WHERE user_id=?`,[owner.user_id]))[0];
const counts={};for(const t of ['users','identities','member_profiles','sessions','beta_invitations','social_messages','social_media','moderation_roles'])counts[t]=(await select('SELECT COUNT(*) n FROM '+t))[0].n;
const release=await(await fetch('https://chatgun.social/release.json',{cache:'no-store'})).json();assert.equal(release.commit,project.canonical_deployment.deployment_trigger.metadata.commit_hash);
const result={checkedAt:new Date().toISOString(),productionSha:release.commit,invitationConsumedExactlyOnce:owner.use_count===1&&owner.max_uses===1&&!!owner.consumed_at,enrollmentActive:owner.enrollment_status==='active',accountActive:owner.status==='active'&&owner.account_state==='active',lineIdentityLinked:owner.line_identities===1,approvedAcceptance:owner.approved_acceptances===1,selfDeclaredAgeRecorded:owner.age_declarations===1,profilePersisted:owner.profiles===1,activeSessions:owner.active_sessions,revokedSessions:owner.revoked_sessions,profileFields:profile?{namePresent:!!profile.name,genderPresent:!!profile.gender,bioPresent:!!profile.bio,interestsPresent:!!profile.interests,discoveryVisible:!!profile.discovery_visible,preciseLocationStored:!!profile.precise_location_stored,directMessagesPreference:!!profile.direct_messages_enabled}:null,counts,foreignKeyViolations:(await select('SELECT COUNT(*) n FROM pragma_foreign_key_check'))[0].n,duplicateProviderSubjects:(await select('SELECT COUNT(*) n FROM (SELECT provider,subject FROM identities GROUP BY provider,subject HAVING COUNT(*)>1)'))[0].n,presencePreferenceStored:(await select('SELECT COUNT(*) n FROM member_presence_preferences WHERE user_id=?',[owner.user_id]))[0].n,flagsPreserved:true,rolesGrantedByVerifier:0,productionWrites:0,historicalProviderTranscript:'Not retained; code path and persisted records support genuine completion, not a replay of historical token/claims evidence'};
writeFileSync('/Users/nattano/.codex/private-backups/chatgun/verified-owner-account-20261020.json',JSON.stringify({userId:owner.user_id,invitationId:owner.id,profile,schema,verifiedAt:result.checkedAt},null,2),{mode:0o600});
writeFileSync('docs/production-pilot-20261020/genuine-owner-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
