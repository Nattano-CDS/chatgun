import test from'node:test';import assert from'node:assert/strict';import{TestD1,environment}from'./helpers/d1.js';import{issueSession,unixTime}from'../functions/_lib/db.js';import{onRequest}from'../functions/api/social/[[path]].js';import{ownerPilotVars,approvedOwnerPilot}from'../scripts/lib/owner-pilot-release.mjs';
import {eligibleSql,canContact} from '../functions/_lib/social-permissions.js';
async function setup(){const db=new TestD1(),now=unixTime(),sessions={};for(const id of['admin','member','other']){
 await db.prepare("INSERT INTO users(id,status,account_state,created_at,updated_at)VALUES(?,'active','active',?,?)").bind(id,now,now).run();
 await db.prepare("INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at)VALUES(?,?,'adult_18_plus','self_declaration','v1',?)").bind(id,id,now).run();
 await db.prepare("INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at)VALUES(?,?,?,?,?)").bind(id,id,id,now,now).run();
 await db.prepare("INSERT INTO beta_enrollments(user_id,status,created_at,activated_at)VALUES(?,'active',?,?)").bind(id,now,now).run();sessions[id]=await issueSession(db,id,now);
 }await db.prepare("INSERT INTO moderation_roles(user_id,role,created_at)VALUES('admin','safety_admin',?)").bind(now).run();
 await db.prepare("INSERT INTO social_reports(id,reporter_user_id,subject_user_id,category,details,created_at)VALUES('case','other','member','harassment','Local fixture',?)").bind(now).run();
 const env={...environment(db),SOCIAL_APP_ENABLED:'true',MODERATION_TOOLS_ENABLED:'true',ACCOUNT_MODERATION_ENABLED:'true',PUBLIC_DISCOVERY_ENABLED:'true',MESSAGING_ENABLED:'true',PRESENCE_ENABLED:'true'};
 function request(path,actor,body,extra={}){const s=sessions[actor],headers={cookie:s?`__Host-cg_session=${s.token}; __Host-cg_csrf=${s.csrf}`:'','x-moderation-purpose':'Investigate authorized synthetic safety case',...extra};if(body)Object.assign(headers,{origin:'https://chatgun.pages.dev','content-type':'application/json','x-csrf-token':s?.csrf||''});return onRequest({env,request:new Request('https://chatgun.pages.dev'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined})});}
 return{db,env,sessions,request};}
