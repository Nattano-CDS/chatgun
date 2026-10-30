import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const directory='docs/issue-16/recovery',before=JSON.parse(readFileSync(directory+'/production-before.json')),after=JSON.parse(readFileSync(directory+'/production-after.json')),checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push({name,status:'PASS'});};
for(const field of ['counts','schemaSha256','foreignKeyViolations','productionD1','productionR2','previewD1','previewR2','secretNames'])check('preserved '+field,JSON.stringify(before[field])===JSON.stringify(after[field]));
for(const [key,value]of Object.entries(before.flags))if(!['DEMO_MODE_ENABLED','DEMO_AUTO_START_ENABLED'].includes(key))check('unchanged gate '+key,after.flags[key]===value);
for(const key of ['DEMO_MODE_ENABLED','DEMO_AUTO_START_ENABLED','PRESENCE_ENABLED'])check(key+' disabled',after.flags[key]==='false');
const origin='https://chatgun.social',release=await(await fetch(origin+'/release.json',{cache:'no-store'})).json();
check('actual deployed SHA matches canonical Cloudflare deployment',after.sha===release.commit);check('closed release mode',release.staticPrelaunch===true&&release.fictionalDemoEnabled===false);
const config=await(await fetch(origin+'/api/social/config')).json(),auth=await(await fetch(origin+'/api/auth/config')).json();
check('real social/presence/media disabled',config.socialAppEnabled===false&&config.onlineStatusEnabled===false&&config.mediaUploadEnabled===false);
check('fictional fallback disabled server-side',config.demoModeEnabled===false&&config.demoAutoStartEnabled===false);
check('OAuth registration closed',auth.oauthLoginEnabled===false&&auth.newAccountRegistrationEnabled===false);
for(const provider of ['google','facebook','line']){
  const start=await fetch(`${origin}/api/auth/oauth/${provider}/start`,{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'});
  check(provider+' start denied without touching provider',start.status===503&&(await start.json()).code==='oauth_unavailable');
  const callback=await fetch(`${origin}/api/auth/oauth/${provider}/callback?state=invalid&code=invalid`,{redirect:'manual'});
  check(provider+' callback disabled',callback.status===303&&callback.headers.get('location')?.includes('oauth_unavailable'));
}
for(const path of ['/api/social/profile','/api/social/online','/api/social/gallery','/api/social/conversations'])check('closed '+path,(await fetch(origin+path)).status===404);
writeFileSync(directory+'/production-security.json',JSON.stringify({checkedAt:new Date().toISOString(),origin,sha:release.commit,passed:checks.length,failed:0,checks,productionD1Changes:false,productionR2Changes:false,secretValuesReadOrPrinted:false,realOAuth:'NOT RUN; disabled; checks above validate denial only'},null,2)+'\n');console.log(JSON.stringify({sha:release.commit,passed:checks.length,productionData:'unchanged'}));
