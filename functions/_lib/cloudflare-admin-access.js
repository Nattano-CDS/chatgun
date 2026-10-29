import { decodeBase64Url, sha256 } from './crypto.js';

// Access never grants a role. Member-session fencing and optional, separate
// Admin-only sessions preserve CSRF, recent authentication and D1 role checks.
const ISSUER = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/u;
let cachedKeys;
let cachedAuthenticationTime;

export function cloudflareAdminAccessConfiguration(env) {
  const flag = env.ADMIN_CLOUDFLARE_ACCESS_REQUIRED;
  const production = env.DEPLOYMENT_ENVIRONMENT === 'production';
  const standalone = env.ADMIN_ACCESS_STANDALONE_ENABLED === 'true';
  if (env.DEPLOYMENT_ENVIRONMENT && !['production', 'preview', 'uat', 'test'].includes(env.DEPLOYMENT_ENVIRONMENT)) {
    throw new Error('invalid_deployment_environment');
  }
  // Production administration and the standalone admin namespace must never
  // silently fall back to a member session when Access is absent or disabled.
  if (flag === undefined || flag === '' || flag === 'false') {
    if (production || standalone) throw new Error('access_configuration_required');
    return null;
  }
  if (flag !== 'true') throw new Error('invalid_access_configuration');
  const issuer = String(env.ADMIN_ACCESS_ISSUER || '');
  const audience = String(env.ADMIN_ACCESS_AUDIENCE || '');
  const email = String(env.ADMIN_ACCESS_EMAIL || '').trim().toLowerCase();
  const userId = String(env.ADMIN_ACCESS_OWNER_USER_ID || '');
  if (!ISSUER.test(issuer) || !/^[a-f0-9]{64}$/u.test(audience)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(userId)) {
    throw new Error('invalid_access_configuration');
  }
  return { issuer, audience, email, userId };
}

function parseToken(token) {
  if (typeof token !== 'string' || token.length > 16384) throw new Error('invalid_access_token');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/u.test(part))) throw new Error('invalid_access_token');
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || header.kid.length > 256
    || header.crit !== undefined || header.b64 !== undefined) throw new Error('invalid_access_token');
  return { header, claims, signature: decodeBase64Url(parts[2]), signed: new TextEncoder().encode(parts.slice(0, 2).join('.')) };
}

function validateClaims(claims, config, now) {
  const aud = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud];
  if (!claims || claims.iss !== config.issuer || !aud.includes(config.audience)
    || claims.type !== 'app' || typeof claims.sub !== 'string' || !claims.sub.trim()
    || typeof claims.email !== 'string' || claims.email.toLowerCase() !== config.email
    || !Number.isSafeInteger(claims.exp) || !Number.isSafeInteger(claims.iat)
    || claims.exp <= now || claims.iat > now || claims.exp <= claims.iat
    || (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > now))) {
    throw new Error('invalid_access_claims');
  }
  if (claims.auth_time !== undefined && (!Number.isSafeInteger(claims.auth_time)
    || claims.auth_time <= 0 || claims.auth_time > claims.iat)) throw new Error('invalid_access_auth_time');
}

export async function verifyCloudflareAccessJwt(token, config, jwks, now = Math.floor(Date.now() / 1000)) {
  const parsed = parseToken(token);
  validateClaims(parsed.claims, config, now);
  const jwk = jwks?.keys?.find(key => key.kid === parsed.header.kid && key.kty === 'RSA'
    && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'));
  if (!jwk) throw new Error('invalid_access_key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, parsed.signature, parsed.signed)) throw new Error('invalid_access_signature');
  return { subject: parsed.claims.sub, expiresAt: parsed.claims.exp,
    // JWT issuance/refresh is NOT a new authentication. High-risk operations
    // remain blocked without signed, IdP-originated authentication-time evidence.
    authenticatedAt: parsed.claims.auth_time || null };
}

async function trustedKeys(issuer) {
  if (cachedKeys?.issuer === issuer && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;
  // Never use jku/x5u/iss supplied by an unverified request as a fetch target.
  const response = await fetch(`${issuer}/cdn-cgi/access/certs`, {
    headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('access_keys_unavailable');
  const body = await response.text();
  if (body.length > 65536) throw new Error('invalid_access_keys');
  const keys = JSON.parse(body);
  if (!Array.isArray(keys.keys) || keys.keys.length > 20) throw new Error('invalid_access_keys');
  cachedKeys = { issuer, keys, expiresAt: Date.now() + 300000 };
  return keys;
}

export async function requireCloudflareAdminAccess(request, env, session) {
  const config = cloudflareAdminAccessConfiguration(env);
  if (!config) return;
  // Binding both identities prevents a valid owner Access token being combined
  // with somebody else's ChatGun session. No grant is derived from an email.
  if (session.user_id !== config.userId) throw new Error('access_owner_mismatch');
  const token = request.headers.get('cf-access-jwt-assertion');
  const parsed = parseToken(token);
  validateClaims(parsed.claims, config, Math.floor(Date.now() / 1000));
  await verifyCloudflareAccessJwt(token, config, await trustedKeys(config.issuer));
}

export async function cloudflareAdminPrincipal(request, env) {
  const config = cloudflareAdminAccessConfiguration(env);
  if (!config) throw new Error('access_not_configured');
  const token = request.headers.get('cf-access-jwt-assertion');
  const parsed = parseToken(token);
  validateClaims(parsed.claims, config, Math.floor(Date.now() / 1000));
  const verified = await verifyCloudflareAccessJwt(token, config, await trustedKeys(config.issuer));
  // Access's documented get-identity.iat is login time, unlike JWT iat. Enable
  // only after verifying this flow with the real configured organization/IdP.
  if (!verified.authenticatedAt && env.ADMIN_ACCESS_IDENTITY_LOOKUP_ENABLED === 'true') {
    const tokenHash = await sha256(token);
    if (cachedAuthenticationTime?.tokenHash === tokenHash && cachedAuthenticationTime.expiresAt > Date.now()) {
      verified.authenticatedAt = cachedAuthenticationTime.authenticatedAt;
    } else {
      let authenticatedAt = null;
      try {
        const response = await fetch(`${config.issuer}/cdn-cgi/access/get-identity`, {
          headers: { accept: 'application/json', cookie: `CF_Authorization=${token}` },
          redirect: 'error', signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const text = await response.text();
          if (text.length <= 65536) {
            const identity = JSON.parse(text);
            if (identity.user_uuid === verified.subject && identity.email?.toLowerCase() === config.email
              && identity.account_id === '23017b53386fb67fc62a52cdd017454c'
              && identity.service_token_status !== true && !identity.service_token_id
              && Number.isSafeInteger(identity.iat) && identity.iat > 0 && identity.iat <= parsed.claims.iat) {
              authenticatedAt = identity.iat;
            }
          }
        }
      } catch { /* No fresh-auth proof: high-risk operations remain denied. */ }
      cachedAuthenticationTime = { tokenHash, authenticatedAt, expiresAt: Date.now() + 60000 };
      verified.authenticatedAt = authenticatedAt;
    }
  }
  return { ...verified, userId: config.userId, token };
}
