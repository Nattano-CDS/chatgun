# ChatGun Phase 1 production authentication checklist

> Provider publishing preparation and the current per-provider GO/NO-GO decision are
> recorded in [provider-publishing-readiness.md](./provider-publishing-readiness.md).

Status captured on 2026-10-16 for Cloudflare account
`23017b53386fb67fc62a52cdd017454c`. This checklist authorizes no Production deployment.

## Verified

- [x] `wrangler whoami` resolves to the dedicated ChatGun Cloudflare account.
- [x] The repository's Production D1 configuration targets `chatgun-auth`
  (`9738a051-d914-42d0-8e7b-8098ef2b959d`).
- [x] Preview D1 targets the distinct `chatgun-auth-staging`
  (`5bbfd55d-eb22-4324-8a7d-57bef14110ea`).
- [ ] Production has only `0001_auth.sql`; read-only inspection on 2026-10-16 found
  `0002_privacy_safety.sql` through `0006_media_review_concurrency.sql` pending. Preview is current.
- [x] The current Production authentication-only schema has no foreign-key violations, but
  it is not ready for the privacy/social application until the pending additive migrations
  are reviewed, backed up, applied under separate approval, and re-verified.
- [x] Email and mobile OTP flags are false, the signup UI has no OTP controls, and both OTP
  endpoints fail closed with `otp_disabled`.
- [x] Google, Facebook, and LINE real Preview login/session/logout flows pass.
- [x] Automated callback-path tests cover positive and negative explicit account linking.

## Blocking before Production

- [x] Save the live Pages **Production** binding `DB` to `chatgun-auth`
  (`9738a051-d914-42d0-8e7b-8098ef2b959d`). The dashboard confirms the binding, while
  Preview remains mapped to `chatgun-auth-staging`.
- [x] Attach `chatgun.social` to Pages project `chatgun`, create the apex CNAME to
  `chatgun.pages.dev`, and verify Cloudflare HTTPS. Public DNS and a successful TLS/HTTP
  response were confirmed on 2026-10-16.
- [x] Implement an exact-host permanent redirect from `chatgun.pages.dev` to the canonical
  `https://chatgun.social` origin. Preview and immutable deployment hostnames are excluded.
- [x] Complete dedicated Production credentials without copying Preview or PiggyPrice values:
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`,
  `FACEBOOK_CLIENT_SECRET`, `FACEBOOK_GRAPH_VERSION`, `LINE_CLIENT_ID`, and
  `LINE_CLIENT_SECRET`. Google, Meta, and LINE values are stored as encrypted Production
  secrets. No credential values are recorded in Git.
- [x] Create a dedicated managed Production Turnstile widget allowlisted only for
  `chatgun.social` and store `TURNSTILE_SITE_KEY` plus `TURNSTILE_SECRET_KEY` as encrypted
  Production secrets. The Preview widget remains unchanged.
- [x] Generate independent Production-only `RATE_LIMIT_PEPPER` and `OTP_PEPPER` secrets.
  OTP remains disabled; retaining its independent pepper avoids sharing Preview material if
  Email OTP is enabled in a future release.
- [x] Store `EMAIL_OTP_ENABLED=false`, `MOBILE_OTP_ENABLED=false`, and
  `LINE_EMAIL_ENABLED=false` in Production. Phase 1 does not require Resend.
- [x] Register exact provider callbacks for `https://chatgun.social`. The Production callbacks
  for Google, Meta, and LINE are separate from Preview credentials and applications.
- [ ] Finish provider publishing and approval:
  - Google is External / Testing. Its Publish button is disabled until the Branding page has
    the application homepage and privacy-policy URL. Authorized domains already include
    `chatgun.social`; the Verification Center currently says verification is not required while
    the app remains in Testing.
  - Meta `ChatGun Production` is Unpublished. Its exact callback is saved with Client OAuth,
    Web OAuth, HTTPS enforcement, and strict redirect matching enabled; embedded browser,
    device, and JavaScript SDK login are disabled. Privacy/data-deletion URLs and category are
    saved. A 1024 x 1024 app icon, a ChatGun-owned business portfolio, business verification,
    and the currently unsubmitted App Review are still required before publishing.
  - LINE `ChatGun Production` is Developing. Its exact callback is saved. Publishing is a
    manual, irreversible console action; email-address permission is not required for the
    Phase 1 `openid profile` scope and remains unapplied.
- [ ] Run new-account, existing-account, denial, revoked-consent, session, logout, and
  explicit-linking smoke tests against the final Production hostname before traffic launch.

## Production Pages values required for Phase 1

Non-secret variables:

- `EMAIL_OTP_ENABLED=false`
- `MOBILE_OTP_ENABLED=false`
- `LINE_EMAIL_ENABLED=false`
- `GOOGLE_CLIENT_ID`
- `FACEBOOK_CLIENT_ID`
- `FACEBOOK_GRAPH_VERSION`
- `LINE_CLIENT_ID`
- `TURNSTILE_SITE_KEY`

Encrypted secrets:

- `OTP_PEPPER` (stored but unused while OTP is disabled)
- `RATE_LIMIT_PEPPER`
- `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_SECRET`
- `LINE_CLIENT_SECRET`
- `TURNSTILE_SECRET_KEY`

Never place real values in Git, PR comments, terminal arguments, or test artifacts.

## Final readiness verification (2026-10-16)

- Cloudflare Pages shows `chatgun.social` **Active** with SSL enabled. Public DNS returns
  Cloudflare IPv4 and IPv6 addresses, and HTTPS responds with status 200 and a valid certificate.
- The dashboard confirms Production `DB -> chatgun-auth` and Preview
  `DB -> chatgun-auth-staging`; both environments report no pending migrations.
- Two separate managed Turnstile widgets exist: Preview and Production. Each has one hostname
  and no pre-clearance; the Production widget is allowlisted to `chatgun.social`.
- Production secrets include dedicated Google, Meta, LINE, Turnstile, rate-limit, and OTP-pepper
  entries. OTP feature flags remain false. Preview values and bindings were not modified.
- `npm test`: 19 passed, 0 failed.
- `npm run test:e2e`: 8 passed, 0 failed across desktop and mobile Chromium.
- No Production deployment was created. The latest deployment remains Preview-only.

**Release assessment: NO-GO.** Infrastructure and encrypted credentials are prepared, but the
  provider applications are not published/approved and real Production-hostname authentication
smoke tests cannot be performed until those manual provider actions and an explicitly approved
Production deployment are complete. In addition, Production D1 migrations 0002–0006 are now
confirmed pending; this supersedes the earlier no-pending-migrations statement.
