import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  productionConfiguration, configDiff, preservationChecks, inspectProject,
  assetManifest, prepareStage, deploymentSourceSha
} from '../scripts/pages-isolated-release.mjs';

const fingerprint=JSON.parse(readFileSync('docs/production-readiness/phase6/production-owner-pilot-fingerprint.json','utf8'));
function makeProject(){
  const env_vars={};
  for(const [key,value] of Object.entries({...fingerprint.mustPreserve,...fingerprint.mustRemainDisabled})) {
    if(value!==null) env_vars[key]={type:'plain_text',value};
  }
  env_vars.ADMIN_ACCESS_STANDALONE_ENABLED={type:'plain_text',value:'true'};
  env_vars.ADMIN_ACCESS_ISSUER={type:'secret_text',value:'OPAQUE_REDACTED'};
  env_vars.ADMIN_ACCESS_AUDIENCE={type:'secret_text',value:'OPAQUE_REDACTED'};
  return {name:'chatgun',production_branch:'main',deployment_configs:{production:{
    env_vars,
    d1_databases:{DB:{id:'synthetic-d1-id'}},
    r2_buckets:{MEDIA:{name:'synthetic-r2-name'}},
    compatibility_date:'2026-10-15',
    compatibility_flags:[],
    fail_open:false,
  }}};
}
test('25/25 live pilot and true Admin standalone are preserved',()=>{
  const p=makeProject(),checks=preservationChecks(p,fingerprint);
  assert.deepEqual(checks,{checked:26,passed:26,failed:[],verdict:'PASS'});
  assert.equal(inspectProject(p,structuredClone(p),fingerprint,'chatgun').verdict,'PASS');
});
test('regression: Wrangler false would overwrite active true Admin flag, so fail closed',()=>{
  const before=makeProject(),after=structuredClone(before);
  after.deployment_configs.production.env_vars.ADMIN_ACCESS_STANDALONE_ENABLED.value='false';
  assert.deepEqual(configDiff(before,after),['production.env_vars.ADMIN_ACCESS_STANDALONE_ENABLED.value']);
  assert.deepEqual(preservationChecks(after,fingerprint).failed,['ADMIN_ACCESS_STANDALONE_ENABLED']);
  assert.throws(()=>inspectProject(before,after,fingerprint,'chatgun'),/BLOCKED/);
});
test('D1, R2, compatibility, variable addition and secret-name drift each stop release',()=>{
  const first=makeProject();
  for(const change of [
    p=>{p.deployment_configs.production.d1_databases.DB.id='other';},
    p=>{p.deployment_configs.production.r2_buckets.MEDIA.name='other';},
    p=>{p.deployment_configs.production.compatibility_date='2026-10-30';},
    p=>{p.deployment_configs.production.env_vars.PUBLIC_DISCOVERY_ENABLED.value='true';},
    p=>{delete p.deployment_configs.production.env_vars.ADMIN_ACCESS_AUDIENCE;},
    p=>{p.deployment_configs.production.env_vars.ADMIN_ACCESS_ISSUER.type='plain_text';}
  ]){
    const second=structuredClone(first);change(second);
    assert.notDeepEqual(configDiff(first,second),[]);
    assert.throws(()=>inspectProject(first,second,fingerprint,'chatgun'),/BLOCKED/);
  }
});
test('secret values remain opaque, while binding names and secret types are compared',()=>{
  const a=makeProject(),b=structuredClone(a);
  b.deployment_configs.production.env_vars.ADMIN_ACCESS_AUDIENCE.value='ANOTHER_OPAQUE_VALUE';
  assert.deepEqual(configDiff(a,b),[]);
  const snapshot=productionConfiguration(b);
  assert.deepEqual(snapshot.env_vars.ADMIN_ACCESS_AUDIENCE,{type:'secret_text'});
  assert.equal(JSON.stringify(snapshot).includes('ANOTHER_OPAQUE_VALUE'),false);
});
test('isolated stage contains no Wrangler config or environment file; assets and Functions hashes match',()=>{
  const temp=mkdtempSync(join(tmpdir(),'chatgun-release-fixture-'));
  let stage;
  try {
    const dist=join(temp,'dist'),functionsDir=join(temp,'functions');
    mkdirSync(dist);mkdirSync(functionsDir);
    writeFileSync(join(dist,'index.html'),'<html>Isolated synthetic fixture</html>');
    writeFileSync(join(functionsDir,'_middleware.js'),'export const onRequest=()=>new Response("fixture");');
    const before=assetManifest(dist,functionsDir);
    const staged=prepareStage(dist,functionsDir,'ed9df39081d2b0a6e2a0ea1ef3815e720a8a5bd4');
    stage=staged.stage;
    assert.deepEqual(staged.manifest,before);
    assert.equal(existsSync(join(stage,'wrangler.jsonc')),false);
    assert.equal(existsSync(join(stage,'.wrangler')),false);
    assert.equal(existsSync(join(stage,'.env')),false);
    assert.equal(existsSync(join(stage,'functions','_middleware.js')),true);
    assert.equal(existsSync(join(stage,'dist','index.html')),true);
    assert.deepEqual(staged.command,[
      'wrangler','pages','deploy','dist','--project-name','chatgun','--branch','main',
      '--commit-hash','ed9df39081d2b0a6e2a0ea1ef3815e720a8a5bd4'
    ]);
  } finally {rmSync(temp,{recursive:true,force:true});if(stage)rmSync(stage,{recursive:true,force:true});}
});
test('unsafe source artifacts are rejected before stage or deployment',()=>{
  const temp=mkdtempSync(join(tmpdir(),'chatgun-release-reject-'));
  try {
    const dist=join(temp,'dist'),functionsDir=join(temp,'functions');mkdirSync(dist);mkdirSync(functionsDir);
    writeFileSync(join(dist,'index.html'),'file');
    writeFileSync(join(functionsDir,'index.js'),'file');
    writeFileSync(join(dist,'wrangler.jsonc'),'{"env":{"production":{"vars":{"ADMIN_ACCESS_STANDALONE_ENABLED":"false"}}}}');
    assert.throws(()=>prepareStage(dist,functionsDir,'ed9df39081d2b0a6e2a0ea1ef3815e720a8a5bd4'),/Wrangler/);
    rmSync(join(dist,'wrangler.jsonc'));
    writeFileSync(join(dist,'.env'),'SECRET=redacted');
    assert.throws(()=>prepareStage(dist,functionsDir,'ed9df39081d2b0a6e2a0ea1ef3815e720a8a5bd4'),/environment/);
  } finally {rmSync(temp,{recursive:true,force:true});}
});

