import assert from 'node:assert/strict';
import test from 'node:test';
import { base64Url } from '../functions/_lib/crypto.js';
import { requireCloudflareAdminAccess, verifyCloudflareAccessJwt, cloudflareAdminPrincipal, cloudflareAdminAccessConfiguration } from '../functions/_lib/cloudflare-admin-access.js';
import { issueSession, unixTime } from '../functions/_lib/db.js';
import { onRequest } from '../functions/api/social/[[path]].js';
import { onRequest as adminRequest } from '../functions/api/admin/[[path]].js';
import { onRequest as authRequest } from '../functions/api/auth/[[path]].js';
import { adminAccessFailureCategory, cleanupAdminAccessSessions } from '../functions/_lib/cloudflare-admin-session.js';
import { environment, TestD1 } from './helpers/d1.js';

// Locally generated test-only signing key. Never a Cloudflare or owner token.
const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'local-access-fixture', alg: 'RS256', use: 'sig' };
const jwks = { keys: [jwk] };
const config = { issuer: 'https://chatgun-local-test.cloudflareaccess.com', audience: 'a'.repeat(64), email: 'owner@example.test', userId: '11111111-1111-4111-8111-111111111111' };
const envConfig = { ADMIN_CLOUDFLARE_ACCESS_REQUIRED: 'true', ADMIN_ACCESS_ISSUER: config.issuer,
  ADMIN_ACCESS_AUDIENCE: config.audience, ADMIN_ACCESS_EMAIL: config.email, ADMIN_ACCESS_OWNER_USER_ID: config.userId };
const now = unixTime();
const claims = { iss: config.issuer, aud: [config.audience], type: 'app', sub: 'local-owner-subject',
  email: config.email, iat: now - 5, nbf: now - 5, exp: now + 1800 };
async function signed(payload = {}, header = {}) {
  const encoded = value => base64Url(new TextEncoder().encode(JSON.stringify(value)));
  const body = `${encoded({ alg: 'RS256', kid: jwk.kid, ...header })}.${encoded({ ...claims, ...payload })}`;
  return `${body}.${base64Url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(body)))}`;
}

test('Access verifier accepts only a correctly signed owner application token and returns no email', async () => {
  assert.deepEqual(await verifyCloudflareAccessJwt(await signed(), config, jwks, now), { subject: claims.sub, expiresAt: claims.exp, authenticatedAt: null });
});

test('Access rejects wrong issuer/audience/email, expired/missing/non-numeric timestamps and service/org tokens', async () => {
  for (const patch of [
    { iss: 'https://attacker.cloudflareaccess.com' }, { aud: ['b'.repeat(64)] }, { email: 'other@example.test' },
    { exp: now }, { exp: undefined }, { exp: 'tomorrow' }, { iat: now + 1 }, { iat: undefined },
    { nbf: now + 1 }, { nbf: 'yesterday' }, { type: 'org' }, { email: undefined, sub: '' }, { sub: null },
  ]) await assert.rejects(verifyCloudflareAccessJwt(await signed(patch), config, jwks, now));
});

test('Access rejects unsigned/algorithm-confused/unknown-key/crit/tampered tokens', async () => {
  for (const header of [{ alg: 'none' }, { alg: 'HS256' }, { kid: 'unknown' }, { crit: ['unknown'] }, { b64: false }]) {
    await assert.rejects(verifyCloudflareAccessJwt(await signed({}, header), config, jwks, now));
  }
  const original = await signed();
  const parts = original.split('.');
  parts[1] = base64Url(new TextEncoder().encode(JSON.stringify({ ...claims, sub: 'tampered' })));
  await assert.rejects(verifyCloudflareAccessJwt(parts.join('.'), config, jwks, now));
  for (const token of ['', 'invalid', 'a.b.c', 'x'.repeat(16385), null]) {
    await assert.rejects(verifyCloudflareAccessJwt(token, config, jwks, now));
  }
});

