// Store verified UAT verifier metadata only. This cannot map an owner or grant roles.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
try {
  assert.equal(process.env.CHATGUN_FINAL_UAT,'approved');
  const s=JSON.parse(readFileSync('docs/final-uat/environment.json'));
  assert.equal(s.account,'23017b53386fb67fc62a52cdd017454c');
  assert.equal(s.project,'chatgun-final-uat');
  assert.equal(s.databaseId,'e3cb426c-b88a-4b93-90fd-39df524f68ae');
  const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
  async function cf(path,body){
    const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+s.account+path,{method:body?'PATCH':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const j=await r.json();assert.ok(r.ok&&j.success);return j.result;
  }
  assert.equal((await cf('')).id,s.account);
  const before=await cf('/pages/projects/'+s.project);
  const preview=before.deployment_configs.preview;
  assert.equal(preview.d1_databases.DB.id,s.databaseId);
  assert.equal(preview.r2_buckets.MEDIA.name,s.bucket);
  const closed=['OAUTH_LOGIN_ENABLED','NEW_ACCOUNT_REGISTRATION_ENABLED','BETA_INVITATION_REGISTRATION_ENABLED','SOCIAL_APP_ENABLED','MEDIA_UPLOAD_ENABLED','MODERATION_TOOLS_ENABLED','ADMIN_ACCESS_STANDALONE_ENABLED'];
  for(const k of closed)assert.equal(preview.env_vars[k].value,'false');
  assert.equal(preview.env_vars.ADMIN_CLOUDFLARE_ACCESS_REQUIRED.value,'true');
  assert.ok(!preview.env_vars.ADMIN_ACCESS_OWNER_USER_ID);
  const metadata={ADMIN_ACCESS_ISSUER:'https://tiny-violet-2021.cloudflareaccess.com',ADMIN_ACCESS_AUDIENCE:'8088041f16940a90a6be75ce895613fff4fcdfaf4cb076d164138867e4709dbc',ADMIN_ACCESS_EMAIL:'natttano@outlook.com'};
  for(const k of Object.keys(metadata))assert.ok(!preview.env_vars[k],'Do not silently overwrite verifier settings');
  const env_vars={...preview.env_vars,...Object.fromEntries(Object.entries(metadata).map(([k,value])=>[k,{type:'secret_text',value}]))};
  await cf('/pages/projects/'+s.project,{deployment_configs:{preview:{env_vars}}});
  const after=await cf('/pages/projects/'+s.project);
  assert.deepEqual(after.deployment_configs.production,before.deployment_configs.production);
  const vars=after.deployment_configs.preview.env_vars;
  for(const k of Object.keys(metadata))assert.equal(vars[k].type,'secret_text');
  for(const [k,v] of Object.entries(preview.env_vars))assert.deepEqual(vars[k],v);
  for(const k of closed)assert.equal(vars[k].value,'false');
  assert.ok(!vars.ADMIN_ACCESS_OWNER_USER_ID);
  writeFileSync('docs/final-uat/oauth-access-setup/access-verifier-metadata.json',JSON.stringify({checkedAt:new Date().toISOString(),project:s.project,applicationId:'c2c866d3-3d41-410b-909f-4beac2683a17',policyId:'8fbef132-a338-4ec4-8c7e-94b29749e0d6',issuer:metadata.ADMIN_ACCESS_ISSUER,audience:metadata.ADMIN_ACCESS_AUDIENCE,encryptedPreviewMetadata:true,ownerUuidMapped:false,adminEnabled:false,roleGrants:0,productionConfigUnchanged:true,genuineMfa:'NOT RUN',independentOrganizationMfa:'OFF'},null,2)+'\n');
  console.log('Verified UAT Access metadata stored encrypted; no UUID mapping, roles or activation.');
} catch {
  console.error('UAT Access metadata save stopped safely; inspect scoped configuration privately.');
  process.exitCode=1;
}
