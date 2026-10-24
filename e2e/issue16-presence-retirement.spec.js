import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
const evidence='docs/issue-16/screens';mkdirSync(evidence,{recursive:true});
async function login(browser,actor,width){
  const sessions=JSON.parse(readFileSync('/tmp/chatgun-issue16-local-sessions.json','utf8'));
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900}});
  for(const [name,value] of [['__Host-cg_session',sessions[actor].token],['__Host-cg_csrf',sessions[actor].csrf]])await context.addCookies([{name,value,url:'https://localhost:8797',secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();await page.goto('/');return {context,page};
}
for(const width of [390,768,1440]){
  test(`authenticated Online across four surfaces, opt-out and logout ${width}`,async({browser})=>{
    const ownerId='owner'+width,viewerId='viewer'+width;
    const owner=await login(browser,ownerId,width),viewer=await login(browser,viewerId,width);
    try{
      await expect(owner.page.locator('#social-view')).toBeVisible();
      await owner.page.locator('#primary-nav [data-tab=profile]').click();
      await owner.page.locator('#online-status-toggle').check();
      await expect.poll(async()=>{const r=await viewer.context.request.get('/api/social/online?users='+ownerId);return (await r.json()).statuses?.[ownerId];}).toBe(true);
      await viewer.page.reload();await expect(viewer.page.locator(`[data-person=${ownerId}] .member-online-slot`)).toHaveText('ออนไลน์');
      await viewer.page.locator(`[data-person=${ownerId}]`).scrollIntoViewIfNeeded();await viewer.page.screenshot({path:`${evidence}/online-discovery-${width}.png`});
      await viewer.page.locator(`[data-person=${ownerId}] .card-open`).click();await expect(viewer.page.locator('.full-name-row .member-online-slot')).toHaveText('ออนไลน์');
      await viewer.page.screenshot({path:`${evidence}/online-profile-${width}.png`});
      await viewer.page.locator('.full-profile-actions [data-action=chat]').click();
      await expect(viewer.page.locator('.thread-head .member-online-slot')).toHaveText('ออนไลน์');
      await viewer.page.locator('.composer input[name=body]').fill('ข้อความสำหรับทดสอบระบบเท่านั้น');await viewer.page.locator('.composer button[type=submit],.composer button.primary').click();
      await expect(viewer.page.locator(`[data-chat=${ownerId}] .member-online-slot`)).toHaveText('ออนไลน์');
      await viewer.page.screenshot({path:`${evidence}/online-chat-${width}.png`});
      expect(await viewer.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await owner.page.locator('#online-status-toggle').uncheck();await viewer.page.goto('/');await expect(viewer.page.locator(`[data-person=${ownerId}] .member-online-slot`)).toBeEmpty();
      await owner.page.locator('#online-status-toggle').check();
      const session=JSON.parse(readFileSync('/tmp/chatgun-issue16-local-sessions.json'))[ownerId];
      const logout=await owner.context.request.post('/api/auth/logout',{headers:{origin:'https://localhost:8797','x-csrf-token':session.csrf}});expect(logout.status()).toBe(200);
      await expect.poll(async()=>{const r=await viewer.context.request.get('/api/social/online?users='+ownerId);return (await r.json()).statuses[ownerId];}).toBe(false);
    }finally{await owner.context.close();await viewer.context.close();}
  });
  test(`prelaunch and exact-key export/removal preserve unrelated data ${width}`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto('https://localhost:8798/');
    await page.evaluate(async()=>{
      localStorage.setItem('unrelated-preference','keep');document.cookie='unrelated-session=keep; SameSite=Lax; path=/';
      const db=await new Promise(resolve=>{const r=indexedDB.open('chatgun-demo',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);});
      await new Promise(resolve=>{const tx=db.transaction('state','readwrite'),s=tx.objectStore('state');s.put({profile:{bio:'owner-edited'},gallery:[{url:'data:image/png;base64,c3ludGhldGlj'}],messages:{edited:'keep-in-export'}},'chatgun-browser-demo-v1');s.put({real:'keep'},'unrelated-key');tx.oncomplete=resolve;});db.close();
    });
    await page.reload();await expect(page.locator('#disabled-view')).toBeVisible();await expect(page.locator('#retired-demo')).toBeVisible();
    await page.screenshot({path:`${evidence}/retirement-choice-${width}.png`,fullPage:true});
    await expect(page.locator('#people-grid .photo-card')).toHaveCount(0);await expect(page.locator('[data-online-user]')).toHaveCount(0);
    const downloaded=page.waitForEvent('download');await page.locator('[data-export-retired]').click();const file=await downloaded;
    const exported=JSON.parse(readFileSync(await file.path(),'utf8'));expect(exported.profile.bio).toBe('owner-edited');expect(exported.gallery[0].url).toContain('data:image/png');
    await page.locator('[data-remove-retired]').click();await expect(page.locator('#retired-demo')).toContainText('ลบเฉพาะข้อมูลตัวอย่างแล้ว');await page.reload();
    await expect(page.locator('#retired-demo')).toBeHidden();
    const kept=await page.evaluate(async()=>{
      const db=await new Promise(resolve=>{const r=indexedDB.open('chatgun-demo');r.onsuccess=()=>resolve(r.result);});const result=await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('unrelated-key');r.onsuccess=()=>resolve(r.result);});db.close();return {result,preference:localStorage.getItem('unrelated-preference'),cookie:document.cookie};
    });expect(kept.result).toEqual({real:'keep'});expect(kept.preference).toBe('keep');expect(kept.cookie).toContain('unrelated-session=keep');
    await page.screenshot({path:`${evidence}/prelaunch-${width}.png`});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const path of ['/assets/demo/network.json','/assets/demo/01.png','/app/demo-network.js','/app/demo-gallery.js','/app/demo-bootstrap.js'])expect((await page.request.get('https://localhost:8798'+path)).status()).toBe(404);
  });
}
test('retirement refuses to remove data edited concurrently in another tab',async({page})=>{
  await page.goto('https://localhost:8798/');
  await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('chatgun-demo',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);});await new Promise(resolve=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({messages:['original']},'chatgun-browser-demo-v1');tx.oncomplete=resolve;});db.close();});
  await page.reload();await expect(page.locator('[data-remove-retired]')).toBeVisible();
  await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('chatgun-demo');r.onsuccess=()=>resolve(r.result);});await new Promise(resolve=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({messages:['newer edit']},'chatgun-browser-demo-v1');tx.oncomplete=resolve;});db.close();});
  await page.locator('[data-remove-retired]').click();await expect(page.locator('[data-retired-status]')).toContainText('ข้อมูลตัวอย่างเปลี่ยนแปลง');
  await page.reload();const exported=page.waitForEvent('download');await page.locator('[data-export-retired]').click();expect(JSON.parse(readFileSync(await(await exported).path(),'utf8')).messages).toEqual(['newer edit']);
});
