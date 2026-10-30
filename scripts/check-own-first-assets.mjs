import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const sha=process.env.EXPECTED_SHA;
assert.match(sha||'',/^[a-f0-9]{40}$/);
const origin='https://chatgun.social',release=await fetch(origin+'/release.json').then(r=>r.json());assert.equal(release.commit,sha);
const hash=b=>createHash('sha256').update(b).digest('hex'),assets=[];
for(const path of ['app/social.js','app/near-components.js','app/near-components.css','app/restoration.css']){
 const response=await fetch(origin+'/'+path,{headers:{'cache-control':'no-cache'}});assert.equal(response.status,200);
 const actual=hash(Buffer.from(await response.arrayBuffer())),expected=hash(execFileSync('git',['show',sha+':'+path]));assert.equal(actual,expected,path);
 assets.push({path,sha256:actual,match:true});
}
assert.equal((await fetch(origin+'/release.json').then(r=>r.json())).commit,sha);
const result={checkedAt:new Date().toISOString(),origin,sha,assets};writeFileSync('docs/issue-10-own-first/deployed-assets.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
