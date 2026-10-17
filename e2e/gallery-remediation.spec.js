import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {ONE_PIXEL_PNG} from '../test/helpers/image.js';
const file=n=>({name:`test-${n}.png`,mimeType:'image/png',buffer:Buffer.from(ONE_PIXEL_PNG)});
// These fixtures exist only in this test's disposable browser IndexedDB.
async function edit(page,update){await page.evaluate(async update=>{
  const db=await new Promise(r=>{const q=indexedDB.open('chatgun-demo',1);q.onsuccess=()=>r(q.result);});
  await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite'),s=tx.objectStore('state'),q=s.get('chatgun-browser-demo-v1');q.onsuccess=()=>{const data=q.result;
    if(update.capacity!==undefined){const own=data.gallery.filter(p=>p.owner==='demo-me');data.gallery=data.gallery.filter(p=>p.owner!=='demo-me');for(let i=0;i<update.capacity;i++)data.gallery.push({...own[i%own.length],id:'boundary-'+i,owner:'demo-me'});}
    if(update.used!==undefined){data.uploadQuotas.gallery={used:update.used,remaining:10-update.used,limit:10,reserved:0};}
    if(update.viewer){const p=data.gallery.find(p=>p.owner==='demo-01'&&p.visibility==='public');p.url=update.viewer.url;p.caption=update.viewer.caption;p.comments=Array.from({length:update.viewer.count??20},(_,i)=>({id:'long-'+i,sender_name:'เพื่อนสมมติ',body:'ข้อความภาษาไทยที่ยาวสำหรับทดสอบการเลื่อนและการแสดงความคิดเห็น '+i,created_at:1}));}
    s.put(data,'chatgun-browser-demo-v1');};tx.oncomplete=resolve;tx.onerror=()=>reject(Error('fixture transaction failed'));});db.close();
},update);}
const evidence=process.env.REMEDIATION_EVIDENCE_DIR||'test-results/gallery-remediation';
async function shot(page,name){mkdirSync(evidence,{recursive:true});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:resolve(evidence,name+'.png'),fullPage:true});}

test('upload navigation preserves scope, warns on leaving, browser Back/Forward and reload',async({page})=>{
  for(const scope of ['gallery','private-gallery']){
    await page.goto('/app/people/demo-me/'+scope);await expect(page.locator('.gallery-grid')).toBeVisible();
    await page.locator('[data-gallery-upload-route]').click();await expect(page).toHaveURL(new RegExp('/'+scope+'/upload$'));
    await page.locator('#gallery-file-picker').setInputFiles(file(1));await expect(page.locator('.thumb-small')).toHaveCount(1);
    page.once('dialog',d=>d.dismiss());await page.keyboard.press('Escape');await expect(page).toHaveURL(/upload$/);
    page.once('dialog',d=>d.dismiss());await page.locator('.go-back').click();await expect(page).toHaveURL(/upload$/);
    page.once('dialog',d=>d.dismiss());await page.goBack();await expect(page).toHaveURL(/upload$/);
    page.once('dialog',d=>d.accept());await page.locator('.go-back').click();await expect(page).toHaveURL(new RegExp('demo-me/'+scope+'$'));
    await page.goBack();await expect(page).toHaveURL(/upload$/);await expect(page.locator('.thumb-small')).toHaveCount(1);
    page.once('dialog',d=>d.accept());await page.goForward();await expect(page).toHaveURL(new RegExp('demo-me/'+scope+'$'));
    await page.goto('/app/me/'+scope+'/upload');await expect(page.locator('input[name=visibility]')).toHaveValue(scope==='gallery'?'public':'private');
    await expect(page.locator('.thumb-small')).toHaveCount(0);await page.locator('#gallery-file-picker').setInputFiles(file(2));
    page.once('dialog',d=>d.accept());await page.reload();await expect(page.locator('input[name=visibility]')).toHaveValue(scope==='gallery'?'public':'private');
    await page.locator('#approved-gallery-upload [data-gallery-return]').first().click();await expect(page).toHaveURL(new RegExp('demo-me/'+scope+'$'));
  }
});

