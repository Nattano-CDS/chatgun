// Protect only the explicitly identified, newly created UAT Google download.
import {readFileSync,writeFileSync,mkdirSync,chmodSync,renameSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
try {
  assert.equal(process.env.CHATGUN_FINAL_UAT,'approved');
  const source=(()=>{const file=process.env.CHATGUN_UAT_GOOGLE_CLIENT_SECRET_FILE;if(!file)throw new Error('CHATGUN_UAT_GOOGLE_CLIENT_SECRET_FILE is required');return file;})();
  const root=(()=>{const value=process.env.CHATGUN_PRIVATE_ROOT;if(!value)throw new Error('CHATGUN_PRIVATE_ROOT is required');return value;})();
  const destination=root+'/uat-provider-google-20261024.json';
  assert.ok(!existsSync(destination),'Do not overwrite a private credential');
  chmodSync(source,0o600);
  const {web}=JSON.parse(readFileSync(source));
  const origin='https://uat.chatgun-final-uat.pages.dev';
  const callback=origin+'/api/auth/oauth/google/callback';
  assert.equal(web.project_id,'chatgun');
  assert.equal(web.client_id,'617793839380-nv8kjlbdobmjs24btpgtv4ghkrujhd0k.apps.googleusercontent.com');
  assert.deepEqual(web.redirect_uris,[callback]);
  assert.deepEqual(web.javascript_origins,[origin]);
  assert.ok(web.client_secret?.length>=16);
  mkdirSync(root,{recursive:true,mode:0o700});
  writeFileSync(destination,JSON.stringify({scope:'new-dedicated-chatgun-uat',provider:'google',callback,newCredentialConfirmed:true,publishingEnabled:false,clientId:web.client_id,clientSecret:web.client_secret,projectId:web.project_id,origin,status:'Testing'}),{mode:0o600,flag:'wx'});
  renameSync(source,root+'/uat-provider-google-20261024-original.json');
  console.log('New UAT Google credential protected; no values emitted.');
} catch {
  console.error('Private download protection stopped safely; inspect exact source and protected destination privately.');
  process.exitCode=1;
}
