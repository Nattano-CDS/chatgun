// Local component fixture only, not real LINE OAuth or Production owner identity.
import {test,expect} from '@playwright/test';import {readFileSync,mkdirSync} from 'node:fs';
mkdirSync('docs/production-pilot-20261020/screens',{recursive:true});
for(const width of [390,768,1440])test(`owner-only shell renders own real-record-shaped card with Discovery disabled ${width}`,async({browser})=>{
  const sessions=JSON.parse(readFileSync('/tmp/chatgun-issue16-local-sessions.json'));
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900}});
  try{
    for(const [name,value]of [['__Host-cg_session',sessions['owner'+width].token],['__Host-cg_csrf',sessions['owner'+width].csrf]])await context.addCookies([{name,value,url:'https://localhost:8797',secure:true,sameSite:'Lax'}]);
    const page=await context.newPage();const discovery=[];
    await page.route('**/api/social/config',async route=>{const r=await route.fetch();const c=await r.json();await route.fulfill({response:r,json:{...c,publicDiscoveryEnabled:false,messagingEnabled:false,mediaUploadEnabled:false,ratingsEnabled:false,onlineStatusEnabled:false,moderationToolsEnabled:false}});});
    page.on('request',r=>{if(new URL(r.url()).pathname==='/api/social/discovery')discovery.push(r);});
    await page.goto('/');await expect(page.locator('#social-view')).toBeVisible();await expect(page.locator('#people-grid .photo-card')).toHaveCount(1);
    await expect(page.locator('#people-grid .empty')).toContainText('การค้นหาสมาชิกและการเผยแพร่ตำแหน่งยังไม่เปิดใช้งาน');await expect(page.locator('#location-toggle')).toBeDisabled();
    expect(discovery.length).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`docs/production-pilot-20261020/screens/owner-shell-component-${width}.png`});
  }finally{await context.close();}
});
