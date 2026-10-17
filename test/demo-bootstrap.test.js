import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSocialConfig} from '../app/demo-bootstrap.js';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('live configuration wins and no fallback asset is requested',async()=>{
  const config={socialAppEnabled:true};
  assert.equal(await loadSocialConfig(async()=>config,()=>assert.fail('unnecessary fallback')),config);
});
test('guarded recovery is fictional only, ignoring injected capability flags',async()=>{
  const config=await loadSocialConfig(async()=>{throw Error('404');},async()=>Response.json({mode:'fictional-only-v1',demoBatch:'chatgun-browser-demo-v1',socialAppEnabled:true}));
  assert.equal(config.demoModeEnabled,true);assert.equal(config.demoAutoStartEnabled,true);
  for(const key of ['socialAppEnabled','messagingEnabled','publicDiscoveryEnabled','mediaUploadEnabled','sensitiveContentEnabled','emailOtpEnabled','mobileOtpEnabled','identityVerificationEnabled'])assert.equal(config[key],false,key);
});
test('non-canary builds, invalid responses and asset outages fail closed',async()=>{
  const original=Error('configuration unavailable');
  for(const response of [new Response('missing',{status:404}),Response.json({mode:'live'}),new Response('<html>error</html>')]){
    await assert.rejects(loadSocialConfig(async()=>{throw original;},async()=>response),e=>e===original);
  }
});
test('recovery marker is generated only for guarded canary builds',()=>{
  for(const canary of [false,true]){
    const directory=mkdtempSync(join(tmpdir(),'chatgun-bootstrap-test-'));
    execFileSync(process.execPath,['scripts/build-pages.mjs'],{env:{...process.env,CF_PAGES_BRANCH:'preview',CHATGUN_CANARY_BUILD:String(canary),CHATGUN_BUILD_DIR:directory},stdio:'pipe'});
    const marker=join(directory,'assets/demo/canary-runtime.json');
    assert.equal(existsSync(marker),canary);
    if(canary)assert.deepEqual(JSON.parse(readFileSync(marker)),{mode:'fictional-only-v1',demoBatch:'chatgun-browser-demo-v1'});
  }
});
