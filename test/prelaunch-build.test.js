import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('all builds exclude fictional assets, demo generators and canary fallback',()=>{
  for(const canary of [false,true]){
    const directory=mkdtempSync(join(tmpdir(),'chatgun-prelaunch-test-'));
    execFileSync(process.execPath,['scripts/build-pages.mjs'],{env:{...process.env,CF_PAGES_BRANCH:'preview',CHATGUN_CANARY_BUILD:String(canary),CHATGUN_RELEASE_MODE:'default',CHATGUN_BUILD_DIR:directory},stdio:'pipe'});
    for(const path of ['assets/demo','app/demo-network.js','app/demo-gallery.js','app/demo-bootstrap.js','test','scripts','docs','e2e-retired','playwright.config.js','playwright.issue16.config.js'])assert.equal(existsSync(join(directory,path)),false,path);
    assert.deepEqual(JSON.parse(readFileSync(join(directory,'_routes.json'))),{version:1,include:['/api/*'],exclude:[]});
    assert.equal(JSON.parse(readFileSync(join(directory,'release.json'))).fictionalDemoEnabled,false);
    assert.match(readFileSync(join(directory,'app/index.html'),'utf8'),/src="\/app\/social\.js\?v=[a-f0-9]{40}"/);
    assert.match(readFileSync(join(directory,'app/social.js'),'utf8'),/online-presence\.js\?v=[a-f0-9]{40}/);
    assert.ok(JSON.parse(readFileSync(join(directory,'release-assets.json'))).files.some(file=>file.path==='app/social.js'&&file.sha256.length===64));
    const source=readFileSync(join(directory,'app/social.js'),'utf8');assert.doesNotMatch(source,/startDemo|demoSave|demoApi|initializeGallery|chatgunDemoNetwork/);
    assert.doesNotMatch(readFileSync(join(directory,'signup.js'),'utf8'),/ทดลอง ChatGun ด้วยข้อมูลสมมติ|เปิดให้ชมโหมดตัวอย่าง/);
  }
});

test('runtime only polls the member\'s visible social surface',()=>{
  const source=readFileSync('app/social.js','utf8');
  // Guard against reintroducing wasteful API traffic after Chat is hidden.
  assert.match(source,/state\.activeTab !== "chat" \|\| document\.visibilityState !== "visible" \|\| !navigator\.onLine/);
  assert.match(source,/if \(state\.activeTab === "near"\) void loadPeople\(\)/);
  assert.match(source,/if\(state\.config\.messagingEnabled\)void loadRelationships\(\)/);
  assert.doesNotMatch(source,/setInterval\(\(\) => \{\s*document\.visibilityState === "visible" && navigator\.onLine && state\.config\?\.socialAppEnabled && state\.profile && Promise\.all\(\[loadPeople\(\), loadRelationships\(\)\]\)/);
});

test('closed Production packaging excludes staging bindings and unsupported Pages account config',()=>{
  const source=readFileSync('scripts/deploy-closed-production.mjs','utf8');
  const config=source.match(/const deployConfig=([^;]+);/)[1];
  assert.doesNotMatch(config,/account_id/);
  assert.match(config,/\.\.\.production/);
  assert.match(source,/CLOUDFLARE_ACCOUNT_ID:account/);
  assert.match(source,/CHATGUN_DEPLOY_APPROVED!=='closed-prelaunch'/);
});

test('static Pages redirects use supported path-only sources, without catch-all Functions',()=>{
  assert.doesNotMatch(readFileSync('_redirects','utf8'),/^https?:\/\//m);
  assert.deepEqual(JSON.parse(readFileSync('_routes.json')),{version:1,include:['/api/*'],exclude:[]});
});

test('explicit closed prelaunch renders without relying on Cloudflare Functions',()=>{
  const directory=mkdtempSync(join(tmpdir(),'chatgun-closed-release-'));
  execFileSync(process.execPath,['scripts/build-pages.mjs'],{
    env:{...process.env,CF_PAGES_BRANCH:'main',CHATGUN_CANARY_BUILD:'true',
      CHATGUN_RELEASE_MODE:'closed-prelaunch',CHATGUN_BUILD_DIR:directory},stdio:'pipe'});
  const html=readFileSync(join(directory,'app/index.html'),'utf8');
  const app=readFileSync(join(directory,'app/social.js'),'utf8');
  const release=JSON.parse(readFileSync(join(directory,'release.json'),'utf8'));
  assert.match(html,/<body data-static-prelaunch="true" data-prelaunch="true">/);
  assert.match(html,/<section id="disabled-view" class="empty">/);
  assert.doesNotMatch(html,/กำลังโหลด ChatGun…/);
  assert.equal(release.staticPrelaunch,true);
  assert.equal(release.fictionalDemoEnabled,false);
  assert.match(app,/if \(document\.body\.dataset\.staticPrelaunch === "true"\)/);
  const bootstrap=app.slice(app.indexOf('async function initialize()'),app.indexOf('$("#primary-nav").addEventListener'));
  assert.ok(bootstrap.indexOf('dataset.staticPrelaunch')>=0);
  assert.ok(bootstrap.indexOf('dataset.staticPrelaunch')<bootstrap.indexOf('"/api/social/config"'));
  assert.deepEqual(JSON.parse(readFileSync(join(directory,'_routes.json'),'utf8')),
    {version:1,include:['/api/*'],exclude:[]});
  assert.equal(existsSync(join(directory,'assets/demo')),false);
  for(const page of ['signup.html','account.html','acceptance.html']){
    const notice=readFileSync(join(directory,page),'utf8');
    assert.match(notice,/ChatGun กำลังเตรียมเปิดให้บริการ/);
    assert.doesNotMatch(notice,/data-provider=/);
  }
});
