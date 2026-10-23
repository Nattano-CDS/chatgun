import test from 'node:test';import assert from 'node:assert/strict';
import {assertYouthFixtureScope,issueYouthFixtureSession} from '../scripts/lib/youth-fixture-scope.mjs';
import {TestD1} from './helpers/d1.js';
function manifest(){const run='youth-e2e-00000000-0000-4000-8000-000000000001',session={token:'x'.repeat(43),csrf:'y'.repeat(43)};
 return{syntheticOnly:true,database:'275d9820-6aec-494a-8bb5-b7ed9b8b74cc',origin:'https://issue13.chatgun-issue13-staging.pages.dev',applicationSha:'a'.repeat(40),run,
 actors:['under_13','13_17','18_19','control'].flatMap(band=>(band==='control'?[390]:[390,768,1440]).map(width=>({band,width,id:run+'-'+band+'-'+width,session,other:session,...(band==='control'?{stale:session,expired:session}:{})}))) };}
test('exact ten-actor synthetic scope is accepted without real OAuth identities',()=>assert.doesNotThrow(()=>assertYouthFixtureScope(manifest())));
for(const [name,mutate]of [
 ['Production database',m=>{m.database='9738a051-d914-42d0-8e7b-8098ef2b959d';}],
 ['Production origin',m=>{m.origin='https://chatgun.social';}],
 ['unrelated account',m=>{m.actors[0].id='unrelated-user';}],
 ['duplicate actor',m=>{m.actors[1]=m.actors[0];}],
 ['credential header injection',m=>{m.actors[0].session={token:'invalid\r\nCookie: injected',csrf:'x'.repeat(43)};}],
 ['incomplete manifest',m=>{m.actors.pop();}],
])test('synthetic E2E rejects '+name,()=>{const m=manifest();mutate(m);assert.throws(()=>assertYouthFixtureScope(m));});
for(const [label,options]of [['fresh',{}],['stale',{authenticatedAt:340}],['expired',{expired:true}]])test('fixture '+label+' session is bounded at creation',async()=>{
 const db=new TestD1(),id=manifest().actors[0].id;try{
  await db.prepare("INSERT INTO users(id,status,created_at,updated_at)VALUES(?,'active',1,1)").bind(id).run();
  await issueYouthFixtureSession(db,id,{now:1000,...options});
  const row=await db.prepare('SELECT s.created_at,s.expires_at,e.authenticated_at FROM sessions s JOIN session_auth_evidence e ON s.token_hash=e.token_hash').first();
  assert.equal(row.expires_at,options.expired?999:2800);assert.equal(row.authenticated_at,options.authenticatedAt||(options.expired?880:1000));
 }finally{db.close();}
});
test('failure between fixture inserts cannot leave an unbounded or fresh-auth session',async()=>{
 const db=new TestD1(),id=manifest().actors[0].id;try{
  await db.prepare("INSERT INTO users(id,status,created_at,updated_at)VALUES(?,'active',1,1)").bind(id).run();
  const failing={prepare:sql=>db.prepare(sql),batch:async statements=>{await statements[0].run();throw Error('Synthetic setup interruption');}};
  await assert.rejects(issueYouthFixtureSession(failing,id,{now:1000}),/setup interruption/);
  assert.equal((await db.prepare('SELECT expires_at FROM sessions').first()).expires_at,2800);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM session_auth_evidence').first()).n,0);
 }finally{db.close();}
});