test('Access opt-in rejects partial/invalid configuration and plain spoofed email headers without a key fetch', async () => {
  const r = new Request('https://chatgun.pages.dev/api/social/moderation/overview', { headers: { 'cf-access-authenticated-user-email': config.email } });
  await requireCloudflareAdminAccess(r, {}, { user_id: config.userId });
  for (const overrides of [
    { ADMIN_ACCESS_ISSUER: '' }, { ADMIN_ACCESS_ISSUER: 'https://evil.test' }, { ADMIN_ACCESS_ISSUER: `${config.issuer}/path` },
    { ADMIN_ACCESS_AUDIENCE: '' }, { ADMIN_ACCESS_EMAIL: '' }, { ADMIN_ACCESS_OWNER_USER_ID: '' },
    { ADMIN_CLOUDFLARE_ACCESS_REQUIRED: 'TRUE' }, {},
  ]) await assert.rejects(requireCloudflareAdminAccess(r, { ...envConfig, ...overrides }, { user_id: config.userId }));
  await assert.rejects(requireCloudflareAdminAccess(r, envConfig, { user_id: 'different-user' }));
});

test('Production and standalone administration require complete Access configuration and never fall back to member auth', async () => {
  for (const env of [
    { DEPLOYMENT_ENVIRONMENT: 'production' },
    { DEPLOYMENT_ENVIRONMENT: 'production', ADMIN_CLOUDFLARE_ACCESS_REQUIRED: 'false' },
    { ADMIN_ACCESS_STANDALONE_ENABLED: 'true' },
    { ADMIN_ACCESS_STANDALONE_ENABLED: 'true', ADMIN_CLOUDFLARE_ACCESS_REQUIRED: 'false' },
  ]) assert.throws(() => cloudflareAdminAccessConfiguration(env));
  assert.throws(() => cloudflareAdminAccessConfiguration({ DEPLOYMENT_ENVIRONMENT: 'prod' }));
  assert.equal(cloudflareAdminAccessConfiguration({ DEPLOYMENT_ENVIRONMENT: 'preview' }), null);
  assert.deepEqual(cloudflareAdminAccessConfiguration({ ...envConfig, DEPLOYMENT_ENVIRONMENT: 'production' }), config);
});

test('Access validates real handler RBAC, audit, CSRF and revocation without granting roles from an email', async () => {
  const db = new TestD1();
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `${config.issuer}/cdn-cgi/access/certs`);
    assert.equal(options.redirect, 'manual');
    fetches++;
    return Response.json(jwks);
  };
  try {
    await db.prepare("INSERT INTO users(id,display_name,status,created_at,updated_at)VALUES(?,'Local owner','active',?,?)").bind(config.userId, now, now).run();
    await db.prepare("INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at)VALUES('access-age',?,'adult_18_plus','self_declaration','v1',?)").bind(config.userId, now).run();
    await db.prepare("INSERT INTO member_profiles(user_id,age_assurance_id,name,created_at,updated_at)VALUES(?,'access-age','Local owner',?,?)").bind(config.userId, now, now).run();
    const session = await issueSession(db, config.userId, now);
    const env = { ...environment(db), ...envConfig, SOCIAL_APP_ENABLED: 'true', MODERATION_TOOLS_ENABLED: 'true' };
    const token = await signed();
    const request = (path, jwt = token, options = {}) => new Request(`https://chatgun.pages.dev/api/social/moderation/${path}`, {
      ...options, headers: { cookie: `__Host-cg_session=${session.token}; __Host-cg_csrf=${session.csrf}`,
        ...(jwt ? { 'cf-access-jwt-assertion': jwt } : {}), ...(options.headers || {}) },
    });
    assert.equal((await onRequest({ env, request: request('overview') })).status, 403, 'Access never grants a D1 role');
    await db.prepare("INSERT INTO moderation_access_grants(id,user_id,role,grant_reason,granted_at,expires_at)VALUES('local-access-grant',?,'safety_admin','Local test only',?,?)").bind(config.userId, now, now + 3600).run();
    assert.equal((await onRequest({ env: { ...env, DEPLOYMENT_ENVIRONMENT: 'production', ADMIN_CLOUDFLARE_ACCESS_REQUIRED: 'false' }, request: request('overview') })).status, 403,
      'Production must not fall back to a member session when Access is disabled');
    assert.equal((await onRequest({ env, request: request('overview', null) })).status, 403);
    assert.equal((await onRequest({ env, request: request('capabilities', null) })).status, 403);
    assert.equal((await onRequest({ env, request: request('overview') })).status, 200);
    const audit = await db.prepare('SELECT purpose FROM media_safety_audit_events').first();
    assert.equal(audit.purpose, 'routine_admin_dashboard_access');
    assert.equal((await onRequest({ env, request: request('reports', token, { method: 'POST', headers: { origin: 'https://chatgun.pages.dev', 'content-type': 'application/json' }, body: '{}' }) })).status, 403, 'CSRF still required');
    await db.prepare("UPDATE moderation_access_grants SET revoked_at=?,revocation_reason='Local test revocation' WHERE id='local-access-grant'").bind(now).run();
    assert.equal((await onRequest({ env, request: request('overview') })).status, 403, 'A valid Access token cannot revive revoked roles');
    assert.equal(fetches, 1, 'keys are cached, never loaded from token-supplied URLs');
  } finally { globalThis.fetch = originalFetch; db.close(); }
});

