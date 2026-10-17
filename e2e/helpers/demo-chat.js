export async function simulateChatCounterpart(page){
  if(await page.locator('#profile-dialog').isVisible()){
    if(!await page.locator('#profile-dialog [data-action=chat]').count())await page.locator('[data-profile-return]').first().click();
    await page.locator('#profile-dialog [data-action=chat]').first().click();
  }
  await page.locator('#thread [data-demo-owner]').click();
}
