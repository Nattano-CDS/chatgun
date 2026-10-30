# Genuine OAuth and Access verification results

## Production Cloudflare Access — BLOCKED

Read-only Cloudflare API verification at 2026-10-30 11:58 Asia/Bangkok returned zero account-level Access applications. Production Pages has no `ADMIN_ACCESS_ISSUER` or `ADMIN_ACCESS_AUDIENCE`. Application code nevertheless passed signed-JWT issuer/audience/algorithm/expiry, JWKS outage, CSRF, RBAC, audit, session and revocation cases in the focused 25/25 suite.

Required approved change: create separate self-hosted Access applications for `/app/moderation*` and `/api/admin/*`, exact `chatgun.social` host, 10-minute session, owner-only include rule and MFA requirement on every login. Do not add bypass, everyone, service-token or email-derived application roles. Store issuer and each audience encrypted; enable standalone/required flags only with the exact release. Bind the genuine verified Access subject to a separately confirmed member UUID and expiring least-privilege D1 grant.

Verification after approval: anonymous redirect/401; valid owner MFA; wrong issuer/audience/identity denial; 10-minute expiry; Access-session revocation; D1-role revocation; CSRF denial; ordinary member denial; purpose audit; and no email/token values in logs.

## LINE — BLOCKED

Live runtime read-back confirms only LINE is enabled, invitation-only admission is enabled and public registration is disabled. The owner pilot was not mutated. Current LINE Business ID/channel state, role, 2-step authentication and callback were not freshly read from the provider console, and genuine cancel/login/refresh/logout/expiry were not executed in Phase 9.

Owner action: authenticate with 2-step verification, confirm the existing Production channel, `https://chatgun.social/api/auth/oauth/line/callback`, `openid profile`, email permission disabled and owner/test eligibility. Then separately authorize the genuine owner journey without creating another identity.

## Google — BLOCKED

Earlier read-only evidence records a Production Web client, exact origin/callback, External/Testing status, one test-user entry and no extra sensitive/restricted scopes. Phase 9 did not reauthenticate to the console or run genuine Production OAuth. Google remains disabled in live runtime.

Owner action: choose retained test-only versus publication, re-read callback/origin/consent status, verify the intended tester privately, and authorize cancel/login/logout only if Google is in the approved release scope.

## Meta — BLOCKED

Earlier read-only evidence records the Production app as In development/Unpublished with strict HTTPS redirect matching and minimal `public_profile`; the release icon/business/review path remains incomplete. Phase 9 did not publish or run genuine OAuth. Meta remains disabled in live runtime.

Owner action: supply the required icon, decide business verification/app review and publication scope, reconfirm the exact callback and authorized role, then separately authorize genuine testing. No provider setting was changed.
