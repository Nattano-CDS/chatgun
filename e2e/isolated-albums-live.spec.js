import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const file=process.env.ISSUE13_SESSION_FILE;
test('real isolated D1/R2 private-album cards, owner consent, revocation and logout',async({page,context,browser,baseURL},info)=>{
  test.skip(!file||info.project.name!=='desktop-chromium','explicit isolated synthetic fixture bundle required; three viewports run once');
  test.setTimeout(120000);
  const b=JSON.parse(readFileSync(file));expect(baseURL).toBe('https://issue13.chatgun-issue13-staging.pages.dev');expect(b.origin).toBe(baseURL);
  for(const id of Object.values(b.ids))expect(id).toMatch(/^issue13-[a-f0-9-]+-(owner|viewer|other)$/);
  async function auth(c,role){await c.addCookies([{name:'__Host-cg_session',value:b.sessions[role].token,url:baseURL,secure:true,httpOnly:true,sameSite:'Lax'},{name:'__Host-cg_csrf',value:b.sessions[role].csrf,url:baseURL,secure:true,httpOnly:false,sameSite:'Lax'}]);}
  await auth(context,'other');
  await page.goto('/app/people/'+b.ids.owner);
  await expect(page.locator('[data-private-album]')).toHaveAttribute('data-album-state','locked');
  await page.locator('[data-private-album]').click();await expect(page.locator('.album-feedback')).toContainText('ส่งคำขอแล้ว');
  const ownerContext=await browser.newContext();await auth(ownerContext,'owner');const owner=await ownerContext.newPage();
  try{
    await owner.goto('/?tab=chat');await owner.locator('[data-chat="'+b.ids.other+'"]').click();
    await expect(owner.locator('[data-album-action=approve]')).toBeVisible();
    const dir=resolve(process.env.ISSUE13_EVIDENCE_DIR||'test-results/issue13-live-screens');mkdirSync(dir,{recursive:true});
    for(const width of [390,768,1440]){await owner.setViewportSize({width,height:width===390?844:1024});await owner.screenshot({path:resolve(dir,`real-owner-request-${width}.png`)});}
    await owner.locator('[data-album-action=approve]').click();await expect(owner.locator('[data-album-action=revoke]')).toBeVisible();
    await expect(page.locator('[data-private-album]')).toHaveAttribute('data-album-state','unlocked',{timeout:15000});await page.locator('[data-private-album]').click();
    await expect(page.locator('[data-photo="'+b.photoId+'"][data-gallery-action=view] img')).toHaveJSProperty('naturalWidth',1);
    await page.locator('[data-photo="'+b.photoId+'"][data-gallery-action=view]').click();await expect(page.locator('.lightbox-image img')).toHaveJSProperty('naturalWidth',1);
    await page.locator('#gallery-comment input[name=comment]').fill('ความคิดเห็นสมมติทดสอบ D1 จริง');await page.locator('#gallery-comment button').click();await expect(page.locator('.post-comments')).toContainText('ความคิดเห็นสมมติทดสอบ D1 จริง');
    await owner.locator('[data-album-action=revoke]').click();await expect(owner.locator('#thread')).toContainText('เพิกถอนสิทธิ์');
    const old=await context.request.get(baseURL+'/api/social/media/'+b.photoId);expect(old.status()).toBe(404);
    await page.reload();await expect(page.locator('.gallery-post-page')).toHaveCount(0);
    await page.goto('/?tab=chat');await page.locator('[data-chat="'+b.ids.owner+'"]').click();await expect(page.locator('#thread')).toContainText('เพิกถอนสิทธิ์');
    const logout=await context.request.post(baseURL+'/api/auth/logout',{headers:{origin:baseURL,'x-csrf-token':b.sessions.other.csrf}});expect(logout.status()).toBe(200);
    expect((await context.request.get(baseURL+'/api/social/conversations')).status()).toBe(401);
  }finally{await ownerContext.close();}
});
