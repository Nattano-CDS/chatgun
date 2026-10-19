// Local simulated provider responses only. Never evidence of genuine LINE Login.
import test from 'node:test';
import assert from 'node:assert/strict';
import {providerConfiguration,verifyProviderIdentity,exchangeCode} from '../functions/_lib/oauth.js';
import {onRequest} from '../functions/api/auth/[[path]].js';
import {TestD1,environment,jsonRequest,cookieValue} from './helpers/d1.js';
import {sha256} from '../functions/_lib/crypto.js';
const now=1800000000,nonce='local-unit-nonce';
const config=()=>providerConfiguration('line',{LINE_CLIENT_ID:'unit-channel',LINE_CLIENT_SECRET:'unit-secret',LINE_EMAIL_ENABLED:'false'});
const claims=()=>({iss:'https://access.line.me',aud:'unit-channel',nonce,iat:now-5,exp:now+300,sub:'unit-only-subject',name:'unit fixture'});
function mockFetch(t,implementation){const original=globalThis.fetch;globalThis.fetch=implementation;t.after(()=>{globalThis.fetch=original;});}
test('LINE minimal configuration keeps email out and requires PKCE',()=>{
  const c=config();assert.equal(c.scope,'openid profile');assert.equal(c.pkce,true);
  assert.equal(c.authorizationUrl,'https://access.line.me/oauth2/v2.1/authorize');
});
test('LINE delegates signature verification to the official endpoint with audience and nonce, discarding unrequested email',async t=>{
  mockFetch(t,async(url,init)=>{
    assert.equal(url,'https://api.line.me/oauth2/v2.1/verify');assert.equal(init.method,'POST');
    assert.equal(init.body.get('client_id'),'unit-channel');assert.equal(init.body.get('nonce'),nonce);
    assert.equal(init.body.get('id_token'),'unit-id-token');assert.equal(init.body.has('client_secret'),false);
    return Response.json({...claims(),email:'discard@example.invalid'});
  });
  const identity=await verifyProviderIdentity('line',config(),{id_token:'unit-id-token'},nonce,now);
  assert.equal(identity.email,null);assert.equal(identity.emailVerified,false);
});
test('LINE rejects missing, nonnumeric, expired, future and mismatched verified claims',async t=>{
  let payload;mockFetch(t,async()=>Response.json(payload));
  const invalid=[{exp:undefined},{exp:null},{exp:'not-a-date'},{exp:String(now+300)},{exp:now},{exp:now-1},{exp:now+0.5},{iat:undefined},{iat:null},{iat:'invalid'},{iat:now+61},{iat:now+300},{iat:0},{aud:'wrong-channel'},{iss:'https://attacker.invalid'},{nonce:'different'},{nonce:undefined},{sub:''},{sub:' '},{sub:'x'.repeat(256)}];
  for(const patch of invalid){payload={...claims(),...patch};await assert.rejects(verifyProviderIdentity('line',config(),{id_token:'unit-id-token'},nonce,now),/invalid_line_id_token/);}
});
test('LINE rejects provider verification errors and malformed responses without trusting decoded claims',async t=>{
  let response;mockFetch(t,async()=>response);
  for(const value of [Response.json({error:'invalid_request'}, {status:400}),Response.json({...claims()},{status:401}),new Response('not-json',{status:200})]){
    response=value;await assert.rejects(verifyProviderIdentity('line',config(),{id_token:'unit-id-token'},nonce,now),/invalid_line_id_token/);
  }
  await assert.rejects(verifyProviderIdentity('line',config(),{},nonce,now),/missing_id_token/);
});
test('LINE token exchange submits exact callback and PKCE verifier server-side',async t=>{
  mockFetch(t,async(url,init)=>{
    assert.equal(url,'https://api.line.me/oauth2/v2.1/token');assert.equal(init.method,'POST');
    assert.equal(init.body.get('grant_type'),'authorization_code');
    assert.equal(init.body.get('redirect_uri'),'https://unit.invalid/api/auth/oauth/line/callback');
    assert.equal(init.body.get('code_verifier'),'unit-pkce-verifier');
    assert.equal(init.body.get('client_secret'),'unit-secret');return Response.json({access_token:'unit-access',id_token:'unit-id'});
  });
  await exchangeCode('line',config(),'unit-code','https://unit.invalid/api/auth/oauth/line/callback','unit-pkce-verifier');
});
async function start(database){
  const env=environment(database);
  const response=await onRequest({env,request:jsonRequest('/api/auth/oauth/line/start',{turnstileToken:'unit-turnstile'})});
  assert.equal(response.status,200);const authorization=new URL((await response.json()).authorizationUrl);
  assert.equal(authorization.searchParams.get('scope'),'openid profile');
  assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
  const state=authorization.searchParams.get('state'),cookie=cookieValue(response,'__Host-cg_oauth');
  assert.ok(state&&authorization.searchParams.get('nonce'));assert.match(response.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Lax/);
  const request=query=>new Request('https://chatgun.pages.dev/api/auth/oauth/line/callback?'+query,{headers:{cookie:'__Host-cg_oauth='+encodeURIComponent(cookie)}});
  return {env,state,request};
}
test('LINE missing/invalid state, cancellation, replay and expiry fail safely without accounts or sessions',async t=>{
  mockFetch(t,async()=>Response.json({success:true,hostname:'chatgun.pages.dev',action:'auth_start'}));
  const database=new TestD1();t.after(()=>database.close());
  const {env,state,request}=await start(database);
  for(const query of ['code=unit-code','state=invalid&code=unit-code']){
    const r=await onRequest({env,request:request(query)});assert.match(r.headers.get('location'),/invalid_state/);
  }
  let r=await onRequest({env,request:request(new URLSearchParams({state,error:'access_denied'}))});assert.match(r.headers.get('location'),/provider_denied/);
  r=await onRequest({env,request:request(new URLSearchParams({state,error:'access_denied'}))});assert.match(r.headers.get('location'),/oauth_expired/);
  const second=await start(database);
  database.database.prepare('UPDATE oauth_flows SET created_at=0, expires_at=1 WHERE state_hash=?').run(await sha256(second.state));
  r=await onRequest({env,request:second.request(new URLSearchParams({state:second.state,code:'unit-code'}))});assert.match(r.headers.get('location'),/oauth_expired/);
  assert.equal(database.database.prepare('SELECT COUNT(*) n FROM users').get().n,0);assert.equal(database.database.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);
});
