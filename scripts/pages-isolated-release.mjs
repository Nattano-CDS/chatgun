// Prepare/verify an isolated Pages asset deployment; intentionally NEVER executes Wrangler.
// Source of truth for Production bindings remains the live Cloudflare Pages project.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const sha = /^[a-f0-9]{40}$/u;
const prohibited = new Set(['wrangler.json','wrangler.jsonc','wrangler.toml','.dev.vars','.env']);
const bindingKeys = ['d1_databases','r2_buckets','kv_namespaces','durable_object_namespaces',
  'services','queue_producers','hyperdrive_bindings','analytics_engine_datasets',
  'vectorize_bindings','mtls_certificates','ai_bindings','browsers'];

export function productionConfiguration(project) {
  const source = project?.result || project;
  assert.ok(source && typeof source === 'object' && source.deployment_configs?.production, 'Missing Pages Production project configuration');
  const config = structuredClone(source.deployment_configs.production);
  assert.ok(config.env_vars && typeof config.env_vars === 'object' && !Array.isArray(config.env_vars), 'Missing Production variables');
  for (const [name, entry] of Object.entries(config.env_vars)) {
    assert.ok(entry && ['plain_text','secret_text'].includes(entry.type), 'Invalid variable binding: ' + name);
    if (entry.type === 'secret_text') config.env_vars[name] = {type: 'secret_text'};
    else assert.equal(typeof entry.value, 'string', 'Missing plaintext value: ' + name);
  }
  for (const key of bindingKeys) {
    if (config[key] !== undefined) assert.ok(config[key] && typeof config[key] === 'object', 'Invalid ' + key);
  }
  // Fields like wrangler_config_hash, fail_open, compatibility date and bindings
  // are deliberately NOT ignored. Only secret values are unreadable.
  return config;
}

export function configDiff(a, b) {
  const differences = [];
  function walk(x, y, path) {
    if (isDeepStrictEqual(x,y)) return;
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)) {
      for (const key of new Set([...Object.keys(x),...Object.keys(y)])) walk(x[key],y[key],path ? path+'.'+key : key);
    } else differences.push(path || 'production');
  }
  walk(productionConfiguration(a),productionConfiguration(b),'production');
  // Paths only: no credentials, plaintext values, UUIDs or secret contents.
  return differences.sort();
}

export function preservationChecks(project, fingerprint) {
  const vars = productionConfiguration(project).env_vars;
  const requirements = {...fingerprint.mustPreserve,...fingerprint.mustRemainDisabled};
  assert.equal(Object.keys(requirements).length,25,'Expected the exact 25-point Production fingerprint');
  const failed = [];
  for(const [key,expected] of Object.entries(requirements)) {
    const actual=vars[key];
    if(expected === null) { if(actual !== undefined) failed.push(key); }
    else if(!actual || actual.type!=='plain_text' || actual.value!==expected) failed.push(key);
  }
  if(vars.ADMIN_ACCESS_STANDALONE_ENABLED?.type!=='plain_text' || vars.ADMIN_ACCESS_STANDALONE_ENABLED.value!=='true') {
    failed.push('ADMIN_ACCESS_STANDALONE_ENABLED');
  }
  return {checked:26,passed:26-failed.length,failed,verdict:failed.length?'BLOCKED':'PASS'};
}

export function inspectProject(before, current, fingerprint, projectName) {
  const source=before?.result || before;
  const latest=current?.result || current;
  assert.equal(source.name,projectName,'Unexpected baseline Pages project');
  assert.equal(latest.name,projectName,'Unexpected current Pages project');
  assert.equal(source.production_branch,latest.production_branch,'Production branch drift');
  const differences=configDiff(before,current);
  const checks=preservationChecks(current,fingerprint);
  if(differences.length || checks.failed.length) throw Object.assign(new Error('Production configuration preservation BLOCKED'),{
    differences,failedChecks:checks.failed
  });
  return {verdict:'PASS',project:projectName,preserved:checks.passed,configurationDifferences:0,
    secrets:{bindingNamesAndTypesCompared:true,contentsVerifiable:false}};
}

