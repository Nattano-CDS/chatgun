import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

for(const width of [390,768,1440])test(`P0 fresh and returning demo access without Functions ${width}`,async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','explicit mobile/tablet/desktop sizes');
  await page.setViewportSize({width,height:900});
  const errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
  // Reproduce the exact incident response even after the platform recovers.
  await page.route('**/api/social/config',r=>r.fulfill({status:404,contentType:'text/html',body:'<!doctype html><title>ไม่พบหน้านี้</title>'}));
  await page.goto('/');
  await expect(page.locator('#people-count')).toHaveText('20');
  await expect(page.locator('#people-grid .photo-card').first()).toHaveAttribute('data-person','demo-me');
  const before=await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('chatgun-demo',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const saved=await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('chatgun-browser-demo-v1');r.onsuccess=()=>resolve(r.result);});
    // This browser context is disposable. Never write to the owner's browser.
    saved.profile.bio='ข้อความสมมติที่ต้องคงอยู่';
    saved.chatPreferences['demo-me']={allowDirectMessages:false};
    saved.messages['demo-01'].push({id:'incident15-retained-message',sender:'demo-me',body:'ข้อความสมมติที่บันทึกไว้',created_at:1});
    saved.gallery[0].caption='คำบรรยายสมมติที่ต้องคงอยู่';
    await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(saved,'chatgun-browser-demo-v1');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    db.close();return JSON.stringify({profile:saved.profile,messages:saved.messages,gallery:saved.gallery,preferences:saved.chatPreferences,assets:saved.assets});
  });
  await page.reload();
  await expect(page.locator('#people-count')).toHaveText('20');
  const after=await page.evaluate(async()=>{
    const db=await new Promise(resolve=>{const r=indexedDB.open('chatgun-demo',1);r.onsuccess=()=>resolve(r.result);});
    const s=await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('chatgun-browser-demo-v1');r.onsuccess=()=>resolve(r.result);});db.close();
    return JSON.stringify({profile:s.profile,messages:s.messages,gallery:s.gallery,preferences:s.chatPreferences,assets:s.assets});
  });
  expect(after).toBe(before);
  await page.goto('/app/people/demo-01/gallery');
  await expect(page.locator('.gallery-grid .tile').first()).toBeVisible();
  await page.locator('.gallery-grid .tile').first().click();
  await expect(page.locator('.lightbox-shell')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const directory=process.env.INCIDENT_EVIDENCE_DIR||'test-results/incident15';mkdirSync(directory,{recursive:true});
  await page.screenshot({path:`${directory}/returning-gallery-${width}.png`});
  expect(errors).toEqual([]);expect(writes).toEqual([]);
});
