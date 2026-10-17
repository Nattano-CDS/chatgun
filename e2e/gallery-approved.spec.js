import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {ONE_PIXEL_PNG} from '../test/helpers/image.js';

for(const width of [390,768,1440])test(`approved Gallery: four destinations, uploads and bounded lightbox ${width}`,async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','explicit owner reference viewport');test.setTimeout(90000);
  await page.setViewportSize({width,height:width===390?844:1100});
  const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
  const dir=resolve(process.env.GALLERY_EVIDENCE_DIR||'test-results/gallery-approved');mkdirSync(dir,{recursive:true});
  const shot=async name=>{await page.locator('button:focus').evaluateAll(bs=>bs.forEach(b=>b.blur()));await page.screenshot({path:resolve(dir,`${name}-${width}.png`),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);};
  await page.goto('/app/people/demo-01/gallery');
  await expect(page.locator('.gallery-grid .tile')).toHaveCount(5);
  await expect(page.locator('.gallery-experience')).not.toContainText('Private');
  await expect(page.locator('.gallery-experience [data-private-album],.gallery-experience .album-management')).toHaveCount(0);
  expect(await page.locator('.gallery-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(3);
  await expect.poll(()=>page.locator('.gallery-grid img').evaluateAll(es=>es.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);await shot('public-view');
  await page.locator('.gallery-grid .tile').nth(1).click();
  await expect(page.locator('.lightbox')).toBeVisible();await expect(page.locator('.lightbox-close')).toBeFocused();
  await page.locator('.post-like').click();await expect(page.locator('.post-like')).toHaveAttribute('aria-pressed','true');
  await page.locator('#gallery-comment input[name=comment]').fill('ภาพวาดสมมติสวยมาก');await page.locator('#gallery-comment button').click();await expect(page.locator('.post-comments')).toContainText('ภาพวาดสมมติสวยมาก');
  await page.locator('.lightbox-close').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('.lightbox-arrows')).toContainText('3 / 5');await shot('public-lightbox');
  await page.keyboard.press('Escape');await expect(page).toHaveURL(/demo-01\/gallery$/);await expect(page.locator('.lightbox')).toHaveCount(0);
  await page.goto('/app/people/demo-08/private-gallery');await expect(page.locator('.gallery-grid .tile')).toHaveCount(5);await expect(page.locator('.private-summary')).toContainText('คุณได้รับสิทธิ์');await shot('private-view');
  await page.locator('.gallery-grid .tile').first().click();await expect(page).toHaveURL(/private-gallery\//);await page.reload();await expect(page.locator('.lightbox')).toBeVisible();await page.keyboard.press('Escape');await expect(page).toHaveURL(/private-gallery$/);
  await page.goto('/app/people/demo-01/private-gallery');await expect(page).toHaveURL(/people\/demo-01$/);await expect(page.locator('.gallery-grid')).toHaveCount(0);
  for(const scope of ['gallery','private-gallery']){
    await page.goto('/app/me/'+scope+'/upload');await expect(page.locator('#approved-gallery-upload')).toBeVisible();await expect(page.locator('input[name=visibility]')).toHaveValue(scope==='gallery'?'public':'private');await shot(scope==='gallery'?'upload-public':'upload-private');
  }
  await page.goto('/app/me/gallery/upload');
  const file={name:'fictional.png',mimeType:'image/png',buffer:Buffer.from(ONE_PIXEL_PNG)};
  await page.locator('#gallery-file-picker').setInputFiles([file,{...file,name:'second.png'}]);await expect(page.locator('.thumb-small')).toHaveCount(2);
  await page.locator('[data-remove-upload="1"]').click();await expect(page.locator('.thumb-small')).toHaveCount(1);
  await page.locator('#gallery-caption').fill('รูปอัปโหลดสมมติ');await page.locator('#approved-gallery-upload button.primary').click();await expect(page.locator('#gallery-upload-status')).toContainText('Pending Moderation');await expect(page.locator('[data-approved-quota]')).toHaveText('1 / 10 รูป');await shot('upload-pending');
  await page.locator('[data-gallery-return]').first().click();await expect(page).toHaveURL(/people\/demo-me\/gallery$/);await expect(page.locator('.review-status')).toHaveCount(3);
  expect(errors).toEqual([]);expect(writes).toEqual([]);
});

test('fictional upgrade preserves user edits and deleted fixtures across reload',async({page})=>{
  await page.goto('/app/people/demo-me/gallery');await expect(page.locator('.gallery-grid .tile')).toHaveCount(6);
  page.on('dialog',d=>d.accept());await page.locator('.gallery-experience [data-gallery-action=delete]').first().click();await expect(page.locator('.gallery-grid .tile')).toHaveCount(5);await page.reload();await expect(page.locator('.gallery-grid .tile')).toHaveCount(5);
  const data=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('chatgun-demo',1);r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('chatgun-browser-demo-v1');r.onsuccess=()=>{db.close();resolve({batch:r.result.galleryBatch,messages:Object.values(r.result.messages).flat().length,people:new Set(r.result.gallery.map(p=>p.owner)).size,max:Math.max(...Object.values(Object.groupBy(r.result.gallery,p=>p.owner)).map(ps=>ps.length))});};});});
  expect(data).toMatchObject({batch:'chatgun-gallery-approved-v1',messages:120,people:21});expect(data.max).toBeLessThanOrEqual(12);
});

