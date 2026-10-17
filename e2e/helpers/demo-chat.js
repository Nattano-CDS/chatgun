export async function simulateChatCounterpart(page){
  if(await page.locator('#profile-dialog').isVisible())await page.locator('#profile-dialog [data-action=chat]').first().click();
  await page.locator('#thread [data-demo-owner]').click();
}
