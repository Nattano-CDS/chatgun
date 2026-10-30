import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const origin='https://issue13.chatgun-issue13-staging.pages.dev',sha=process.env.EXPECTED_SHA;
assert.match(sha||'',/^[a-f0-9]{40}$/);
assert.equal((await(await fetch(origin+'/release.json',{cache:'no-store'})).json()).commit,sha);
const removed=[];
for(const path of ['/assets/demo/network.json','/assets/demo/01.png','/app/demo-network.js','/app/demo-gallery.js','/app/demo-bootstrap.js','/playwright.issue16.config.js']){const r=await fetch(origin+path);assert.equal(r.status,404,path);removed.push({path,status:404});}
const assets=[];const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(JSON.parse(readFileSync('dist/release.json')).commit,sha);
for(const path of ['app/social.js','app/online-presence.js','app/online-presence.css','app/retire-demo.js','app/near-components.js']){const r=await fetch(origin+'/'+path+'?v='+sha);assert.equal(r.status,200,path);const sha256=hash(Buffer.from(await r.arrayBuffer()));assert.equal(sha256,hash(readFileSync('dist/'+path)));assets.push({path,sha256});}
const browser=await chromium.launch(),screens=[];mkdirSync('docs/issue-16/screens/preview',{recursive:true});
try{for(const width of [390,768,1440]){const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.locator('#disabled-view').waitFor();assert.equal(await page.locator('#people-grid .photo-card').count(),0);assert.equal(await page.locator('[data-online-user]').count(),0);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`docs/issue-16/screens/preview/prelaunch-${width}.png`});screens.push({width,staticPrelaunch:'PASS',fictionalMembers:0,onlineBadges:0});await context.close();}}finally{await browser.close();}
const config=await fetch(origin+'/api/social/config');
const result={checkedAt:new Date().toISOString(),origin,commit:sha,status:'PASS-static-only',authenticatedPresence:'BLOCKED until real Functions E2E passes',configHttpStatus:config.status,removed,assets,screens};
writeFileSync('docs/issue-16/preview-smoke.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
