// Read-only HTTP plus disposable browser-local demo tests. No remote data writes.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const origin='https://chatgun.social',directory='docs/incident-15';
mkdirSync(directory+'/screens/production',{recursive:true});
const http=[];
for(const path of ['/','/app/','/app/people/demo-01/gallery','/release.json','/app/social.js','/app/demo-bootstrap.js','/app/demo-gallery.js','/assets/demo/canary-runtime.json','/api/social/config','/api/auth/config']){
  const r=await fetch(origin+path,{cache:'no-store'});
  http.push({path,status:r.status,type:r.headers.get('content-type')});
  if(!path.startsWith('/api/'))assert.equal(r.status,200,path);
}
const browser=await chromium.launch(),checks=[];
try{
  for(const width of [390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});
    const page=await context.newPage(),errors=[],writes=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
    const ready=async()=>{await page.locator('#people-count').filter({hasText:'20'}).waitFor();assert.equal(await page.locator('#people-grid .photo-card').first().getAttribute('data-person'),'demo-me');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);};
    await page.goto(origin);await ready();
    await page.locator('#people-grid img').evaluateAll(images=>Promise.all(images.filter(image=>image.getBoundingClientRect().top<innerHeight).map(image=>image.decode().catch(()=>{}))));
    await page.screenshot({path:`${directory}/screens/production/discovery-${width}.png`});
    const fingerprint=async()=>createHash('sha256').update(await page.evaluate(async()=>{
      const db=await new Promise(resolve=>{const r=indexedDB.open('chatgun-demo',1);r.onsuccess=()=>resolve(r.result);});
      const s=await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('chatgun-browser-demo-v1');r.onsuccess=()=>resolve(r.result);});db.close();
      return JSON.stringify({profile:s.profile,messages:s.messages,gallery:s.gallery,assets:s.assets,preferences:s.chatPreferences});
    })).digest('hex');
    const before=await fingerprint();await page.reload();await ready();assert.equal(await fingerprint(),before);
    await page.goto(origin+'/app/people/demo-01/gallery');await page.locator('.gallery-grid .tile').first().waitFor();await page.locator('.gallery-grid .tile').first().click();await page.locator('.lightbox-shell').waitFor();
    await page.screenshot({path:`${directory}/screens/production/gallery-${width}.png`});
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
    checks.push({width,freshAccess:'PASS',returningAccess:'PASS',savedDataFingerprintUnchanged:true,gallery:'PASS',pageErrors:0,remoteWrites:0});
    await context.close();
  }
}finally{await browser.close();}
const release=await(await fetch(origin+'/release.json',{cache:'no-store'})).json();
const result={checkedAt:new Date().toISOString(),origin,release,http,checks,limitations:'Browser data assertions cover disposable synthetic contexts, not an export of owner private storage. Functions API availability is reported separately.'};
writeFileSync(directory+'/live-access.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