test('postflight requires canonical Production SHA and does not claim remote assets or secret values',()=>{
  const temp=mkdtempSync(join(tmpdir(),'chatgun-postfixture-'));
  try {
    const before=makeProject(),after=structuredClone(before);
    const correct='ed9df39081d2b0a6e2a0ea1ef3815e720a8a5bd4';
    after.canonical_deployment={deployment_trigger:{metadata:{commit_hash:correct}}};
    assert.equal(deploymentSourceSha(after),correct);
    const baseline=join(temp,'before.json'),latest=join(temp,'after.json');
    writeFileSync(baseline,JSON.stringify(before));
    writeFileSync(latest,JSON.stringify(after));
    const args=['scripts/pages-isolated-release.mjs','--phase','post','--project','chatgun',
      '--before',baseline,'--current',latest,'--fingerprint',
      'docs/production-readiness/phase6/production-owner-pilot-fingerprint.json','--sha',correct];
    const run=spawnSync(process.execPath,args,{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const result=JSON.parse(run.stdout);
    assert.equal(result.verdict,'PASS');
    assert.equal(result.observedProductionSha,correct);
    assert.equal(result.remoteAssetAndSecretRuntimeChecks,'NOT RUN — separately required');
    assert.equal(result.productionDeployment,'NOT RUN');
    const invalid=spawnSync(process.execPath,[...args.slice(0,-1),'f12466ea282355084a2cacb6d165bca20beb3b4c'],{encoding:'utf8'});
    assert.equal(invalid.status,1);
    assert.match(invalid.stderr,/Deployed SHA mismatch/);
  } finally {rmSync(temp,{recursive:true,force:true});}
});
test('explicit --deploy is prohibited even for a synthetic invocation',()=>{
  const run=spawnSync(process.execPath,['scripts/pages-isolated-release.mjs','--deploy'],{encoding:'utf8'});
  assert.equal(run.status,1);
  assert.match(run.stderr,/forbidden/);
});
