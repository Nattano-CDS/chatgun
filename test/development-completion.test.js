import test from 'node:test';
import assert from 'node:assert/strict';
import {TestD1,environment} from './helpers/d1.js';
import {issueSession,unixTime} from '../functions/_lib/db.js';
import {onRequest} from '../functions/api/social/[[path]].js';
import {createMessageDelivery} from '../app/message-delivery.js';
import {onRequest as auth} from '../functions/api/auth/[[path]].js';
import {assertFullSystemRelease} from '../scripts/lib/full-system-release-gate.mjs';

async function fixture(t){
 const db=new TestD1();t.after(()=>db.close());const now=unixTime(),sessions={};
 for(const id of ['owner','viewer','admin','independent']){
  db.exec(`INSERT INTO users(id,status,created_at,updated_at)VALUES('${id}','active',${now},${now});
   INSERT INTO age_assurance_events VALUES('${id}-adult','${id}','adult_18_plus','self_declaration','test',${now},NULL);
   INSERT INTO member_profiles(user_id,age_assurance_id,name,discovery_visible,latitude,longitude,accuracy,located_at,created_at,updated_at)
   VALUES('${id}','${id}-adult','${id}',1,13.75,100.5,10,${now},${now},${now});`);
  sessions[id]=await issueSession(db,id);
 }
 for(const id of ['admin','independent'])await db.prepare("INSERT INTO moderation_roles(user_id,role,created_at)VALUES(?,'safety_admin',?)").bind(id,now).run();
 const objects=new Map(),env={...environment(db),SOCIAL_APP_ENABLED:'true',MESSAGING_ENABLED:'true',PUBLIC_DISCOVERY_ENABLED:'true',RATINGS_ENABLED:'true',MODERATION_TOOLS_ENABLED:'true',ACCOUNT_MODERATION_ENABLED:'true',IDENTITY_VERIFICATION_ENABLED:'true',MEDIA:{head:async k=>objects.has(k)?{}:null,get:async k=>objects.has(k)?{body:objects.get(k)}:null}};
 const call=(path,actor='admin',body)=>{const s=sessions[actor];return onRequest({env,request:new Request('https://chatgun.pages.dev/api/social/'+path,{method:body?'POST':'GET',headers:{cookie:s?`__Host-cg_session=${s.token}; __Host-cg_csrf=${s.csrf}`:'','x-moderation-purpose':'Investigate isolated local regression case',...(body?{origin:'https://chatgun.pages.dev','content-type':'application/json','x-csrf-token':s?.csrf||''}:{})},...(body?{body:JSON.stringify(body)}:{})})});};
 const media=(id='photo')=>{db.exec(`INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,created_at,state)VALUES('${id}','owner','gallery/${id}','gallery','image/png',4,${now},'pending_deletion');
  INSERT INTO profile_photos(media_id,owner_user_id,created_at,visibility)VALUES('${id}','owner',${now},'public');
  INSERT INTO media_safety_reviews(media_id,status,category,source,created_at,reviewed_by)VALUES('${id}','rejected','prohibited','manual',${now},'admin');
  INSERT INTO media_appeals(id,media_id,appellant_user_id,reason,created_at)VALUES('appeal-${id}','${id}','owner','Please independently review this test case',${now});
  INSERT INTO media_deletion_queue(object_key,operation_id,next_attempt_at,created_at)VALUES('gallery/${id}','cleanup-${id}',${now+86400},${now});`);objects.set('gallery/'+id,new Uint8Array([1,2,3,4]));};
 return{db,env,sessions,now,objects,call,media};
}

