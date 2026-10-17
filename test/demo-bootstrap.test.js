import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSocialConfig} from '../app/demo-bootstrap.js';

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
