import assert from 'node:assert/strict';
import test from 'node:test';
import { base64Url } from '../functions/_lib/crypto.js';
import { requireCloudflareAdminAccess, verifyCloudflareAccessJwt } from '../functions/_lib/cloudflare-admin-access.js';
import { issueSession, unixTime } from '../functions/_lib/db.js';
import { onRequest } from '../functions/api/social/[[path]].js';
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
  assert.deepEqual(await verifyCloudflareAccessJwt(await signed(), config, jwks, now), { subject: claims.sub });
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

test('Access validates real handler RBAC, audit, CSRF and revocation without granting roles from an email', async () => {
  const db = new TestD1();
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `${config.issuer}/cdn-cgi/access/certs`);
    assert.equal(options.redirect, 'error');
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
    await assert.rejects(requireCloudflareAdminAccess(r, { ...envConfig, ADMIN_ACCESS_ISSUER: issuer }, { user_id: config.userId }));
  } finally { globalThis.fetch = originalFetch; }
});