test('gallery upload rejects invalid images and shows shared Bangkok quota exhaustion',async({page})=>{
  await page.goto('/app/me/private-gallery/upload');await page.locator('#gallery-file-picker').setInputFiles({name:'fake.png',mimeType:'image/png',buffer:Buffer.from('not an image')});await expect(page.locator('#gallery-upload-status')).toContainText('ไฟล์รูปไม่ถูกต้อง');await expect(page.locator('.thumb-small')).toHaveCount(0);
  await page.locator('#gallery-file-picker').setInputFiles({name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(8*1024*1024+1)});await expect(page.locator('#gallery-upload-status')).toContainText('8 MB');
  await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('chatgun-demo',1);r.onsuccess=()=>resolve(r.result);});await new Promise(resolve=>{const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),r=store.get('chatgun-browser-demo-v1');r.onsuccess=()=>{const s=r.result;const d=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());s.uploadQuotas.localDay=d;s.uploadQuotas.gallery={used:10,remaining:0,limit:10,reserved:0};store.put(s,'chatgun-browser-demo-v1');};tx.oncomplete=resolve;});db.close();});
  for(const scope of ['gallery','private-gallery']){await page.goto('/app/me/'+scope+'/upload');await expect(page.locator('#approved-gallery-upload button.primary')).toBeDisabled();await expect(page.locator('.quota-helper')).toContainText('เหลือ 0 รูปวันนี้');}
});

test('optional demo reset requires confirmation and preserves uploads, original data and quota',async({page})=>{
  const writes=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
  await page.goto('/app/me/gallery/upload');await page.locator('#gallery-file-picker').setInputFiles({name:'keep.png',mimeType:'image/png',buffer:Buffer.from(ONE_PIXEL_PNG)});await page.locator('#approved-gallery-upload button.primary').click();await expect(page.locator('#gallery-upload-status')).toContainText('Pending Moderation');
  await page.locator('[data-gallery-return]').first().click();await expect(page.locator('.gallery-grid .tile')).toHaveCount(7);
  page.once('dialog',d=>d.accept());await page.locator('.gallery-experience [data-gallery-action=delete][data-photo^="chatgun-gallery-approved-v1-demo-me-public-"]').first().click();await expect(page.locator('.gallery-grid .tile')).toHaveCount(6);
  await page.locator('#primary-nav [data-tab=chat]').click();page.once('dialog',d=>d.dismiss());await page.locator('[data-reset-gallery-fixtures]').click();
  await page.goto('/app/people/demo-me/gallery');await expect(page.locator('.gallery-grid .tile')).toHaveCount(6);
  await page.locator('#primary-nav [data-tab=chat]').click();page.once('dialog',d=>d.accept());await page.locator('[data-reset-gallery-fixtures]').click();await expect(page.locator('#toast')).toContainText('รีเซ็ตเฉพาะชุด Gallery');
  await page.goto('/app/people/demo-me/gallery');await expect(page.locator('.gallery-grid .tile')).toHaveCount(7);await expect(page.locator('.review-status')).toHaveCount(3);
  await page.goto('/app/me/private-gallery/upload');await expect(page.locator('[data-approved-quota]')).toHaveText('1 / 10 รูป');expect(writes).toEqual([]);
});

test('own private profile photo is not serialized into Public Gallery avatar or tiles',async({page})=>{
  await page.goto('/');await page.locator('#primary-nav [data-tab=profile]').click();await page.locator('#manage-gallery').click();
  await page.locator('#my-gallery [data-gallery-action=select][data-photo=demo-own-01]').click();await expect(page.locator('#toast')).toContainText('ตั้งรูปหลักแล้ว');
  await page.goto('/app/people/demo-me/gallery');await expect(page.locator('.gallery-grid .tile')).toHaveCount(6);
  await expect(page.locator('.gallery-experience .avatar img')).toHaveCount(0);
  await expect(page.locator('.gallery-experience [data-photo=demo-own-01],.gallery-experience img[src$="/01.png"]')).toHaveCount(0);
});
