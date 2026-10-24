// Local synthetic provider responses only, never real OAuth/E2E evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {TestD1} from './helpers/d1.js';
import {findOrCreateIdentity,unixTime} from '../functions/_lib/db.js';
import {readFileSync} from 'node:fs';
import {requiredAcceptanceVersions} from '../functions/_lib/acceptance.js';
const profile={provider:'line',subject:'local-public-registration-fixture',name:'สมาชิกทดสอบในเครื่อง',email:null,emailVerified:false,picture:null};

test('public launch proposal cannot silently activate draft acceptance policies',()=>{
 const proposal=JSON.parse(readFileSync('docs/public-social-launch/activation-candidate.json'));
 assert.equal(proposal.ownerScopeApproved,true);assert.equal(proposal.exactPolicyTextApproved,false);assert.equal(proposal.applyToProduction,false);
 assert.throws(()=>requiredAcceptanceVersions(proposal.candidateVars),/unapproved_acceptance_versions/);
});

test('failed public identity insert rolls back the newly created pending account',async()=>{
 const db=new TestD1();try{
  db.database.exec("CREATE TRIGGER fixture_identity_failure BEFORE INSERT ON identities BEGIN SELECT RAISE(ABORT,'fixture identity write failure'); END");
  await assert.rejects(findOrCreateIdentity(db,profile,null,unixTime(),{allowRegistration:true}));
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM users').first()).n,0);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM identities').first()).n,0);
 }finally{db.close();}
});

test('duplicate public callback with a stale initial lookup leaves exactly one identity and pending account',async()=>{
 const db=new TestD1();try{
  let reads=0;const stale={batch:statements=>db.batch(statements),prepare(sql){const statement=db.prepare(sql);if(/SELECT i\.user_id, u\.status FROM identities/.test(sql)&&reads++<2)statement.first=async()=>null;return statement;}};
  const first=await findOrCreateIdentity(stale,profile,null,unixTime(),{allowRegistration:true});
  const second=await findOrCreateIdentity(stale,profile,null,unixTime(),{allowRegistration:true});
  assert.equal(first,second);assert.equal((await db.prepare('SELECT COUNT(*) n FROM users').first()).n,1);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM identities').first()).n,1);
  assert.equal((await db.prepare('SELECT account_state FROM users').first()).account_state,'pending_acceptance');
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM beta_enrollments').first()).n,0);
  assert.equal(db.database.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close();}
});