test('Access key service outages fail closed; a token cannot supply an alternate certificate URL', async () => {
  const originalFetch = globalThis.fetch;
  const issuer = 'https://chatgun-outage-test.cloudflareaccess.com';
  const token = await signed({ iss: issuer }, { jku: 'https://attacker.example.test/certs' });
  const r = new Request('https://chatgun.pages.dev/api/social/moderation/overview', { headers: { 'cf-access-jwt-assertion': token } });
  try {
    globalThis.fetch = async url => { assert.equal(url, `${issuer}/cdn-cgi/access/certs`); return new Response('unavailable', { status: 503 }); };
    await assert.rejects(requireCloudflareAdminAccess(r, { ...envConfig, ADMIN_ACCESS_ISSUER: issuer }, { user_id: config.userId }),
      error => error.message === 'access_jwks_fetch_failed');
  } finally { globalThis.fetch = originalFetch; }
});

test('Access JWKS diagnostics distinguish fetch, payload, missing-key and verifier runtime failures', async () => {
  const originalFetch = globalThis.fetch;
  const principal = async (name, response) => {
    const issuer = `https://chatgun-jwks-${name}.cloudflareaccess.com`;
    const token = await signed({ iss: issuer });
    globalThis.fetch = async url => {
      assert.equal(url, `${issuer}/cdn-cgi/access/certs`);
      if (response instanceof Error) throw response;
      return response;
    };
    return cloudflareAdminPrincipal(new Request('https://chatgun.pages.dev/api/admin/session', {
      headers: { 'cf-access-jwt-assertion': token },
    }), { ...envConfig, ADMIN_ACCESS_ISSUER: issuer });
  };
  try {
    await assert.rejects(principal('timeout', new DOMException('Timed out', 'TimeoutError')),
      error => error.message === 'access_jwks_fetch_failed');
    await assert.rejects(principal('http', new Response('', { status: 503 })),
      error => error.message === 'access_jwks_fetch_failed');
    await assert.rejects(principal('redirect', new Response('', { status: 302, headers: { location: 'https://other.example.test/' } })),
      error => error.message === 'access_jwks_redirect_failed');
    await assert.rejects(principal('json', new Response('{', { headers: { 'content-type': 'application/json' } })),
      error => error.message === 'access_jwks_invalid_payload');
    await assert.rejects(principal('shape', Response.json({ keys: 'not-an-array' })),
      error => error.message === 'access_jwks_invalid_payload');
    await assert.rejects(principal('key-shape', Response.json({ keys: [{ ...jwk, n: '' }] })),
      error => error.message === 'access_jwks_invalid_payload');
    await assert.rejects(principal('missing', Response.json({ keys: [{ ...jwk, kid: 'different-key' }] })),
      error => error.message === 'invalid_access_signature');
    await assert.rejects(verifyCloudflareAccessJwt(await signed(), config, { keys: { find() { throw new Error('fixture runtime'); } } }, now),
      error => error.message === 'access_verifier_runtime_failed');
  } finally { globalThis.fetch = originalFetch; }
});

