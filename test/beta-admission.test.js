import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {enabledOAuthProviders} from '../functions/_lib/oauth-provider-gates.js';
import {onRequest} from '../functions/api/auth/[[path]].js';
import {providerConfiguration,verifyProviderIdentity} from '../functions/_lib/oauth.js';
function helper(){const window={};vm.runInNewContext(readFileSync('beta-admission.js','utf8'),{window,URL,URLSearchParams});return window.ChatgunBetaAdmission;}
const token='A'.repeat(43);
test('private invitation is captured from fragment and immediately removed from history',()=>{
  const api=helper();let replaced;const value=api.capture({href:'https://chatgun.social/signup?next=account#invite='+token},{state:{test:1},replaceState:(...args)=>replaced=args});
  assert.equal(value.code,token);assert.equal(replaced[2],'/signup?next=account');
  assert.equal(JSON.stringify(replaced).includes(token),false);
  assert.doesNotMatch(readFileSync('beta-admission.js','utf8'),/\.setItem\(|document\.cookie/);
});
test('malformed, duplicate and URL-query invitations are rejected and scrubbed',()=>{
  for(const suffix of ['#invite=bad','#invite='+token+'&invite='+token,'?invite='+token+'#invite='+token]){
    let destination;const value=helper().capture({href:'https://chatgun.social/signup'+suffix},{state:null,replaceState:(_,__,url)=>destination=url});
    assert.equal(value.code,null);assert.equal(value.error,'invitation_invalid');assert.equal(destination,'/signup');
  }
});
test('invitation cannot be attached when login/admission is closed or public registration is open',()=>{
  const api=helper(),admission={code:token};
  for(const config of [{},{oauthLoginEnabled:false,invitationOnlyRegistrationEnabled:true,newAccountRegistrationEnabled:false},{oauthLoginEnabled:true,invitationOnlyRegistrationEnabled:false,newAccountRegistrationEnabled:false},{oauthLoginEnabled:true,invitationOnlyRegistrationEnabled:true,newAccountRegistrationEnabled:true}])assert.equal(Object.keys(api.requestFields(admission,config)).length,0);
  assert.equal(api.requestFields(admission,{oauthLoginEnabled:true,invitationOnlyRegistrationEnabled:true,newAccountRegistrationEnabled:false}).invitationCode,token);
});
test('per-provider allowlist is enforced on config, initiation and callbacks before credentials or D1',async()=>{
  const env={OAUTH_LOGIN_ENABLED:'true',OAUTH_ENABLED_PROVIDERS:'google, unknown,GOOGLE'};
  assert.deepEqual(enabledOAuthProviders(env),['google']);assert.deepEqual(enabledOAuthProviders({...env,OAUTH_ENABLED_PROVIDERS:''}),[]);
  assert.deepEqual(enabledOAuthProviders({...env,OAUTH_LOGIN_ENABLED:'false'}),[]);
  const config=await(await onRequest({env,request:new Request('https://chatgun.social/api/auth/config')})).json();assert.deepEqual(config.oauthProviders,['google']);
  for(const provider of ['facebook','line']){
    const start=await onRequest({env,request:new Request(`https://chatgun.social/api/auth/oauth/${provider}/start`,{method:'POST',headers:{origin:'https://chatgun.social','content-type':'application/json'},body:'{}'})});assert.equal(start.status,503);
    const callback=await onRequest({env,request:new Request(`https://chatgun.social/api/auth/oauth/${provider}/callback?code=untrusted&state=untrusted`)});assert.equal(callback.status,303);assert.match(callback.headers.get('location'),/oauth_unavailable/);
  }
});

test('Facebook minimal scope does not request or retain email without separately approved permission',async t=>{
  const config=providerConfiguration('facebook',{FACEBOOK_CLIENT_ID:'test-app',FACEBOOK_CLIENT_SECRET:'test-secret',FACEBOOK_GRAPH_VERSION:'v24.0'});
  assert.equal(config.scope,'public_profile');
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async input=>{
    const url=new URL(input);
    if(url.pathname.endsWith('/debug_token'))return Response.json({data:{is_valid:true,app_id:config.clientId,user_id:'test-subject',expires_at:9999999999}});
    assert.equal(url.searchParams.get('fields'),'id,name,picture');assert.ok(url.searchParams.get('appsecret_proof'));
    return Response.json({id:'test-subject',name:'component test',email:'do-not-retain@example.invalid'});
  };
  const identity=await verifyProviderIdentity('facebook',config,{access_token:'component-test-token'},null,1);
  assert.equal(identity.email,null);assert.equal(identity.emailVerified,false);
});
