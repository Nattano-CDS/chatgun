import {test,expect} from '@playwright/test';
for(const [width,height] of [[390,844],[768,1024],[1440,1100]]){
  test(`v91 measured layout, pagination, keyboard and failure recovery ${width}px`,async({page},info)=>{
    test.skip(info.project.name!=='desktop-chromium','explicit reference viewports');
    await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});
    await page.route('**/api/social/config',r=>r.fulfill({json:{socialAppEnabled:false,demoModeEnabled:true,demoAutoStartEnabled:true}}));
    const writes=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&r.method()!=='GET')writes.push(r.url());});
    await page.goto('/');await expect(page.locator('#people-grid .photo-card')).toHaveCount(17);
    const metrics=await page.locator('#people-grid').evaluate(e=>{
      const c=getComputedStyle(e),card=e.querySelector('.photo-card'),main=document.querySelector('#app>main');
      return {columns:c.gridTemplateColumns.split(' ').length,y:card.getBoundingClientRect().y,height:card.getBoundingClientRect().height,radius:getComputedStyle(card).borderRadius,padding:getComputedStyle(main).paddingLeft,background:getComputedStyle(document.body).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    expect(metrics).toEqual({columns:width===1440?4:2,y:width===390?215.5:width===768?202:210,height:width===390?290:390,radius:width===390?'17px':'22px',padding:width===390?'16px':width===768?'28px':'65px',background:'rgb(247, 247, 251)',overflow:false});
    await page.locator('[data-discovery-page="2"]').click();await expect(page.locator('#people-grid .photo-card')).toHaveCount(5);
    await page.locator('[data-discovery-page="1"]').click();
    await page.locator('#people-search').fill('ไม่มีคนชื่อนี้ในตัวอย่าง');await expect(page.locator('#people-grid .empty')).toBeVisible();
    await page.locator('#people-grid [data-clear-filters]').click();await expect(page.locator('#people-grid .photo-card')).toHaveCount(17);
    if(width<1100){await page.locator('#filter-toggle').click();await expect(page.locator('#discovery-filters')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#discovery-filters')).not.toBeVisible();await expect(page.locator('#filter-toggle')).toHaveAttribute('aria-expanded','false');}
    await page.locator('#people-grid .card-open').first().focus();await page.keyboard.press('Enter');await expect(page.locator('#profile-dialog')).toBeVisible();
    await expect(page.locator('#profile-dialog')).not.toHaveJSProperty('tagName','DIALOG');await expect(page.locator('#profile-dialog nav')).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.locator('#profile-dialog')).not.toBeVisible();await expect(page).not.toHaveURL(/\/people\//);
    await page.locator('#primary-nav [data-tab="chat"]').click();await page.locator('.conversation-list .conversation').first().click();
    await expect(page.locator('.conversation-list')).not.toBeVisible();await expect(page.locator('.composer')).toBeVisible();
    const composer=await page.locator('.composer').boundingBox(),nav=await page.locator('.sidebar').boundingBox();expect(composer.y+composer.height).toBeLessThanOrEqual(nav.y);
    await page.locator('.chat-back').click();await expect(page.locator('.conversation-list')).toBeVisible();
    expect(writes).toEqual([]);
  });
}
test('failed portrait remains labelled; persistent auth navigation excludes Game',async({page})=>{
  await page.route('**/api/social/config',r=>r.fulfill({json:{socialAppEnabled:false,demoModeEnabled:true,demoAutoStartEnabled:true}}));
  await page.route('**/assets/demo/01.png',r=>r.abort());
  await page.goto('/');await expect(page.locator('[data-image-error]').first()).toHaveAttribute('aria-label',/มะปราง/);
  await page.goto('/signup');await expect(page.locator('.auth-navigation a')).toHaveCount(4);await expect(page.locator('.auth-navigation')).not.toContainText('เกม');
});
test('fictional direct chat and block/unblock persist without server writes',async({page})=>{
  await page.route('**/api/social/config',r=>r.fulfill({json:{socialAppEnabled:false,demoModeEnabled:true,demoAutoStartEnabled:true}}));
  const writes=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&r.method()!=='GET')writes.push(r.url());});
  await page.goto('/');await page.locator('#people-grid [data-person=demo-01] .card-open').click();await page.locator('.full-profile-actions [data-action=chat]').click();
  await page.locator('.composer input[name=body]').fill('คุยกับสมาชิกใหม่โดยตรง');await page.locator('.composer button[aria-label="ส่ง"]').click();
  await expect(page.locator('#thread .message')).toContainText('คุยกับสมาชิกใหม่โดยตรง');
  await page.locator('#primary-nav [data-tab=near]').click();
  await page.locator('#people-grid [data-person="demo-02"]').click();page.once('dialog',d=>d.accept());await page.locator('.full-profile-info [data-action=block]').click();
  await page.locator('#primary-nav [data-tab=profile]').click();await expect(page.locator('#blocked-list')).toContainText('ต้นน้ำ');
  await page.locator('#blocked-list [data-action=unblock]').click();await expect(page.locator('#blocked-list')).not.toContainText('ต้นน้ำ');
  await page.reload();await page.locator('#primary-nav [data-tab=chat]').click();await page.locator('[data-chat=demo-01]').click();
  await expect(page.locator('#thread .message')).toContainText('คุยกับสมาชิกใหม่โดยตรง');expect(writes).toEqual([]);
});
