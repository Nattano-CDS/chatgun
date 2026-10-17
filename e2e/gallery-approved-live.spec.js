import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import {ONE_PIXEL_PNG} from '../test/helpers/image.js';
const file=process.env.ISSUE13_SESSION_FILE;
test('real isolated owner uploads use distinct server scopes, shared quota and quarantine',async({page,context,baseURL},info)=>{
  test.skip(!file||info.project.name!=='desktop-chromium','requires isolated synthetic sessions; no real OAuth bypass claimed');test.setTimeout(90000);
  expect(baseURL).toBe('https://issue13.chatgun-issue13-staging.pages.dev');const b=JSON.parse(readFileSync(file));expect(b.origin).toBe(baseURL);
  await context.addCookies([{name:'__Host-cg_session',value:b.sessions.owner.token,url:baseURL,secure:true,httpOnly:true,sameSite:'Lax'},{name:'__Host-cg_csrf',value:b.sessions.owner.csrf,url:baseURL,secure:true,sameSite:'Lax'}]);
  const directory=process.env.GALLERY_EVIDENCE_DIR||'test-results/gallery-approved-live';mkdirSync(directory,{recursive:true});
  const uploaded=[];
  const retryOnly=process.env.GALLERY_RETRY_ONLY==='true';
  const initialQuota=await (await context.request.get(baseURL+'/api/social/upload-quotas')).json();expect(initialQuota.gallery.remaining).toBeGreaterThanOrEqual(retryOnly?1:3);
  try{
    for(const scope of retryOnly?[]:['public','private']){
      let releaseInitial;
      if(scope==='public'){
        const gate=new Promise(r=>releaseInitial=r);let held=false;
        await page.route('**/api/social/albums/access',async route=>{if(route.request().method()==='GET'&&!held){held=true;await gate;}await route.continue();});
      }
      await page.goto('/app/me/'+(scope==='public'?'gallery':'private-gallery')+'/upload',{waitUntil:'domcontentloaded'});
      if(releaseInitial){await expect(page.getByText('กำลังตรวจสอบโควตาและพื้นที่อัลบั้ม…')).toBeVisible();await expect(page.locator('#approved-gallery-upload')).toHaveCount(0);releaseInitial();}
      await expect(page.locator('#approved-gallery-upload')).toBeVisible();
      await page.locator('#gallery-file-picker').setInputFiles({name:'isolated-synthetic.png',mimeType:'image/png',buffer:Buffer.from(ONE_PIXEL_PNG)});await expect(page.locator('.thumb-small')).toHaveCount(1);
      const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/social/gallery'&&r.request().method()==='POST');await page.locator('[data-upload-submit]').click();const r=await response;expect(r.status()).toBe(201);const {id}=await r.json();uploaded.push(id);
      await expect(page.locator('[data-upload-success]')).toContainText('รอผู้ดูแลตรวจสอบ');expect((await context.request.get(baseURL+'/api/social/media/'+id)).status()).toBe(404);
      const out=await (await context.request.get(baseURL+'/api/social/gallery?user='+b.ids.owner+'&album='+scope)).json();expect(out.photos.find(p=>p.id===id)).toMatchObject({visibility:scope,review_status:'pending'});
      if(scope==='private'){const publicOut=await (await context.request.get(baseURL+'/api/social/gallery?user='+b.ids.owner)).json();expect(JSON.stringify(publicOut)).not.toContain(id);}
      await page.screenshot({path:directory+'/real-upload-'+scope+'.png',fullPage:true});
    }
    await page.goto('/app/me/gallery/upload');await expect(page.locator('[data-album-capacity]')).toBeVisible();
    await page.locator('#gallery-file-picker').setInputFiles({name:'lost-ack.png',mimeType:'image/png',buffer:Buffer.from(ONE_PIXEL_PNG)});
    let savedId,lost=false;
    const loseAck=async route=>{if(route.request().method()!=='POST'||lost)return route.continue();lost=true;const r=await route.fetch();expect(r.status()).toBe(201);savedId=(await r.json()).id;uploaded.push(savedId);await route.abort('failed');};
    await page.route('**/api/social/gallery',loseAck);await page.locator('[data-upload-submit]').click();await expect(page.locator('#gallery-upload-status')).toContainText('ไม่สำเร็จ 1 รูป');await expect(page.locator('[data-upload-submit]')).toBeEnabled();
    const retry=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/social/gallery'&&r.request().method()==='POST');await page.locator('[data-upload-submit]').click();const replay=await retry;expect(replay.status()).toBe(201);expect((await replay.json()).id).toBe(savedId);await expect(page.locator('[data-upload-success]')).toBeVisible();
    const quota=await (await context.request.get(baseURL+'/api/social/upload-quotas')).json();expect(quota.gallery.used).toBe(initialQuota.gallery.used+(retryOnly?1:3));
  }finally{
    // Only files created by this test are queued for deletion; preserve all fixtures.
    for(const id of uploaded){const r=await context.request.post(baseURL+'/api/social/gallery',{headers:{origin:baseURL,'x-csrf-token':b.sessions.owner.csrf},data:{action:'delete',id}});expect(r.status()).toBe(200);}
  }
});
