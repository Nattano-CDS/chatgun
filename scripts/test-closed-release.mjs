// Static release checks only; no provider identity, D1 mutation or CAPTCHA bypass.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const local=process.argv.includes('--local'),stage=process.env.RELEASE_CHECK_STAGE||'local';
assert.ok(['local','preview','production'].includes(stage));
const directory=resolve(process.env.CLOSED_BUILD_DIR||'dist'),expected=JSON.parse(readFileSync(directory+'/release.json'));
assert.equal(expected.staticPrelaunch,true);assert.equal(expected.fictionalDemoEnabled,false);
let server,origin=process.env.RELEASE_CHECK_ORIGIN;
if(local){server=createServer((req,res)=>{
  let path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/')||path.startsWith('/assets/demo/')||/^\/app\/demo-/.test(path)){res.writeHead(404);res.end('Not found');return;}
  if(path==='/'||path==='/app/'||path==='/app/photos'||path.startsWith('/app/people/')||path.startsWith('/app/me/'))path='/app/index.html';
  else if(!extname(path))path+='.html';
  const file=resolve(directory,'.'+path);
  if(!file.startsWith(directory+'/')||!existsSync(file)){res.writeHead(404);res.end('Not found');return;}
  const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
  res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;}
else assert.ok(['https://issue13.chatgun-issue13-staging.pages.dev','https://chatgun.social'].includes(origin));
const output='docs/issue-16/recovery';mkdirSync(output+'/screens/'+stage,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push({name,status:'PASS'});};
const browser=await chromium.launch();
try{
  const response=await fetch(origin+'/release.json',{cache:'no-store'}),release=await response.json();check('actual release SHA and static mode',release.commit===expected.commit&&release.staticPrelaunch===true&&release.fictionalDemoEnabled===false);
  const manifestResponse=await fetch(origin+'/release-assets.json'),manifestText=await manifestResponse.text();check('manifest digest',hash(manifestText)===release.assetsManifestSha256);
  const manifest=JSON.parse(manifestText);let assets=0;
  for(const file of manifest.files.filter(file=>/\.(js|css)$/.test(file.path))){
    assert.match(file.path,/^[a-zA-Z0-9_./-]+$/);assert.ok(!file.path.includes('..'));
    const r=await fetch(origin+'/'+file.path+'?v='+release.commit);assert.equal(r.status,200,file.path);assert.equal(hash(Buffer.from(await r.arrayBuffer())),file.sha256,file.path);assets++;
  }
  check('versioned JavaScript/CSS hashes match build',assets>10);
  for(const path of ['/assets/demo/network.json','/assets/demo/01.png','/app/demo-network.js','/app/demo-gallery.js','/app/demo-bootstrap.js'])check('retired '+path,(await fetch(origin+path)).status===404);
  const nojs=await browser.newContext({javaScriptEnabled:false});const fallback=await nojs.newPage();await fallback.goto(origin);check('prelaunch renders without JavaScript',await fallback.locator('#disabled-view').isVisible());await nojs.close();
  for(const width of [390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],apis=[],failedAssets=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin===origin&&new URL(r.url()).pathname.startsWith('/api/'))apis.push(new URL(r.url()).pathname);});
    page.on('response',r=>{if(new URL(r.url()).origin===origin&&r.status()>=400)failedAssets.push({path:new URL(r.url()).pathname,status:r.status()});});
    await page.clock.install();await page.goto(origin);await page.locator('#disabled-view').waitFor();
    await page.clock.fastForward(120000);await page.evaluate(()=>{history.pushState({},'', '/app/people/demo-01/private-gallery');dispatchEvent(new PopStateEvent('popstate',{state:{cgStep:1}}));});
    check(`no fictional cards or Online ${width}`,await page.locator('.photo-card,[data-online-user]').count()===0);
    check(`no overflow ${width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`${output}/screens/${stage}/prelaunch-${width}.png`});
    for(const route of ['/signup','/account','/acceptance']){await page.goto(origin+route);await page.getByRole('heading',{name:'ChatGun กำลังเตรียมเปิดให้บริการ'}).waitFor();check(`no provider controls ${route} ${width}`,await page.locator('[data-provider]').count()===0);}
    check(`zero API calls during startup/timers/navigation ${width}`,apis.length===0);check(`no JavaScript errors ${width}`,errors.length===0);check(`all loaded local assets available ${width}`,failedAssets.length===0);
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:900}}),page=await context.newPage();await page.goto(origin);
  await page.evaluate(async()=>{
    localStorage.setItem('unrelated-recovery-test','keep');document.cookie='unrelated-recovery-test=keep; path=/; SameSite=Lax';
    const db=await new Promise(resolve=>{const r=indexedDB.open('chatgun-demo',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);});
    await new Promise(resolve=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({messages:['edited fictional recovery fixture'],photos:['local-only']},'chatgun-browser-demo-v1');tx.objectStore('state').put({keep:true},'unrelated-real-record-test');tx.oncomplete=resolve;});db.close();
  });await page.reload();await page.locator('[data-export-retired]').waitFor();
  const download=page.waitForEvent('download');await page.locator('[data-export-retired]').click();const data=JSON.parse(readFileSync(await(await download).path(),'utf8'));check('returning browser can export edits',data.messages[0]==='edited fictional recovery fixture');
  await page.screenshot({path:`${output}/screens/${stage}/retirement-choice-390.png`});await page.locator('[data-remove-retired]').click();await page.getByRole('status').filter({hasText:'ลบเฉพาะข้อมูลตัวอย่างแล้ว'}).waitFor();
  check('selective removal preserves unrelated storage and cookie',await page.evaluate(async()=>{
    const db=await new Promise(resolve=>{const r=indexedDB.open('chatgun-demo');r.onsuccess=()=>resolve(r.result);});
    const get=key=>new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get(key);r.onsuccess=()=>resolve(r.result);});
    const retired=await get('chatgun-browser-demo-v1'),kept=await get('unrelated-real-record-test');db.close();return !retired&&kept.keep&&localStorage.getItem('unrelated-recovery-test')==='keep'&&document.cookie.includes('unrelated-recovery-test=keep');
  }));await context.close();
  const result={checkedAt:new Date().toISOString(),origin,stage,commit:release.commit,staticPrelaunch:true,passed:checks.length,failed:0,skipped:0,hashedAssets:assets,checks,realOAuth:'NOT RUN; disabled',realSocialActivation:false,browserRecovery:'disposable test context only; no owner browser storage accessed'};
  writeFileSync(`${output}/${stage}-static-tests.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({stage,commit:release.commit,passed:checks.length,hashedAssets:assets}));
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
