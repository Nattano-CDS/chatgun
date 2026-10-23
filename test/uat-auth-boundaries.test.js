import test from 'node:test';
import assert from 'node:assert/strict';
import {TestD1,environment,cookieValue} from './helpers/d1.js';
import {issueSession,getSession} from '../functions/_lib/db.js';
import {enabledOAuthProviders} from '../functions/_lib/oauth-provider-gates.js';
import {onRequest} from '../functions/api/auth/[[path]].js';
import {spawnSync} from 'node:child_process';
import {finalUatRolePlan} from '../scripts/lib/final-uat-role-plan.mjs';

test('UAT-only role plan rejects Production, permanent duration and broad role administration',()=>{
 const p={database:'e3cb426c-b88a-4b93-90fd-39df524f68ae',userId:'11111111-1111-4111-8111-111111111111',now:10000,expiresAt:20800,roles:['report_reviewer','safety_admin'],ids:['grant1','event1','grant2','event2']};
 const statements=finalUatRolePlan(p);assert.equal(statements.length,4);assert.ok(statements[0].sql.includes('authenticated_at>=?-600'));assert.ok(statements[0].sql.includes('member_age_safety_holds'));assert.ok(statements[0].sql.includes('beta_enrollments'));
 assert.throws(()=>finalUatRolePlan({...p,database:'9738a051-d914-42d0-8e7b-8098ef2b959d'}));assert.throws(()=>finalUatRolePlan({...p,expiresAt:null}));assert.throws(()=>finalUatRolePlan({...p,expiresAt:p.now+86400}));assert.throws(()=>finalUatRolePlan({...p,roles:['moderation_admin']}));
});

test('private credential importer fails closed with sanitized errors before credential/API access',()=>{
 const r=spawnSync(process.execPath,['scripts/store-final-uat-provider.mjs','google'],{encoding:'utf8',env:{...process.env,CHATGUN_FINAL_UAT:'not-approved',CHATGUN_UAT_NEW_CREDENTIAL_FILE:'/must-not-read-private-credential-input'}});
 assert.equal(r.status,1);assert.equal(r.stdout,'');assert.ok(r.stderr.includes('stopped safely'));assert.ok(!r.stderr.includes('must-not-read-private-credential-input'));assert.ok(!r.stderr.includes('AssertionError'));
});

test('provisioned UAT credentials cannot override the closed OAuth/admission flags',async()=>{
 const db=new TestD1();try{const env={...environment(db),OAUTH_LOGIN_ENABLED:'false',OAUTH_ENABLED_PROVIDERS:'google,facebook,line',NEW_ACCOUNT_REGISTRATION_ENABLED:'false',BETA_INVITATION_REGISTRATION_ENABLED:'false'};
 assert.deepEqual(enabledOAuthProviders(env),[]);
 const r=await onRequest({env,request:new Request('https://uat.chatgun-final-uat.pages.dev/api/auth/config')});
 const c=await r.json();assert.equal(c.oauthLoginEnabled,false);assert.deepEqual(c.oauthProviders,[]);assert.equal(c.newAccountRegistrationEnabled,false);assert.equal(c.invitationOnlyRegistrationEnabled,false);
 }finally{db.close();}
});

test('a session in one isolated database cannot authenticate against a second environment',async()=>{
 const a=new TestD1(),b=new TestD1(),now=Math.floor(Date.now()/1000),id='isolated-session-boundary';
 try{await a.prepare("INSERT INTO users(id,display_name,status,created_at,updated_at)VALUES(?,'Isolated test','active',?,?)").bind(id,now,now).run();
 const s=await issueSession(a,id,now),r=new Request('https://uat.chatgun-final-uat.pages.dev/api/auth/me',{headers:{cookie:'__Host-cg_session='+s.token}});
 assert.ok(await getSession(r,a,now));assert.equal(await getSession(r,b,now),null);
 for(const cookie of s.cookies){assert.ok(cookie.includes('Secure')&&cookie.includes('Path=/')&&cookie.includes('SameSite=Lax'));assert.ok(!cookie.includes('Domain='));}
 assert.ok(s.cookies[0].includes('HttpOnly'));assert.equal((await b.prepare('SELECT COUNT(*) n FROM sessions').first()).n,0);
 }finally{a.close();b.close();}
});

test('an OAuth flow and copied state cookie cannot cross isolated D1 environments',async()=>{
 const a=new TestD1(),b=new TestD1(),originalFetch=globalThis.fetch,origin='https://uat.chatgun-final-uat.pages.dev';
 try{
  const envA={...environment(a),OAUTH_LOGIN_ENABLED:'true',OAUTH_ENABLED_PROVIDERS:'google',NEW_ACCOUNT_REGISTRATION_ENABLED:'false'},envB={...envA,DB:b};let verificationCalls=0;
  globalThis.fetch=async url=>{assert.equal(String(url),'https://challenges.cloudflare.com/turnstile/v0/siteverify');verificationCalls++;return Response.json({success:true,hostname:new URL(origin).hostname,action:'auth_start'});};
  const start=await onRequest({env:envA,request:new Request(origin+'/api/auth/oauth/google/start',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({turnstileToken:'synthetic-negative-boundary-token'})})});assert.equal(start.status,200);
  const state=cookieValue(start,'__Host-cg_oauth');assert.ok(state);
  const callback=await onRequest({env:envB,request:new Request(origin+'/api/auth/oauth/google/callback?code=synthetic-unused-code&state='+encodeURIComponent(state),{headers:{cookie:'__Host-cg_oauth='+state}})});
  assert.equal(callback.status,303);assert.equal(callback.headers.get('location'),'/signup.html?auth_error=oauth_expired');assert.equal(verificationCalls,1,'No provider exchange is allowed after a foreign flow');
  assert.equal((await b.prepare('SELECT COUNT(*) n FROM users').first()).n,0);assert.equal((await b.prepare('SELECT COUNT(*) n FROM sessions').first()).n,0);assert.equal((await a.prepare('SELECT COUNT(*) n FROM oauth_flows').first()).n,1);
 }finally{globalThis.fetch=originalFetch;a.close();b.close();}
});
