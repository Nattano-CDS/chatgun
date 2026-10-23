import test from 'node:test';
import assert from 'node:assert/strict';
import { TestD1, environment } from './helpers/d1.js';
import { issueSession, unixTime } from '../functions/_lib/db.js';
import { onRequest as auth } from '../functions/api/auth/[[path]].js';
import { onRequest as social } from '../functions/api/social/[[path]].js';
import { runRetentionCleanup } from '../functions/_lib/retention.js';

async function setup() {
  const db = new TestD1(), now = unixTime(), sessions = {};
  for (const id of ['held','other','admin']) {
    await db.prepare("INSERT INTO users(id,status,account_state,created_at,updated_at)VALUES(?,'active','active',?,?)").bind(id,now,now).run();
    sessions[id] = await issueSession(db,id,now);
  }
  await db.prepare("INSERT INTO member_age_safety_holds VALUES('held','13_17','held','unpublished-local-test',?,?)").bind(now,now).run();
  await db.prepare("INSERT INTO moderation_roles(user_id,role,created_at)VALUES('admin','safety_admin',?)").bind(now).run();
  const env = {...environment(db),SOCIAL_APP_ENABLED:'true',MODERATION_TOOLS_ENABLED:'true',ELIGIBILITY_REVIEW_ENABLED:'true'};
  async function call(actor,body,moderator=false,headers={}) {
    const s=sessions[actor];
    return (moderator?social:auth)({env,request:new Request('https://chatgun.pages.dev'+(moderator?'/api/social/moderation/eligibility':'/api/auth/eligibility-review'),{
      method:body?'POST':'GET',headers:{cookie:s?`__Host-cg_session=${s.token}; __Host-cg_csrf=${s.csrf}`:'',
        'x-moderation-purpose':'Review local eligibility correction request',...(body?{origin:'https://chatgun.pages.dev','content-type':'application/json','x-csrf-token':s?.csrf||''}:{}),...headers},
      ...(body?{body:JSON.stringify(body)}:{}),
    })});
  }
  return {db,env,sessions,call};
}
const reason='Please review my declared eligibility information without identity documents';
test('held account can request correction, see only own status, withdraw once; hold remains enforced',async()=>{
  const {db,call}=await setup();try{
    assert.equal((await call('held',{action:'request',reason})).status,201);
    assert.equal((await call('held',{action:'request',reason})).status,409);
    const {requests}=await(await call('held')).json();assert.equal(requests.length,1);
    assert.deepEqual((await(await call('other')).json()).requests,[]);
    assert.equal((await call('other',{action:'withdraw',reason,id:requests[0].id,revision:0})).status,409);
    assert.equal((await call('held',{action:'withdraw',reason,id:requests[0].id,revision:0})).status,200);
    assert.equal((await call('held',{action:'withdraw',reason,id:requests[0].id,revision:0})).status,409);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM eligibility_review_events').first()).n,2);
    assert.equal((await db.prepare("SELECT state FROM member_age_safety_holds WHERE user_id='held'").first()).state,'held');
    assert.equal(db.database.prepare('PRAGMA foreign_key_check').all().length,0);
  }finally{db.close();}
});
test('review requires RBAC, recent authentication, purpose and CSRF; cannot grant access or replay a decision',async()=>{
  const {db,call}=await setup();try{
    const created=await(await call('held',{action:'request',reason})).json();
    const decision={id:created.id,revision:0,action:'deferred',reason:'Pending approved legal and safeguarding admission model'};
    assert.equal((await call('other',undefined,true)).status,403);
    assert.equal((await call('admin',undefined,true,{'x-moderation-purpose':''})).status,400);
    assert.equal((await call('admin',decision,true,{'x-csrf-token':''})).status,403);
    assert.equal((await call('admin',{...decision,action:'clear'},true)).status,400);
    assert.equal((await call('admin',decision,true)).status,200);
    assert.equal((await call('admin',decision,true)).status,409);
    const event=await db.prepare("SELECT purpose,reason FROM eligibility_review_events WHERE action='deferred'").first();
    assert.equal(event.purpose,'Review local eligibility correction request');
    const queue=await(await call('admin',undefined,true)).json();assert.equal(queue.admissionEnabled,false);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM administration_access_events').first()).n,1);
    assert.equal((await db.prepare("SELECT state FROM member_age_safety_holds WHERE user_id='held'").first()).state,'held');
    await db.prepare("UPDATE session_auth_evidence SET authenticated_at=? WHERE user_id IN ('admin','held')").bind(unixTime()-601).run();
    assert.equal((await call('admin',undefined,true)).status,403);
    assert.equal((await call('held',{action:'request',reason})).status,428);
  }finally{db.close();}
});
test('feature defaults closed; invalid requests, absent holds, origin and CSRF fail without writes',async()=>{
  const {db,env,call}=await setup();try{
    env.ELIGIBILITY_REVIEW_ENABLED='false';assert.equal((await call('held',{action:'request',reason})).status,404);
    assert.equal((await(await call('held')).json()).enabled,false);env.ELIGIBILITY_REVIEW_ENABLED='true';
    assert.equal((await call('unknown')).status,401);
    assert.equal((await call('held',{action:'request',reason},false, {origin:'https://evil.example'})).status,403);
    assert.equal((await call('held',{action:'request',reason},false,{'x-csrf-token':''})).status,403);
    assert.equal((await call('held',{action:'request',reason:'short'})).status,400);
    assert.equal((await call('held',{action:'request',reason:'😀'.repeat(5)})).status,400,'Unicode length must match the database rather than causing a constraint500');
    assert.equal((await call('other',{action:'request',reason})).status,409);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM eligibility_review_requests').first()).n,0);
  }finally{db.close();}
});

