// Public fictional UI only. Opens/closes its own headless context, never user tabs.
import {chromium} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const origin=process.env.GALLERY_ORIGIN||'https://chatgun.social';
const stage=process.env.GALLERY_CAPTURE_STAGE||'before';
if(!['before','after'].includes(stage))throw Error('Invalid evidence stage');
const directory=resolve('docs/gallery-approved/screens/'+stage);mkdirSync(directory,{recursive:true});
const browser=await chromium.launch();
try{
  for(const width of [390,768,1440]){
    const page=await browser.newPage({viewport:{width,height:width===390?844:1100}});
    for(const [name,path] of [['public-view','/app/people/demo-01/gallery'],['private-view','/app/people/demo-08/private-gallery'],['upload-public','/app/me/gallery/upload'],['upload-private','/app/me/private-gallery/upload']]){
      await page.goto(origin+path);if(await page.locator('#app').count())await page.waitForFunction(()=>document.querySelector('#app')?.getAttribute('aria-busy')==='false');
      await page.locator('button:focus').evaluateAll(bs=>bs.forEach(b=>b.blur()));await page.screenshot({path:resolve(directory,`${name}-${width}.png`),fullPage:true});
    }
    await page.close();
  }
}finally{await browser.close();}
console.log('Fictional '+stage+' screenshots captured at 390/768/1440; no server fixture writes');
