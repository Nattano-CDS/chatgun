// Explicitly isolated staging only. Never changes the chatgun project or its databases.
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const account='23017b53386fb67fc62a52cdd017454c';
if(process.env.CHATGUN_ISOLATED_STAGING!=='issue13')throw Error('Explicit staging provision acknowledgement required');
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function api(path,method='GET',body){const r=await fetch('https://api.cloudflare.com/client/v4'+path,{method,headers:{Authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok||!d.success)throw Error('Cloudflare request failed: '+r.status+' '+(d.errors||[]).map(e=>e.code).join(','));return d.result;}
const accounts=await api('/accounts');if(!accounts.some(a=>a.id===account))throw Error('ChatGun account not authorized');
const base='/accounts/'+account;
let db=(await api(base+'/d1/database')).find(d=>d.name==='chatgun-issue13-staging');
if(!db)db=await api(base+'/d1/database','POST',{name:'chatgun-issue13-staging'});
if(['5bbfd55d-eb22-4324-8a7d-57bef14110ea','9738a051-d914-42d0-8e7b-8098ef2b959d'].includes(db.uuid))throw Error('Refusing existing protected database');
const buckets=await api(base+'/r2/buckets');
if(!buckets.buckets.some(b=>b.name==='chatgun-issue13-media'))await api(base+'/r2/buckets','POST',{name:'chatgun-issue13-media'});
const projects=await api(base+'/pages/projects');
let project=projects.find(p=>p.name==='chatgun-issue13-staging');
const vars={SOCIAL_APP_ENABLED:'true',PUBLIC_DISCOVERY_ENABLED:'true',MESSAGING_ENABLED:'true',MEDIA_UPLOAD_ENABLED:'true',MEDIA_QUARANTINE_ENABLED:'true',DEMO_MODE_ENABLED:'true',DEMO_AUTO_START_ENABLED:'true',ACCEPTANCE_FLOW_ENABLED:'false',ADULT_ONBOARDING_ENABLED:'false',MODERATION_TOOLS_ENABLED:'false',RATINGS_ENABLED:'true',SENSITIVE_CONTENT_ENABLED:'false',FRIEND_REQUESTS_ENABLED:'false',OAUTH_LOGIN_ENABLED:'false',NEW_ACCOUNT_REGISTRATION_ENABLED:'false',EMAIL_OTP_ENABLED:'false',MOBILE_OTP_ENABLED:'false',IDENTITY_VERIFICATION_ENABLED:'false'};
const env_vars=Object.fromEntries(Object.entries(vars).map(([k,value])=>[k,{type:'plain_text',value}]));
// Never rotate an existing secret on a repeat invocation.
if(!project)env_vars.RATE_LIMIT_PEPPER={type:'secret_text',value:randomBytes(32).toString('hex')};
const config={d1_databases:{DB:{id:db.uuid}},r2_buckets:{MEDIA:{name:'chatgun-issue13-media'}},env_vars,compatibility_date:'2026-10-15',compatibility_flags:[]};
if(!project)project=await api(base+'/pages/projects','POST',{name:'chatgun-issue13-staging',production_branch:'isolated-staging-only',deployment_configs:{preview:config,production:config}});
const actual=await api(base+'/pages/projects/chatgun-issue13-staging');
if(actual.deployment_configs.preview.d1_databases.DB.id!==db.uuid||actual.deployment_configs.preview.r2_buckets.MEDIA.name!=='chatgun-issue13-media')throw Error('Isolated binding mismatch');
console.log(JSON.stringify({account,database:db.name,databaseId:db.uuid,bucket:'chatgun-issue13-media',project:actual.name,vars},null,2));
