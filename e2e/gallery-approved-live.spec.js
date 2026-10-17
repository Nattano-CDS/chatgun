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
  try{
    for(const scope of ['public','private']){
      await page.goto('/app/me/'+(scope==='public'?'gallery':'private-gallery')+'/upload');await expect(page.locator('#approved-gallery-upload')).toBeVisible();
      await page.locator('#gallery-file-picker').setInputFiles({name:'isolated-synthetic.png',mimeType:'image/png',buffer:Buffer.from(ONE_PIXEL_PNG)});await expect(page.locator('.thumb-small')).toHaveCount(1);
      const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/social/gallery'&&r.request().method()==='POST');await page.locator('#approved-gallery-upload button.primary').click();const r=await response;expect(r.status()).toBe(201);const {id}=await r.json();uploaded.push(id);
      await expect(page.locator('#gallery-upload-status')).toContainText('Pending Moderation');expect((await context.request.get(baseURL+'/api/social/media/'+id)).status()).toBe(404);
      const out=await (await context.request.get(baseURL+'/api/social/gallery?user='+b.ids.owner+'&album='+scope)).json();expect(out.photos.find(p=>p.id===id)).toMatchObject({visibility:scope,review_status:'pending'});
      if(scope==='private'){const publicOut=await (await context.request.get(baseURL+'/api/social/gallery?user='+b.ids.owner)).json();expect(JSON.stringify(publicOut)).not.toContain(id);}
      await page.screenshot({path:directory+'/real-upload-'+scope+'.png',fullPage:true});
    }
    const quota=await (await context.request.get(baseURL+'/api/social/upload-quotas')).json();expect(quota.gallery.used).toBe(5);
  }finally{
    // Only files created by this test are queued for deletion; preserve all fixtures.
    for(const id of uploaded){const r=await context.request.post(baseURL+'/api/social/gallery',{headers:{origin:baseURL,'x-csrf-token':b.sessions.owner.csrf},data:{action:'delete',id}});expect(r.status()).toBe(200);}
  }
});