test('durable text delivery is retry-safe under concurrency, mismatched payload and unsend',async t=>{
 const{db,call}=await fixture(t),body={action:'send',target:'owner',body:'สวัสดี ข้อความทดสอบระบบ',clientRequestId:'retry_operation_123456'};
 const results=await Promise.all([call('messages','viewer',body),call('messages','viewer',body)]);
 assert.deepEqual(results.map(r=>r.status),[200,200]);const payloads=await Promise.all(results.map(r=>r.json()));assert.equal(payloads[0].messageId,payloads[1].messageId);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM social_messages').first()).n,1);
 assert.equal((await call('messages','viewer',{...body,body:'changed'})).status,409);
 assert.equal((await call('messages','viewer',{action:'unsend',id:payloads[0].messageId})).status,200);
 assert.equal((await call('messages','viewer',body)).status,200);
 assert.ok((await db.prepare('SELECT unsent_at FROM social_messages').first()).unsent_at);
 assert.equal((await call('messages','viewer',{...body,clientRequestId:'bad'})).status,400);
});
test('frontend retry retains the same request ID after ambiguous network failure',async()=>{
 const bodies=[];let fail=true;const deliver=createMessageDelivery(async(_,options)=>{bodies.push(options.body);if(fail){fail=false;throw Error('Network response lost');}return{ok:true};},()=>`request_id_${bodies.length}_123456`);
 const payload={target:'owner',body:'ข้อความจริงใน fixture เท่านั้น'};await assert.rejects(()=>deliver(payload));await deliver(payload);
 assert.equal(bodies[0].clientRequestId,bodies[1].clientRequestId);await deliver({...payload,body:'ข้อความถัดไป'});assert.notEqual(bodies[1].clientRequestId,bodies[2].clientRequestId);
});
test('moderation report pagination, literal search, severity ordering and closed revision claims',async t=>{
 const{db,call,now}=await fixture(t);
 for(let i=0;i<121;i++)await db.prepare("INSERT INTO social_reports(id,reporter_user_id,subject_user_id,category,reason_code,details,created_at)VALUES(?,'viewer','owner','harassment',?,?,?)").bind('r'+String(i).padStart(3,'0'),i===120?'threat':'harassment',i===120?'urgent exact case':'Routine case '+i,now+i).run();
 const first=await(await call('moderation/reports')).json(),second=await(await call('moderation/reports?page=2')).json(),third=await(await call('moderation/reports?page=3')).json();
 assert.equal(first.reports.length,50);assert.equal(first.reports[0].id,'r120');assert.equal(first.hasMore,true);assert.equal(third.reports.length,21);assert.equal(third.hasMore,false);assert.equal(new Set([...first.reports,...second.reports,...third.reports].map(r=>r.id)).size,121);
 assert.equal((await(await call('moderation/reports?q=urgent')).json()).reports.length,1);
 assert.equal((await(await call('moderation/reports?q=%25')).json()).reports.length,0);
 assert.equal((await call('moderation/reports?page=-1')).status,400);
 const decision={id:'r120',status:'reviewed',note:'Checked local isolated safety case',revision:0};
 const decisions=await Promise.all([call('moderation/reports','admin',decision),call('moderation/reports','independent',{...decision,status:'closed'})]);assert.deepEqual(decisions.map(r=>r.status).sort(),[200,409]);
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM moderation_audit_events WHERE action='report_review'").first()).n,1);
});
test('media appeal requires an independent reviewer and existing private object',async t=>{
 const{call,media,objects,db}=await fixture(t);media();const decision={id:'appeal-photo',decision:'granted',category:'general',reason:'Independent fixture review establishes permitted general content',revision:0};
 assert.equal((await call('moderation/appeals','admin',decision)).status,409);
 const queue=await(await call('moderation/appeals','admin')).json();assert.equal(queue.appeals[0].reviewer_conflict,1);
 objects.clear();assert.equal((await call('moderation/appeals','independent',decision)).status,409);
 assert.equal((await db.prepare('SELECT status FROM media_appeals').first()).status,'pending');
 objects.set('gallery/photo',new Uint8Array([1]));assert.equal((await call('moderation/appeals','independent',decision)).status,200);
 assert.equal((await db.prepare('SELECT state FROM social_media').first()).state,'active');assert.equal((await db.prepare('SELECT COUNT(*) n FROM moderation_notifications').first()).n,1);
});
test('losing an appeal revision claim cannot restore media, remove cleanup or emit notifications',async t=>{
 const{db,call,media}=await fixture(t);media();const batch=db.batch.bind(db);let interleave=true;
 db.batch=async statements=>{if(interleave){interleave=false;db.exec("UPDATE media_appeals SET status='denied',revision=1,decision_nonce='other-winner'");}return batch(statements);};
 assert.equal((await call('moderation/appeals','independent',{id:'appeal-photo',decision:'granted',category:'general',reason:'Losing concurrent decision must have no effects',revision:0})).status,409);
 assert.equal((await db.prepare('SELECT state FROM social_media').first()).state,'pending_deletion');assert.equal((await db.prepare('SELECT COUNT(*) n FROM media_deletion_queue').first()).n,1);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM moderation_notifications').first()).n,0);assert.equal((await db.prepare('SELECT COUNT(*) n FROM media_moderation_decisions').first()).n,0);
});
test('safety role cannot access identity queues, evidence or identity report decisions',async t=>{
 const{db,call,now}=await fixture(t);
 for(const path of ['moderation/verification','moderation/verification/media/identity-photo'])assert.equal((await call(path)).status,403);
 db.exec(`INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,created_at)VALUES('identity-photo','owner','verification/test','verification_id','image/png',1,${now});
  INSERT INTO media_reports(id,media_id,reporter_user_id,reason_code,details,created_at)VALUES('identity-report','identity-photo','viewer','privacy','Private fixture identity report',${now});`);
 assert.equal((await call('moderation/media-reports','admin',{id:'identity-report',status:'closed',note:'Unauthorized evidence category decision',revision:0})).status,404);
 assert.equal((await db.prepare('SELECT status FROM media_reports').first()).status,'pending');
});
test('ratings reject ineligible recipients; private reviews exclude both block directions and paginate',async t=>{
 const{db,call}=await fixture(t);db.exec("UPDATE age_assurance_events SET revoked_at=1 WHERE user_id='owner'");
 assert.equal((await call('ratings','viewer',{target:'owner',score:5,comment:'must not persist'})).status,404);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM proximity_ratings').first()).n,0);
 db.exec("UPDATE age_assurance_events SET revoked_at=NULL;INSERT INTO proximity_ratings(id,sender_user_id,receiver_user_id,local_day,score,comment,created_at)VALUES('rate','viewer','owner','2026-10-20',4,'private text',1)");
 assert.equal((await(await call('ratings','owner')).json()).ratings.length,1);
 db.exec("INSERT INTO social_blocks VALUES('viewer','owner',1)");assert.equal((await(await call('ratings','owner')).json()).ratings.length,0);
 assert.equal((await(await call('ratings','admin')).json()).ratings.length,0);
});
test('in-progress media cleanup denies appeal release even when object still exists',async t=>{
 const{db,call,media}=await fixture(t);media();db.exec("UPDATE media_deletion_queue SET processing_nonce='deleting',lease_until=9999999999");
 assert.equal((await call('moderation/appeals','independent',{id:'appeal-photo',decision:'granted',category:'general',reason:'Must not race an ongoing R2 deletion operation',revision:0})).status,409);
 assert.equal((await db.prepare('SELECT status FROM media_appeals').first()).status,'pending');
});
test('discovery supports stable candidate cursors, server filters and no precise-radius oracle',async t=>{
 const{db,call,now}=await fixture(t);
 for(let i=0;i<105;i++){const id='z'+String(i).padStart(3,'0');db.exec(`INSERT INTO users(id,status,created_at,updated_at)VALUES('${id}','active',1,1);INSERT INTO age_assurance_events VALUES('${id}','${id}','adult_18_plus','self_declaration','test',1,NULL);INSERT INTO member_profiles(user_id,age_assurance_id,name,interests,discovery_visible,latitude,longitude,accuracy,located_at,created_at,updated_at)VALUES('${id}','${id}','member ${i}','coffee',1,13.75,100.5,10,${now},1,1)`);}
 const first=await(await call('discovery?paged=1','viewer')).json(),next=await(await call('discovery?paged=1&after='+first.nextCursor,'viewer')).json();assert.equal(first.people.length,100);assert.equal(first.hasMore,true);assert.equal(next.hasMore,false);assert.equal(new Set([...first.people,...next.people].map(p=>p.user_id)).size,108);assert.doesNotMatch(JSON.stringify(first),/latitude|longitude|accuracy|located_at/);
 const filtered=await(await call('discovery?paged=1&q=member%20104&interest=coffee','viewer')).json();assert.equal(filtered.people[0].user_id,'z104');assert.equal((await call('discovery?radius=100','viewer')).status,400);
});
test('Gallery reuse in chat keeps original permissions and revocation applies to chat URLs',async t=>{
 const{db,call,media}=await fixture(t);media();db.exec("UPDATE social_media SET state='active';UPDATE media_safety_reviews SET status='released',category='general';UPDATE profile_photos SET visibility='private'");
 assert.equal((await call('messages','owner',{action:'send',target:'viewer',mediaId:'photo',body:''})).status,404);
 assert.equal((await(await call('chat-assets?target=viewer','owner')).json()).gallery.length,0);
 assert.equal((await call('albums/access','viewer',{action:'request',owner:'owner'})).status,200);
 const request=await db.prepare('SELECT id,revision FROM album_access_requests').first();assert.equal((await call('albums/access','owner',{action:'approve',...request})).status,200);
 assert.equal((await(await call('chat-assets?target=viewer','owner')).json()).gallery[0].id,'photo');
 assert.equal((await call('messages','owner',{action:'send',target:'viewer',mediaId:'photo',body:''})).status,200);
 assert.equal((await call('chat/media/photo','viewer')).status,200);
 assert.equal((await call('messages','viewer',{action:'send',target:'independent',mediaId:'photo',body:''})).status,404,'a private grant does not grant redistribution');
 const current=await db.prepare('SELECT id,revision FROM album_access_requests').first();await call('albums/access','owner',{action:'revoke',...current});assert.equal((await call('chat/media/photo','viewer')).status,404);
});
test('role capabilities reflect expiry without broadening report-only grants or leaking identifiers',async t=>{
 const{db,call,now}=await fixture(t);db.exec("DELETE FROM moderation_roles WHERE user_id='admin'");
 await db.prepare("INSERT INTO moderation_access_grants(id,user_id,role,grant_reason,granted_at,expires_at)VALUES('narrow','admin','report_reviewer','Isolated temporary narrow scope',?,?)").bind(now,now+60).run();
 let c=await(await call('moderation/capabilities')).json();assert.equal(c.canReviewReports,true);assert.equal(c.canReviewMedia,false);assert.equal(c.canManageRoles,false);assert.equal(c.canReviewIdentity,false);assert.doesNotMatch(JSON.stringify(c),/user_id|token_hash|expires_at/);
 db.exec("INSERT INTO moderation_roles(user_id,role,created_at)VALUES('admin','report_reviewer',1)");
 db.exec('UPDATE moderation_access_grants SET granted_at=0,expires_at=1');c=await(await call('moderation/capabilities')).json();assert.equal(c.canReviewReports,false);assert.equal((await call('moderation/overview')).status,403);
});
test('member session management preserves current session and rejects CSRF/stale/foreign operations',async t=>{
 const{db,env,sessions}=await fixture(t),extra=await issueSession(db,'owner');
 const req=(actor,body,csrf=true)=>{const s=sessions[actor];return auth({env,request:new Request('https://chatgun.pages.dev/api/auth/sessions',{method:body?'POST':'GET',headers:{cookie:`__Host-cg_session=${s.token}; __Host-cg_csrf=${s.csrf}`,...(body?{origin:'https://chatgun.pages.dev','content-type':'application/json','x-csrf-token':csrf?s.csrf:'wrong'}:{})},...(body?{body:JSON.stringify(body)}:{})})});};
 const list=await(await req('owner')).json();assert.equal(list.sessions.length,2);assert.equal(list.sessions.filter(s=>s.current).length,1);assert.doesNotMatch(JSON.stringify(list),/token_hash|csrf_hash|__Host/);
 assert.equal((await req('owner',{action:'revoke_others'},false)).status,403);
 const response=await req('owner',{action:'revoke_others'});assert.equal(response.status,200);assert.equal((await response.json()).revoked,1);
 assert.equal((await req('owner')).status,200);const invalid=await auth({env,request:new Request('https://chatgun.pages.dev/api/auth/me',{headers:{cookie:`__Host-cg_session=${extra.token}`}})});assert.equal(invalid.status,401);assert.equal((await req('viewer')).status,200);
 db.exec("UPDATE session_auth_evidence SET authenticated_at=1 WHERE user_id='owner'");assert.equal((await req('owner',{action:'revoke_others'})).status,428);
});
test('new release cannot deploy against Production schema15 or reuse an old owner-only rollout approval',()=>{
 const release={commit:'fixture-sha',requiredD1MigrationNumber:17};assert.throws(()=>assertFullSystemRelease({release,migrationCount:15,approval:null}));assert.throws(()=>assertFullSystemRelease({release,migrationCount:17,approval:{sha:'old-sha',humanUatPassed:true,rolloutApproved:true,productionMigrationsApproved:true}}));assert.throws(()=>assertFullSystemRelease({release,migrationCount:17,approval:null}));assert.doesNotThrow(()=>assertFullSystemRelease({release,migrationCount:17,approval:{sha:'fixture-sha',humanUatPassed:true,rolloutApproved:true,productionMigrationsApproved:true}}));
});
test('gallery comment reads hide both directions of blocked authors without leaking their text',async t=>{
 const{db,call,media,now}=await fixture(t);media();db.exec("UPDATE social_media SET state='active';UPDATE media_safety_reviews SET status='released',category='general';UPDATE profile_photos SET visibility='public'");await db.prepare("INSERT INTO photo_comments(id,media_id,sender_user_id,body,created_at)VALUES('comment','photo','independent','Must be hidden after blocking',?)").bind(now).run();
 assert.equal((await(await call('gallery?user=owner&photo=photo','viewer')).json()).comments.length,1);db.exec("INSERT INTO social_blocks VALUES('independent','viewer',1)");const response=await(await call('gallery?user=owner&photo=photo','viewer')).json();assert.equal(response.comments.length,0);assert.ok(!JSON.stringify(response).includes('Must be hidden'));
});
