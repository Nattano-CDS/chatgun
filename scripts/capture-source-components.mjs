import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const target=process.env.AUDIT_URL||'https://chatgun.social';
const original=process.env.AUDIT_KIND==='near';
const modern=process.env.AUDIT_MODERN==='true';
const release=original?null:await fetch(target+'/release.json').then(r=>r.json());
if(process.env.EXPECTED_SHA&&release?.commit!==process.env.EXPECTED_SHA)throw Error('Unexpected capture deployment SHA');
const output=resolve(process.env.AUDIT_OUTPUT||'docs/issue-10/before');
await mkdir(output,{recursive:true});
const browser=await chromium.launch();
const failures=[],measurements=[];
const fixture=JSON.parse(await readFile('assets/demo/network.json','utf8'));
for(const [width,height] of [[390,844],[768,1024],[1440,1100]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  const page=await context.newPage();
  if(original){
    await page.addInitScript(()=>sessionStorage.setItem('near-mode','demo'));
    await page.route('**/assets/demo/*.png',async route=>route.fulfill({contentType:'image/png',body:await readFile(resolve('assets/demo',new URL(route.request().url()).pathname.split('/').at(-1)))}));
  }
  const shot=async name=>{
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.evaluate(async()=>{await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,5000))]);await Promise.race([Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0;}).map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,5000))]);});
    await page.waitForTimeout(200);
    await page.screenshot({path:resolve(output,`${name}-${width}.png`),fullPage:false});
    const selector={'member-card':original?'.photo-card':'#people-grid [data-person="demo-01"]',discovery:original||modern?'.photo-card':'.person-card',friends:'.request-card .photo-card','member-profile':original||modern?'.full-profile-info':'.member-profile-info','member-gallery':'.gallery-summary','gallery-post':'.post-layout','own-profile':original||modern?'.full-profile-info':'.member-profile-info','own-gallery':'.gallery-summary',profile:'.profile-form'}[name];
    if(selector){const element=page.locator(selector).first();if(await element.isVisible()){
      measurements.push({width,name,dom:await element.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),image=e.querySelector('img'),imageStyle=image&&getComputedStyle(image);return{tag:e.tagName,classes:e.className,width:r.width,height:r.height,x:r.x,y:r.y,font:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,padding:s.padding,borderRadius:s.borderRadius,image:image?{objectFit:imageStyle.objectFit,objectPosition:imageStyle.objectPosition,width:image.getBoundingClientRect().width,height:image.getBoundingClientRect().height}:null,children:[...e.children].map(c=>({tag:c.tagName,classes:c.className}))}})});
      await element.screenshot({path:resolve(output,`crop-${name}-${width}.png`)});
    }}

  };
  const attempt=async(name,fn)=>{try{await fn();await shot(name);}catch(e){failures.push({width,name,error:e.message.slice(0,200)});}};
  const nav=async tab=>{
    if(original)await page.locator('.route-footer').getByRole('button',{name:{near:'หาเพื่อน',friends:'เพื่อน',chat:'แชท',reviews:'ความคิดเห็น',profile:'โปรไฟล์'}[tab],exact:true}).click();
    else await page.locator(`#primary-nav [data-tab="${tab}"]`).click();
    if(original&&tab==='profile'){
      // NEAR's form has independent default React state (Nat) even when its
      // demo store contains our fixture. Match editable text in-browser only.
      await page.locator('.profile-form input[maxlength="50"]').fill('คุณ');
      await page.locator('.profile-form select').selectOption({label:'ไม่ระบุ'});
      await page.locator('.profile-form textarea').fill('กำลังทดลอง ChatGun');
      await page.locator('.profile-form input[maxlength="100"]').fill('กาแฟ, เพื่อนใหม่');
    }
  };
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
      const messages=fixture.conversations.flatMap((c,ci)=>c.messages.map((body,i)=>({id:`message-${c.with}-${i}`,sender:i%2?'demo-me':`demo-${c.with}`,receiver:i%2?`demo-${c.with}`:'demo-me',body,created:now-(12-i)*120000,read_at:i%2===0&&ci<3&&i/2<ci+1?null:now})));
      const galleryPhotos=people.map(p=>({id:`demo-portrait-${p.slug}`,owner:p.id,caption:`ภาพตัวละครสมมติ ${p.name}`,url:p.photoUrl,likeCount:3,likedByMe:false,comments:[{id:`comment-${p.id}`,name:'เพื่อนตัวอย่าง',body:'รูปนี้ดูสดใสดีมาก'}]}));
      galleryPhotos.push(...people.slice(0,2).map(p=>({id:`own-${p.id}`,owner:'demo-me',caption:'แกลเลอรีตัวอย่าง — ตัวละครสมมติ',url:p.photoUrl,likeCount:4,comments:[]})));
      const value={me,people,relations,messages,galleryPhotos,ownRatings:people.slice(0,15).map((p,i)=>({name:p.name,score:4+i%2,comment:['คุยเป็นกันเองและสุภาพ','ชอบแลกเปลี่ยนเรื่องคาเฟ่กับหนังสือ','เป็นเพื่อนที่รับฟังและให้เกียรติกัน'][i%3],created:now-i*3600000})),blockedUsers:[],chatImages:[{id:'fixture-chat-01',url:'/assets/demo/01.png',created:now}],reports:[]};
      await new Promise((resolve,reject)=>{const request=indexedDB.open('near-demo',1);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('state','readwrite');tx.objectStore('state').put(value,'demo');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
    },fixture);
    await page.reload();await page.locator('.photo-card').first().waitFor();
  }else{
    await page.evaluate(async()=>{await new Promise((resolve,reject)=>{const request=indexedDB.open('chatgun-demo',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('state','readwrite');tx.objectStore('state').put({assets:[{id:'fixture-chat-01',url:'/assets/demo/01.png',created_at:Math.floor(Date.now()/1000)}]},'chatgun-browser-demo-v1');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});});
    await page.reload();await page.locator('#people-grid .person-card').first().waitFor();
  }
  await shot('discovery');await shot('member-card');
  const search=page.locator(original?'.toolbar-search input':'#people-search');
  await attempt('search-empty',async()=>{await search.fill('ไม่พบข้อมูลตัวอย่างนี้');});
  await search.fill('');
  await attempt('filters',async()=>{const trigger=page.locator(original?'.filter-trigger':'#filter-toggle');if(await trigger.isVisible())await trigger.click();});
  await page.keyboard.press('Escape');
  if(!original)await page.locator('#filter-toggle').evaluate(e=>{if(e.getAttribute('aria-expanded')==='true')e.click();});
  for(const tab of ['friends','chat','reviews','profile'])await attempt(tab==='chat'?'inbox':tab,()=>nav(tab));
  await nav('chat');
  await attempt('chat',()=>page.locator(original?'.inbox-row':'.conversation-list .conversation').first().click());
  if(await page.locator('.picker-toggle').count()){
    await attempt('image-picker',()=>page.locator('.picker-toggle').click());
    await page.locator(original?'button[aria-label="ปิดตัวเลือกรูป"]':'[data-picker-close]').click();
  }else{await shot('image-picker');failures.push({width,name:'image-picker',missing:true,note:'Baseline lacks canonical inline image picker'});}
  await attempt('chat-gallery-empty',()=>page.locator(original?'.thread-gallery':'.asset-library').click());
  await page.locator(original?'.chat-gallery-heading button':'#asset-dialog .dialog-close').click();
  await nav('near');
  await attempt('member-profile',()=>page.locator(original?'.card-open':'#people-grid [data-person="demo-01"] .card-open').first().click());
  await attempt('member-gallery',()=>page.locator(original||modern?'.profile-gallery-top':'.member-profile-gallery-top').click());
  await attempt('gallery-post',()=>page.locator(original?'.ig-tile>button':'#dialog-gallery button').first().click());
  await attempt('own-profile',async()=>{await page.goto(target);await nav('profile');await page.getByRole('button',{name:original?'ดูโปรไฟล์และ Gallery':'ดูโปรไฟล์และแกลเลอรี',exact:true}).click();});
  await attempt('own-gallery',()=>page.locator(original||modern?'.profile-gallery-top':'.member-profile-gallery-top').click());
  await page.goto(target);await nav('near');await page.locator(original?'.photo-card':'#people-grid .person-card').first().waitFor();
  await page.evaluate(async original=>{
    const name=original?'near-demo':'chatgun-demo',key=original?'demo':'chatgun-browser-demo-v1';
    await new Promise((resolve,reject)=>{const request=indexedDB.open(name,1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),get=store.get(key);get.onsuccess=()=>{const value=get.result||{};if(original){value.relations=[];value.ownRatings=[];value.messages=[];value.galleryPhotos=[];}else{value.relationships=[];value.ratings=[];value.messages={};value.gallery=[];}store.put(value,key);};tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
  },original);
  await page.reload();await page.locator(original?'.photo-card':'#people-grid .person-card').first().waitFor();
  for(const [tab,name] of [['friends','friends-empty'],['chat','inbox-empty'],['reviews','reviews-empty'],['profile','own-gallery-empty']])await attempt(name,async()=>{await nav(tab);if(tab==='profile')await page.goto(target+(original?'/photos':'/app/photos'));});
  await nav('near');await context.setOffline(true);try{await shot('offline');}finally{await context.setOffline(false);}
  for(const [name,path] of [['upload-photos',original?'/photos':'/app/photos'],['login',original?'/login':'/signup'],['register',original?'/register':'/acceptance'],['account','/account'],['admin-denied','/app/moderation.html']]){
    if(original&&['account','admin-denied'].includes(name))continue;
    await attempt(name,async()=>{
      const acceptance=!original&&name==='register'?page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/acceptance'&&r.request().method()==='GET'):null;
      await page.goto(target+path);
      if(!original&&(name==='account'||(acceptance&&(await acceptance).status()===401)))await page.waitForURL(/\/signup(?:\.html)?(?:\?|$)/,{timeout:10000});
    });
  }
  await context.close();
}
if(!original&&(await fetch(target+'/release.json').then(r=>r.json())).commit!==release.commit)throw Error('Deployment changed during capture; recapture required');
await writeFile(resolve(output,'measurements.json'),JSON.stringify(measurements,null,2));
await writeFile(resolve(output,'capture.json'),JSON.stringify({target,commit:release?.commit,kind:original?'canonical-source-render':'live-site',referenceCommit:original?'98bb83e44bf88eddb9822d7875f18cd4fe833ee2':undefined,fixture:'chatgun-browser-demo-v1; browser-only adapter and empty-state variations',viewports:[[390,844],[768,1024],[1440,1100]],failures},null,2));
await browser.close();
console.log(JSON.stringify({output,failures}));
