import assert from 'node:assert/strict';
import test from 'node:test';
import { TestD1,environment } from './helpers/d1.js';
import { issueSession,unixTime,createDeletionRequest,confirmAccountDeletion } from '../functions/_lib/db.js';
import { onRequest } from '../functions/api/social/[[path]].js';

async function fixture(t){
  const db=new TestD1();t.after(()=>db.close());const sessions={};
  for(const id of ['owner','viewer','other']){
    db.exec(`INSERT INTO users(id,status,created_at,updated_at) VALUES('${id}','active',1,1);
      INSERT INTO age_assurance_events VALUES('${id}-adult','${id}','adult_18_plus','self_declaration','v1',1,NULL);
      INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at) VALUES('${id}','${id}-adult','${id}',1,1);`);
    sessions[id]=await issueSession(db,id);
  }
  const env={...environment(db),SOCIAL_APP_ENABLED:'true',MESSAGING_ENABLED:'true',MEDIA_UPLOAD_ENABLED:'true',PUBLIC_DISCOVERY_ENABLED:'false',SENSITIVE_CONTENT_ENABLED:'false',
    MEDIA:{get:async()=>({body:new Uint8Array([1,2,3])})}};
  async function call(actor,path,body,headers={}){
    const s=sessions[actor];
    return onRequest({env,request:new Request('https://chatgun.pages.dev/api/social/'+path,{method:body?'POST':'GET',headers:{cookie:s?`__Host-cg_session=${s.token}; __Host-cg_csrf=${s.csrf}`:'',...(body?{origin:'https://chatgun.pages.dev','content-type':'application/json','x-csrf-token':s?.csrf||''}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})})});
  }
  async function request(){assert.equal((await call('viewer','albums/access',{action:'request',owner:'owner'})).status,200);return db.prepare('SELECT * FROM album_access_requests').first();}
  async function decide(r,action='approve',actor='owner'){return call(actor,'albums/access',{action,id:r.id,revision:r.revision});}
  function photo(id='private-photo',visibility='private',status='released',category='general'){
    db.exec(`INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,created_at) VALUES('${id}','owner','${id}','gallery','image/png',3,1);
      INSERT INTO profile_photos(media_id,owner_user_id,caption,created_at,visibility) VALUES('${id}','owner','not-for-strangers',1,'${visibility}');
      INSERT INTO media_safety_reviews(media_id,status,category,source,created_at) VALUES('${id}','${status}','${category}','manual',1);`);
  }
  return {db,env,call,request,decide,photo};
}