test('public members without Beta enrollment can be suspended, appeal and recover without fabricated enrollment',async()=>{
 const{db,env,sessions,request}=await setup();try{
  env.BETA_ENROLLMENT_REQUIRED='false';env.NEW_ACCOUNT_REGISTRATION_ENABLED='true';env.BETA_INVITATION_REGISTRATION_ENABLED='false';
  await db.prepare("DELETE FROM beta_enrollments WHERE user_id='member'").run();
  const eligible=async()=>Boolean(await db.prepare(`SELECT 1 ok WHERE ${eligibleSql('?')}`).bind('member').first());
  assert.equal(await eligible(),true);
  assert.equal((await request('/api/social/moderation/accounts','admin',{action:'suspend',reportId:'case',reason:'Restrict a public-registration account for safety review'})).status,201);
  assert.equal((await request('/api/social/profile','member')).status,401);
  const restriction=await db.prepare('SELECT id,revision FROM beta_account_restrictions').first();
  assert.ok(restriction);assert.equal(await eligible(),false);assert.equal(await canContact(db,'other','member'),false);assert.equal(await canContact(db,'member','other'),false);
  sessions.member=await issueSession(db,'member',unixTime());
  assert.equal((await request('/api/social/profile','member')).status,403);
  env.ACCOUNT_MODERATION_ENABLED='false';assert.equal((await request('/api/social/profile','member')).status,403);env.ACCOUNT_MODERATION_ENABLED='true';
  assert.equal((await request('/api/social/account-appeals','member')).status,200);
  assert.equal((await request('/api/social/account-appeals','member',{id:restriction.id,reason:'Please review this public account restriction with its evidence'})).status,201);
  assert.equal((await request('/api/social/moderation/accounts','admin',{action:'lift',id:restriction.id,revision:restriction.revision,reason:'Evidence reviewed and account restriction is lifted'})).status,200);
  assert.equal((await request('/api/social/profile','member')).status,200);assert.equal(await eligible(),true);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM beta_enrollments WHERE user_id='member'").first()).n,0);
  assert.equal(db.database.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close();}
});
test('approved Admin scope changes only moderation; public signup and every social/media wave stay closed',()=>{const receipt=approvedOwnerPilot(),base=ownerPilotVars(receipt),admin=ownerPilotVars(receipt,{ownerAdmin:true});assert.deepEqual(Object.keys(base).filter(k=>base[k]!==admin[k]),['MODERATION_TOOLS_ENABLED']);assert.equal(admin.MODERATION_TOOLS_ENABLED,'true');});
test('Beta suspension revokes sessions, denies social access, preserves account and permits authenticated appeal with conflict audit',async()=>{const{db,request,sessions}=await setup();try{
 const suspend=await request('/api/social/moderation/accounts','admin',{action:'suspend',reportId:'case',reason:'Suspend controlled Beta access for safety investigation'});assert.equal(suspend.status,201);
 const restriction=await db.prepare('SELECT id,revision FROM beta_account_restrictions').first();
 assert.equal((await request('/api/social/profile','member')).status,401);
 assert.equal((await db.prepare("SELECT status FROM users WHERE id='member'").first()).status,'active');
 sessions.member=await issueSession(db,'member',unixTime());
 assert.equal((await request('/api/social/profile','member')).status,403);assert.equal((await request('/api/social/account-appeals','other',{id:restriction.id,reason:'Unauthorized cross-user appeal must not work'})).status,404);
 assert.equal((await request('/api/social/account-appeals','member',{id:restriction.id,reason:'Request a review of my account restriction'})).status,201);
 assert.equal((await request('/api/social/account-appeals','member',{id:restriction.id,reason:'Duplicate appeal must not produce duplicate records'})).status,409);
 const list=await(await request('/api/social/moderation/accounts?view=appeals','admin')).json();assert.equal(list.items[0].reviewer_conflict,1);
 const decision={action:'resolve_appeal',id:list.items[0].id,revision:0,decision:'lifted',reason:'Review confirms restriction may be safely lifted'};
 assert.equal((await request('/api/social/moderation/accounts','admin',decision)).status,409);
 assert.equal((await request('/api/social/moderation/accounts','admin',{...decision,conflictAcknowledged:true})).status,200);
 assert.equal((await request('/api/social/profile','member')).status,200);
 assert.equal((await request('/api/social/moderation/accounts','admin',{...decision,conflictAcknowledged:true})).status,409);
 const events=(await db.prepare("SELECT action,reason FROM beta_account_moderation_events WHERE action<>'queue_view' ORDER BY created_at,action").all()).results;assert.equal(events.length,3);assert.ok(events.some(e=>e.reason.includes('conflict acknowledged')));assert.equal((await db.prepare('SELECT COUNT(*) n FROM users').first()).n,3);assert.equal(db.database.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close();}});
test('account moderation is default off, role/CSRF/recent-auth guarded and prevents self or privileged suspension',async()=>{const{db,env,request}=await setup();try{
 env.ACCOUNT_MODERATION_ENABLED='false';assert.equal((await request('/api/social/moderation/accounts','admin')).status,404);env.ACCOUNT_MODERATION_ENABLED='true';
 assert.equal((await request('/api/social/moderation/accounts','other')).status,403);assert.equal((await request('/api/social/moderation/accounts','anonymous')).status,401);
 await db.prepare("UPDATE social_reports SET subject_user_id='admin' WHERE id='case'").run();assert.equal((await request('/api/social/moderation/accounts','admin',{action:'suspend',reportId:'case',reason:'Attempted self suspension must be rejected'})).status,403);
 await db.prepare("UPDATE social_reports SET subject_user_id='member' WHERE id='case'").run();await db.prepare("INSERT INTO moderation_roles(user_id,role,created_at)VALUES('member','report_reviewer',?)").bind(unixTime()).run();assert.equal((await request('/api/social/moderation/accounts','admin',{action:'suspend',reportId:'case',reason:'Protected reviewer requires separate access procedure'})).status,403);
 await db.prepare("UPDATE session_auth_evidence SET authenticated_at=? WHERE user_id='admin'").bind(unixTime()-601).run();assert.equal((await request('/api/social/moderation/accounts','admin')).status,403);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM beta_account_restrictions').first()).n,0);
 }finally{db.close();}});
test('missing CSRF cannot suspend a member and invalid decisions cannot write',async()=>{const{db,env,sessions,request}=await setup();try{const r=await onRequest({env,request:new Request('https://chatgun.pages.dev/api/social/moderation/accounts',{method:'POST',headers:{origin:'https://chatgun.pages.dev','content-type':'application/json','x-moderation-purpose':'Investigate an authorized local report',cookie:`__Host-cg_session=${sessions.admin.token}`},body:JSON.stringify({action:'suspend',reportId:'case',reason:'Missing CSRF must not suspend an account'})})});assert.equal(r.status,403);assert.equal((await request('/api/social/moderation/accounts','admin',{action:'lift',id:'missing',revision:-1,reason:'Invalid version must not write a decision'})).status,409);assert.equal((await db.prepare('SELECT COUNT(*) n FROM beta_account_moderation_events').first()).n,0);}finally{db.close();}});
test('suspension removes location and private album grants; lifting never resurrects either',async()=>{const{db,request}=await setup();try{const now=unixTime();await db.prepare("UPDATE member_profiles SET discovery_visible=1,latitude=0,longitude=0,accuracy=10,located_at=? WHERE user_id='member'").bind(now).run();await db.prepare("INSERT INTO album_access_requests(id,album_owner_id,requester_id,status,created_at,updated_at)VALUES('grant-case','other','member','approved',?,?)").bind(now,now).run();await db.prepare("INSERT INTO album_access_grants(album_owner_id,viewer_id,approved_request_id,granted_at,revision)VALUES('other','member','grant-case',?,1)").bind(now).run();assert.equal((await request('/api/social/moderation/accounts','admin',{action:'suspend',reportId:'case',reason:'Restrict exposure during safety review of a report'})).status,201);const r=await db.prepare('SELECT id,revision FROM beta_account_restrictions').first();assert.equal((await db.prepare("SELECT revoked_at FROM album_access_grants WHERE viewer_id='member'").first()).revoked_at,now);assert.equal((await request('/api/social/moderation/accounts','admin',{action:'lift',id:r.id,revision:r.revision,reason:'Complete review and reinstate only Beta eligibility'})).status,200);const p=await db.prepare("SELECT discovery_visible,latitude,longitude FROM member_profiles WHERE user_id='member'").first();assert.equal(p.discovery_visible,0);assert.equal(p.latitude,null);assert.equal(p.longitude,null);assert.ok((await db.prepare("SELECT revoked_at FROM album_access_grants WHERE viewer_id='member'").first()).revoked_at);assert.equal((await db.prepare("SELECT status FROM album_access_requests WHERE id='grant-case'").first()).status,'revoked');}finally{db.close();}});
