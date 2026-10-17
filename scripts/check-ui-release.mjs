// Read-only release gates. Print/store only allowlisted flags and binding IDs.
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const account='23017b53386fb67fc62a52cdd017454c';
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function api(path,options={}){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{...options,headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'}});const d=await r.json();if(!r.ok||!d.success)throw Error('Cloudflare read-only check failed');return d.result;}
const p=await api('/pages/projects/chatgun'),prod=p.deployment_configs.production,preview=p.deployment_configs.preview;
const prodDb=prod.d1_databases?.DB?.id,previewDb=preview.d1_databases?.DB?.id;
if(prodDb!=='9738a051-d914-42d0-8e7b-8098ef2b959d'||previewDb!=='5bbfd55d-eb22-4324-8a7d-57bef14110ea')throw Error('Database isolation mismatch');
if(Object.keys(prod.r2_buckets||{}).length||preview.r2_buckets?.MEDIA?.name!=='chatgun-media-staging')throw Error('R2 isolation mismatch');
const disabled=['OAUTH_LOGIN_ENABLED','SOCIAL_APP_ENABLED','NEW_ACCOUNT_REGISTRATION_ENABLED','MEDIA_UPLOAD_ENABLED','MODERATION_TOOLS_ENABLED','SENSITIVE_CONTENT_ENABLED','FRIEND_REQUESTS_ENABLED','PUBLIC_DISCOVERY_ENABLED','MESSAGING_ENABLED','RATINGS_ENABLED','IDENTITY_VERIFICATION_ENABLED','EMAIL_OTP_ENABLED','MOBILE_OTP_ENABLED'];
const flags=Object.fromEntries(disabled.map(k=>[k,prod.env_vars?.[k]?.value]));
if(Object.values(flags).some(v=>v!=='false'))throw Error('Production shutdown gates changed');
for(const k of ['DEMO_MODE_ENABLED','DEMO_AUTO_START_ENABLED','PUBLIC_DEMO_CANARY_ENABLED']){flags[k]=prod.env_vars?.[k]?.value;if(flags[k]!=='true')throw Error('Public-fiction isolation missing');}
const domain=(await api('/pages/projects/chatgun/domains')).find(d=>d.name==='chatgun.social');
if(domain?.status!=='active')throw Error('Custom domain not active');
const fk=await api(`/d1/database/${prodDb}/query`,{method:'POST',body:JSON.stringify({sql:'SELECT count(*) AS violations FROM pragma_foreign_key_check'})});
if(fk[0].results[0].violations!==0||fk[0].meta?.changed_db)throw Error('D1 integrity check failed');
const evidence={checkedAt:new Date().toISOString(),account,project:p.name,domain:domain.status,productionD1:prodDb,previewD1:previewDb,productionR2Bindings:0,previewR2:preview.r2_buckets.MEDIA.name,productionFlags:flags,canonicalDeployment:{id:p.canonical_deployment?.id,sha:p.canonical_deployment?.deployment_trigger?.metadata?.commit_hash,status:p.canonical_deployment?.latest_stage?.status},foreignKeyViolations:0,databaseWrites:0,originalAndStagingDataMutations:'none'};
const output=process.env.RELEASE_EVIDENCE_DIR||'docs/issue-10-components';await mkdir(output,{recursive:true});await writeFile(output+'/infrastructure-check.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
