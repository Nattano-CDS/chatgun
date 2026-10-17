import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
for(const [width,height] of [[390,844],[768,1024],[1440,1100]]){
 test(`viewer self shortcut, filters, pagination, edit, primary photo and recovery ${width}`,async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','three explicit reference sizes');
  await page.setViewportSize({width,height});
  const writes=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
  await page.goto('/');
  const first=page.locator('#people-grid .photo-card').first();
  const verify=async()=>{await expect(first).toHaveAttribute('data-person','demo-me');await expect(first.locator('.self-card-badge')).toHaveText('คุณ');await expect(first.locator('.rating-line')).toHaveText('โปรไฟล์ของคุณ · ตัวอย่าง');await expect(first.locator('.card-distance,[data-action],.verify-badge')).toHaveCount(0);};
  await verify();await expect(first.locator('.portrait-fallback')).toBeVisible();
  await expect(page.locator('#people-count')).toHaveText('20');await expect(page.locator('#people-grid .photo-card')).toHaveCount(17);
  const others=new Set(await page.locator('#people-grid .photo-card').evaluateAll(es=>es.slice(1).map(e=>e.dataset.person)));
  await page.locator('[data-discovery-page="2"]').click();await verify();await expect(page.locator('#people-grid .photo-card')).toHaveCount(5);
  for(const id of await page.locator('#people-grid .photo-card').evaluateAll(es=>es.slice(1).map(e=>e.dataset.person)))others.add(id);
  expect(others.size).toBe(20);
  await page.locator('#people-search').fill('ไม่มีชื่อในผลลัพธ์');await verify();await expect(page.locator('#people-count')).toHaveText('0');await expect(page.locator('#people-grid .photo-card')).toHaveCount(1);
  await page.locator('#people-grid [data-clear-filters]').click();
  await first.locator('.card-open').focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/people\/demo-me$/);
  await expect(page.locator('.full-profile-actions [data-action],.people-management')).toHaveCount(0);
  await page.locator('.profile-gallery-top').click();await page.locator('.ig-tile>button').first().click();await expect(page.locator('.post-layout')).toBeVisible();
  await page.goBack();await expect(page.locator('.gallery-summary')).toBeVisible();await page.locator('[data-profile-return]').click();await page.locator('.profile-back').click();
  await page.locator('#primary-nav [data-tab=profile]').click();
  await page.locator('#profile-form [name=name]').fill('ผู้ทดลองสมมติ');await page.locator('#profile-form [name=bio]').fill('กาแฟ หนังสือ และเพลงไทย');await page.locator('#profile-form button[type=submit]').click();await expect(page.locator('#toast')).toContainText('บันทึกโปรไฟล์แล้ว');
  await page.locator('#manage-gallery').click();await page.locator('#my-gallery [data-gallery-action=select]').nth(1).click();await expect(page.locator('#toast')).toContainText('ตั้งรูปหลักแล้ว');
  await page.locator('#gallery-settings-back').click();await page.locator('#primary-nav [data-tab=near]').click();await verify();
  await expect(first.locator('.person-name')).toHaveText('ผู้ทดลองสมมติ');await expect(first.locator('.person-bio')).toHaveText('กาแฟ หนังสือ และเพลงไทย');await expect(first.locator('img')).toHaveAttribute('src',/02\.png$/);
  await page.reload();await verify();await expect(first.locator('img')).toHaveAttribute('src',/02\.png$/);
  const dir=process.env.SELF_EVIDENCE_DIR||'test-results/own-first';mkdirSync(dir,{recursive:true});await page.screenshot({path:`${dir}/self-first-${width}.png`,fullPage:false});
  expect(writes).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
