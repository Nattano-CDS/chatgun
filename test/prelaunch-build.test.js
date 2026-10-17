import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('all builds exclude fictional assets, demo generators and canary fallback',()=>{
  for(const canary of [false,true]){
    const directory=mkdtempSync(join(tmpdir(),'chatgun-prelaunch-test-'));
    execFileSync(process.execPath,['scripts/build-pages.mjs'],{env:{...process.env,CF_PAGES_BRANCH:'preview',CHATGUN_CANARY_BUILD:String(canary),CHATGUN_BUILD_DIR:directory},stdio:'pipe'});
    for(const path of ['assets/demo','app/demo-network.js','app/demo-gallery.js','app/demo-bootstrap.js','test','scripts','docs','e2e-retired','playwright.config.js','playwright.issue16.config.js'])assert.equal(existsSync(join(directory,path)),false,path);
    assert.deepEqual(JSON.parse(readFileSync(join(directory,'_routes.json'))),{version:1,include:['/api/*'],exclude:[]});
    assert.equal(JSON.parse(readFileSync(join(directory,'release.json'))).fictionalDemoEnabled,false);
    const source=readFileSync(join(directory,'app/social.js'),'utf8');assert.doesNotMatch(source,/startDemo|demoSave|demoApi|initializeGallery|chatgunDemoNetwork/);
  }
});