test('Access JWKS retrieval uses Workers-supported manual redirect handling and rejects redirects', async () => {
  const originalFetch = globalThis.fetch;
  const issuer = 'https://chatgun-workers-fetch-test.cloudflareaccess.com';
  const token = await signed({ iss: issuer });
  const request = new Request('https://chatgun.pages.dev/api/admin/session', {
    headers: { 'cf-access-jwt-assertion': token },
  });
  let calls = 0;
  try {
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, `${issuer}/cdn-cgi/access/certs`);
      // Cloudflare Workers throws before sending when redirect is "error".
      if (options?.redirect === 'error') throw new TypeError('unsupported redirect mode');
      assert.equal(options?.redirect, 'manual');
      return Response.json(jwks);
    };
    assert.equal((await cloudflareAdminPrincipal(request, {
      ...envConfig, ADMIN_ACCESS_ISSUER: issuer,
    })).subject, claims.sub);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('bare Admin namespace redirects only safe reads into the Access-protected session route', async () => {
  const enabled = { ADMIN_ACCESS_STANDALONE_ENABLED: 'true' };
  for (const method of ['GET', 'HEAD']) {
    const response = await adminRequest({ env: enabled, request: new Request('https://chatgun.social/api/admin?untrusted=1', { method }) });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/api/admin/session');
    assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  }
  assert.equal((await adminRequest({ env: enabled, request: new Request('https://chatgun.social/api/admin', { method: 'POST' }) })).status, 404);
  assert.equal((await adminRequest({ env: {}, request: new Request('https://chatgun.social/api/admin') })).status, 404);
});

test('standalone Access login needs no LINE/member cookie, retains RBAC/CSRF, and logout rejects assertion replay', async () => {
  const db = new TestD1(), originalFetch = globalThis.fetch;
  const issuer = 'https://chatgun-standalone-test.cloudflareaccess.com';
  globalThis.fetch = async url => { assert.equal(url, `${issuer}/cdn-cgi/access/certs`); return Response.json(jwks); };
  try {
    const env = { ...environment(db), ...envConfig, ADMIN_ACCESS_ISSUER: issuer, ADMIN_ACCESS_STANDALONE_ENABLED: 'true', SOCIAL_APP_ENABLED: 'true', MODERATION_TOOLS_ENABLED: 'true' };
    await db.prepare("INSERT INTO users(id,display_name,status,created_at,updated_at)VALUES(?,'Local owner','active',?,?)").bind(config.userId, now, now).run();
    const jwt = await signed({ iss: issuer });
    const req = (path, body, csrf, origin = 'https://chatgun.pages.dev', assertion = jwt) => new Request(`https://chatgun.pages.dev/api/admin/${path}`, {
      method: body ? 'POST' : 'GET', headers: { 'cf-access-jwt-assertion': assertion,
        ...(body ? { origin, 'content-type': 'application/json', 'x-cg-admin-csrf': csrf || '' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const call = (path, ...args) => adminRequest({ env, request: req(path, ...args) });
    assert.equal((await call('session')).status, 403, 'A valid Access identity without a role cannot start');
    await db.prepare("INSERT INTO moderation_access_grants(id,user_id,role,grant_reason,granted_at,expires_at)VALUES('expired-role',?,'report_reviewer','Expired local Access fixture only',?,?)").bind(config.userId, now - 7200, now - 3600).run();
    assert.equal((await call('session')).status, 403, 'An expired role cannot start an Admin session');
    await db.prepare("INSERT INTO moderation_access_grants(id,user_id,role,grant_reason,granted_at,expires_at)VALUES('standalone-role',?,'moderation_admin','Local Access fixture only',?,?)").bind(config.userId, now, now + 3600).run();
    let response = await call('session'); assert.equal(response.status, 200);
    const challenge = await response.json(); assert.equal(challenge.authenticated, false);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await call('overview')).status, 401);
    assert.equal((await call('session', { action: 'start' })).status, 403);
    assert.equal((await call('session', { action: 'start' }, challenge.csrfToken, 'https://attacker.example.test')).status, 403);
    response = await call('session', { action: 'start' }, challenge.csrfToken); assert.equal(response.status, 200);
    const login = await response.json(); assert.equal(login.authenticated, true); assert.equal(login.recentlyAuthenticated, false);
    assert.equal((await call('overview')).status, 403, 'moderation_admin cannot read the reviewer overview');
    const capabilities = await (await call('capabilities')).json();
    assert.deepEqual({ manage: capabilities.canManageRoles, reports: capabilities.canReviewReports, media: capabilities.canReviewMedia },
      { manage: true, reports: false, media: false }, 'moderation_admin grants role management only');
    assert.equal((await call('reports')).status, 400, 'Exceptional purpose is still mandatory');
    const reports = new Request(req('reports'), { headers: { 'cf-access-jwt-assertion': jwt, 'x-moderation-purpose': 'Inspect local fixture reports only' } });
    response = await adminRequest({ env, request: reports }); assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'admin_auth_evidence_missing', 'iat does not masquerade as fresh authentication');
    const freshJwt = await signed({ iss: issuer, sub: 'fresh-local-subject', auth_time: now - 5 });
    response = await adminRequest({ env, request: req('session', undefined, undefined, undefined, freshJwt) });
    const freshChallenge = await response.json();
    response = await adminRequest({ env, request: req('session', { action: 'start' }, freshChallenge.csrfToken, undefined, freshJwt) });
    const fresh = await response.json(); assert.equal(fresh.recentlyAuthenticated, true);
    const freshReports = new Request(req('reports', undefined, undefined, undefined, freshJwt), { headers: { 'cf-access-jwt-assertion': freshJwt, 'x-moderation-purpose': 'Inspect local fixture reports only' } });
    assert.equal((await adminRequest({ env, request: freshReports })).status, 403,
      'fresh authentication does not let moderation_admin inspect reports');
    await db.prepare("INSERT INTO moderation_access_grants(id,user_id,role,grant_reason,granted_at,expires_at)VALUES('standalone-safety',?,'safety_admin','Separate local review fixture only',?,?)").bind(config.userId, now, now + 3600).run();
    assert.equal((await adminRequest({ env, request: freshReports })).status, 200,
      'private reports require the separate safety_admin role');
    assert.equal((await call('overview')).status, 200, 'reviewer overview requires a separate review role');
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM sessions').first()).n, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM identities').first()).n, 0);
    assert.equal((await authRequest({ env, request: new Request('https://chatgun.pages.dev/api/auth/me', { headers: { 'cf-access-jwt-assertion': jwt } }) })).status, 401, 'Admin assertion is not a member login');
    assert.equal((await call('session', { action: 'logout' }, challenge.csrfToken)).status, 403, 'Start challenge cannot authorize logout');
    assert.equal((await call('session', { action: 'logout' }, login.csrfToken)).status, 200);
    assert.equal((await call('overview')).status, 401);
    const retry = await (await call('session')).json();
    assert.equal((await call('session', { action: 'start' }, retry.csrfToken)).status, 403, 'Logged-out assertion cannot revive a session');
    assert.equal(await cleanupAdminAccessSessions(db, now + 1000), 0, 'Do not delete revocation tombstones before assertion expiry');
    await db.prepare("UPDATE moderation_access_grants SET revoked_at=?,revocation_reason='Local revocation test only' WHERE id IN ('standalone-role','standalone-safety')").bind(now).run();
    assert.equal((await adminRequest({ env, request: freshReports })).status, 403);
    await db.prepare('UPDATE cloudflare_admin_sessions SET authenticated_at=?,created_at=?,expires_at=? WHERE revoked_at IS NULL AND user_id=?').bind(now-3601,now-3600,now-1,config.userId).run();
    assert.equal((await adminRequest({env,request:req('session',{action:'logout'},fresh.csrfToken,undefined,freshJwt)})).status,200,'Own-session logout remains possible after role revocation');
    assert.equal((await call('notifications')).status, 404, 'Member notifications stay outside Access namespace');
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM pragma_foreign_key_check').first()).n, 0);
  } finally { globalThis.fetch = originalFetch; db.close(); }
});

