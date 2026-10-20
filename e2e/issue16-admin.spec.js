// Local TestD1 + actual handlers, not Production role or media evidence.
import{test,expect}from'@playwright/test';import{readFileSync,mkdirSync}from'node:fs';
mkdirSync('docs/production-pilot-20261020/screens',{recursive:true});
for(const width of[390,768,1440])test('Admin overview, purpose boundary and ordinary-member denial '+width,async({browser})=>{
 const sessions=JSON.parse(readFileSync('/tmp/chatgun-issue16-local-sessions.json'));
 for(const kind of['owner','viewer']){const s=sessions[kind+width],context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900}});try{
  for(const[name,value]of[['__Host-cg_session',s.token],['__Host-cg_csrf',s.csrf]])await context.addCookies([{name,value,url:'https://localhost:8797',secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();let prompts=0;page.on('dialog',async d=>{prompts++;await d.accept('Review local-only synthetic queue for security validation');});
  await page.goto('/app/moderation.html');
  if(kind==='owner'){
   await expect(page.locator('#moderation-status')).toHaveText('โหลดข้อมูลเรียบร้อยแล้ว');expect(prompts).toBe(0);
   await expect(page.locator('#moderation-stats')).toContainText('สมาชิกจริง');await expect(page.locator('#moderation-daily')).toContainText('19:00–22:00');
   await page.getByRole('button',{name:'รายงานผู้ใช้',exact:true}).click();await expect(page.locator('#moderation-results')).toContainText('ไม่มีรายงานผู้ใช้');expect(prompts).toBe(1);
   await page.getByRole('button',{name:'สิทธิ์ Beta',exact:true}).click();await expect(page.locator('#moderation-results')).toContainText('ไม่มีรายการสิทธิ์ Beta');
   await page.screenshot({path:`docs/production-pilot-20261020/screens/admin-local-${width}.png`});
  }else{await expect(page.locator('#moderation-status')).toContainText('ไม่มีสิทธิ์');await expect(page.locator('#moderation-stats')).not.toContainText('สมาชิกจริง');}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context.close();}}
});
