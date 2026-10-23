// Genuine Pages Functions/D1 HTTP, but synthetic authenticated sessions, NOT OAuth.
import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import {assertYouthFixtureScope} from '../scripts/lib/youth-fixture-scope.mjs';
const pointer=readFileSync('/tmp/chatgun-youth-e2e-manifest-path','utf8');
if(!/^\/Users\/nattano\/\.codex\/private-backups\/chatgun\/youth-e2e-[^/]+\/manifest\.json$/u.test(pointer))throw Error('Untrusted synthetic manifest path');
const manifest=assertYouthFixtureScope(JSON.parse(readFileSync(pointer)));
const origin='https://issue13.chatgun-issue13-staging.pages.dev';
if(process.env.CHATGUN_ISOLATED_STAGING!=='issue13'||manifest.origin!==origin||manifest.database!=='275d9820-6aec-494a-8bb5-b7ed9b8b74cc'||manifest.syntheticOnly!==true||manifest.actors.length!==10)throw Error('Wrong isolated synthetic environment');
if(!/^youth-e2e-[a-f0-9-]{36}$/u.test(manifest.run)||new Set(manifest.actors.map(a=>a.id)).size!==10||manifest.actors.some(a=>!a.id.startsWith(manifest.run+'-')))throw Error('Invalid exact synthetic actor scope');
const screenDir='test-results/youth-cloud/screens';mkdirSync(screenDir,{recursive:true});
function headers(session){return {cookie:`__Host-cg_session=${session.token}; __Host-cg_csrf=${session.csrf}`,origin,'x-csrf-token':session.csrf};}
async function contextFor(browser,actor,session=actor.session){
 const context=await browser.newContext({baseURL:origin,viewport:{width:actor.width,height:900}});
 await context.addCookies([{name:'__Host-cg_session',value:session.token,url:origin,secure:true,httpOnly:true,sameSite:'Lax'},
  {name:'__Host-cg_csrf',value:session.csrf,url:origin,secure:true,sameSite:'Lax'}]);return context;
}
test.beforeAll(async({request})=>{
 const r=await request.get('/release.json');expect(r.status()).toBe(200);const j=await r.json();expect(j.commit).toBe(manifest.applicationSha);expect(j.requiredD1MigrationNumber).toBe(21);
});
test('isolated Preview remains closed to real registration and anonymous member access',async({request})=>{
 const r=await request.get('/api/auth/config');expect(r.status()).toBe(200);const config=await r.json();expect(config.oauthLoginEnabled).toBe(false);expect(config.newAccountRegistrationEnabled).toBe(false);expect(config.emailOtpEnabled).toBe(false);expect(config.mobileOtpEnabled).toBe(false);
 for(const path of ['/api/auth/me','/api/social/profile','/api/social/discovery'])expect((await request.get(path)).status()).toBe(401);
});
for(const actor of manifest.actors.filter(a=>a.band!=='control'))test(`Cloudflare held ${actor.band} rights, bypass denial and deletion at ${actor.width}px`,async({browser})=>{
 const context=await contextFor(browser,actor);const page=await context.newPage();
 try{
  const me=await(await context.request.get('/api/auth/me')).json();expect(me.user.id===actor.id).toBe(true);expect(me.ageSafetyReviewRequired).toBe(true);expect(me.canLinkAccounts).toBe(false);expect(me.nextPath).toBe('/account.html?access=age-review');expect(me.user.accountState).toBe('pending_acceptance');expect(me.providers).toHaveLength(0);
  for(const path of ['profile','discovery','conversations','gallery','online','upload-quotas']){
   const r=await context.request.get('/api/social/'+path);expect(r.status()).toBe(403);expect((await r.json()).code).toBe('age_safety_review_required');
  }
  for(const [path,data]of [['messages',{action:'send',target:actor.id,body:'Denied synthetic send'}],['albums/access',{action:'request',owner:actor.id}],['online',{action:'heartbeat',foreground:true,tabId:'synthetic-cloud-tab-0001'}]]){
   const r=await context.request.post('/api/social/'+path,{headers:headers(actor.session),data});expect(r.status()).toBe(403);expect((await r.json()).code).toBe('age_safety_review_required');
  }
  // Rights mutations still enforce CSRF and same-origin; do not weaken them for a hold.
  const csrfDenied=await context.request.post('/api/auth/account-deletion/request',{headers:{origin,'x-csrf-token':'invalid-fixture-token'},data:{acknowledged:true}});expect(csrfDenied.status()).toBe(403);expect((await csrfDenied.json()).code).toBe('invalid_csrf');
  expect((await context.request.post('/api/auth/account-deletion/request',{headers:{origin:'https://invalid.example','x-csrf-token':actor.session.csrf},data:{acknowledged:true}})).status()).toBe(403);
  const sessions=await(await context.request.get('/api/auth/sessions')).json();
  const revoked=await context.request.post('/api/auth/sessions',{headers:headers(actor.session),data:{action:'revoke_others'}});expect(revoked.status()).toBe(200);expect((await revoked.json()).revoked).toBe(sessions.sessions.filter(s=>!s.current).length);
  expect((await context.request.get('/api/auth/me',{headers:headers(actor.other)})).status()).toBe(401);
  expect((await context.request.get('/api/auth/me')).status()).toBe(200);
  // Pages canonicalizes .html routes; the Social fence uses the shared restricted route.
  // The specific age notice comes only from authenticated server state, never this query.
  await page.goto('/app/');await expect(page).toHaveURL(/\/account(?:\.html)?\?access=(?:age-review|restricted)$/u);
  await expect(page.locator('#age-safety-notice')).toBeVisible();await expect(page.locator('#open-social')).toBeHidden();await expect(page.locator('#linking')).toBeHidden();await expect(page.locator('.auth-navigation')).toBeHidden();
  await expect(page.locator('#session-management')).toBeVisible();await expect(page.locator('#logout')).toBeVisible();await expect(page.locator('#age-safety-notice')).toContainText('อย่าส่งวันเกิดเต็ม');
  await page.reload();await expect(page.locator('#age-safety-notice')).toBeVisible();
  await expect(page.locator('#eligibility-review')).toBeVisible();
  const correction={action:'request',reason:'คำขอทบทวนจากบัญชีจำลองในสภาพแวดล้อมแยก ไม่ใช่การรับผู้เยาว์จริง'};
  const simultaneous=await Promise.all([0,1].map(()=>context.request.post('/api/auth/eligibility-review',{headers:headers(actor.session),data:correction})));
  expect(simultaneous.map(r=>r.status()).sort()).toEqual([201,409]);
  const own=await(await context.request.get('/api/auth/eligibility-review')).json();expect(own.requests.filter(r=>r.status==='pending')).toHaveLength(1);
  const pending=own.requests.find(r=>r.status==='pending');
  const withdrawals=await Promise.all([0,1].map(()=>context.request.post('/api/auth/eligibility-review',{headers:headers(actor.session),data:{action:'withdraw',id:pending.id,revision:pending.revision,reason:'ถอนคำขอจำลองโดยไม่ปลดข้อจำกัดบัญชี'}})));
  expect(withdrawals.map(r=>r.status()).sort()).toEqual([200,409]);
  await page.reload();await expect(page.locator('#eligibility-history')).toContainText('ถอนคำขอแล้ว');
  await page.locator('#age-safety-notice a[href="mailto:natttano@outlook.com"]').focus();await expect(page.locator('#age-safety-notice a[href="mailto:natttano@outlook.com"]')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`${screenDir}/${actor.band}-${actor.width}.png`,fullPage:true});
  await page.locator('#delete-start').click();await expect(page.locator('#delete-confirm')).toBeVisible();
  await page.locator('#delete-phrase').fill('ลบบัญชีถาวร');await page.locator('#delete-confirm button').click();await expect(page.getByRole('heading',{name:'ลบบัญชีแล้ว',exact:true})).toBeVisible();
  expect((await context.request.get('/api/auth/me')).status()).toBe(401);
  expect((await context.request.get('/api/social/profile')).status()).toBe(401);
  expect((await context.request.post('/api/auth/account-deletion/confirm',{headers:headers(actor.session),data:{confirmText:'ลบบัญชีถาวร',requestId:'replay',confirmationToken:'replay'}})).status()).toBe(401);
 }finally{await context.close();}
});
test('Cloudflare expired/stale sessions and held-account logout remain enforced',async({browser})=>{
 const actor=manifest.actors.find(a=>a.band==='control');
 const context=await contextFor(browser,actor,actor.other);
 try{
  const me=await(await context.request.get('/api/auth/me')).json();expect(me.user.id===actor.id).toBe(true);
  expect((await context.request.get('/api/auth/me',{headers:headers(actor.expired)})).status()).toBe(401);
  const stale=await context.request.post('/api/auth/account-deletion/request',{headers:headers(actor.stale),data:{acknowledged:true}});expect(stale.status()).toBe(428);expect((await stale.json()).code).toBe('recent_auth_required');
  const page=await context.newPage();await page.goto('/account.html');await expect(page.locator('#age-safety-notice')).toBeVisible();
  const logout=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/logout'&&r.request().method()==='POST');
  await page.locator('#logout').click();expect((await logout).status()).toBe(200);
  await expect(page).not.toHaveURL(/\/account(?:\.html)?(?:\?|$)/u);
  expect((await context.request.get('/api/auth/me',{headers:headers(actor.other)})).status()).toBe(401);
 }finally{await context.close();}
});
