import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
// LOCAL COMPONENT TEST ONLY. No provider identity or genuine CAPTCHA success.
for(const width of [390,768,1440])test(`private admission transport and provider filtering, localhost ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const invitation='A'.repeat(43);let captured;
  await page.route('**/api/auth/config',route=>route.fulfill({json:{oauthLoginEnabled:true,oauthProviders:['google'],turnstileSiteKey:'localhost-component-key',newAccountRegistrationEnabled:false,invitationOnlyRegistrationEnabled:true}}));
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',route=>route.fulfill({contentType:'text/javascript',body:"window.turnstile={render:()=>1,getResponse:()=> 'localhost-component-token',reset:()=>{}};"}));
  await page.route('**/api/auth/oauth/google/start',async route=>{captured=route.request().postDataJSON();await route.fulfill({status:503,json:{message:'การทดสอบส่วนติดต่อเท่านั้น — ไม่ได้ยืนยันตัวตน'}});});
  await page.goto('/signup#invite='+invitation);
  await expect(page.getByRole('heading',{name:'เข้าร่วมการทดสอบ ChatGun'})).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);await expect(page.locator('[data-provider=facebook]')).toBeHidden();await expect(page.locator('[data-provider=line]')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>Boolean(window.turnstile))).toBe(true);
  await page.locator('[data-provider=google]').click();await expect(page.locator('#message')).toContainText('ไม่ได้ยืนยันตัวตน');
  expect(captured.invitationCode).toBe(invitation);expect(captured.turnstileToken).toBe('localhost-component-token');
  expect(await page.evaluate(()=>location.href.includes('A'.repeat(43)))).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  mkdirSync('docs/beta-activation/screens',{recursive:true});await page.screenshot({path:`docs/beta-activation/screens/admission-component-${width}.png`});
});
