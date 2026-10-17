// Actual public Production UI, without API interception or authorized sessions.
// Every fictional write must remain in this disposable browser's IndexedDB.
import {chromium,expect} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='https://chatgun.social',expected=process.env.EXPECTED_SHA;
assert.ok(expected,'Set the exact EXPECTED_SHA before testing Production');
assert.equal((await fetch(origin+'/release.json').then(r=>r.json())).commit,expected);
const config=await fetch(origin+'/api/social/config').then(r=>r.json());
assert.equal(config.socialAppEnabled,false);assert.equal(config.mediaUploadEnabled,false);
const browser=await chromium.launch(),results=[],directory=process.env.PRODUCTION_CONTROLS_DIR||'docs/issue-10-components/production-controls';await mkdir(directory,{recursive:true});
for(const [width,height] of [[390,844],[768,1024],[1440,1100]]){
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),writes=[],errors=[];
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(origin);await expect(page.locator('#people-grid .photo-card')).toHaveCount(17);
 await page.locator('#people-grid [data-person="demo-02"] .card-open').click();
 await page.locator('.profile-gallery-top').click();await page.locator('.ig-tile>button').first().click();
 await page.locator('.post-like').click();await expect(page.locator('.post-like')).toHaveAttribute('aria-pressed','true');
 await page.locator('#gallery-comment input[name=comment]').fill('ความคิดเห็นสมมติสำหรับตรวจ UI เท่านั้น');await page.locator('#gallery-comment button').click();
 await expect(page.locator('.post-comments')).toContainText('ความคิดเห็นสมมติสำหรับตรวจ UI เท่านั้น');
 await page.locator('[data-gallery-return]').click();await page.locator('[data-profile-return]').click();await page.locator('.profile-back').click();
 await page.locator('#primary-nav [data-tab=profile]').click();await page.locator('#manage-gallery').click();
 await page.locator('#my-gallery [data-gallery-action=select]').first().click();await expect(page.locator('#my-gallery .cover-label')).toHaveCount(1);
 await page.locator('#gallery-settings-back').click();await page.locator('#view-own-profile').click();await expect(page.locator('.full-profile-image img')).toHaveAttribute('src',/01\.png$/);
 await page.locator('.profile-gallery-top').click();
 const bytes=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=320;const x=c.getContext('2d');x.fillStyle='#645574';x.fillRect(0,0,640,320);return c.toDataURL().split(',')[1];});
 await page.locator('#route-gallery-upload input[type=file]').setInputFiles({name:'synthetic-local-only.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});
 await page.locator('#route-gallery-upload input[name=caption]').fill('ภาพสมมติในเบราว์เซอร์เท่านั้น');await page.locator('#route-gallery-upload button').click();
 await expect(page.locator('.ig-tile')).toHaveCount(3);await expect(page.locator('[data-route-gallery-quota]')).toContainText('9/10');
 await page.locator('.ig-tile>button').first().click();await expect(page.locator('.lightbox-image img')).toHaveAttribute('src',/^data:image\//);
 await page.locator('[data-gallery-action=next]').click();await expect(page.locator('.lightbox-nav')).toContainText('2 / 3');
 await page.locator('[data-gallery-action=previous]').click();await expect(page.locator('.lightbox-nav')).toContainText('1 / 3');
 await page.locator('[data-gallery-return]').click();await page.locator('.delete-photo').first().click();await expect(page.locator('.ig-tile')).toHaveCount(2);
 await expect(page.locator('[data-route-gallery-quota]')).toContainText('9/10');
 await page.screenshot({path:`${directory}/own-gallery-${width}.png`});
 await page.locator('[data-close-profile]').click();await page.locator('#manage-gallery').click();
 await page.locator('#gallery-upload input[type=file]').setInputFiles({name:'synthetic-preview-only.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});
 await expect(page.locator('[data-upload-preview] img')).toHaveJSProperty('naturalWidth',640);
 await page.locator('[data-cancel-upload]').click();await expect(page.locator('.upload-pending')).toBeHidden();
 await expect(page.locator('#gallery-upload-quota')).toContainText('9/10');
 await page.screenshot({path:`${directory}/management-${width}.png`});
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 results.push({width,height,result:'PASS',serverWrites:0,apiInterception:false,checks:['member profile/gallery/like/private comment/back','own selection/gallery upload/next/previous/delete','deletion does not refund quota','image management CSP-compatible preview/cancel','no overflow or page errors']});
 await context.close();
}
await browser.close();assert.equal((await fetch(origin+'/release.json').then(r=>r.json())).commit,expected);
await writeFile(`${directory}/results.json`,JSON.stringify({origin,commit:expected,results,stagingMutations:0,productionDatabaseWrites:0,fixtureMutations:'disposable browser IndexedDB only'},null,2));console.log(JSON.stringify(results));