test('direct DM creates inbox without friendship, persists text, read and unsend',async t=>{
  const {db,call}=await fixture(t);
  assert.equal((await call('viewer','messages?target=owner')).status,200);
  assert.equal((await call('viewer','messages',{action:'send',target:'owner',body:'สวัสดีครับ'})).status,200);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM social_relationships').first()).n,0);
  let inbox=await (await call('owner','conversations')).json();assert.equal(inbox.conversations.length,1);assert.equal(inbox.conversations[0].unread_count,1);
  const messages=(await (await call('owner','messages?target=viewer')).json()).messages;assert.equal(messages[0].body,'สวัสดีครับ');
  await call('owner','messages',{action:'read',target:'viewer'});
  inbox=await (await call('owner','conversations')).json();assert.equal(inbox.conversations[0].unread_count,0);
  assert.equal((await call('other','messages',{action:'unsend',id:messages[0].id})).status,404);
  assert.equal((await call('viewer','messages',{action:'unsend',id:messages[0].id})).status,200);
});
test('DM denies anonymous/self/nonadult/inactive/opt-out/both block directions and CSRF',async t=>{
  const {db,call}=await fixture(t);
  assert.equal((await call(null,'messages?target=owner')).status,401);
  assert.equal((await call('viewer','messages?target=viewer')).status,403);
  assert.equal((await call('viewer','messages',{action:'send',target:'owner',body:'x'},{'x-csrf-token':'wrong'})).status,403);
  for(const sql of ["UPDATE users SET account_state='disabled' WHERE id='owner'","UPDATE age_assurance_events SET revoked_at=1 WHERE user_id='owner'"]){
    db.exec(sql);assert.equal((await call('viewer','messages?target=owner')).status,403);
    db.exec("UPDATE users SET account_state='active';UPDATE age_assurance_events SET revoked_at=NULL;UPDATE member_profiles SET direct_messages_enabled=1");
  }
  db.exec("UPDATE member_profiles SET direct_messages_enabled=0 WHERE user_id='owner'");
  assert.equal((await call('viewer','messages',{action:'send',target:'owner',body:'denied'})).status,403);
  assert.equal((await call('viewer','messages?target=owner')).status,200,'opt-out preserves read access to history');
  db.exec('UPDATE member_profiles SET direct_messages_enabled=1');
  for(const [a,b] of [['owner','viewer'],['viewer','owner']]){
    db.exec(`INSERT INTO social_blocks VALUES('${a}','${b}',1)`);assert.equal((await call('viewer','messages?target=owner')).status,403);db.exec('DELETE FROM social_blocks');
  }
});
test('duplicate and distinct-recipient spam guards are durable and atomic',async t=>{
  const {db,call}=await fixture(t);
  assert.equal((await call('viewer','messages',{action:'send',target:'owner',body:'same'})).status,200);
  assert.equal((await call('viewer','messages',{action:'send',target:'other',body:'same'})).status,429);
  for(let i=0;i<10;i++)db.exec(`INSERT INTO users(id,status,created_at,updated_at) VALUES('target${i}','active',1,1);
    INSERT INTO age_assurance_events VALUES('target${i}-adult','target${i}','adult_18_plus','self_declaration','v1',1,NULL);
    INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at) VALUES('target${i}','target${i}-adult','target',1,1)`);
  for(let i=0;i<9;i++)await db.prepare("INSERT INTO social_messages(id,sender_user_id,receiver_user_id,body,created_at) VALUES(?,'viewer',?,?,?)").bind('spam'+i,'target'+i,'unique'+i,unixTime()).run();
  await assert.rejects(()=>db.prepare("INSERT INTO social_messages(id,sender_user_id,receiver_user_id,body,created_at) VALUES('overflow','viewer','target9','next',?)").bind(unixTime()).run(),/recipient_limit/);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM chat_initiations').first()).n,10);
});
test('album requests are durable typed events, duplicate-safe and owner-only with revision/CSRF',async t=>{
  const {db,call,request,decide}=await fixture(t);const r=await request();
  assert.equal((await call('viewer','albums/access',{action:'request',owner:'owner'})).status,409);
  assert.equal((await decide(r,'approve','other')).status,409);
  assert.equal((await call('owner','albums/access',{action:'approve',id:r.id,revision:r.revision},{'x-csrf-token':'bad'})).status,403);
  const raced=await Promise.all([decide(r),decide(r,'reject')]);assert.deepEqual(raced.map(r=>r.status).sort(),[200,409]);
  assert.equal((await decide(r)).status,409);
  const events=(await (await call('viewer','messages?target=owner')).json()).messages.filter(m=>m.system);
  assert.equal(events.length,2);assert.equal(events[0].request_revision,2);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM album_access_grants WHERE revoked_at IS NULL').first()).n,1);
});
test('private gallery metadata, comments, likes and old raw URL deny until grant; revoke is immediate',async t=>{
  const {db,call,request,decide,photo}=await fixture(t);photo();
  db.exec("INSERT INTO social_relationships VALUES('legacy','owner','viewer','owner','accepted',1,1)");
  for(const actor of ['viewer','other']){
    const payload=await (await call(actor,'gallery?user=owner')).json();assert.deepEqual(payload.photos,[]);assert.ok(!JSON.stringify(payload).includes('private-photo'));
    assert.equal((await call(actor,'gallery?user=owner&photo=private-photo')).status,404);
    assert.equal((await call(actor,'media/private-photo')).status,404);
    assert.equal((await call(actor,'gallery',{action:'like',id:'private-photo'})).status,404);
    assert.equal((await call(actor,'gallery',{action:'comment',id:'private-photo',comment:'x'})).status,404);
  }
  const r=await request();await decide(r);
  let response=await call('viewer','media/private-photo');assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal((await call('other','media/private-photo')).status,404);
  assert.equal((await call('viewer','gallery',{action:'comment',id:'private-photo',comment:'permitted'})).status,200);
  assert.equal((await decide({...r,revision:2},'revoke')).status,200);
  assert.equal((await call('viewer','media/private-photo')).status,404);
  assert.equal((await call('viewer','gallery?user=owner&photo=private-photo')).status,404);
  assert.equal((await call('viewer','albums/access',{action:'request',owner:'owner'})).status,409);
  db.exec('UPDATE album_access_requests SET updated_at=1');
  assert.equal((await call('viewer','albums/access',{action:'request',owner:'owner'})).status,200);
});
test('block revokes grants permanently across unblock; account deletion cascades all new personal data',async t=>{
  const {db,call,request,decide,photo}=await fixture(t);photo();const r=await request();await decide(r);
  assert.equal((await call('viewer','blocks',{action:'block',target:'owner'})).status,200);
  assert.equal((await call('viewer','media/private-photo')).status,404);
  await call('viewer','blocks',{action:'unblock',target:'owner'});
  assert.equal((await call('viewer','media/private-photo')).status,404);
  assert.equal((await db.prepare('SELECT status FROM album_access_requests').first()).status,'revoked');
  db.exec("DELETE FROM member_profiles WHERE user_id='viewer';DELETE FROM age_assurance_events WHERE user_id='viewer';DELETE FROM users WHERE id='viewer'");
  for(const table of ['album_access_requests','album_access_grants','chat_system_events'])assert.equal((await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n,0);
  assert.deepEqual(db.database.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('public publication is explicit; grants never override quarantine, prohibited or Sensitive denial',async t=>{
  const {call,request,decide,photo,db}=await fixture(t);photo('public','public');photo('pending','private','pending');photo('sensitive','private','released','sensitive');photo('prohibited','private','rejected','prohibited');
  assert.equal((await call('viewer','media/public')).status,200);
  await decide(await request());
  for(const id of ['pending','sensitive','prohibited'])for(const actor of ['owner','viewer'])assert.equal((await call(actor,'media/'+id)).status,404);
  assert.equal((await call('other','gallery',{action:'visibility',id:'public',visibility:'private'})).status,403);
  await call('owner','gallery',{action:'visibility',id:'public',visibility:'private'});
  assert.equal((await call('other','media/public')).status,404);
  assert.equal((await call('viewer','media/public')).status,200);
  assert.equal((await db.prepare("SELECT status FROM media_safety_reviews WHERE media_id='pending'").first()).status,'pending');
});
test('requester may cancel but not approve; owner may reject; no text or forged event grants access',async t=>{
  const {call,request,decide,db}=await fixture(t);const r=await request();
  assert.equal((await decide(r,'approve','viewer')).status,409);
  assert.equal((await decide(r,'cancel','viewer')).status,200);
  assert.equal((await decide(r)).status,409);
  await call('viewer','messages',{action:'send',target:'owner',body:'<button>Approve</button>',system:true,event_type:'approved'});
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM album_access_grants').first()).n,0);
  db.exec('UPDATE album_access_requests SET updated_at=1');
  await call('viewer','albums/access',{action:'request',owner:'owner'});
  const r2=await db.prepare('SELECT * FROM album_access_requests').first();assert.equal((await decide(r2,'reject')).status,200);
});
test('Production closed gates deny new routes before touching migration-13 tables',async t=>{
  const {call,env,db}=await fixture(t);env.SOCIAL_APP_ENABLED='false';
  db.exec('DROP TABLE chat_preferences;DROP TABLE chat_initiations');
  for(const path of ['conversations','albums/access','gallery','messages?target=owner'])assert.equal((await call('viewer',path)).status,404);
  assert.equal((await call('viewer','albums/access',{action:'request',owner:'owner'})).status,404);
});

test('unmigrated Production schema supports guarded fictional release without migration 0013',async t=>{
  const db=new TestD1({throughMigration:'0012_synthetic_seed_batches.sql'});t.after(()=>db.close());
  const env={...environment(db),SOCIAL_APP_ENABLED:'false',MESSAGING_ENABLED:'false',DEMO_MODE_ENABLED:'true',DEMO_AUTO_START_ENABLED:'true'};
  for(const path of ['conversations','albums/access','gallery','messages','media/unknown','chat-assets','relationships']){
    const response=await onRequest({env,request:new Request('https://chatgun.social/api/social/'+path)});assert.equal(response.status,404,path);
  }
  const config=await onRequest({env,request:new Request('https://chatgun.social/api/social/config')});assert.equal(config.status,200);
  assert.equal((await config.json()).demoModeEnabled,true);
});

test('real deletion transaction cascades album evidence and sessions, queues media, preserves unrelated users',async t=>{
  const {db,request,decide,photo,call}=await fixture(t);photo();await decide(await request());
  const deletion=await createDeletionRequest(db,'owner');
  const result=await confirmAccountDeletion(db,'owner',deletion.requestId,deletion.confirmationToken);
  assert.equal(result.requestId,deletion.requestId);
  for(const table of ['album_access_requests','album_access_grants','chat_system_events'])assert.equal((await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n,0);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM media_deletion_queue').first()).n,1);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM users WHERE id IN ('viewer','other')").first()).n,2);
  assert.equal((await call('owner','conversations')).status,401);
  assert.equal((await call('viewer','media/private-photo')).status,404);
  assert.deepEqual(db.database.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('blocking while request pending makes stale approval fail and cannot resurrect a grant',async t=>{
  const {db,call,request,decide}=await fixture(t);const r=await request();
  await call('owner','blocks',{action:'block',target:'viewer'});
  assert.equal((await decide(r)).status,409);
  await call('owner','blocks',{action:'unblock',target:'viewer'});
  assert.equal((await decide({...r,revision:2})).status,409);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM album_access_grants WHERE revoked_at IS NULL').first()).n,0);
});
