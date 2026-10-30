// Import NEW dedicated-UAT credentials from a protected private file, never CLI arguments/logs.
// This configures encrypted Preview secrets only. It cannot enable OAuth, admission or roles.
import assert from 'node:assert/strict';
import {readFileSync,statSync,realpathSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
try {
assert.equal(process.env.CHATGUN_FINAL_UAT,'approved');
const provider=process.argv[2];assert.ok(['google','facebook','line'].includes(provider));
const file=realpathSync(process.env.CHATGUN_UAT_NEW_CREDENTIAL_FILE||'');
assert.ok(file.startsWith((()=>{const root=process.env.CHATGUN_PRIVATE_ROOT;if(!root)throw new Error('CHATGUN_PRIVATE_ROOT is required');return root;})()+'/uat-provider-'),'Use a protected NEW-UAT credential handoff, not Downloads or an old Production file');
assert.equal(statSync(file).mode&0o777,0o600);
const s=JSON.parse(readFileSync('docs/final-uat/environment.json'));
assert.equal(s.account,'23017b53386fb67fc62a52cdd017454c');assert.equal(s.project,'chatgun-final-uat');assert.equal(s.databaseId,'e3cb426c-b88a-4b93-90fd-39df524f68ae');
const input=JSON.parse(readFileSync(file));assert.equal(input.scope,'new-dedicated-chatgun-uat');assert.equal(input.provider,provider);
assert.equal(input.callback,s.origin+'/api/auth/oauth/'+provider+'/callback');
assert.equal(input.newCredentialConfirmed,true);assert.equal(input.publishingEnabled,false);
assert.ok(typeof input.clientSecret==='string'&&input.clientSecret.length>=16&&input.clientSecret.length<2048);
assert.ok(typeof input.clientId==='string'&&input.clientId.length>=6&&input.clientId.length<256);
const forbidden=new Set(['2012039306','1136950635489003','1732162668911193','617793839380-mgqbegh2hpe1ecd1e8p8ogl4bn46fub1.apps.googleusercontent.com','617793839380-hhsjjoi2rgkraf1oll20odtf4dt09mtq.apps.googleusercontent.com']);
assert.ok(!forbidden.has(input.clientId),'Do not reuse known existing Production/Preview credentials');
if(provider==='google'){assert.equal(input.projectId,'chatgun');assert.equal(input.origin,s.origin);assert.equal(input.status,'Testing');assert.match(input.clientId,/\.apps\.googleusercontent\.com$/);}
if(provider==='facebook'){assert.equal(input.status,'Development');assert.match(input.graphVersion,/^v\d+\.\d+$/);assert.equal(input.emailPermission,false);}
if(provider==='line'){assert.equal(input.status,'Developing');assert.equal(input.emailPermission,false);assert.equal(input.channelType,'LINE Login');assert.equal(input.webLogin,true);}
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function cf(path,body,method=body?'POST':'GET'){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+s.account+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),j=await r.json();assert.ok(r.ok&&j.success,'Scoped credential configuration failed');return j.result;}
assert.equal((await cf('')).id,s.account);
const p=await cf('/pages/projects/'+s.project),preview=p.deployment_configs.preview;
assert.equal(preview.d1_databases.DB.id,s.databaseId);assert.equal(preview.r2_buckets.MEDIA.name,s.bucket);
for(const k of['OAUTH_LOGIN_ENABLED','NEW_ACCOUNT_REGISTRATION_ENABLED','BETA_INVITATION_REGISTRATION_ENABLED','SOCIAL_APP_ENABLED','MEDIA_UPLOAD_ENABLED'])assert.equal(preview.env_vars[k].value,'false');
const upper=provider.toUpperCase(),idName=upper+'_CLIENT_ID',secretName=upper+'_CLIENT_SECRET';
assert.ok(!preview.env_vars[idName]&&!preview.env_vars[secretName],'Never overwrite/rotate an existing credential; inspect its creation metadata first');
const vars={...preview.env_vars,[idName]:{type:'secret_text',value:input.clientId},[secretName]:{type:'secret_text',value:input.clientSecret}};
if(provider==='line')vars.LINE_EXPECTED_CLIENT_ID={type:'secret_text',value:input.clientId};
if(provider==='facebook')vars.FACEBOOK_GRAPH_VERSION={type:'secret_text',value:input.graphVersion};
await cf('/pages/projects/'+s.project,{deployment_configs:{preview:{env_vars:vars}}},'PATCH');
const after=await cf('/pages/projects/'+s.project);for(const key of[idName,secretName])assert.equal(after.deployment_configs.preview.env_vars[key].type,'secret_text');
for(const [key,value] of Object.entries(preview.env_vars)){
 const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 assert.ok(digest(after.deployment_configs.preview.env_vars[key])===digest(value),'Existing UAT binding metadata changed');
}
for(const k of['OAUTH_LOGIN_ENABLED','NEW_ACCOUNT_REGISTRATION_ENABLED','BETA_INVITATION_REGISTRATION_ENABLED','SOCIAL_APP_ENABLED','MEDIA_UPLOAD_ENABLED'])assert.equal(after.deployment_configs.preview.env_vars[k].value,'false');
const root='docs/final-uat/oauth-access-setup';mkdirSync(root,{recursive:true});
writeFileSync(root+'/'+provider+'-credential-metadata.json',JSON.stringify({checkedAt:new Date().toISOString(),provider,callback:input.callback,clientIdSha256:createHash('sha256').update(input.clientId).digest('hex'),newCredentialConfirmed:true,encryptedPreviewIdAndSecret:true,publishing:false,admissionOpened:false,genuineOAuth:'NOT RUN',evidenceLimit:'Stored credentials do not prove OAuth callback or human login success',productionWrites:0},null,2)+'\n');
console.log(provider+' NEW UAT credentials stored encrypted; all admission/service flags remain closed. No credential values emitted.');
} catch {
 console.error('UAT credential import stopped safely. Check the protected input, explicit approval and scoped configuration privately; no credential/error payload emitted.');
 process.exitCode=1;
}
