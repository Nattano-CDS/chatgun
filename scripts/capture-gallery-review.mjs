// Public fictional UI only. Opens/closes its own headless context, never user tabs.
import {chromium,devices} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const origin=process.env.GALLERY_ORIGIN||'https://chatgun.social';
const stage=process.env.GALLERY_CAPTURE_STAGE||'before';
if(!['before','after'].includes(stage))throw Error('Invalid evidence stage');
const evidence=process.env.RELEASE_EVIDENCE_DIR||'docs/gallery-approved';
const directory=resolve(evidence+'/screens/'+stage);mkdirSync(directory,{recursive:true});
const browser=await chromium.launch();
try{
  for(const width of [390,768,1440]){
    const page=await browser.newPage({...width===390?devices['iPhone 13']:{},viewport:{width,height:width===390?844:width===768?1024:1100},deviceScaleFactor:1});
    for(const [name,path] of [['public-view','/app/people/demo-01/gallery'],['private-view','/app/people/demo-08/private-gallery'],['upload-public','/app/me/gallery/upload'],['upload-private','/app/me/private-gallery/upload']]){
      await page.goto(origin+path);if(await page.locator('#app').count())await page.waitForFunction(()=>document.querySelector('#app')?.getAttribute('aria-busy')==='false');
      {
        await page.evaluate(()=>document.fonts.ready);
        await page.waitForFunction(()=>[...document.querySelectorAll('.gallery-experience img')].every(i=>i.complete&&i.naturalWidth>0));
      }
      await page.locator('button:focus').evaluateAll(bs=>bs.forEach(b=>b.blur()));await page.screenshot({path:resolve(directory,`${name}-${width}.png`),fullPage:true});
      if(stage==='after'&&name.startsWith('upload-')){await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await page.screenshot({path:resolve(directory,`${name}-bottom-${width}.png`)});}
    }
    if(stage==='after'&&width===390){
      const manifest=await page.evaluate(async()=>{
        const db=await new Promise(resolve=>{const r=indexedDB.open('chatgun-demo',1);r.onsuccess=()=>resolve(r.result);});
        const s=await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('chatgun-browser-demo-v1');r.onsuccess=()=>resolve(r.result);});db.close();
        const counts=Object.fromEntries(['public','private'].map(scope=>[scope,s.gallery.filter(p=>p.visibility===scope).length]));
        return {batch:s.galleryBatch,photos:s.gallery.length,photosByScope:counts,newBatchPhotos:s.gallery.filter(p=>p.seed_batch===s.galleryBatch).length,ownerPhotos:s.gallery.filter(p=>p.owner==='demo-me').length,ownerAlbumCounts:Object.fromEntries(['public','private'].map(scope=>[scope,s.gallery.filter(p=>p.owner==='demo-me'&&p.visibility===scope).length])),owners:new Set(s.gallery.map(p=>p.owner)).size,privateAlbumOwners:new Set(s.gallery.filter(p=>p.visibility==='private').map(p=>p.owner)).size,originalMessages:Object.values(s.messages).flat().length,conversations:Object.keys(s.messages).length,comments:s.gallery.reduce((n,p)=>n+p.comments.length,0),moderationExamples:{pending:s.gallery.filter(p=>p.review_status==='pending').length,rejected:s.gallery.filter(p=>p.review_status==='rejected').length},permissionExamples:s.albumRequests.filter(r=>r.seed_batch===s.galleryBatch).map(r=>r.status),automaticExpiry:false,persistence:'IndexedDB; additive versioned upgrade; no automatic reset; explicit batch-only reset in Demo Chat preserves uploads and quota'};
      });
      writeFileSync(evidence+'/seed-manifest.json',JSON.stringify({origin,...manifest},null,2)+'\n');
    }
    await page.close();
  }
}finally{await browser.close();}
console.log('Fictional '+stage+' screenshots captured at 390/768/1440; no server fixture writes');