test('closed review evidence is bounded, pending requests survive cleanup, deletion cascades personal requests',async()=>{
  const {db,call}=await setup();try{
    const created=await(await call('held',{action:'request',reason})).json();
    const future=unixTime()+91*86400;
    await runRetentionCleanup(db,future); // Does not discard an unresolved request.
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM eligibility_review_requests').first()).n,1);
    await db.prepare("UPDATE eligibility_review_requests SET status='withdrawn' WHERE id=?").bind(created.id).run();
    await runRetentionCleanup(db,future);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM eligibility_review_events').first()).n,0);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM eligibility_review_requests').first()).n,0);
    assert.equal(db.database.prepare('PRAGMA foreign_key_check').all().length,0);
  }finally{db.close();}
});

test('member/deletion queues require safety role, purpose and fresh auth, expose no secrets and audit reads',async()=>{
  const {db,env,sessions}=await setup();
  const call=(actor,view='members',headers={})=>social({env,request:new Request('https://chatgun.pages.dev/api/social/moderation/members?view='+view,{headers:{cookie:`__Host-cg_session=${sessions[actor].token}`,'x-moderation-purpose':'Inspect local synthetic account administration',...headers}})});
  try{
    assert.equal((await call('other')).status,403);assert.equal((await call('admin','members',{'x-moderation-purpose':''})).status,400);
    await db.prepare("INSERT INTO account_deletion_requests(request_id,user_id,confirmation_hash,status,requested_at,expires_at,updated_at)VALUES('request','held','NEVER_RETURN_THIS_SECRET','pending',?,?,?)").bind(unixTime(),unixTime()+600,unixTime()).run();
    for(const view of ['members','deletions']){
      const r=await call('admin',view);assert.equal(r.status,200);const text=await r.text();assert.ok(!/confirmation_hash|NEVER_RETURN|token_hash|email|latitude|age_band/u.test(text));assert.equal(JSON.parse(text).readOnly,true);
    }
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM administration_access_events').first()).n,2);
    await db.prepare("UPDATE session_auth_evidence SET authenticated_at=? WHERE user_id='admin'").bind(unixTime()-601).run();
    assert.equal((await call('admin')).status,403);
  }finally{db.close();}
});
