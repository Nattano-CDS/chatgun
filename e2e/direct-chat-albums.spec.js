import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

for(const width of [390,768,1440])test(`direct DM and two-sided fictional album consent at ${width}px`,async({page},info)=>{
  test.setTimeout(90000);
  await page.setViewportSize({width,height:width===390?844:1024});
  const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
  const dir=resolve(process.env.ISSUE13_EVIDENCE_DIR||'test-results/issue13-screens');mkdirSync(dir,{recursive:true});
  const shot=async name=>{await page.screenshot({path:resolve(dir,`${info.project.name}-${width}-${name}.png`),fullPage:false});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);};
  await page.goto('/?demo=1');await expect(page.locator('#people-grid .person-card')).toHaveCount(17);
  await expect(page.locator('#people-grid .person-card').first()).toHaveAttribute('data-person','demo-me');
  await expect(page.locator('#primary-nav [data-tab]')).toHaveCount(4);
  await expect(page.locator('[data-tab=friends],[data-action=request],[data-action=accept],[data-action=unfriend]')).toHaveCount(0);
  await shot('discovery');
  await page.locator('[data-person=demo-01] [data-action=chat]').click();
  await expect(page.locator('#thread .composer')).toBeVisible();
  await page.locator('.composer input[name=body]').fill('สวัสดี ตัวอย่างแชทโดยตรง');await page.locator('.composer button[aria-label="ส่ง"]').click();
  await expect(page.locator('#thread .message')).toContainText('สวัสดี ตัวอย่างแชทโดยตรง');
  await expect(page.locator('[data-chat=demo-01]')).toHaveCount(1);await shot('direct-chat');
  await page.locator('#primary-nav [data-tab=near]').click();
  await page.locator('[data-person=demo-01] .card-open').click();
  await expect(page.locator('.private-album')).toContainText('ล็อก');
  await page.locator('[data-album-action=request]').click();await expect(page.locator('.private-album')).toContainText('ส่งคำขอแล้ว');await shot('pending');
  await page.locator('[data-demo-owner]').click();
  await expect(page.locator('#demo-actor')).toHaveValue('demo-01');
  await expect(page.locator('[data-album-action=approve]')).toBeVisible();await shot('owner-request');
  await page.locator('[data-album-action=approve]').click();await expect(page.locator('#thread .album-system-card').filter({hasText:'อนุมัติสิทธิ์อัลบั้มส่วนตัวแล้ว'})).toBeVisible();
  await page.locator('#demo-actor').selectOption('demo-me');await page.locator('[data-chat=demo-01]').click();
  await expect(page.locator('#thread .album-system-card')).toHaveCount(2);await shot('viewer-approved');
  await page.locator('#primary-nav [data-tab=near]').click();await page.locator('[data-person=demo-01] .card-open').click();
  await expect(page.locator('.private-album')).toContainText('ได้รับสิทธิ์');await page.locator('.profile-gallery-top').click();
  await expect(page.locator('.ig-tile')).toHaveCount(2);await shot('granted-gallery');
  await page.locator('[data-demo-owner]').click();await page.locator('[data-album-action=revoke]').click();
  await page.locator('#demo-actor').selectOption('demo-me');await page.locator('[data-chat=demo-01]').click();
  await expect(page.locator('#thread')).toContainText('เพิกถอนสิทธิ์');
  await page.locator('#primary-nav [data-tab=near]').click();await page.locator('[data-person=demo-01] .card-open').click();await page.locator('.profile-gallery-top').click();
  await expect(page.locator('.ig-tile')).toHaveCount(1);await shot('revoked-gallery');
  await page.locator('[data-close-profile]').click();await page.reload();
  await page.locator('#primary-nav [data-tab=chat]').click();await page.locator('[data-chat=demo-01]').click();
  await expect(page.locator('#thread .message')).toContainText('สวัสดี ตัวอย่างแชทโดยตรง');await expect(page.locator('.album-system-card')).toHaveCount(3);
  // A different pair exercises explicit rejection, without shortening real cooldowns.
  await page.locator('#primary-nav [data-tab=near]').click();await page.locator('[data-person=demo-02] .card-open').click();await page.locator('[data-album-action=request]').click();await page.locator('[data-demo-owner]').click();await page.locator('[data-album-action=reject]').click();
  await page.locator('#demo-actor').selectOption('demo-me');await page.locator('[data-chat=demo-02]').click();await expect(page.locator('#thread')).toContainText('ปฏิเสธคำขออัลบั้มส่วนตัว');await shot('rejected');
  expect(errors).toEqual([]);expect(writes).toEqual([]);
});

test('legacy fictional inbox upgrade preserves read states, 120 messages and all 20 members',async({page})=>{
  await page.goto('/?demo=1');await expect(page.locator('#people-count')).toHaveText('20');
  await page.locator('#primary-nav [data-tab=chat]').click();await page.locator('.conversation').first().click();await expect(page.locator('#thread .message')).toHaveCount(12);
  await expect(page.locator('.conversation.active .inbox-unread')).toHaveCount(0);
  await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('chatgun-demo',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),r=store.get('chatgun-browser-demo-v1');r.onsuccess=()=>{const s=r.result;delete s.modelVersion;delete s.albumRequests;delete s.systemEvents;s.relationships.forEach(p=>p.unread_count=0);Object.values(s.messages).flat().forEach(m=>delete m.read_at);store.put(s,'chatgun-browser-demo-v1');};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
  });
  await page.reload();await expect(page.locator('#message-badge')).toBeHidden();await expect(page.locator('#people-count')).toHaveText('20');
  await page.locator('#primary-nav [data-tab=chat]').click();await expect(page.locator('.conversation')).toHaveCount(10);
  await page.locator('.conversation').first().click();await expect(page.locator('#thread .message')).toHaveCount(12);
});

test('fictional owner media decisions persist and private portraits never become public covers',async({page})=>{
  await page.goto('/?demo=1');await page.locator('#primary-nav [data-tab=chat]').click();await page.locator('#demo-actor').selectOption('demo-01');
  await page.locator('#primary-nav [data-tab=near]').click();await page.locator('[data-person=demo-01] .card-open').click();await page.locator('.profile-gallery-top').click();
  await page.locator('[data-photo-visibility=private][data-photo=demo-portrait-01]').click();
  await expect(page.locator('section[aria-label="รูปอัลบั้มส่วนตัว"] .ig-tile')).toHaveCount(2);
  await page.locator('[data-close-profile]').click();await page.locator('#primary-nav [data-tab=chat]').click();await page.locator('#demo-actor').selectOption('demo-me');await page.locator('#primary-nav [data-tab=near]').click();
  await expect(page.locator('[data-person=demo-01] .card-photo img')).toHaveCount(0);
  await page.reload();await expect(page.locator('[data-person=demo-01] .card-photo img')).toHaveCount(0);
  await page.locator('#primary-nav [data-tab=chat]').click();await page.locator('#demo-actor').selectOption('demo-01');await page.locator('#primary-nav [data-tab=near]').click();await page.locator('[data-person=demo-01] .card-open').click();await page.locator('.profile-gallery-top').click();
  page.once('dialog',d=>d.accept());await page.locator('[data-gallery-action=delete][data-photo=demo-private-01]').click();await expect(page.locator('[data-gallery-action=view][data-photo=demo-private-01]')).toHaveCount(0);
  await page.reload();await expect(page.locator('[data-gallery-action=view][data-photo=demo-private-01]')).toHaveCount(0);
});