test('10/12 capacity rejects an oversized selection without dropping or charging, success has no X',async({page},info)=>{
  await page.goto('/app/me/gallery/upload');await expect(page.locator('[data-album-capacity]')).toHaveText('10 / 12 รูป');
  await page.locator('#gallery-file-picker').setInputFiles(Array.from({length:5},(_,i)=>file(i)));
  await expect(page.locator('.thumb-small')).toHaveCount(5);await expect(page.locator('[data-upload-submit]')).toBeDisabled();await expect(page.locator('#gallery-upload-status')).toContainText('พื้นที่ว่าง 2 รูป');
  await expect(page.locator('[data-approved-quota]')).toHaveText('0 / 10 รูป');await shot(page,info.project.name+'-capacity-exceeded');
  for(let i=0;i<3;i++)await page.locator('[data-remove-upload]').last().click();
  await page.locator('[data-upload-submit]').click();await expect(page.locator('[data-upload-success]')).toBeVisible();
  await expect(page.locator('[data-remove-upload]')).toHaveCount(0);await expect(page.locator('[data-upload-submit]')).toBeHidden();await expect(page.locator('[data-approved-quota]')).toHaveText('2 / 10 รูป');
  await expect(page.locator('[data-album-capacity]')).toHaveText('12 / 12 รูป');await shot(page,info.project.name+'-success');
  await page.locator('[data-upload-view]').click();await expect(page).toHaveURL(/demo-me\/gallery$/);
  await expect(page.locator('.review-status')).toHaveCount(4);await expect(page.locator('.gallery-grid .tile:disabled')).toHaveCount(4);
  page.once('dialog',d=>d.accept());await page.locator('.gallery-experience [data-gallery-action=delete]').first().click();
  await page.locator('[data-gallery-upload-route]').click();await expect(page.locator('[data-approved-quota]')).toHaveText('2 / 10 รูป');await expect(page.locator('[data-album-capacity]')).toHaveText('11 / 12 รูป');
});

test('empty/full albums and daily quota are separate, invalid format/size/decode and Add More',async({page})=>{
  await page.goto('/app/me/private-gallery/upload');await expect(page.locator('[data-album-capacity]')).toHaveText('10 / 12 รูป');
  for(const invalid of [{name:'bad.gif',mimeType:'image/gif',buffer:Buffer.from('bad')},{name:'huge.png',mimeType:'image/png',buffer:Buffer.alloc(8*1024*1024+1)},{name:'bad.png',mimeType:'image/png',buffer:Buffer.from('bad')}]){
    await page.locator('#gallery-file-picker').setInputFiles(invalid);await expect(page.locator('#gallery-upload-status')).toBeVisible();await expect(page.locator('.thumb-small')).toHaveCount(0);
  }
  await edit(page,{capacity:0});await page.reload();await expect(page.locator('[data-album-capacity]')).toHaveText('0 / 12 รูป');
  await page.locator('#gallery-file-picker').setInputFiles(file(1));await page.locator('[data-upload-submit]').click();await expect(page.locator('[data-upload-success]')).toBeVisible();await page.locator('[data-upload-again]').click();
  await expect(page.locator('.thumb-small')).toHaveCount(0);await expect(page.locator('[data-approved-quota]')).toHaveText('1 / 10 รูป');await expect(page.locator('[data-album-capacity]')).toHaveText('1 / 12 รูป');
  await edit(page,{capacity:12,used:0});await page.reload();await expect(page.locator('[data-upload-allowance]')).toContainText('เพิ่มได้อีก 0 รูป');
  await edit(page,{capacity:0,used:10});await page.reload();await expect(page.locator('[data-upload-submit]')).toBeDisabled();await expect(page.locator('[data-album-capacity]')).toHaveText('0 / 12 รูป');await expect(page.locator('[data-approved-quota]')).toHaveText('10 / 10 รูป');
});

test('partial IndexedDB failure retries only failed file with no duplicate quota',async({page},info)=>{
  await page.goto('/app/me/private-gallery/upload');await expect(page.locator('[data-album-capacity]')).toHaveText('10 / 12 รูป');
  await page.locator('#gallery-file-picker').setInputFiles([file(1),file(2)]);
  // Simulate one failed browser storage write, without changing production APIs.
  await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;let n=0;IDBObjectStore.prototype.put=function(...args){if(this.name==='state'&&++n===2)throw Error('จำลองเครือข่ายหรือที่เก็บข้อมูลไม่พร้อม');return put.apply(this,args);};});
  await page.locator('[data-upload-submit]').click();await expect(page.locator('#gallery-upload-status')).toContainText('ไม่สำเร็จ 1 รูป');
  await expect(page.locator('.thumb-small.saved')).toHaveCount(1);await expect(page.locator('[data-remove-upload]')).toHaveCount(1);await expect(page.locator('[data-approved-quota]')).toHaveText('1 / 10 รูป');await shot(page,info.project.name+'-partial-failure');
  await page.locator('[data-upload-submit]').click();await expect(page.locator('[data-upload-success]')).toBeVisible();await expect(page.locator('[data-approved-quota]')).toHaveText('2 / 10 รูป');await expect(page.locator('[data-album-capacity]')).toHaveText('12 / 12 รูป');
  await page.reload();await expect(page.locator('[data-approved-quota]')).toHaveText('2 / 10 รูป');
});

