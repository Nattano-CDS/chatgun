import test from 'node:test';
import assert from 'node:assert/strict';
import {TestD1,environment} from './helpers/d1.js';
import {issueSession,unixTime} from '../functions/_lib/db.js';
import {onRequest} from '../functions/api/social/[[path]].js';
import {onRequest as auth} from '../functions/api/auth/[[path]].js';
import {createOnlinePresence} from '../app/online-presence.js';

async function fixture(t){
  const db=new TestD1();t.after(()=>db.close());
  const env={...environment(db),SOCIAL_APP_ENABLED:'true',PRESENCE_ENABLED:'true'};
  const sessions={};
  for(const id of ['viewer','owner','other']){
    db.exec(`INSERT INTO users(id,status,created_at,updated_at)VALUES('${id}','active',1,1);
      INSERT INTO age_assurance_events VALUES('${id}-adult','${id}','adult_18_plus','self_declaration','v1',1,NULL);
      INSERT INTO member_profiles(user_id,age_assurance_id,name,discovery_visible,latitude,longitude,accuracy,located_at,created_at,updated_at)VALUES('${id}','${id}-adult','${id}',1,0,0,10,1,1,1);`);
    sessions[id]=await issueSession(db,id);
  }
  const req=(actor,body,extra={})=>new Request('https://chatgun.pages.dev/api/social/online'+(body?'':'?users=owner,unknown'),{method:body?'POST':'GET',headers:{cookie:`__Host-cg_session=${sessions[actor]?.token||'invalid'}; __Host-cg_csrf=${sessions[actor]?.csrf||''}`,...(body?{origin:'https://chatgun.pages.dev','content-type':'application/json','x-csrf-token':sessions[actor]?.csrf||''}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
  const call=(actor,body,extra)=>onRequest({env,request:req(actor,body,extra)});
  const preference=async(enabled=true)=>assert.equal((await call('owner',{action:'preference',enabled})).status,200);
  const heartbeat=async(actor='owner',tabId='tab_abcdefghijklmnop')=>call(actor,{action:'heartbeat',foreground:true,tabId});
  const online=async()=> (await (await call('viewer')).json()).statuses;
  return {db,env,sessions,req,call,preference,heartbeat,online};
}

test('presence fails closed behind service flags and requires auth, CSRF, eligibility and foreground',async t=>{
  const f=await fixture(t),body={action:'heartbeat',tabId:'abcdefghijklmnop',foreground:true};
  assert.equal((await f.call('missing',body)).status,401);
  assert.equal((await f.call('owner',body,{'x-csrf-token':''})).status,403);
  assert.equal((await f.call('owner',body,{origin:'https://evil.invalid'})).status,403);
  assert.equal((await f.call('owner',{...body,foreground:false})).status,400);
  f.db.exec("UPDATE users SET account_state='pending_acceptance' WHERE id='owner'");
  assert.equal((await f.call('owner',body)).status,403);
  f.env.PRESENCE_ENABLED='false';assert.equal((await f.call('owner',body)).status,404);
});
test('independent opt-in, real heartbeat, safe booleans, 110s expiry and no geolocation dependency',async t=>{
  const f=await fixture(t);assert.deepEqual(await f.online(),{owner:false,unknown:false});
  await f.heartbeat();assert.deepEqual(await f.online(),{owner:false,unknown:false});
  await f.preference();await f.heartbeat();assert.deepEqual(await f.online(),{owner:true,unknown:false});
  const result=await(await f.call('viewer')).json();assert.deepEqual(Object.keys(result).sort(),['showOnline','statuses']);
  assert.doesNotMatch(JSON.stringify(result),/touched|last_seen|token|latitude|longitude|expires/);
  assert.equal((await f.db.prepare("SELECT located_at FROM member_profiles WHERE user_id='owner'").first()).located_at,1);
  f.db.exec(`UPDATE member_presence_leases SET touched_at=${unixTime()-110}`);assert.equal((await f.online()).owner,false);
  await f.heartbeat();await f.preference(false);assert.equal((await f.online()).owner,false);
  assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM member_presence_leases').first()).n,0);
});
test('blocking in both directions, hidden profiles, revoked age and deactivation suppress Online',async t=>{
  const f=await fixture(t);await f.preference();await f.heartbeat();
  for(const [a,b] of [['viewer','owner'],['owner','viewer']]){f.db.exec(`INSERT INTO social_blocks VALUES('${a}','${b}',1)`);assert.equal((await f.online()).owner,false);f.db.exec('DELETE FROM social_blocks');}
  f.db.exec("UPDATE member_profiles SET discovery_visible=0 WHERE user_id='owner'");assert.equal((await f.online()).owner,false);
  f.db.exec("UPDATE member_profiles SET discovery_visible=1 WHERE user_id='owner';UPDATE age_assurance_events SET revoked_at=1 WHERE user_id='owner'");assert.equal((await f.online()).owner,false);
  f.db.exec("UPDATE age_assurance_events SET revoked_at=NULL;UPDATE users SET status='disabled' WHERE id='owner'");assert.equal((await f.online()).owner,false);
});
test('multiple devices and tabs, background withdrawal, logout, expiry and account deletion',async t=>{
  const f=await fixture(t);await f.preference();await f.heartbeat();
  await f.heartbeat('owner','second_tab_abcdefghijklmnop');
  await f.call('owner',{action:'offline',tabId:'tab_abcdefghijklmnop'});assert.equal((await f.online()).owner,true);
  const first=f.sessions.owner;f.sessions.owner=await issueSession(f.db,'owner');await f.heartbeat();
  const second=f.sessions.owner;f.sessions.owner=first;
  const request=f.req('owner',{anything:true});const logout=new Request('https://chatgun.pages.dev/api/auth/logout',{method:'POST',headers:request.headers});
  assert.equal((await auth({env:f.env,request:logout})).status,200);assert.equal((await f.online()).owner,true);
  f.sessions.owner=second;f.db.exec(`UPDATE sessions SET created_at=${unixTime()-100},expires_at=${unixTime()-1} WHERE revoked_at IS NULL AND user_id='owner'`);assert.equal((await f.online()).owner,false);
  assert.equal((await f.heartbeat()).status,401);
  f.db.exec("DELETE FROM users WHERE id='owner'");assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM member_presence_leases').first()).n,0);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM member_presence_preferences').first()).n,0);
  assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM pragma_foreign_key_check').first()).n,0);
});
test('heartbeat abuse is rate limited, malformed inputs rejected, repeated tab heartbeat idempotent',async t=>{
  const f=await fixture(t);await f.preference();
  assert.equal((await f.call('owner',{action:'heartbeat',tabId:'bad',foreground:true})).status,400);
  for(let n=0;n<12;n++)assert.equal((await f.heartbeat()).status,200);
  assert.equal((await f.heartbeat()).status,429);
  assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM member_presence_leases').first()).n,1);
});
test('client pauses in background, drops stale booleans on API failure and never derives status',async()=>{
  const doc=new EventTarget();doc.visibilityState='visible';let clock=0,interval,fail=false,statuses;
  const calls=[];
  const controller=createOnlinePresence({doc,now:()=>clock,every:fn=>{interval=fn;return 1;},cancel:()=>{},targets:()=>['member'],apply:s=>{statuses=s;},request:async(path,options={})=>{calls.push({path,...options});if(fail)throw Error('offline');return {showOnline:true,statuses:{member:true}};}});
  await controller.start();assert.equal(statuses.member,true);
  doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(statuses.member,false);assert.equal(calls.at(-1).body.action,'offline');
  const count=calls.length;await interval();assert.equal(calls.length,count);
  doc.visibilityState='visible';clock=120000;fail=true;await controller.refresh();assert.equal(statuses.member,false);controller.stop();
});
