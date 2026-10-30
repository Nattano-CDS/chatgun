import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {assertProductionMediaBinding} from '../scripts/lib/production-media-binding.mjs';
import {requiredAcceptanceVersions} from '../functions/_lib/acceptance.js';
import {verifyProductionPreservation} from '../scripts/verify-production-preservation.mjs';
test('Production binding checks require exact explicit private bucket and reject Staging or additional bindings',()=>{
  assertProductionMediaBinding({},'unbound');assertProductionMediaBinding({MEDIA:{name:'chatgun-media-production'}},'private-bound');
  for(const binding of [{},{MEDIA:{name:'chatgun-media-staging'}},{MEDIA:{name:'chatgun-media-production'},OTHER:{name:'unexpected'}}])assert.throws(()=>assertProductionMediaBinding(binding,'private-bound'));
  assert.throws(()=>assertProductionMediaBinding({MEDIA:{name:'chatgun-media-production'}},'unbound'));
});
test('acceptance refuses pending legal versions even if activation flags are accidentally enabled',()=>{
  for(const value of ['pending-owner-approval','draft-v1','unapproved-policy','TBD'])assert.throws(()=>requiredAcceptanceVersions({ACCEPTANCE_FLOW_ENABLED:'true',ADULT_NOTICE_VERSION:'adult-v1',TERMS_VERSION:value,PRIVACY_VERSION:'privacy-v1'}),/unapproved_acceptance_versions/);
  assert.deepEqual(requiredAcceptanceVersions({ACCEPTANCE_FLOW_ENABLED:'true',ADULT_NOTICE_VERSION:'adult-reviewed-v1',TERMS_VERSION:'terms-reviewed-v1',PRIVACY_VERSION:'privacy-reviewed-v1'}),{adultNotice:'adult-reviewed-v1',terms:'terms-reviewed-v1',privacy:'privacy-reviewed-v1'});
});
test('Production private storage configuration preserves only the approved owner pilot',()=>{
  const prod=JSON.parse(readFileSync('wrangler.jsonc')).env.production;
  const fingerprint=JSON.parse(readFileSync('docs/production-readiness/phase6/production-owner-pilot-fingerprint.json'));
  assert.deepEqual(prod.r2_buckets,[{binding:'MEDIA',bucket_name:'chatgun-media-production'}]);
  assert.equal(verifyProductionPreservation(prod.vars,fingerprint).result,'PASS');
  for(const key of ['PUBLIC_DISCOVERY_ENABLED','MESSAGING_ENABLED','MEDIA_UPLOAD_ENABLED','PRESENCE_ENABLED','SENSITIVE_CONTENT_ENABLED'])assert.equal(prod.vars[key],'false',key);
});