test('optional Cloudflare identity lookup binds real login time to verified subject, email and account, not JWT refresh time', async () => {
  const originalFetch=globalThis.fetch,issuer='https://chatgun-identity-test.cloudflareaccess.com';
  const env={...envConfig,ADMIN_ACCESS_ISSUER:issuer,ADMIN_ACCESS_IDENTITY_LOOKUP_ENABLED:'true'};
  const cases=[{}, {account_id:'wrong-account'}, {email:'other@example.test'}, {user_uuid:'wrong-subject'},
    {iat:now+1}, {iat:'today'}, {service_token_status:true}];
  try {
    for(let index=0;index<cases.length;index++){
      const sub='local-identity-'+index,jwt=await signed({iss:issuer,sub});
      globalThis.fetch=async(url,options)=>{
        if(url===`${issuer}/cdn-cgi/access/certs`)return Response.json(jwks);
        assert.equal(url,`${issuer}/cdn-cgi/access/get-identity`);
        assert.equal(options.headers.cookie,`CF_Authorization=${jwt}`);
        assert.equal(options.redirect,'manual');
        return Response.json({user_uuid:sub,email:config.email,account_id:'23017b53386fb67fc62a52cdd017454c',iat:now-1000,...cases[index]});
      };
      const principal=await cloudflareAdminPrincipal(new Request('https://chatgun.pages.dev/api/admin/session',{headers:{'cf-access-jwt-assertion':jwt}}),env);
      assert.equal(principal.authenticatedAt,index===0?now-1000:null);
    }
  } finally {globalThis.fetch=originalFetch;}
});

