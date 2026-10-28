import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { PROPOSED_POLICY, finalUatSocialVars, validateFinalUatSocialApproval } from '../scripts/lib/final-uat-social-campaign.mjs';
import { SESSION_TTL_SECONDS } from '../functions/_lib/db.js';
import { findOrCreateIdentity } from '../functions/_lib/db.js';
import { TestD1 } from './helpers/d1.js';

function receipt() {
  const participant=(reference,provider,hash)=>({reference,provider,providerAccountReferencePrivate:'',providerAccountReferenceSha256:hash,genuineDistinctAdultConfirmed:true,age20PlusConfirmed:true,individualConsentConfirmed:true,providerTesterEligible:true,socialScopeConsent:true,locationScopeConsent:true,chatScopeConsent:true,presenceScopeConsent:true,privacyScopeConsent:true,disposableTestDataConsent:true,alwaysOnAccessConsent:true,outOfHoursModerationAcknowledged:true,mediaConsentUsed:false,accountDeletionConsent:reference==='B'});
  return {scope:'final-uat-always-on-private-social-location-chat-privacy',ownerAuthorizationComment:6473130647,policyApproved:true,applicationSha:'c'.repeat(40),policyVersions:PROPOSED_POLICY.versions,policyFiles:PROPOSED_POLICY.files,operations:{moderationCoverage:'19:00-22:00 Asia/Bangkok daily',no24x7OrBackupModeratorClaim:true,participantAccess:'24x7-until-explicit-owner-close-or-safety-kill-switch',accessRestrictedToModerationHours:false,automatic2200Shutdown:false,mediaEnabled:false,publicRegistrationEnabled:false,youthAdmissionEnabled:false,productionChangesAuthorized:false,retentionDecision:'campaign-plus-7-days-logical-cleanup-with-recovery-caveat',recoveryCaveatAcknowledged:true,auditEvidenceRetentionDays:90,auditEvidenceRetentionStartsAt:'actual-campaign-close',auditEvidenceScope:'strictly-necessary-minimized-security-audit-only',auditEvidencePhysicalBackupLimitClaimed:false,actualCampaignClosedAt:null,auditEvidenceExpiresAt:null,ownerAccountDeletionAuthorized:false},window:{timezone:'Asia/Bangkok',start:'2026-10-29T19:00:00+07:00',end:'2026-10-29T22:00:00+07:00'},participants:[participant('A','line','a'.repeat(64)),participant('B','google','b'.repeat(64))]};
}

test('always-on approval is independent of every member access clock hour',()=>{
  const approved=receipt();
  for(let hour=0;hour<24;hour+=1){
    assert.doesNotThrow(()=>validateFinalUatSocialApproval(approved),`hour ${hour}`);
    assert.equal(finalUatSocialVars(approved).UAT_ACCESS_MODE,'always-on-until-explicit-close');
  }
  assert.equal(SESSION_TTL_SECONDS,30*24*60*60,'return sessions must cross midnight without reinvitation');
});

