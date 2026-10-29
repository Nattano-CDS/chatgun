# Phase 5 Cloudflare Access Production configuration checklist

Status: prepared and verified read-only on 2026-10-30 Asia/Bangkok. **Not authorized for
Production execution.** Do not place a private administrator identity, application audience,
token, member UUID or credential in Git, a pull request, logs or chat.

## Current Access inventory

- Account team domain and required issuer:
  `https://tiny-violet-2021.cloudflareaccess.com`.
- Exactly one self-hosted Access application exists: `ChatGun Final UAT Admin`. Its destinations
  are isolated UAT admin routes. There is no Production Access application to reuse or edit.
- The UAT owner policy requires MFA on every access and uses a 10-minute application session.
- The account allows authenticator-application MFA. Global MFA defaults are not applied to every
  application, so the Production policy must contain its own explicit MFA requirement.
- The App Launcher owner policy and 15-minute launcher session are not substitutes for a
  Production application policy. The account-level MFA authentication duration is 24 hours;
  the Production application must override this with the stricter every-access requirement.
- Production currently has no `ADMIN_ACCESS_ISSUER` or `ADMIN_ACCESS_AUDIENCE` secret and the
  deployed owner-pilot release has no `/api/admin/*` namespace.

## Owner-authorized console procedure

1. In Zero Trust → Access controls → Applications, recheck that no application already protects
   either Production destination. Stop on any duplicate or overlapping wildcard.
2. Create one self-hosted application named `ChatGun Production Admin` with exactly these two
   destinations:
   - `chatgun.social/app/moderation*`
   - `chatgun.social/api/admin/*`
3. Set the application session to 10 minutes. Do not enable WARP/Cloudflare One Client
   authentication, browser rendering, service-token access or a bypass policy.
4. Select only the owner's established login method. Do not rely on the account-wide “accept all
   identity providers” default if it would present an unapproved authentication method.
5. Attach one application policy named `ChatGun Production owner only + MFA`:
   - action: Allow;
   - include: exactly the privately confirmed administrator identity;
   - require: Cloudflare Access MFA on every access;
   - exclude/bypass/service-auth rules: none;
   - session: same 10-minute application duration.
6. Save, then privately record the generated application audience tag. Read back both
   destinations, policy, identity rule, MFA requirement and session duration. Do not copy the
   identity or audience into repository files.
7. Configure the candidate release through protected Production secrets/configuration:
   - `ADMIN_ACCESS_ISSUER=https://tiny-violet-2021.cloudflareaccess.com`
   - `ADMIN_ACCESS_AUDIENCE=<generated Production application audience>`
   - `ADMIN_ACCESS_EMAIL=<private exact Access identity>`
   - `ADMIN_ACCESS_OWNER_USER_ID=<privately confirmed genuine Production owner UUID>`
   - `ADMIN_ACCESS_IDENTITY_LOOKUP_ENABLED=true`
   - retain `ADMIN_CLOUDFLARE_ACCESS_REQUIRED=true`
8. Do not enable `ADMIN_ACCESS_STANDALONE_ENABLED` until schema 21, the exact application build,
   the Access secrets and the genuine owner UUID are all present and separately authorized.
   Missing, partial or false Access configuration must leave administration unavailable.

## Required verification before activation

Perform these checks only after the app and candidate are separately authorized:

1. An unauthenticated browser request is challenged by Access before reaching the application.
2. A non-browser request without an assertion receives denial and no application session.
3. The owner completes genuine Access authentication and MFA personally; retain only a sanitized
   receipt. Do not record the JWT, cookie, MFA code or private identity.
4. The application verifies RS256 signature from the fixed issuer JWKS endpoint, exact `iss`,
   exact audience, application token type, subject, identity, `iat`, `nbf`, `exp` and recent
   authentication. A JWKS outage fails closed.
5. A verified Access identity creates no D1 role. Confirm a separate active, expiring least-
   privilege grant, owner UUID match, current account/session and recent-auth evidence.
6. Verify CSRF denial, purpose-required audit reads, ordinary-member denial and no effect on
   `/api/social/*` member routes.
7. Revoke the D1 grant, application admin session and Access session independently. Each must
   deny the next privileged operation; logout assertion replay must fail.
8. Let the 10-minute session expire and prove reauthentication plus MFA is required again.

## Owner-pilot preservation and rollback

The assessed PR #19 Production variables are intentionally closed and do **not** match the
deployed controlled owner pilot. Never deploy them blindly. Before any release, compare the
approved preservation manifest against the live fingerprint so that LINE owner OAuth,
invitation-only admission, onboarding/Social shell and the moderation UI are not disabled or
broadened. Public registration, Discovery, messaging, Media, Presence, Sensitive, youth, OTP and
Demo must remain off.

On Access failure, keep `ADMIN_ACCESS_STANDALONE_ENABLED=false`, revoke any D1 grants and admin
sessions, disable the new application policy if necessary, and retain the existing owner pilot.
Do not delete schema, restore D1, disable LINE admission or broaden member authentication as a
rollback shortcut.