test('Admin Access failure taxonomy is allowlisted and defaults unexpected errors to verifier runtime failure', () => {
  const cases = new Map([
    ['invalid_access_claims', 'invalid_access_claims'],
    ['invalid_access_signature', 'invalid_access_signature'],
    ['invalid_access_configuration', 'invalid_access_configuration'],
    ['access_configuration_required', 'invalid_access_configuration'],
    ['admin_account_inactive', 'admin_account_inactive'],
    ['admin_account_restricted', 'admin_account_inactive'],
    ['access_jwks_fetch_failed', 'access_jwks_fetch_failed'],
    ['access_jwks_redirect_failed', 'access_jwks_redirect_failed'],
    ['access_jwks_invalid_payload', 'access_jwks_invalid_payload'],
    ['access_verifier_runtime_failed', 'access_verifier_runtime_failed'],
    ['access_verification_unavailable', 'access_jwks_fetch_failed'],
    ['sensitive implementation detail', 'access_verifier_runtime_failed'],
  ]);
  for (const [reason, expected] of cases) assert.equal(adminAccessFailureCategory(new Error(reason)), expected);
  assert.equal(adminAccessFailureCategory(null), 'access_verifier_runtime_failed');
});

test('standalone Admin diagnostics classify failures without leaking credentials and leave RBAC separate', async () => {
  const originalFetch = globalThis.fetch, originalWarn = console.warn;
  const alternatePair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const encoded = value => base64Url(new TextEncoder().encode(JSON.stringify(value)));
  async function tokenFor(issuer, patch = {}, signingKey = pair.privateKey) {
    const body = `${encoded({ alg: 'RS256', kid: jwk.kid })}.${encoded({ ...claims, iss: issuer, ...patch })}`;
    return `${body}.${base64Url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signingKey, new TextEncoder().encode(body)))}`;
  }
  const logs = [];
  console.warn = value => logs.push(String(value));
  try {
    const run = async ({ name, expected, tokenPatch = {}, envPatch = {}, signingKey, user = true, fetchResult = jwks }) => {
      const db = new TestD1();
      const issuer = `https://chatgun-diagnostic-${name}.cloudflareaccess.com`;
      try {
        if (user) await db.prepare("INSERT INTO users(id,display_name,status,created_at,updated_at)VALUES(?,'Diagnostic owner','active',?,?)")
          .bind(config.userId, now, now).run();
        const env = { ...environment(db), ...envConfig, ADMIN_ACCESS_ISSUER: issuer,
          ADMIN_ACCESS_STANDALONE_ENABLED: 'true', MODERATION_TOOLS_ENABLED: 'true', ...envPatch };
        const token = await tokenFor(issuer, tokenPatch, signingKey);
        globalThis.fetch = async url => {
          assert.equal(url, `${issuer}/cdn-cgi/access/certs`);
          if (fetchResult instanceof Error) throw fetchResult;
          return fetchResult instanceof Response ? fetchResult : Response.json(fetchResult);
        };
        const start = logs.length;
        const response = await adminRequest({ env, request: new Request('https://chatgun.social/api/admin/session', {
          headers: { 'cf-access-jwt-assertion': token },
        }) });
        assert.equal(response.status, 403);
        const body = await response.json();
        assert.equal(body.code, 'admin_access_required');
        assert.equal(logs.length, start + 1);
        const diagnostic = JSON.parse(logs.at(-1));
        assert.deepEqual(Object.keys(diagnostic).sort(), ['category', 'event', 'requestId']);
        assert.equal(diagnostic.event, 'admin_access_verification_failed');
        assert.equal(diagnostic.category, expected);
        assert.match(diagnostic.requestId, /^[a-f0-9-]{36}$/u);
        assert.equal(response.headers.get('x-chatgun-request-id'), diagnostic.requestId);
        for (const secret of [token, config.email, config.userId, claims.sub, issuer]) {
          assert.equal(logs.at(-1).includes(secret), false);
          assert.equal(JSON.stringify(body).includes(secret), false);
        }
      } finally { db.close(); }
    };

    await run({ name: 'wrong-issuer', expected: 'invalid_access_claims', tokenPatch: { iss: 'https://wrong.cloudflareaccess.com' } });
    await run({ name: 'wrong-audience', expected: 'invalid_access_claims', tokenPatch: { aud: ['b'.repeat(64)] } });
    await run({ name: 'expired', expected: 'invalid_access_claims', tokenPatch: { exp: now - 1 } });
    await run({ name: 'owner-binding', expected: 'invalid_access_claims', tokenPatch: { email: 'wrong@example.test' } });
    await run({ name: 'signature', expected: 'invalid_access_signature', signingKey: alternatePair.privateKey });
    await run({ name: 'configuration', expected: 'invalid_access_configuration', envPatch: { ADMIN_ACCESS_AUDIENCE: '' } });
    await run({ name: 'jwks-timeout', expected: 'access_jwks_fetch_failed', fetchResult: new DOMException('Timed out', 'TimeoutError') });
    await run({ name: 'jwks-http', expected: 'access_jwks_fetch_failed', fetchResult: new Response('', { status: 503 }) });
    await run({ name: 'jwks-redirect', expected: 'access_jwks_redirect_failed', fetchResult: new Response('', { status: 302 }) });
    await run({ name: 'jwks-json', expected: 'access_jwks_invalid_payload', fetchResult: new Response('{') });
    await run({ name: 'jwks-shape', expected: 'access_jwks_invalid_payload', fetchResult: { keys: 'invalid' } });
    await run({ name: 'inactive', expected: 'admin_account_inactive', user: false });

    const runtimeDb = new TestD1(), runtimeIssuer = 'https://chatgun-diagnostic-runtime.cloudflareaccess.com';
    try {
      globalThis.fetch = async url => { assert.equal(url, `${runtimeIssuer}/cdn-cgi/access/certs`); return Response.json(jwks); };
      const runtimeEnv = { ...environment(runtimeDb), ...envConfig, ADMIN_ACCESS_ISSUER: runtimeIssuer,
        ADMIN_ACCESS_STANDALONE_ENABLED: 'true', MODERATION_TOOLS_ENABLED: 'true' };
      runtimeEnv.DB = { prepare() { throw new Error('fixture database runtime'); } };
      const start = logs.length;
      const response = await adminRequest({ env: runtimeEnv, request: new Request('https://chatgun.social/api/admin/session', {
        headers: { 'cf-access-jwt-assertion': await tokenFor(runtimeIssuer) },
      }) });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, 'admin_access_required');
      const diagnostic = JSON.parse(logs.at(-1));
      assert.equal(logs.length, start + 1);
      assert.equal(diagnostic.category, 'access_verifier_runtime_failed');
      assert.deepEqual(Object.keys(diagnostic).sort(), ['category', 'event', 'requestId']);
    } finally { runtimeDb.close(); }

    const db = new TestD1(), issuer = 'https://chatgun-diagnostic-valid.cloudflareaccess.com';
    try {
      await db.prepare("INSERT INTO users(id,display_name,status,created_at,updated_at)VALUES(?,'Diagnostic owner','active',?,?)")
        .bind(config.userId, now, now).run();
      globalThis.fetch = async url => { assert.equal(url, `${issuer}/cdn-cgi/access/certs`); return Response.json(jwks); };
      const env = { ...environment(db), ...envConfig, ADMIN_ACCESS_ISSUER: issuer,
        ADMIN_ACCESS_STANDALONE_ENABLED: 'true', MODERATION_TOOLS_ENABLED: 'true' };
      const start = logs.length;
      const response = await adminRequest({ env, request: new Request('https://chatgun.social/api/admin/session', {
        headers: { 'cf-access-jwt-assertion': await tokenFor(issuer) },
      }) });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, 'forbidden', 'valid Access without an application role reaches RBAC');
      assert.equal(response.headers.get('x-chatgun-request-id'), null);
      assert.equal(logs.length, start, 'missing RBAC is not misclassified as an authentication failure');
    } finally { db.close(); }
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
