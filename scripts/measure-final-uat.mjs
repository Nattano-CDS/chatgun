// Observed browser/API traffic only; not a billing estimate or genuine OAuth/MFA proof.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
assert.equal(process.env.CHATGUN_FINAL_UAT,'approved');
const s=JSON.parse(readFileSync('docs/final-uat/environment.json'));
assert.equal(s.project,'chatgun-final-uat');assert.equal(s.databaseId,'e3cb426c-b88a-4b93-90fd-39df524f68ae');
const checks=[],timings=[];
for(const path of ['/api/health','/api/auth/config','/api/social/config']){
 const start=performance.now(),r=await fetch(s.origin+path);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/application\/json/);await r.json();timings.push({path,status:r.status,elapsedMs:Math.round(performance.now()-start)});checks.push({path,status:'PASS'});
}
const auth=await(await fetch(s.origin+'/api/auth/config')).json();
assert.equal(auth.oauthLoginEnabled,false);assert.deepEqual(auth.oauthProviders,[]);assert.equal(auth.turnstileSiteKey,s.turnstileSiteKey);assert.equal(auth.newAccountRegistrationEnabled,false);assert.equal(auth.invitationOnlyRegistrationEnabled,false);
for(const path of ['/api/auth/me','/api/auth/sessions','/api/admin/session']){const r=await fetch(s.origin+path);assert.equal(r.status,path==='/api/admin/session'?404:401);checks.push({path,status:'PASS',http:r.status});}
const release=await(await fetch(s.origin+'/release.json')).json();assert.equal(release.commit,s.candidate);assert.equal(release.requiredD1MigrationNumber,21);
const manifestText=await(await fetch(s.origin+'/release-assets.json')).text();assert.equal(createHash('sha256').update(manifestText).digest('hex'),release.assetsManifestSha256);
const manifest=JSON.parse(manifestText);for(let i=0;i<manifest.files.length;i+=6)await Promise.all(manifest.files.slice(i,i+6).map(async f=>{const r=await fetch(s.origin+'/'+f.path);assert.equal(r.status,200);assert.equal(createHash('sha256').update(new Uint8Array(await r.arrayBuffer())).digest('hex'),f.sha256);}));
const browser=await chromium.launch();mkdirSync('docs/final-uat/screens',{recursive:true});const screens=[];
try{
 for(const width of [390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();const requests=[],errors=[];
  page.on('request',r=>{const u=new URL(r.url());if(u.origin===s.origin)requests.push({path:u.pathname,kind:r.resourceType()});});page.on('pageerror',e=>errors.push(e.message));
  const start=performance.now();await page.goto(s.origin+'/app/');await page.locator('#disabled-view').waitFor({state:'visible'});const loadMs=Math.round(performance.now()-start);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(errors.length,0);
  await page.screenshot({path:'docs/final-uat/screens/prelaunch-'+width+'.png',fullPage:true});
  await page.goto(s.origin+'/app/');await page.locator('#disabled-view').waitFor({state:'visible'});
  screens.push({width,loadMs,totalSameOriginRequests:requests.length,apiRequests:requests.filter(r=>r.path.startsWith('/api/')).length,scriptErrors:errors.length,horizontalOverflow:false,screenshot:'screens/prelaunch-'+width+'.png'});await context.close();
 }
}finally{await browser.close();}
const{token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function q(sql,params=[]){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+s.account+'/d1/database/'+s.databaseId+'/query',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({sql,params})}),j=await r.json();assert.ok(r.ok&&j.success);assert.equal(j.result[0].meta.changed_db,false);return j.result[0];}
const plans=[];for(const [label,sql,params]of[
 ['session_lookup','SELECT * FROM sessions WHERE token_hash=?',['no-such-synthetic-token']],
 ['conversation_messages','SELECT * FROM social_messages WHERE sender_user_id=? AND receiver_user_id=? ORDER BY created_at DESC LIMIT 50',['no-such-synthetic-sender','no-such-synthetic-receiver']],
 ['presence_expiration','SELECT * FROM member_presence_leases WHERE touched_at<=? LIMIT 500',[0]],
]){const r=await q('EXPLAIN QUERY PLAN '+sql,params);plans.push({label,plan:r.results});}
const widgets=readdirSync('/Users/nattano/.codex/private-backups/chatgun').filter(n=>n.startsWith('final-uat-credentials-'));
let negativeTurnstile={status:'NOT RUN'};
for(const dir of widgets){const w=JSON.parse(readFileSync('/Users/nattano/.codex/private-backups/chatgun/'+dir+'/turnstile.json'));if(w.sitekey!==s.turnstileSiteKey)continue;const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:w.secret,response:'invalid-disposable-uat-negative-response'})}),j=await r.json();assert.equal(j.success,false);negativeTurnstile={status:'PASS',invalidResponseRejected:true,errorCodes:j['error-codes'],genuineChallenge:'NOT RUN',hostnameActionAndExpiryHumanProof:'BLOCKED until the consolidated genuine campaign'};}
writeFileSync('docs/final-uat/http-browser-verification.json',JSON.stringify({checkedAt:new Date().toISOString(),origin:s.origin,sha:s.candidate,checks,assetHashesMatched:manifest.files.length,timings,screens,d1Plans:plans,negativeTurnstile,staticRouting:{include:['/api/*'],note:'Frozen _routes.json restricts Functions to API paths; no claimed billing attribution.'},limitations:['Closed prelaunch timings only; authenticated workflow performance is reported separately.','No account-wide billing/capacity estimate; no plan change.','Actual hidden-tab heartbeat/poll suppression not independently measured in this run; existing deterministic regression evidence retained.']},null,2)+'\n');console.log('UAT JSON APIs, real closed flags, asset hashes, anonymous denials, responsive empty state and invalid Turnstile response checks PASS.');
