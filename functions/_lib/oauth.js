import { decodeBase64Url, hmacHex } from "./crypto.js";

function parseJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid_id_token");
  try {
    return {
      header: JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0]))),
      claims: JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1]))),
      signature: decodeBase64Url(parts[2]),
      signed: new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    };
  } catch {
    throw new Error("invalid_id_token");
  }
}

let googleKeys;
let googleKeysExpiresAt = 0;

async function getGoogleKey(keyId) {
  if (!googleKeys || Date.now() >= googleKeysExpiresAt) {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error("google_keys_unavailable");
    const body = await response.json();
    googleKeys = body.keys;
    const maximumAge = Number((response.headers.get("cache-control") || "").match(/max-age=(\d+)/u)?.[1] || 300);
    googleKeysExpiresAt = Date.now() + Math.min(maximumAge, 3600) * 1000;
  }
  return googleKeys.find((key) => key.kid === keyId);
}

async function verifyGoogleIdToken(idToken, clientId, nonce, timestamp) {
  const parsed = parseJwt(idToken);
  if (parsed.header.alg !== "RS256" || typeof parsed.header.kid !== "string") throw new Error("invalid_id_token");
  const jwk = await getGoogleKey(parsed.header.kid);
  if (!jwk) throw new Error("invalid_id_token_key");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, parsed.signature, parsed.signed);
  const claims = parsed.claims;
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!valid || !["https://accounts.google.com", "accounts.google.com"].includes(claims.iss)
    || !audience.includes(clientId) || claims.azp && claims.azp !== clientId
    || Number(claims.exp) <= timestamp || Number(claims.iat) > timestamp + 60
    || claims.nonce !== nonce || typeof claims.sub !== "string") {
    throw new Error("invalid_id_token_claims");
  }
  return claims;
}

function graphVersion(env) {
  const version = env.FACEBOOK_GRAPH_VERSION;
  if (!/^v\d+\.\d+$/u.test(version || "")) throw new Error("facebook_version_missing");
  return version;
}

export function providerConfiguration(provider, env) {
  const upper = provider.toUpperCase();
  const clientId = env[`${upper}_CLIENT_ID`];
  const clientSecret = env[`${upper}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) throw new Error("provider_not_configured");
  if (provider === "google") return {
    clientId, clientSecret,
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    pkce: true,
  };
  if (provider === "line") return {
    clientId, clientSecret,
    authorizationUrl: "https://access.line.me/oauth2/v2.1/authorize",
    tokenUrl: "https://api.line.me/oauth2/v2.1/token",
    scope: "openid email profile",
    pkce: true,
  };
  const version = graphVersion(env);
  return {
    clientId, clientSecret,
    authorizationUrl: `https://www.facebook.com/${version}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${version}/oauth/access_token`,
    scope: "email,public_profile",
    pkce: false,
    version,
  };
}

export async function exchangeCode(provider, configuration, code, redirectUri, verifier) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: configuration.clientId,
    client_secret: configuration.clientSecret,
    redirect_uri: redirectUri,
  });
  if (configuration.pkce) body.set("code_verifier", verifier);
  const response = await fetch(configuration.tokenUrl, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await response.text();
  let token;
  try {
    token = JSON.parse(text);
  } catch {
    token = Object.fromEntries(new URLSearchParams(text));
  }
  if (!response.ok || !token.access_token) throw new Error("token_exchange_failed");
  return token;
}

export async function verifyProviderIdentity(provider, configuration, token, nonce, timestamp) {
  if (provider === "google") {
    if (!token.id_token) throw new Error("missing_id_token");
    const claims = await verifyGoogleIdToken(token.id_token, configuration.clientId, nonce, timestamp);
    return {
      provider,
      subject: claims.sub,
      email: typeof claims.email === "string" ? claims.email.trim().toLowerCase() : null,
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
      name: typeof claims.name === "string" ? claims.name : null,
      picture: typeof claims.picture === "string" ? claims.picture : null,
    };
  }

  if (provider === "line") {
    if (!token.id_token) throw new Error("missing_id_token");
    const body = new URLSearchParams({ id_token: token.id_token, client_id: configuration.clientId, nonce });
    const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const claims = await response.json().catch(() => ({}));
    if (!response.ok || claims.iss !== "https://access.line.me" || claims.aud !== configuration.clientId
      || claims.nonce !== nonce || Number(claims.exp) <= timestamp || typeof claims.sub !== "string") {
      throw new Error("invalid_line_id_token");
    }
    return {
      provider,
      subject: claims.sub,
      email: typeof claims.email === "string" ? claims.email.trim().toLowerCase() : null,
      // LINE returns email only after the channel receives email permission and validates the signed ID token.
      emailVerified: typeof claims.email === "string",
      name: typeof claims.name === "string" ? claims.name : null,
      picture: typeof claims.picture === "string" ? claims.picture : null,
    };
  }

  const applicationToken = `${configuration.clientId}|${configuration.clientSecret}`;
  const debugBody = new URLSearchParams({ input_token: token.access_token, access_token: applicationToken });
  const debugResponse = await fetch(`https://graph.facebook.com/${configuration.version}/debug_token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: debugBody,
  });
  const debug = await debugResponse.json().catch(() => ({}));
  if (!debugResponse.ok || debug.data?.is_valid !== true || debug.data?.app_id !== configuration.clientId
    || !debug.data?.user_id || debug.data.expires_at && Number(debug.data.expires_at) <= timestamp) {
    throw new Error("invalid_facebook_token");
  }
  const proof = await hmacHex(configuration.clientSecret, token.access_token);
  const profileUrl = new URL(`https://graph.facebook.com/${configuration.version}/me`);
  profileUrl.searchParams.set("fields", "id,name,email,picture");
  profileUrl.searchParams.set("appsecret_proof", proof);
  const profileResponse = await fetch(profileUrl, {
    headers: { accept: "application/json", authorization: `Bearer ${token.access_token}` },
  });
  const profile = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok || profile.id !== debug.data.user_id) throw new Error("invalid_facebook_profile");
  return {
    provider,
    subject: profile.id,
    email: typeof profile.email === "string" ? profile.email.trim().toLowerCase() : null,
    // Meta does not include an email_verified assertion in this response; never auto-link with it.
    emailVerified: false,
    name: typeof profile.name === "string" ? profile.name : null,
    picture: typeof profile.picture?.data?.url === "string" ? profile.picture.data.url : null,
  };
}
