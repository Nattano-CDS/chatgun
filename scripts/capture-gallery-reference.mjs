// Render the approved prototype without its external presentation frame.
// Product CSS/components remain unchanged. Does not edit the approved source.
import {chromium} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=resolve('docs/gallery-approved/screens/reference');mkdirSync(dir,{recursive:true});
const browser=await chromium.launch();
try{
  for(const width of [390,768,1440]){
    const page=await browser.newPage({viewport:{width,height:width===390?844:1100}});
    await page.goto(pathToFileURL(resolve('docs/gallery-approved/reference/chatgun-gallery-design/chatgun_gallery_ux_prototype.html')).href);
    await page.addStyleTag({content:'.demo-toolbar,.frame-caption{display:none}.preview-frame{margin:0;padding:0;max-width:none}.browser-frame{border:0;border-radius:0;box-shadow:none}'});
    for(const [name,mode] of [['public-view','view-public'],['private-view','view-private'],['upload-public','upload-public'],['upload-private','upload-private']]){
      await page.locator('[data-mode='+mode+']').evaluate(el=>el.click());
      await page.locator('button:focus').evaluateAll(bs=>bs.forEach(b=>b.blur()));
      await page.locator('#app').screenshot({path:resolve(dir,`${name}-${width}.png`)});
    }
    await page.close();
  }
}finally{await browser.close();}
console.log('Approved product component reference captures: 390/768/1440');
