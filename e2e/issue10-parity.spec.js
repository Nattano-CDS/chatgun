import {test,expect} from '@playwright/test';
for(const [width,height] of [[390,844],[768,1024],[1440,1100]]){
  test(`v91 measured layout, pagination, keyboard and failure recovery ${width}px`,async({page},info)=>{
    test.skip(info.project.name!=='desktop-chromium','explicit reference viewports');
    await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});
    await page.route('**/api/social/config',r=>r.fulfill({json:{socialAppEnabled:false,demoModeEnabled:true,demoAutoStartEnabled:true}}));
    const writes=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&r.method()!=='GET')writes.push(r.url());});
    await page.goto('/');await expect(page.locator('#people-grid .photo-card')).toHaveCount(16);
    const metrics=await page.locator('#people-grid').evaluate(e=>{
      const c=getComputedStyle(e),card=e.querySelector('.photo-card'),main=document.querySelector('#app>main');
      return {columns:c.gridTemplateColumns.split(' ').length,height:card.getBoundingClientRect().height,radius:getComputedStyle(card).borderRadius,padding:getComputedStyle(main).paddingLeft,background:getComputedStyle(document.body).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    expect(metrics).toEqual({columns:width===1440?4:2,height:width===390?290:390,radius:width===390?'17px':'22px',padding:width===390?'16px':width===768?'28px':'65px',background:'rgb(247, 247, 251)',overflow:false});
    await page.locator('[data-discovery-page="2"]').click();await expect(page.locator('#people-grid .photo-card')).toHaveCount(4);
    await page.locator('[data-discovery-page="1"]').click();
    await page.locator('#people-search').fill('ไม่มีคนชื่อนี้ในตัวอย่าง');await expect(page.locator('#people-grid .empty')).toBeVisible();
    await page.locator('#people-grid [data-clear-filters]').click();await expect(page.locator('#people-grid .photo-card')).toHaveCount(16);
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
  await page.goto('/signup');await expect(page.locator('.auth-navigation a')).toHaveCount(5);await expect(page.locator('.auth-navigation')).not.toContainText('เกม');
});
test('fictional friendship accept/reject/request/block/unblock persists without server writes',async({page})=>{
  await page.route('**/api/social/config',r=>r.fulfill({json:{socialAppEnabled:false,demoModeEnabled:true,demoAutoStartEnabled:true}}));
  const writes=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&r.method()!=='GET')writes.push(r.url());});
  await page.goto('/');await page.locator('#primary-nav [data-tab=friends]').click();
  await page.locator('#requests-grid [data-action=accept]').first().click();await expect(page.locator('#friends-grid .person-card')).toHaveCount(11);
  await page.locator('#requests-grid [data-action=reject]').first().click();await expect(page.locator('#requests-grid .person-card')).toHaveCount(3);
  await page.locator('#primary-nav [data-tab=near]').click();
  await page.locator('#people-grid [data-person="demo-01"] .card-open').click();await page.locator('.full-profile-actions [data-action=request]').click();await page.locator('#people-grid [data-person="demo-01"] .card-open').click();await expect(page.locator('.full-profile-actions [data-action=request]')).toBeDisabled();await page.keyboard.press('Escape');
  await page.locator('#people-grid [data-person="demo-02"]').click();page.once('dialog',d=>d.accept());await page.locator('.full-profile-info [data-action=block]').click();
  await page.locator('#primary-nav [data-tab=profile]').click();await expect(page.locator('#blocked-list')).toContainText('ต้นน้ำ');
  await page.locator('#blocked-list [data-action=unblock]').click();await expect(page.locator('#blocked-list')).not.toContainText('ต้นน้ำ');
  await page.reload();await page.locator('#primary-nav [data-tab=friends]').click();
  await expect(page.locator('#requests-grid .person-card')).toHaveCount(4);expect(writes).toEqual([]);
});
