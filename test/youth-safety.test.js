import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { issueSession, unixTime } from '../functions/_lib/db.js';
import { canContact, albumGrant, canViewPhoto } from '../functions/_lib/social-permissions.js';
import { onlineStatuses } from '../functions/_lib/online-presence.js';
import { onRequest } from '../functions/api/social/[[path]].js';
import { onRequest as authRequest } from '../functions/api/auth/[[path]].js';
import { environment, TestD1 } from './helpers/d1.js';

async function member(db, id) {
  const now = unixTime();
  await db.prepare("INSERT INTO users(id,display_name,status,created_at,updated_at)VALUES(?,?,'active',?,?)").bind(id, id, now, now).run();
  await db.prepare("INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at)VALUES(?,?,'adult_18_plus','self_declaration','legacy-fixture',?)").bind(id + '-age', id, now).run();
  await db.prepare("INSERT INTO member_profiles(user_id,age_assurance_id,name,discovery_visible,direct_messages_enabled,latitude,longitude,accuracy,located_at,created_at,updated_at)VALUES(?,?,?,1,1,13.75,100.5,5,?,?,?)").bind(id, id + '-age', id, now, now, now).run();
  await db.prepare('INSERT INTO member_presence_preferences(user_id,show_online)VALUES(?,1)').bind(id).run();
  const s = await issueSession(db, id, now);
  await db.prepare('INSERT INTO member_presence_leases(user_id,session_token_hash,tab_id,touched_at)SELECT ?,token_hash,?,? FROM sessions WHERE user_id=?').bind(id, 'local-fixture-tab-0001', now, id).run();
  return s;
}
function request(path, session, body) {
  return new Request('https://chatgun.pages.dev' + path, { method: body ? 'POST' : 'GET',
    headers: { cookie: `__Host-cg_session=${session.token}; __Host-cg_csrf=${session.csrf}`,
      ...(body ? { origin: 'https://chatgun.pages.dev', 'content-type': 'application/json', 'x-csrf-token': session.csrf } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

for (const band of ['under_13','13_17','18_19']) test(`age hold ${band} blocks both contact directions, private access and server bypass`, async () => {
  const db = new TestD1(), now = unixTime();
  try {
    const adult = await member(db, 'local-adult'), youth = await member(db, 'local-held');
    const env = { ...environment(db), SOCIAL_APP_ENABLED: 'true', PUBLIC_DISCOVERY_ENABLED: 'true',
      MESSAGING_ENABLED: 'true', PRESENCE_ENABLED: 'true', MEDIA_UPLOAD_ENABLED: 'true', RATINGS_ENABLED: 'true' };
    let objectReads=0;env.MEDIA={get:async()=>{objectReads++;return{body:new Uint8Array([1])};}};
    await db.prepare("INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,created_at)VALUES('held-photo','local-held','synthetic/held-photo','gallery','image/png',1,?)").bind(now).run();
    await db.prepare("INSERT INTO profile_photos(media_id,owner_user_id,visibility,created_at)VALUES('held-photo','local-held','public',?)").bind(now).run();
    await db.prepare("INSERT INTO media_safety_reviews(media_id,status,category,source,created_at)VALUES('held-photo','released','general','manual',?)").bind(now).run();
    await db.prepare("INSERT INTO album_access_requests(id,album_owner_id,requester_id,status,created_at,updated_at)VALUES('old-grant','local-held','local-adult','pending',?,?)").bind(now, now).run();
    await db.prepare("UPDATE album_access_requests SET status='approved',revision=revision+1 WHERE id='old-grant'").run();
    assert.equal(await albumGrant(db, 'local-adult', 'local-held'), true);
    await db.prepare("INSERT INTO member_age_safety_holds(user_id,age_band,state,notice_version,declared_at,updated_at)VALUES('local-held',?,'held','unpublished-fixture-v1',?,?)").bind(band, now, now).run();
    const p = await db.prepare("SELECT discovery_visible,direct_messages_enabled,latitude,longitude FROM member_profiles WHERE user_id='local-held'").first();
    assert.deepEqual({ ...p }, { discovery_visible: 0, direct_messages_enabled: 0, latitude: null, longitude: null });
    assert.equal((await db.prepare("SELECT show_online FROM member_presence_preferences WHERE user_id='local-held'").first()).show_online, 0);
    assert.equal((await db.prepare("SELECT COUNT(*) n FROM member_presence_leases WHERE user_id='local-held'").first()).n, 0);
    assert.equal(await canContact(db, 'local-adult', 'local-held'), false);
    assert.equal(await canContact(db, 'local-held', 'local-adult'), false);
    assert.equal(await albumGrant(db, 'local-adult', 'local-held'), false);
    assert.equal(await canViewPhoto(db, 'local-adult', { owner_user_id: 'local-held', visibility: 'public' }), false);
    assert.equal((await onlineStatuses(db, 'local-adult', ['local-held']))['local-held'], false);
    for (const [path, body] of [
      ['/api/social/profile'], ['/api/social/discovery'], ['/api/social/conversations'],
      ['/api/social/messages', { target: 'local-adult', body: 'Must not send' }],
      ['/api/social/albums/access', { action: 'request', target: 'local-adult' }],
      ['/api/social/online', { action: 'heartbeat', foreground: true, tabId: 'local-fixture-tab-0002' }],
      ['/api/social/gallery'], ['/api/social/upload-quotas'],
    ]) {
      const r = await onRequest({ env, request: request(path, youth, body) });
      assert.equal(r.status, 403, path); assert.equal((await r.json()).code, 'age_safety_review_required');
    }
    assert.equal((await onRequest({ env, request: request('/api/social/profile?user=local-held', adult) })).status, 404);
    assert.equal((await onRequest({ env, request: request('/api/social/gallery?user=local-held', adult) })).status, 404);
    assert.equal((await onRequest({ env, request: request('/api/social/media/held-photo', adult) })).status, 404);
    assert.equal((await onRequest({ env, request: request('/api/social/gallery?user=local-held&photo=held-photo', adult) })).status, 404);
    assert.equal((await onRequest({ env, request: request('/api/social/gallery', adult, {action:'like',id:'held-photo'}) })).status, 404);
    assert.equal(objectReads,0,'Denied media never reaches R2');
    assert.equal((await authRequest({ env, request: request('/api/auth/me', youth) })).status, 200, 'Account/privacy controls stay reachable');
    const authEnv={...env,ACCEPTANCE_FLOW_ENABLED:'true',ADULT_NOTICE_VERSION:'age-notice-v1',TERMS_VERSION:'terms-v1',PRIVACY_VERSION:'privacy-v1'};
    const authStatus=await(await authRequest({env:authEnv,request:request('/api/auth/me',youth)})).json();
    assert.equal(authStatus.nextPath,'/account.html?access=age-review');assert.equal(authStatus.canLinkAccounts,false);
    const falseAdult=await authRequest({env:authEnv,request:request('/api/auth/acceptance',youth,{confirmedAdult:true,acceptedTerms:true,acknowledgedPrivacy:true,adultNoticeVersion:'age-notice-v1',termsVersion:'terms-v1',privacyVersion:'privacy-v1'})});
    assert.equal(falseAdult.status,403);assert.equal((await falseAdult.json()).code,'age_safety_review_required');
    assert.equal((await db.prepare("SELECT COUNT(*) n FROM account_acceptances WHERE user_id='local-held'").first()).n,0);
    await assert.rejects(db.prepare("INSERT INTO social_messages(id,sender_user_id,receiver_user_id,body,created_at)VALUES('bypass','local-adult','local-held','Must not send',?)").bind(now).run(), /age_safety_contact_denied/u);
    await assert.rejects(db.prepare("INSERT INTO album_access_requests(id,album_owner_id,requester_id,status,created_at,updated_at)VALUES('bypass-album','local-adult','local-held','pending',?,?)").bind(now, now).run(), /age_safety_contact_denied/u);
    await assert.rejects(db.prepare("UPDATE member_age_safety_holds SET state='cleared' WHERE user_id='local-held'").run(), /CHECK/u);
    await assert.rejects(db.prepare("UPDATE album_access_requests SET status='approved',revision=revision+1 WHERE id='old-grant'").run(), /age_safety_contact_denied/u);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM pragma_foreign_key_check').first()).n, 0);
    assert.equal((await db.prepare("SELECT age_band FROM age_assurance_events WHERE user_id='local-adult'").first()).age_band, 'adult_18_plus', 'Do not relabel unrelated adult declarations');
    const deletion=await authRequest({env:authEnv,request:request('/api/auth/account-deletion/request',youth,{acknowledged:true})});
    assert.equal(deletion.status,200,'Age hold must not block the existing deletion right');
    const confirmation=await deletion.json();
    const deleted=await authRequest({env:authEnv,request:request('/api/auth/account-deletion/confirm',youth,{...confirmation,confirmText:'ลบบัญชีถาวร'})});
    assert.equal(deleted.status,200);assert.equal((await deleted.json()).accountAccessRevoked,true);
    assert.equal((await db.prepare("SELECT COUNT(*) n FROM member_age_safety_holds WHERE user_id='local-held'").first()).n,0);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM pragma_foreign_key_check').first()).n,0);
    assert.equal((await authRequest({env:authEnv,request:request('/api/auth/me',youth)})).status,401);
  } finally { db.close(); }
});

test('new migrations are additive/idempotent and leave schema17 member rows intact', async () => {
  const db = new TestD1({ throughMigration: '0017_delivery_and_review_claims.sql' });
  try {
    const created = db.database.prepare("SELECT 1 ok FROM sqlite_master WHERE name='member_age_safety_holds'").get();
    assert.equal(created, undefined);
    const now = unixTime();
    await db.prepare("INSERT INTO users(id,display_name,status,created_at,updated_at)VALUES('preserved','Preserve','active',?,?)").bind(now, now).run();
    const before = await db.prepare("SELECT * FROM users WHERE id='preserved'").first();
    for (let i=0;i<2;i++) for (const file of ['0018_cloudflare_admin_sessions.sql','0019_member_age_safety_holds.sql']) db.exec(readFileSync('migrations/' + file, 'utf8'));
    assert.deepEqual(await db.prepare("SELECT * FROM users WHERE id='preserved'").first(), before);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM pragma_foreign_key_check').first()).n, 0);
    const cols = (await db.prepare('PRAGMA table_info(member_age_safety_holds)').all()).results.map(r=>r.name);
    assert.ok(!cols.some(c=>/birth|email|parent|location/u.test(c)));
  } finally { db.close(); }
});
