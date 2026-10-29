# Production OAuth owner-console checklist

This checklist describes the remaining privileged verification. It is not evidence that a
provider is live, published or approved. Keep `OAUTH_LOGIN_ENABLED=false`,
`OAUTH_ENABLED_PROVIDERS=""` and registration closed until a separately authorized release.

## Exact Production callbacks

| Provider | Exact callback | Minimum application requirements | Owner-console evidence still required |
|---|---|---|---|
| Google | `https://chatgun.social/api/auth/oauth/google/callback` | Web client, exact redirect URI and origin `https://chatgun.social`; OpenID `openid profile email`; authorized owner test user while External/Testing | Read back client ID, project/mode, redirect URI, consent-screen status and test-user eligibility; perform a genuine cancel and owner login without exposing the secret. |
| LINE | `https://chatgun.social/api/auth/oauth/line/callback` | Dedicated Production LINE Login channel, Web app, exact callback; `profile openid`; PKCE and nonce; email permission remains disabled | Read back channel ID, Developing/Published state, callback, owner tester/admin eligibility and required 2FA; perform genuine cancel and owner login. Preserve the existing owner identity. |
| Meta | `https://chatgun.social/api/auth/oauth/facebook/callback` | Dedicated Production Web app, exact Valid OAuth Redirect URI, App Domain `chatgun.social`, HTTPS and strict redirect matching; minimal `public_profile` scope | Read back app ID, app mode, site URL/domain, redirect URI, tester/admin eligibility and any review requirements. Do not request email unless separately approved. |

The server derives the callback from the request origin and validates OAuth state, nonce,
provider token audience, token expiry and provider identity. Google uses S256 PKCE; LINE uses
S256 PKCE and the provider verification endpoint; Meta validates the token with app-secret
proof. These application checks do not replace provider-console verification.

## Activation gate

Before enabling any provider, capture a sanitized receipt containing the exact release SHA,
provider/client identifier (never its secret), callback read-back, console mode, eligible owner
identity, timestamp and result. A configured credential is not a successful OAuth test. Any
origin mismatch, unpublished/tester mismatch or unverified callback is a **BLOCKED** result.
