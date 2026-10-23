import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium} from '@playwright/test';
assert.equal(process.env.CHATGUN_FINAL_UAT,'approved');
const b=JSON.parse(readFileSync(readFileSync('/tmp/chatgun-final-uat-fixture-path','utf8').trim()));
assert.equal(b.databaseId,'e3cb426c-b88a-4b93-90fd-39df524f68ae');assert.equal(b.origin,'https://engineering.chatgun-final-uat.pages.dev');
const browser=await chromium.launch(),context=await browser.newContext({baseURL:b.origin,viewport:{width:390,height:900}});
const s=b.sessions.owner390,observations=[];let phase='initial';
try{
 await context.addCookies([{name:'__Host-cg_session',value:s.token,url:b.origin,secure:true,sameSite:'Lax'},{name:'__Host-cg_csrf',value:s.csrf,url:b.origin,secure:true,sameSite:'Lax'}]);
 const page=await context.newPage();page.on('response',r=>{const u=new URL(r.url());if(u.origin===b.origin)observations.push({phase,path:u.pathname,method:r.request().method(),status:r.status(),resourceType:r.request().resourceType(),cacheControl:r.headers()['cache-control']||null});});
 const start=performance.now();await page.goto('/?tab=profile');await page.locator('#profile-form').waitFor();const initialLoadMs=Math.round(performance.now()-start);
 phase='navigation';await page.goto('/?tab=chat');await page.locator('#section-chat').waitFor({state:'attached'}).catch(()=>{});
 // Observe without injecting visibility or bypassing security. No password/MFA/CAPTCHA interaction.
 phase='foreground_observation';const visible=await page.evaluate(()=>document.visibilityState);await page.waitForTimeout(30000);
 const foregroundRequests=observations.filter(r=>r.phase===phase);
 phase='repeat_navigation';await page.goto('/?tab=profile');await page.locator('#profile-form').waitFor();
 const result={checkedAt:new Date().toISOString(),syntheticOnly:true,origin:b.origin,windowMs:30000,visibility:visible,initialLoadMs,totalBrowserResponses:observations.length,observedApiResponses:observations.filter(r=>r.path.startsWith('/api/')).length,foregroundApiResponses:foregroundRequests.filter(r=>r.path.startsWith('/api/')).length,foregroundPresenceResponses:foregroundRequests.filter(r=>r.path==='/api/social/online').length,foregroundChatResponses:foregroundRequests.filter(r=>['/api/social/messages','/api/social/conversations'].includes(r.path)).length,server5xx:observations.filter(r=>r.status>=500).length,responses:observations,limitations:['Single synthetic browser observation, not overall Pages/D1/R2 billable usage.','No chat thread selected in this idle-inbox sample.','Hidden-tab suppression covered by existing deterministic tests; not fabricated as an actual browser measurement.','No projected concurrent-user capacity or monthly cost claimed.']};
 assert.equal(result.server5xx,0);writeFileSync('docs/final-uat/authenticated-request-observation.json',JSON.stringify(result,null,2)+'\n');console.log('Authenticated synthetic browser traffic observation saved; no genuine OAuth/MFA claim.');
}finally{await context.close();await browser.close();}
