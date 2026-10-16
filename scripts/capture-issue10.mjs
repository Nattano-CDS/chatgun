import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const target=process.env.AUDIT_URL||'https://chatgun.social';
const original=process.env.AUDIT_KIND==='near';
const output=resolve(process.env.AUDIT_OUTPUT||'docs/issue-10/before');
await mkdir(output,{recursive:true});
const browser=await chromium.launch();
const failures=[];
const fixture=JSON.parse(await readFile('assets/demo/network.json','utf8'));
for(const [width,height] of [[390,844],[768,1024],[1440,1100]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  const page=await context.newPage();
  if(original){
    await page.addInitScript(()=>sessionStorage.setItem('near-mode','demo'));
    await page.route('**/assets/demo/*.png',async route=>route.fulfill({contentType:'image/png',body:await readFile(resolve('assets/demo',new URL(route.request().url()).pathname.split('/').at(-1)))}));
  }
  const shot=async name=>{
    await page.evaluate(async()=>{await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,5000))]);await Promise.race([Promise.all([...document.images].filter(i=>i.getBoundingClientRect().top<innerHeight).map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,5000))]);});
    await page.waitForTimeout(200);
    await page.screenshot({path:resolve(output,`${name}-${width}.png`),fullPage:false});
  };
  const attempt=async(name,fn)=>{try{await fn();await shot(name);}catch(e){failures.push({width,name,error:e.message.slice(0,200)});}};
  const nav=async tab=>{if(original)await page.locator('.route-footer').getByRole('button',{name:{near:'หาเพื่อน',friends:'เพื่อน',chat:'แชท',reviews:'ความคิดเห็น',profile:'โปรไฟล์'}[tab],exact:true}).click();else await page.locator(`#primary-nav [data-tab="${tab}"]`).click();};
  await page.goto(target,{timeout:90000});
  await page.locator(original?'.photo-card':'#people-grid .person-card').first().waitFor();
  if(original){
    // Same approved PUBLIC fictional fixture, browser-only IndexedDB adapter.
    // No original source, staging records or provider identities are modified.
    await page.evaluate(async fixture=>{
      const now=Date.now();
      const people=fixture.profiles.map((p,i)=>({...p,id:`demo-${p.slug}`,photoUrl:`/assets/demo/${p.slug}.png`,distance:250*(i+1),score:4+(i%10)/10,count:i+2,verified:0}));
      const me={id:'demo-me',name:'คุณ',gender:'ไม่ระบุ',bio:'กำลังทดลอง ChatGun',interests:'กาแฟ, เพื่อนใหม่',visible:1,locationFresh:true};
      const relations=fixture.conversations.map((c,i)=>({id:`fixture-${i}`,sender:'demo-me',receiver:`demo-${c.with}`,status:'accepted'}));
      relations.push(...people.slice(11,16).map(p=>({id:`request-${p.id}`,sender:p.id,receiver:'demo-me',status:'pending'})));
      const messages=fixture.conversations.flatMap(c=>c.messages.map((body,i)=>({id:`message-${c.with}-${i}`,sender:i%2?'demo-me':`demo-${c.with}`,receiver:i%2?`demo-${c.with}`:'demo-me',body,created:now-(12-i)*120000})));
      const galleryPhotos=people.map(p=>({id:`demo-portrait-${p.slug}`,owner:p.id,caption:`ภาพตัวละครสมมติ ${p.name}`,url:p.photoUrl,likeCount:3,likedByMe:false,comments:[{id:`comment-${p.id}`,name:'เพื่อนตัวอย่าง',body:'รูปนี้ดูสดใสดีมาก'}]}));
      galleryPhotos.push(...people.slice(0,2).map(p=>({id:`own-${p.id}`,owner:'demo-me',caption:'แกลเลอรีตัวอย่าง — ตัวละครสมมติ',url:p.photoUrl,likeCount:4,comments:[]})));
      const value={me,people,relations,messages,galleryPhotos,ownRatings:people.slice(0,15).map((p,i)=>({name:p.name,score:4+i%2,comment:['คุยเป็นกันเองและสุภาพ','ชอบแลกเปลี่ยนเรื่องคาเฟ่กับหนังสือ','เป็นเพื่อนที่รับฟังและให้เกียรติกัน'][i%3],created:now-i*3600000})),blockedUsers:[],chatImages:[],reports:[]};
      await new Promise((resolve,reject)=>{const request=indexedDB.open('near-demo',1);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('state','readwrite');tx.objectStore('state').put(value,'demo');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
    },fixture);
    await page.reload();await page.locator('.photo-card').first().waitFor();
  }
  await shot('discovery');
  const search=page.locator(original?'.toolbar-search input':'#people-search');
  await attempt('search-empty',async()=>{await search.fill('ไม่พบข้อมูลตัวอย่างนี้');});
  await search.fill('');
  await attempt('filters',async()=>{const trigger=page.locator(original?'.filter-trigger':'#filter-toggle');if(await trigger.isVisible())await trigger.click();});
  await page.keyboard.press('Escape');
  if(!original)await page.locator('#filter-toggle').evaluate(e=>{if(e.getAttribute('aria-expanded')==='true')e.click();});
  for(const tab of ['friends','chat','reviews','profile'])await attempt(tab==='chat'?'inbox':tab,()=>nav(tab));
  await nav('chat');
  await attempt('chat',()=>page.locator(original?'.inbox-row':'.conversation-list .conversation').first().click());
  await nav('near');
  await attempt('member-profile',()=>page.locator(original?'.card-open':'#people-grid [data-person]').first().click());
  await attempt('member-gallery',()=>page.locator(original?'.profile-gallery-top':'.member-profile-gallery-top').click());
  await attempt('gallery-post',()=>page.locator(original?'.ig-tile>button':'#dialog-gallery button').first().click());
  for(const [name,path] of [['login',original?'/login':'/signup'],['register',original?'/register':'/acceptance'],['account','/account'],['admin-denied','/app/moderation.html']]){
    if(original&&['account','admin-denied'].includes(name))continue;
    await attempt(name,()=>page.goto(target+path));
  }
  await context.close();
}
await writeFile(resolve(output,'capture.json'),JSON.stringify({target,kind:original?'canonical-source-render':'live-site',viewports:[[390,844],[768,1024],[1440,1100]],failures},null,2));
await browser.close();
console.log(JSON.stringify({output,failures}));