function walkFiles(dir,root=dir) {
  assert.ok(existsSync(dir) && lstatSync(dir).isDirectory(),'Missing directory: '+basename(dir));
  const list=[];
  for(const entry of readdirSync(dir,{withFileTypes:true})) {
    const full=join(dir,entry.name);
    if(entry.isSymbolicLink()) throw new Error('Symlink forbidden in staged artifacts');
    if(entry.name==='.wrangler' || prohibited.has(entry.name)) throw new Error('Wrangler or environment configuration in artifact: '+entry.name);
    if(entry.isDirectory()) list.push(...walkFiles(full,root));
    else if(entry.isFile()) list.push({file:full,path:relative(root,full)});
    else throw new Error('Unsupported asset entry');
  }
  return list;
}

export function assetManifest(dist,functionsDir) {
  const items=[...walkFiles(dist).map(x=>({...x,path:'dist/'+x.path})),
    ...walkFiles(functionsDir).map(x=>({...x,path:'functions/'+x.path}))];
  assert.ok(items.some(x=>x.path.startsWith('functions/')),'Missing Pages Functions');
  assert.ok(items.some(x=>x.path.startsWith('dist/')),'Missing built assets');
  const hashed=items.map(({path,file})=>({path,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')}))
    .sort((a,b)=>a.path.localeCompare(b.path,'en'));
  return {files:hashed.length,digest:createHash('sha256').update(JSON.stringify(hashed)).digest('hex')};
}

export function prepareStage(dist,functionsDir,commit) {
  assert.match(commit,sha);
  const paths=[resolve(dist),resolve(functionsDir)];
  const manifest=assetManifest(...paths);
  const stage=mkdtempSync(join(tmpdir(),'chatgun-pages-'));
  mkdirSync(join(stage,'dist'));
  mkdirSync(join(stage,'functions'));
  cpSync(paths[0],join(stage,'dist'),{recursive:true,force:true});
  cpSync(paths[1],join(stage,'functions'),{recursive:true,force:true});
  const staged=assetManifest(join(stage,'dist'),join(stage,'functions'));
  assert.deepEqual(staged,manifest,'Staged artifact differs from source');
  assert.ok(!existsSync(join(stage,'.wrangler')),'Generated Wrangler deployment redirection prohibited');
  return {stage,manifest,command:['wrangler','pages','deploy','dist','--project-name','chatgun',
    '--branch','main','--commit-hash',commit]};
}

function option(name) {
  const i=process.argv.indexOf(name);
  if(i<0 || !process.argv[i+1] || process.argv[i+1].startsWith('--')) throw new Error('Missing '+name);
  return process.argv[i+1];
}
if(process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if(process.argv.includes('--execute') || process.argv.includes('--deploy')) throw new Error('Production execution is forbidden in this preparation tool');
    const phase=option('--phase');
    assert.ok(['pre','post'].includes(phase),'Use --phase pre|post');
    const before=JSON.parse(readFileSync(option('--before'),'utf8'));
    const current=JSON.parse(readFileSync(option('--current'),'utf8'));
    const fp=JSON.parse(readFileSync(option('--fingerprint'),'utf8'));
    const state=inspectProject(before,current,fp,option('--project'));
    const result={...state,phase,productionDeployment:'NOT RUN',configurationSecretValues:'NOT INSPECTED'};
    if(phase==='pre'){
      const commit=option('--sha');
      const staged=prepareStage(option('--dist'),option('--functions'),commit);
      Object.assign(result,{testedSourceSha:commit,stage:staged.stage,assetDigest:staged.manifest.digest,
        files:staged.manifest.files,deployCommand:staged.command,
        instruction:'For a separately authorized deployment only: run the pinned Wrangler executable FROM stage, with no --config, --env or repository cwd. This script never deploys.'});
    }
    console.log(JSON.stringify(result,null,2));
  } catch(error) {
    // Report only changed key paths and check names. Never print snapshot contents.
    console.error(JSON.stringify({result:'BLOCKED',reason:error.message,
      changes:error.differences||[],failedChecks:error.failedChecks||[]}));
    process.exitCode=1;
  }
}
