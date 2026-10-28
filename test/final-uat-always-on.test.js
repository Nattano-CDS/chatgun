import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { SESSION_TTL_SECONDS, findOrCreateIdentity } from '../functions/_lib/db.js';
import { TestD1 } from './helpers/d1.js';

test('always-on sessions cross midnight without a daily access window',()=>{
  assert.equal(SESSION_TTL_SECONDS,30*24*60*60);
  const activation=readFileSync('scripts/activate-final-uat-social.mjs','utf8'),invitations=readFileSync('scripts/issue-final-uat-invitations.mjs','utf8');
  assert.doesNotMatch(activation,/Date\.parse\(receipt\.window|approved window|22:00/u);assert.doesNotMatch(invitations,/Date\.parse\(receipt\.window|full 30-minute invitation lifetime.*window/u);assert.match(invitations,/expiresAt = issuedAt \+ 1800/u);
});

test('schema22 models two owner-controlled identities, not two humans, and rejects a third slot/provider duplicate',()=>{
  const db=new DatabaseSync(':memory:');for(const file of readdirSync('migrations').filter(name=>/^\d{4}.*\.sql$/u.test(name)).sort())db.exec(readFileSync(`migrations/${file}`,'utf8'));
  const columns=db.prepare('PRAGMA table_info(uat_authorized_identities)').all().map(row=>row.name);for(const column of ['identity_ref','provider','account_reference_sha256','invitation_id','user_id','provider_subject_sha256','revoked_at'])assert.ok(columns.includes(column),column);
  db.prepare("INSERT INTO uat_authorized_identities(identity_ref,provider,account_reference_sha256,consented_at) VALUES('A','line',?,1)").run('a'.repeat(64));
  assert.throws(()=>db.prepare("INSERT INTO uat_authorized_identities(identity_ref,provider,account_reference_sha256,consented_at) VALUES('B','line',?,1)").run('b'.repeat(64)));assert.throws(()=>db.prepare("INSERT INTO uat_authorized_identities(identity_ref,provider,account_reference_sha256,consented_at) VALUES('C','google',?,1)").run('c'.repeat(64)));assert.equal(db.prepare('SELECT COUNT(*) n FROM pragma_foreign_key_check').get().n,0);db.close();
});

test('unauthorized invitation cannot create an account and exact identity binding is atomic',async()=>{
  const db=new TestD1(),now=1_800_000_000;await db.prepare("INSERT INTO beta_invitations(id,token_hash,label,max_uses,use_count,expires_at,created_at,uat_identity_ref,uat_required_provider,uat_account_reference_sha256) VALUES('invite-a','hash-a','A',1,0,?,?, 'A','line',?)").bind(now+1800,now,'a'.repeat(64)).run();
  const line={provider:'line',subject:'provider-subject-a',email:null,emailVerified:false,name:'A',picture:null};await assert.rejects(()=>findOrCreateIdentity(db,line,null,now,{allowRegistration:false,allowInvitationRegistration:true,invitationId:'invite-a',authorizedCohort:true}),/invitation_unavailable/);assert.equal((await db.prepare('SELECT COUNT(*) n FROM users').first()).n,0);
  await db.prepare("INSERT INTO uat_authorized_identities(identity_ref,provider,account_reference_sha256,consented_at) VALUES('A','line',?,?)").bind('a'.repeat(64),now).run();const userId=await findOrCreateIdentity(db,line,null,now,{allowRegistration:false,allowInvitationRegistration:true,invitationId:'invite-a',authorizedCohort:true});const bound=await db.prepare("SELECT user_id,provider_subject_sha256 FROM uat_authorized_identities WHERE identity_ref='A'").first();assert.equal(bound.user_id,userId);assert.match(bound.provider_subject_sha256,/^[A-Za-z0-9_-]{43}$/);db.close();
});

test('server paths preserve exact provider-subject admission and per-account privacy boundaries',()=>{
  const auth=readFileSync('functions/api/auth/[[path]].js','utf8'),social=readFileSync('functions/api/social/[[path]].js','utf8');for(const pattern of [/uat_required_provider !== provider/u,/provider_subject_sha256/u,/uat_cohort_denied/u,/identity_ref/u])assert.match(auth,pattern);assert.match(social,/UAT_PRIVATE_COHORT_REQUIRED/u);assert.match(social,/uat_authorized_identities WHERE user_id=\?/u);for(const pattern of [/receiver_user_id/u,/sender_user_id/u,/blocker_user_id/u,/blocked_user_id/u])assert.match(social,pattern);
});

test('close labels evidence truthfully and enforces revocation plus 7/90-day lifecycle',()=>{
  const close=readFileSync('scripts/record-final-uat-campaign-close.mjs','utf8');for(const pattern of [/single-operator-dual-account-functional-e2e/u,/now \+ UAT_AUDIT_RETENTION_SECONDS/u,/UPDATE sessions SET revoked_at/u,/UPDATE uat_authorized_identities SET revoked_at/u,/DELETE FROM social_messages/u,/DELETE FROM member_profiles/u,/identityAChatgunAccountDeleted: false/u,/identityBDeletionRequiresSeparateOwnerAuthorizedAccountDeletionFlow: true/u,/externalProviderAccountsDeleted: false/u])assert.match(close,pattern);assert.doesNotMatch(close,/two-person cohort|eligibleAndConsented/u);
});

test('member UI separates 24/7 access from 19:00-22:00 human moderation',()=>{
  const api=readFileSync('functions/api/social/[[path]].js','utf8'),page=readFileSync('app/index.html','utf8'),client=readFileSync('app/social.js','utf8');assert.match(api,/alwaysOnPrivateUat/);assert.match(page,/ผู้ปฏิบัติการหนึ่งคน/);assert.match(page,/ไม่ใช่การทดสอบโดยมนุษย์สองคน/);assert.match(page,/เข้าได้ตลอด 24 ชั่วโมง/);assert.match(page,/19:00–22:00/);assert.match(page,/ไม่มีการตอบสนองฉุกเฉิน/);assert.match(client,/always-on-uat-notice/);
});
