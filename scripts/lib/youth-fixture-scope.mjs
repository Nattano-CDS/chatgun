import assert from 'node:assert/strict';
import {randomToken,sha256} from '../../functions/_lib/crypto.js';
// Bound the server expiry in the FIRST insert, not a later best-effort UPDATE.
// A process failure between inserts must not leave a 30-day fixture session.
export async function issueYouthFixtureSession(db,userId,{now,authenticatedAt=now,expired=false}){
 assert.ok(/^youth-e2e-[a-f0-9-]{36}-(?:under_13|13_17|18_19|control)-(?:390|768|1440)$/u.test(userId),'Not a scoped synthetic actor');
 return issueBoundedFixtureSession(db,userId,{now,authenticatedAt,expired});
}
export async function issueDevelopmentFixtureSession(db,userId,{now}){
 assert.ok(/^development-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-(?:owner|viewer|moderator|other|held)(?:390|768|1440)$/u.test(userId),'Not a scoped development actor');
 return issueBoundedFixtureSession(db,userId,{now,authenticatedAt:now,expired:false});
}
async function issueBoundedFixtureSession(db,userId,{now,authenticatedAt,expired}){
 assert.ok(Number.isSafeInteger(now)&&Number.isSafeInteger(authenticatedAt)&&authenticatedAt<=now,'Invalid fixture clock');
 const token=randomToken(),csrf=randomToken(),tokenHash=await sha256(token);
 const createdAt=expired?now-120:now,expiresAt=expired?now-1:now+1800;
 await db.batch([
  db.prepare('INSERT INTO sessions(token_hash,user_id,csrf_hash,created_at,expires_at,last_seen_at)VALUES(?,?,?,?,?,?)').bind(tokenHash,userId,await sha256(csrf),createdAt,expiresAt,createdAt),
  db.prepare('INSERT INTO session_auth_evidence(token_hash,user_id,authenticated_at,expires_at)VALUES(?,?,?,?)').bind(tokenHash,userId,Math.min(authenticatedAt,createdAt),expiresAt),
 ]);
 return{token,csrf};
}
export function assertYouthFixtureScope(m){
 assert.equal(m?.syntheticOnly,true,'Not a synthetic manifest');
 assert.equal(m.database,'275d9820-6aec-494a-8bb5-b7ed9b8b74cc','Not isolated D1');
 assert.equal(m.origin,'https://issue13.chatgun-issue13-staging.pages.dev','Not isolated Preview');
 assert.match(m.run,/^youth-e2e-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u);
 assert.match(m.applicationSha,/^[a-f0-9]{40}$/u);
 assert.equal(m.actors?.length,10,'Incomplete synthetic scope');
 const expected=new Set(['under_13','13_17','18_19'].flatMap(band=>[390,768,1440].map(width=>band+'-'+width)).concat('control-390'));
 for(const a of m.actors){
  const key=a.band+'-'+a.width;assert.ok(expected.delete(key),'Unknown/duplicate synthetic actor');
  assert.ok(a.id===m.run+'-'+key,'Actor is outside this exact batch');
  for(const name of ['session','other',...(a.band==='control'?['stale','expired']:[])]){
   assert.ok(/^[A-Za-z0-9_-]{43}$/u.test(a[name]?.token||''),'Invalid synthetic session format');
   assert.ok(/^[A-Za-z0-9_-]{43}$/u.test(a[name]?.csrf||''),'Invalid synthetic CSRF format');
  }
 }
 assert.equal(expected.size,0);return m;
}
