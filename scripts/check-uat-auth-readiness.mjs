// Live closed-admission negative tests only. Never creates users, invitations or OAuth flows.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from '@playwright/test';
assert.equal(process.env.CHATGUN_FINAL_UAT,'approved');
const s=JSON.parse(readFileSync('docs/final-uat/environment.json'));
assert.equal(s.account,'23017b53386fb67fc62a52cdd017454c');assert.equal(s.origin,'https://uat.chatgun-final-uat.pages.dev');
const dir='docs/final-uat/oauth-access-setup';mkdirSync(dir,{recursive:true});
const checks=[];
async function check(name,path,{method='GET',origin,body,status,code,location}={}){
 const r=await fetch(s.origin+path,{method,redirect:'manual',headers:{...(origin?{origin}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal(r.status,status,name);
 if(code)assert.equal((await r.json()).code,code,name);
 if(location)assert.equal(r.headers.get('location'),location,name);
 assert.equal(r.headers.get('cache-control'),'no-store',name);
 const cookie=r.headers.get('set-cookie');if(cookie){assert.ok(cookie.includes('Max-Age=0'),'Negative callback may only clear its own flow cookie');assert.ok(cookie.includes('Secure')&&cookie.includes('HttpOnly')&&cookie.includes('SameSite=Lax'));assert.ok(!cookie.includes('Domain='));}
 checks.push({name,path,method,http:r.status,status:'PASS',noCrossDomainCookie:true});
}
const config=await(await fetch(s.origin+'/api/auth/config')).json();assert.equal(config.oauthLoginEnabled,false);assert.deepEqual(config.oauthProviders,[]);assert.equal(config.newAccountRegistrationEnabled,false);assert.equal(config.invitationOnlyRegistrationEnabled,false);assert.equal(config.turnstileSiteKey,s.turnstileSiteKey);
for(const provider of['google','facebook','line']){
 await check(provider+' initiation closed','/api/auth/oauth/'+provider+'/start',{method:'POST',origin:s.origin,body:{turnstileToken:'invalid-negative-only'},status:503,code:'oauth_unavailable'});
 await check(provider+' foreign origin denied','/api/auth/oauth/'+provider+'/start',{method:'POST',origin:'https://invalid.example',body:{},status:403,code:'invalid_origin'});
 await check(provider+' callback cannot authenticate while closed','/api/auth/oauth/'+provider+'/callback?code=invalid-uat-negative-only&state=invalid-uat-negative-only',{status:303,location:'/signup.html?auth_error=oauth_unavailable'});
}
await check('unknown provider rejected','/api/auth/oauth/invalid/start',{method:'POST',origin:s.origin,body:{},status:404,code:'not_found'});
await check('missing member session denied','/api/auth/me',{status:401,code:'unauthorized'});
await check('session management denied','/api/auth/sessions',{status:401,code:'unauthorized'});
await check('session mutation foreign origin denied','/api/auth/logout',{method:'POST',origin:'https://invalid.example',body:{},status:403,code:'invalid_origin'});
await check('standalone Admin stays disabled','/api/admin/session',{status:404,code:'feature_disabled'});
await check('Email OTP remains disabled','/api/auth/otp/start',{method:'POST',origin:s.origin,body:{channel:'email'},status:404,code:'otp_disabled'});
await check('Mobile OTP remains disabled','/api/auth/otp/start',{method:'POST',origin:s.origin,body:{channel:'mobile'},status:404,code:'otp_disabled'});
const browser=await chromium.launch(),screens=[];
try{for(const width of[390,768,1440]){const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(s.origin+'/app/');await page.locator('#disabled-view').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(errors.length,0);await page.screenshot({path:dir+'/closed-'+width+'.png',fullPage:true});screens.push({width,status:'PASS',scriptErrors:0,horizontalOverflow:false});await page.close();}}finally{await browser.close();}
writeFileSync(dir+'/live-negative-security.json',JSON.stringify({checkedAt:new Date().toISOString(),origin:s.origin,applicationSha:s.candidate,checks,passed:checks.length,failed:0,screens,genuineOAuth:'NOT RUN',genuineMfa:'NOT RUN',turnstileHuman:'NOT RUN',limitation:'Providers deliberately OFF. Invalid-state/token/PKCE cryptographic paths are covered by isolated implementation tests, not falsely claimed as exercised through an active live provider.',accountsCreated:0,invitationsIssued:0,roleGrants:0},null,2)+'\n');
console.log('Live closed-admission negative checks '+checks.length+' PASS; three responsive views PASS. No genuine authentication attempted.');
