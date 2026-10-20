// Static/unauthenticated release checks only. No CAPTCHA, provider login or user fixtures.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';import {approvedOwnerPilot,ownerPilotVars} from './lib/owner-pilot-release.mjs';
const origin=process.env.PILOT_CHECK_ORIGIN;assert.ok(['https://issue13.chatgun-issue13-staging.pages.dev','https://chatgun.social'].includes(origin));
const stage=origin==='https://chatgun.social'?'production':'preview',out='docs/production-pilot-20261020';mkdirSync(out,{recursive:true});
const expected=JSON.parse(readFileSync('dist/release.json')),approved=approvedOwnerPilot(),checks=[];
assert.equal(expected.releaseMode,'controlled-beta');
const check=(name,value)=>{assert.ok(value,name);checks.push({name,status:'PASS'});};
const live=await(await fetch(origin+'/release.json',{cache:'no-store'})).json();check('exact controlled release SHA and no demo',live.commit===expected.commit&&live.releaseMode==='controlled-beta'&&live.staticPrelaunch===false&&live.fictionalDemoEnabled===false);
const text=await(await fetch(origin+'/release-assets.json',{cache:'no-store'})).text();check('asset manifest digest',createHash('sha256').update(text).digest('hex')===live.assetsManifestSha256);
let assets=0;for(const file of JSON.parse(text).files){assert.match(file.path,/^[a-zA-Z0-9_./-]+$/);assert.ok(!file.path.includes('..'));const r=await fetch(origin+'/'+file.path+'?v='+live.commit);assert.equal(r.status,200);assert.equal(createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),file.sha256);assets++;}check('all manifest HTML/JS/CSS hashes verified',assets>20);
for(const file of Object.keys(approved.files)){const r=await fetch(origin+'/'+file);const html=await r.text();check('approved published '+file,r.status===200&&html.includes('data-policy-version=')&&html.includes('20 ตุลาคม 2026'));}
for(const path of ['/assets/demo/network.json','/app/demo-network.js','/app/demo-gallery.js','/app/demo-bootstrap.js'])check('retired demo unavailable '+path,(await fetch(origin+path)).status===404);
for(const path of ['/api/health','/api/auth/config','/api/social/config']){const r=await fetch(origin+path);check('JSON '+path,r.status===200&&r.headers.get('content-type')?.includes('application/json'));}
if(stage==='production'){
  const auth=await(await fetch(origin+'/api/auth/config')).json(),social=await(await fetch(origin+'/api/social/config')).json();
  check('LINE only invitation admission and approved versions',auth.oauthLoginEnabled&&JSON.stringify(auth.oauthProviders)==='["line"]'&&!auth.newAccountRegistrationEnabled&&auth.invitationOnlyRegistrationEnabled);
  check('social shell but no later-wave services',social.socialAppEnabled&&!social.publicDiscoveryEnabled&&!social.messagingEnabled&&!social.onlineStatusEnabled&&!social.mediaUploadEnabled&&!social.sensitiveContentEnabled);
  check('anonymous account denied',(await fetch(origin+'/api/auth/me')).status===401);
  for(const provider of ['google','facebook']){const r=await fetch(origin+'/api/auth/oauth/'+provider+'/start',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'});check(provider+' disabled',r.status===503);}
  for(const suffix of ['', '?state=invalid&code=invalid']){const r=await fetch(origin+'/api/auth/oauth/line/callback'+suffix,{redirect:'manual'});check('LINE callback rejects missing/untrusted state '+suffix,r.status===303&&r.headers.get('location')?.includes('invalid_state'));}
}
const result={checkedAt:new Date().toISOString(),origin,stage,commit:live.commit,passed:checks.length,failed:0,checks,hashedAssets:assets,policyVersions:live.policyVersions,realOAuth:'NOT RUN by this checker; human interaction required',realUserCreated:false};writeFileSync(out+'/'+stage+'-pilot-checks.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({stage,commit:live.commit,passed:checks.length,hashedAssets:assets}));
