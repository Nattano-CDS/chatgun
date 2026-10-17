import test from 'node:test';
import assert from 'node:assert/strict';
import {TestD1,environment} from './helpers/d1.js';
import {issueSession} from '../functions/_lib/db.js';
import {onRequest} from '../functions/api/social/[[path]].js';
import {ONE_PIXEL_PNG} from './helpers/image.js';
import {initializeGallery,galleryBatch,resetGalleryBatch} from '../app/demo-gallery.js';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

async function fixture(t){
  const db=new TestD1();t.after(()=>db.close());const sessions={},objects=new Map();
  const env={...environment(db),SOCIAL_APP_ENABLED:'true',PUBLIC_DISCOVERY_ENABLED:'true',MESSAGING_ENABLED:'true',MEDIA_UPLOAD_ENABLED:'true',SENSITIVE_CONTENT_ENABLED:'false',MEDIA:{async put(k,b){objects.set(k,b);},async delete(k){objects.delete(k);},async get(k){return objects.has(k)?{body:objects.get(k)}:null;}}};
  for(const id of ['owner','viewer','other']){
    db.exec(`INSERT INTO users(id,status,created_at,updated_at) VALUES('${id}','active',1,1);INSERT INTO age_assurance_events VALUES('${id}-adult','${id}','adult_18_plus','self_declaration','v1',1,NULL);INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at) VALUES('${id}','${id}-adult','${id}',1,1)`);
    sessions[id]=await issueSession(db,id);
  }
  const headers=actor=>({cookie:`__Host-cg_session=${sessions[actor].token}; __Host-cg_csrf=${sessions[actor].csrf}`,origin:'https://chatgun.pages.dev','x-csrf-token':sessions[actor].csrf});
  const call=(actor,path,body)=>onRequest({env,request:new Request('https://chatgun.pages.dev/api/social/'+path,{method:body?'POST':'GET',headers:{...headers(actor),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})});
  const upload=(visibility,key='approved-gallery-key-001')=>{const form=new FormData();form.set('file',new File([ONE_PIXEL_PNG],'synthetic.png',{type:'image/png'}));form.set('visibility',visibility);form.set('caption',visibility+' caption');return onRequest({env,request:new Request('https://chatgun.pages.dev/api/social/gallery',{method:'POST',headers:{...headers('owner'),'idempotency-key':key},body:form})});};
  return {db,env,call,upload,objects};
}
test('Public responses exclude Private IDs, captions and comments even for owner/granted viewer',async t=>{
  const {db,upload,call}=await fixture(t);
  const pub=await (await upload('public','public-gallery-key-0001')).json(),priv=await (await upload('private','private-gallery-key-001')).json();
  db.exec("UPDATE media_safety_reviews SET status='released',category='general'");
  await call('viewer','albums/access',{action:'request',owner:'owner'});const r=await db.prepare('SELECT id,revision FROM album_access_requests').first();await call('owner','albums/access',{action:'approve',...r});
  for(const actor of ['owner','viewer']){
    const out=await (await call(actor,'gallery?user=owner')).json();assert.deepEqual(out.photos.map(p=>p.id),[pub.id]);assert.ok(!JSON.stringify(out).includes(priv.id));assert.ok(!JSON.stringify(out).includes('private caption'));
    assert.equal((await call(actor,'gallery?user=owner&photo='+priv.id)).status,404);
    const privateOut=await (await call(actor,'gallery?user=owner&album=private')).json();assert.deepEqual(privateOut.photos.map(p=>p.id),[priv.id]);
    assert.equal((await call(actor,'gallery?user=owner&album=private&photo='+pub.id)).status,404);
  }
  assert.equal((await call('other','gallery?user=owner&album=private')).status,404);
  assert.equal((await call('viewer','gallery',{action:'comment',id:priv.id,album:'public',comment:'must not cross scopes'})).status,404);
  assert.equal((await call('viewer','gallery?user=owner&album=invalid')).status,400);
  await call('owner','albums/access',{action:'revoke',id:r.id,revision:2});
  assert.equal((await call('viewer','gallery?user=owner&album=private')).status,404);
  assert.equal((await call('viewer','media/'+priv.id)).status,404);
});
test('separate upload scopes share quota, preserve quarantine, and reject cross-album retry reuse',async t=>{
  const {db,call,upload,objects}=await fixture(t);
  for(const scope of ['public','private']){
    const r=await upload(scope,scope+'-upload-test-key-01');assert.equal(r.status,201);const {id}=await r.json();
    assert.equal((await db.prepare('SELECT visibility FROM profile_photos WHERE media_id=?').bind(id).first()).visibility,scope);
    assert.equal((await call('owner','media/'+id)).status,404);
    assert.equal((await call('viewer','gallery?user=owner')).status,200);
  }
  assert.equal(objects.size,2);assert.equal((await call('owner','upload-quotas')).status,200);
  assert.equal((await (await call('owner','upload-quotas')).json()).gallery.used,2);
  assert.equal((await upload('public','public-upload-test-key-01')).status,201);
  assert.equal(objects.size,2);assert.equal((await upload('private','public-upload-test-key-01')).status,409);
  assert.equal((await upload('invalid')).status,400);
  const owner=await (await call('owner','gallery?user=owner')).json();assert.equal(owner.photos.length,1);assert.equal(owner.photos[0].review_status,'pending');
  assert.equal((await call('owner','gallery?user=owner&photo='+owner.photos[0].id)).status,404);
  assert.deepEqual((await (await call('viewer','gallery?user=owner')).json()).photos,[]);
});
test('shared 12-photo capacity is transaction-enforced and releases failed upload reservations',async t=>{
  const {db,upload,objects,call}=await fixture(t);
  for(let i=0;i<12;i++)db.exec(`INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,created_at) VALUES('cap${i}','owner','cap${i}','gallery','image/png',1,1);INSERT INTO profile_photos(media_id,owner_user_id,visibility,created_at) VALUES('cap${i}','owner','${i%2?'private':'public'}',1)`);
  assert.equal((await upload('public')).status,409);assert.equal(objects.size,0);
  assert.deepEqual((await (await call('owner','upload-quotas')).json()).galleryCapacity,{used:12,limit:12,remaining:0});
  assert.deepEqual((await (await call('viewer','upload-quotas')).json()).galleryCapacity,{used:0,limit:12,remaining:12},'capacity is only the authenticated owner aggregate');
  assert.equal((await db.prepare("SELECT count(*) n FROM media_upload_quota_attempts WHERE status='completed'").first()).n,0);
  assert.equal((await db.prepare('SELECT count(*) n FROM profile_photos').first()).n,12);
  db.exec("DELETE FROM profile_photos WHERE media_id='cap0'");
  assert.equal((await upload('private')).status,201);assert.equal((await db.prepare('SELECT count(*) n FROM profile_photos').first()).n,12);
  assert.equal((await upload('private')).status,201,'replay succeeds even at full capacity');
});
test('simultaneous public/private uploads cannot exceed one remaining album space',async t=>{
  const {db,upload,objects,call}=await fixture(t);
  for(let i=0;i<11;i++)db.exec(`INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,created_at) VALUES('race${i}','owner','race${i}','gallery','image/png',1,1);INSERT INTO profile_photos(media_id,owner_user_id,visibility,created_at) VALUES('race${i}','owner','public',1)`);
  const results=await Promise.all([upload('public','concurrent-public-001'),upload('private','concurrent-private-01')]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(objects.size,1);
  const quota=await (await call('owner','upload-quotas')).json();assert.equal(quota.gallery.used,1);assert.equal(quota.galleryCapacity.used,12);
});
test('fictional gallery upgrade is bounded, additive, idempotent, and never restores deleted fixtures',()=>{
  const s={people:Array.from({length:20},(_,i)=>({user_id:'demo-'+String(i+1).padStart(2,'0')})),demoGallery:[{id:'legacy',owner:'demo-me',visibility:'private',caption:'edited'}],demoAlbumRequests:[],demoSystemEvents:[]};
  assert.equal(initializeGallery(s,null),galleryBatch);
  const baseline=structuredClone(s);assert.equal(s.people.length,20);assert.equal(s.demoGallery[0].caption,'edited');
  for(const owner of ['demo-me',...s.people.map(p=>p.user_id)])assert.ok(s.demoGallery.filter(p=>p.owner===owner).length<=12);
  assert.ok(s.demoGallery.filter(p=>p.owner==='demo-me'&&p.visibility==='public').length>=4);assert.ok(s.demoGallery.filter(p=>p.owner==='demo-me'&&p.visibility==='private').length>=4);
  s.demoGallery.splice(1,1);s.demoAlbumRequests[0].status='revoked';initializeGallery(s,{galleryBatch});
  assert.equal(s.demoGallery.length,baseline.demoGallery.length-1);assert.equal(s.demoAlbumRequests[0].status,'revoked');
  s.demoGallery.push({id:'owner-upload',owner:'demo-me',visibility:'private',caption:'keep'});
  const before=s.demoGallery.length;assert.equal(resetGalleryBatch(s).dryRun,true);assert.equal(s.demoGallery.length,before);
  resetGalleryBatch(s,{confirmed:true});assert.equal(s.demoGallery.find(p=>p.id==='owner-upload').caption,'keep');assert.equal(s.demoGallery.find(p=>p.id==='legacy').caption,'edited');
});
test('failed media commit plus R2 deletion failure creates a durable cleanup retry',async t=>{
  const {db,env,upload,objects}=await fixture(t);
  db.batch=async()=>{throw Error('simulated media commit failure');};
  env.MEDIA.delete=async()=>{throw Error('simulated R2 outage');};
  assert.equal((await upload('private','failure-gallery-key-001')).status,500);
  assert.equal(objects.size,1);assert.equal((await db.prepare('SELECT COUNT(*) n FROM media_deletion_queue WHERE completed_at IS NULL').first()).n,1);
  assert.equal((await db.prepare("SELECT count(*) n FROM media_upload_quota_attempts WHERE status='released'").first()).n,1);
  assert.equal((await db.prepare('SELECT count(*) n FROM profile_photos').first()).n,0);
});
test('failed upload attempts are rate-limited independently of the successful daily quota',async t=>{
  const {db,upload,objects}=await fixture(t);
  for(let i=0;i<60;i++)assert.equal((await upload('invalid','rate-gallery-key-'+String(i).padStart(3,'0'))).status,400);
  assert.equal((await upload('public','rate-gallery-next-00001')).status,429);
  assert.equal(objects.size,0);assert.equal((await db.prepare('SELECT count(*) n FROM media_upload_quota_attempts').first()).n,0);
});
test('Gallery glyphs use the exact approved prototype paths, not alternative drawings',()=>{
  const window={};vm.runInNewContext(readFileSync('app/gallery-approved.js','utf8'),{window});
  const source=readFileSync('docs/gallery-approved/reference/chatgun-gallery-design/chatgun_gallery_ux_prototype.html','utf8');
  for(const [_,name,paths] of source.matchAll(/^\s*(\w+):'([^']*)'/gm)){
    assert.equal(window.ChatgunGallery.icon(name).match(/<svg[^>]*>([\s\S]*)<\/svg>/)[1],paths);
  }
});
test('Public Gallery never reuses a private selected photo as its owner avatar',()=>{
  const window={};vm.runInNewContext(readFileSync('app/gallery-approved.js','utf8'),{window});
  const html=window.ChatgunGallery.gallery({person:{name:'owner',selected_photo_id:'private-secret'},id:'owner',own:true,photos:[{id:'public',visibility:'public'},{id:'private-secret',visibility:'private'}],html:String,portrait:p=>p.selected_photo_id?'<img src="'+p.selected_photo_id+'">':'initial',media:String,config:{},album:{granted:true}});
  assert.ok(!html.includes('private-secret'));assert.match(html,/class="avatar">initial/);
});
