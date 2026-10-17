// Real HTTP + remote D1/R2 test, restricted to a new isolated synthetic environment.
// No OAuth bypass is claimed: these are explicitly synthetic session fixtures.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {issueSession,unixTime} from '../functions/_lib/db.js';
import {ONE_PIXEL_PNG} from '../test/helpers/image.js';
import {drainMediaDeletionQueue} from '../workers/media-cleanup.js';
const account='23017b53386fb67fc62a52cdd017454c',database='275d9820-6aec-494a-8bb5-b7ed9b8b74cc';
const origin='https://issue13.chatgun-issue13-staging.pages.dev';
if(process.env.CHATGUN_ISOLATED_STAGING!=='issue13')throw Error('Isolated staging acknowledgement required');
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function cf(path,body){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok||!d.success)throw Error('Cloudflare fixture request failed '+r.status);return d.result;}
const project=await cf('/pages/projects/chatgun-issue13-staging');
assert.equal(project.deployment_configs.preview.d1_databases.DB.id,database);
assert.equal(project.deployment_configs.preview.r2_buckets.MEDIA.name,'chatgun-issue13-media');
async function query(sql,params=[]){const result=await cf(`/d1/database/${database}/query`,{sql,params});assert.equal(result[0].success,true);return result[0];}
// Sequential fixture-only adapter; application atomicity is exercised inside real D1.
const db={async batch(statements){const results=[];for(const statement of statements)results.push(await statement.run());return results;},prepare(sql){let params=[];return {bind(...v){params=v;return this;},async first(){return (await query(sql,params)).results[0]||null;},async all(){return query(sql,params);},async run(){return query(sql,params);}};}};
const run='issue13-'+randomUUID(),sessions={},ids={},evidence=[];
const check=(name,condition)=>{assert.ok(condition,name);evidence.push({name,result:'PASS'});};
for(const role of ['owner','viewer','other']){
  const id=run+'-'+role;ids[role]=id;
  await query("INSERT INTO users(id,display_name,status,created_at,updated_at) VALUES(?,?,'active',?,?)",[id,'บุคคลสมมติ '+role,unixTime(),unixTime()]);
  await query("INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at) VALUES(?,?,'adult_18_plus','self_declaration','isolated-synthetic-test',?)",[id+'-adult',id,unixTime()]);
  await query('INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at) VALUES(?,?,?,?,?)',[id,id+'-adult','บุคคลสมมติ '+role,unixTime(),unixTime()]);
  sessions[role]=await issueSession(db,id);
}
function headers(role){const s=sessions[role];return {cookie:`__Host-cg_session=${s.token}; __Host-cg_csrf=${s.csrf}`,origin,'x-csrf-token':s.csrf};}
async function call(role,path,body){return fetch(origin+'/api/social/'+path,{method:body?'POST':'GET',headers:{...headers(role),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});}
const release=await (await fetch(origin+'/release.json')).json();
if(process.env.EXPECTED_SHA)assert.equal(release.commit,process.env.EXPECTED_SHA);
check('anonymous messages denied',(await fetch(origin+'/api/social/messages?target='+ids.owner)).status===401);
check('stranger DM succeeds',(await call('viewer','messages',{action:'send',target:ids.owner,body:'สวัสดีจากการทดสอบ staging '+run})).status===200);
check('no friendship rows',(await query('SELECT COUNT(*) n FROM social_relationships')).results[0].n===0);
check('owner inbox contains actual conversation and authorized preview',(await (await call('owner','conversations')).json()).conversations.some(c=>c.other_user_id===ids.viewer&&c.unread_count===1&&c.last_message_body?.includes(run)&&c.last_message_sender_id===ids.viewer));
check('existing counterpart can reply',(await call('owner','messages',{action:'send',target:ids.viewer,body:'reply '+run})).status===200);
check('recipient can opt out',(await call('owner','profile',{action:'contact_privacy',enabled:false})).status===200);
check('opt-out denies new sends',(await call('viewer','messages',{action:'send',target:ids.owner,body:'denied '+run})).status===403);
check('opt-out preserves read receipts',(await call('viewer','messages',{action:'read',target:ids.owner})).status===200);
check('recipient can restore contact',(await call('owner','profile',{action:'contact_privacy',enabled:true})).status===200);
const form=new FormData();form.set('file',new File([ONE_PIXEL_PNG],'synthetic.png',{type:'image/png'}));
const upload=await fetch(origin+'/api/social/gallery',{method:'POST',headers:{...headers('owner'),'idempotency-key':run+'-gallery'},body:form});
assert.equal(upload.status,201,await upload.clone().text());const {id:photo}=await upload.json();
check('quarantine denies owner bytes',(await call('owner','media/'+photo)).status===404);
check('quarantine excludes owner photo navigation',(await call('owner','gallery?user='+ids.owner+'&album=private&photo='+photo)).status===404);
// Synthetic fixture release, NOT evidence of a staffed moderator or scanning vendor.
await query("UPDATE media_safety_reviews SET status='released',category='general',revision=revision+1,reviewed_at=? WHERE media_id=?",[unixTime(),photo]);
check('private listing hides IDs',(await (await call('viewer','gallery?user='+ids.owner)).json()).photos.length===0);
check('private raw URL denies stranger',(await call('viewer','media/'+photo)).status===404);
check('album request succeeds',(await call('viewer','albums/access',{action:'request',owner:ids.owner})).status===200);
let r=(await query('SELECT id,revision FROM album_access_requests WHERE album_owner_id=? AND requester_id=?',[ids.owner,ids.viewer])).results[0];
check('duplicate pending request rejected',(await call('viewer','albums/access',{action:'request',owner:ids.owner})).status===409);
check('cross-user approval rejected',(await call('other','albums/access',{action:'approve',...r})).status===409);
const decisions=await Promise.all([call('owner','albums/access',{action:'approve',...r}),call('owner','albums/access',{action:'approve',...r})]);
check('concurrent approval exactly once',decisions.map(x=>x.status).sort().join(',')==='200,409');
check('grant permits private bytes',(await call('viewer','media/'+photo)).status===200);
check('granted viewer public list still hides private IDs',!(JSON.stringify(await (await call('viewer','gallery?user='+ids.owner)).json())).includes(photo));
check('granted viewer dedicated private list includes only private photos',(await (await call('viewer','gallery?user='+ids.owner+'&album=private')).json()).photos.every(p=>p.visibility==='private')&&(await (await call('viewer','gallery?user='+ids.owner+'&album=private')).json()).photos.some(p=>p.id===photo));
check('unrelated dedicated private listing denied',(await call('other','gallery?user='+ids.owner+'&album=private')).status===404);
check('private comments cannot be requested through public scope',(await call('viewer','gallery?user='+ids.owner+'&photo='+photo)).status===404);
check('cross-scope comment rejected',(await call('viewer','gallery',{action:'comment',id:photo,album:'public',comment:'scope test'})).status===404);
await call('owner','profile',{action:'contact_privacy',enabled:false});
check('granted album profile remains navigable after contact opt-out',(await call('viewer','profile?user='+ids.owner)).status===200);
await call('owner','profile',{action:'contact_privacy',enabled:true});
check('grant does not permit unrelated viewer',(await call('other','media/'+photo)).status===404);
check('permitted comment persists',(await call('viewer','gallery',{action:'comment',id:photo,comment:'ข้อความสมมติ'})).status===200);
check('typed approval delivered',(await (await call('viewer','messages?target='+ids.owner)).json()).messages.some(e=>e.system&&e.event_type==='approved'));
r={...r,revision:2};check('owner revoke succeeds',(await call('owner','albums/access',{action:'revoke',...r})).status===200);
check('old raw URL denied after revoke',(await call('viewer','media/'+photo)).status===404);
check('old photo comments denied after revoke',(await call('viewer','gallery?user='+ids.owner+'&photo='+photo)).status===404);
check('gallery deletion queues R2 cleanup',(await call('owner','gallery',{action:'delete',id:photo})).status===200);
check('deleted media cannot be retrieved',(await call('owner','media/'+photo)).status===404);
const key=(await query('SELECT object_key FROM social_media WHERE id=?',[photo])).results[0].object_key;
check('R2 queue records exact object',(await query('SELECT COUNT(*) n FROM media_deletion_queue WHERE object_key=? AND completed_at IS NULL',[key])).results[0].n===1);
const managed=await cf('/r2/buckets/chatgun-issue13-media/domains/managed');
check('managed public R2 domain disabled',managed.enabled===false);
const cleanup=await drainMediaDeletionQueue({DB:db,MEDIA:{async delete(objectKey){
  execFileSync('npx',['wrangler@4.151.1','r2','object','delete','chatgun-issue13-media/'+objectKey,'--remote'],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account},stdio:'pipe'});
}}});
check('real R2 cleanup worker completes',cleanup.completed>=1&&cleanup.failed===0);
check('deletion queue completion persisted',(await query('SELECT COUNT(*) n FROM media_deletion_queue WHERE object_key=? AND completed_at IS NOT NULL',[key])).results[0].n===1);
check('foreign keys valid',(await query('SELECT COUNT(*) n FROM pragma_foreign_key_check')).results[0].n===0);
// A new, private, explicitly synthetic released fixture for real browser consent tests.
const uiForm=new FormData();uiForm.set('file',new File([ONE_PIXEL_PNG],'synthetic-ui.png',{type:'image/png'}));
const uiUpload=await fetch(origin+'/api/social/gallery',{method:'POST',headers:{...headers('owner'),'idempotency-key':run+'-ui-gallery'},body:uiForm});
assert.equal(uiUpload.status,201);const {id:uiPhoto}=await uiUpload.json();
await query("UPDATE media_safety_reviews SET status='released',category='general',revision=revision+1,reviewed_at=? WHERE media_id=?",[unixTime(),uiPhoto]);
check('browser fixture is private without owner consent',(await call('other','media/'+uiPhoto)).status===404);
const publicForm=new FormData();publicForm.set('file',new File([ONE_PIXEL_PNG],'synthetic-public.png',{type:'image/png'}));publicForm.set('visibility','public');
const publicResponse=await fetch(origin+'/api/social/gallery',{method:'POST',headers:{...headers('owner'),'idempotency-key':run+'-public-gallery'},body:publicForm});
assert.equal(publicResponse.status,201);const {id:publicPhoto}=await publicResponse.json();
check('explicit public upload persists public scope',(await query('SELECT visibility FROM profile_photos WHERE media_id=?',[publicPhoto])).results[0].visibility==='public');
check('unreleased public photo hidden from viewer',!(JSON.stringify(await (await call('viewer','gallery?user='+ids.owner)).json())).includes(publicPhoto));
check('quarantine still denies public bytes',(await call('viewer','media/'+publicPhoto)).status===404);
await query("UPDATE media_safety_reviews SET status='released',category='general',revision=revision+1,reviewed_at=? WHERE media_id=?",[unixTime(),publicPhoto]);
const publicList=await (await call('viewer','gallery?user='+ids.owner)).json();
check('released public listing excludes private fixture metadata',publicList.photos.some(p=>p.id===publicPhoto)&&publicList.photos.every(p=>p.visibility==='public')&&!JSON.stringify(publicList).includes(uiPhoto));
check('public and private uploads count against one gallery quota',(await (await call('owner','upload-quotas')).json()).gallery.used===3);
check('private next-photo list excludes public fixture',!(JSON.stringify(await (await call('owner','gallery?user='+ids.owner+'&album=private')).json())).includes(publicPhoto));
await query("UPDATE media_safety_reviews SET status='rejected',category='prohibited',revision=revision+1 WHERE media_id=?",[publicPhoto]);
check('moderation withdrawal removes public listing',!(JSON.stringify(await (await call('viewer','gallery?user='+ids.owner)).json())).includes(publicPhoto));
check('moderation withdrawal denies old public bytes',(await call('viewer','media/'+publicPhoto)).status===404);
await query("UPDATE media_safety_reviews SET status='released',category='general',revision=revision+1 WHERE media_id=?",[publicPhoto]);
const summary={run,origin,commit:release.commit,database,bucket:'chatgun-issue13-media',syntheticOnly:true,checks:evidence,passed:evidence.length,failed:0,cleanup,oauth:'not retested; synthetic session fixture only'};
const evidenceDirectory=process.env.RELEASE_EVIDENCE_DIR||'docs/issue-13';mkdirSync(evidenceDirectory,{recursive:true});writeFileSync(evidenceDirectory+'/cloud-test-results.json',JSON.stringify(summary,null,2)+'\n');
// Session fixtures stay outside the repository, protected and short-lived operationally.
writeFileSync('/tmp/chatgun-issue13-sessions.json',JSON.stringify({origin,run,ids,sessions,photoId:uiPhoto}),{mode:0o600});
console.log(JSON.stringify(summary,null,2));