test('activation and initial invitations contain no kickoff-window access cutoff',()=>{
  const activation=readFileSync('scripts/activate-final-uat-social.mjs','utf8');
  const invitations=readFileSync('scripts/issue-final-uat-invitations.mjs','utf8');
  assert.doesNotMatch(activation,/Date\.parse\(receipt\.window|approved window|22:00/u);
  assert.doesNotMatch(invitations,/Date\.parse\(receipt\.window|full 30-minute invitation lifetime.*window/u);
  assert.match(invitations,/expiresAt = issuedAt \+ 1800/u);
  assert.match(activation,/ACTIVATED_ALWAYS_ON_PRIVATE_UNTIL_EXPLICIT_CLOSE/u);
});

test('schema22 creates exactly two-bindable server-side UAT identities',()=>{
  const db=new DatabaseSync(':memory:');
  for(const file of readdirSync('migrations').filter(name=>/^\d{4}.*\.sql$/u.test(name)).sort())db.exec(readFileSync(`migrations/${file}`,'utf8'));
  const columns=db.prepare('PRAGMA table_info(uat_authorized_identities)').all().map(row=>row.name);
  for(const column of ['participant_ref','provider','account_reference_sha256','invitation_id','user_id','provider_subject_sha256','revoked_at'])assert.ok(columns.includes(column),column);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM pragma_foreign_key_check').get().n,0);
  db.close();
});

test('unauthorized invitation cannot create an orphan account and authorized binding commits atomically',async()=>{
  const db=new TestD1();
  const now=1_800_000_000;
  await db.prepare("INSERT INTO beta_invitations(id,token_hash,label,max_uses,use_count,expires_at,created_at,uat_participant_ref,uat_required_provider,uat_account_reference_sha256) VALUES('invite-a','hash-a','A',1,0,?,?, 'A','line',?)").bind(now+1800,now,'a'.repeat(64)).run();
  const profile={provider:'line',subject:'provider-subject-a',email:null,emailVerified:false,name:'A',picture:null};
  await assert.rejects(()=>findOrCreateIdentity(db,profile,null,now,{allowRegistration:false,allowInvitationRegistration:true,invitationId:'invite-a',authorizedCohort:true}),/invitation_unavailable/);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM users').first()).n,0);
  assert.equal((await db.prepare("SELECT use_count FROM beta_invitations WHERE id='invite-a'").first()).use_count,0);
  await db.prepare("INSERT INTO uat_authorized_identities(participant_ref,provider,account_reference_sha256,consented_at) VALUES('A','line',?,?)").bind('a'.repeat(64),now).run();
  const userId=await findOrCreateIdentity(db,profile,null,now,{allowRegistration:false,allowInvitationRegistration:true,invitationId:'invite-a',authorizedCohort:true});
  const bound=await db.prepare("SELECT user_id,provider_subject_sha256 FROM uat_authorized_identities WHERE participant_ref='A'").first();
  assert.equal(bound.user_id,userId);
  assert.match(bound.provider_subject_sha256,/^[A-Za-z0-9_-]{43}$/);
  assert.equal((await db.prepare("SELECT use_count FROM beta_invitations WHERE id='invite-a'").first()).use_count,1);
  db.close();
});

test('server paths enforce provider-bound enrollment and authorized cohort on every social request',()=>{
  const auth=readFileSync('functions/api/auth/[[path]].js','utf8');
  const social=readFileSync('functions/api/social/[[path]].js','utf8');
  assert.match(auth,/uat_required_provider !== provider/u);
  assert.match(auth,/provider_subject_sha256/u);
  assert.match(auth,/uat_cohort_denied/u);
  assert.match(social,/UAT_PRIVATE_COHORT_REQUIRED/u);
  assert.match(social,/uat_authorized_identities WHERE user_id=\?/u);
});

test('explicit close remains the only retention clock start',()=>{
  const close=readFileSync('scripts/record-final-uat-campaign-close.mjs','utf8');
  assert.match(close,/record-actual-close/u);
  assert.match(close,/now \+ UAT_AUDIT_RETENTION_SECONDS/u);
  assert.doesNotMatch(close,/receipt\.window\.end.*expiresAt/u);
  assert.match(close,/UPDATE sessions SET revoked_at/);
  assert.match(close,/UPDATE uat_authorized_identities SET revoked_at/);
  assert.match(close,/DELETE FROM social_messages/);
  assert.match(close,/DELETE FROM member_profiles/);
  assert.match(close,/participantAAccountDeleted: false/);
  assert.match(close,/participantBDeletionRequiresSeparateConfirmedAccountDeletionFlow: true/);
});

test('member UI clearly separates 24/7 access from 19:00-22:00 human moderation',()=>{
  const api=readFileSync('functions/api/social/[[path]].js','utf8');
  const page=readFileSync('app/index.html','utf8');
  const client=readFileSync('app/social.js','utf8');
  assert.match(api,/alwaysOnPrivateUat/);
  assert.match(api,/always-on-until-explicit-close/);
  assert.match(page,/เข้าได้ตลอด 24 ชั่วโมง/);
  assert.match(page,/19:00–22:00/);
  assert.match(page,/ไม่มีการตอบสนองฉุกเฉิน/);
  assert.match(client,/always-on-uat-notice/);
});