test('slow photo load and empty caption/comments recover without blocking navigation',async({page})=>{
  await page.goto('/app/people/demo-01/gallery');await expect(page.locator('.gallery-grid')).toBeVisible();await edit(page,{viewer:{url:'/test-slow-media.png',caption:'',count:0}});
  let release;const gate=new Promise(r=>release=r);
  await page.route('**/test-slow-media.png',async route=>{await gate;await route.fulfill({contentType:'image/png',body:Buffer.from(ONE_PIXEL_PNG)});});
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.gallery-grid .tile').first().click();await expect(page.locator('.image-load-status')).toContainText('กำลังโหลดรูป');await expect(page.locator('.post-comments .comment')).toHaveCount(0);
  release();await expect(page.locator('.image-load-status')).toBeEmpty();await page.keyboard.press('ArrowRight');await expect(page.locator('.lightbox-arrows')).toContainText('2 / 5');await page.keyboard.press('Escape');await expect(page).toHaveURL(/demo-01\/gallery$/);
});

for(const width of [390,768,1440])test(`upload and viewer visual usability ${width}`,async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','explicit viewport comparison');await page.setViewportSize({width,height:width===390?844:width===768?1024:1100});
  await page.goto('/app/me/gallery/upload');await expect(page.locator('[data-album-capacity]')).toHaveText('10 / 12 รูป');await shot(page,'upload-public-'+width);
  const action=page.locator('.action-bar'),nav=page.locator('.sidebar');
  if(width<=768){const a=await action.boundingBox(),n=await nav.boundingBox();expect(a.y+a.height).toBeLessThanOrEqual(n.y+1);expect(a.y).toBeLessThan(width===390?844:1024);}
  await page.locator('#gallery-file-picker').setInputFiles(file(1));await shot(page,'upload-preview-'+width);
  await page.locator('[data-remove-upload]').click();await page.goto('/app/me/private-gallery/upload');await expect(page.locator('#approved-gallery-upload')).toBeVisible();await shot(page,'upload-private-'+width);
  for(const [name,w,h] of [['portrait',300,900],['landscape',900,400],['square',600,600],['panorama',1800,200]]){
    const url='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#d0f17b"/><circle cx="50%" cy="50%" r="70" fill="#6d42e5"/></svg>`);
    await edit(page,{viewer:{url,caption:'ภาพสมมติสำหรับทดสอบ '+name+' '+('คำบรรยายภาษาไทยที่ยาวมาก '.repeat(12))}});await page.goto('/app/people/demo-01/gallery');await page.locator('.gallery-grid .tile').first().click();await expect(page.locator('.lightbox')).toBeVisible();
    expect(await page.locator('.lightbox-art img').evaluate(i=>getComputedStyle(i).objectFit)).toBe('contain');await page.locator('#gallery-comment input[name=comment]').fill('ทดสอบข้อความ');await expect(page.locator('#gallery-comment button')).toBeEnabled();
    const arrow=await page.locator('.lightbox-arrows').boundingBox();expect(arrow.y+arrow.height).toBeLessThanOrEqual(width===390?844:width===768?1024:1100);
    if(width<=768){const art=await page.locator('.lightbox-art').boundingBox(),side=await page.locator('.lightbox-side').boundingBox();expect(art.width).toBeGreaterThan(width-40);expect(side.y).toBeGreaterThanOrEqual(art.y+art.height-1);}
    await shot(page,'viewer-'+name+'-'+width);
    await page.keyboard.press('Escape');await expect(page).toHaveURL(/demo-01\/gallery$/);
  }
  await edit(page,{viewer:{url:'/assets/demo/missing-synthetic.png',caption:''}});await page.reload();await page.locator('.gallery-grid .tile').first().click();await expect(page.locator('.image-load-status')).toContainText('โหลดรูปไม่สำเร็จ');await shot(page,'viewer-broken-'+width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
