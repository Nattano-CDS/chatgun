# ChatGun Phase 1 production authentication checklist

Status captured on 2026-10-16 for Cloudflare account
`23017b53386fb67fc62a52cdd017454c`. This checklist authorizes no Production deployment.

## Verified

- [x] `wrangler whoami` resolves to the dedicated ChatGun Cloudflare account.
- [x] The repository's Production D1 configuration targets `chatgun-auth`
  (`9738a051-d914-42d0-8e7b-8098ef2b959d`).
- [x] Preview D1 targets the distinct `chatgun-auth-staging`
  (`5bbfd55d-eb22-4324-8a7d-57bef14110ea`).
- [x] Production and Preview both have migration `0001_auth.sql`; no migrations are pending.
- [x] Production schema, indexes, and foreign keys pass read-only inspection.
- [x] Email and mobile OTP flags are false, the signup UI has no OTP controls, and both OTP
  endpoints fail closed with `otp_disabled`.
- [x] Google, Facebook, and LINE real Preview login/session/logout flows pass.
- [x] Automated callback-path tests cover positive and negative explicit account linking.

## Blocking before Production

- [ ] Configure the live Pages **Production** binding `DB` to `chatgun-auth`
  (`9738a051-d914-42d0-8e7b-8098ef2b959d`). A read-only Pages configuration download
  currently shows the staging binding at the top level and an empty `env.production`.
- [ ] Attach `chatgun.social` to Pages project `chatgun`, create/verify DNS, and confirm a
  valid certificate. It currently does not resolve and is not listed as a Pages domain.
- [ ] Decide whether `chatgun.pages.dev` will redirect to the canonical custom domain. If it
  remains an authentication origin, register both production origins with every provider.
- [ ] Create dedicated Production credentials without copying Preview or PiggyPrice values:
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`,
  `FACEBOOK_CLIENT_SECRET`, `FACEBOOK_GRAPH_VERSION`, `LINE_CLIENT_ID`, and
  `LINE_CLIENT_SECRET`.
- [ ] Create a Production Turnstile widget allowlisted for the chosen production hostname(s)
  and set `TURNSTILE_SITE_KEY` plus `TURNSTILE_SECRET_KEY`.
- [ ] Generate a new Production-only `RATE_LIMIT_PEPPER`.
- [ ] Keep `EMAIL_OTP_ENABLED=false`, `MOBILE_OTP_ENABLED=false`, and
  `LINE_EMAIL_ENABLED=false`. Phase 1 does not require Resend or OTP secrets.
- [ ] Register exact provider callbacks for `https://chatgun.social` and publish/approve each
  provider application as required by its console.
- [ ] Configure Google production branding/homepage/privacy links on the verified domain;
  switch the Meta app to Live only after its privacy/data-deletion settings pass review; and
  publish the LINE Login channel for the intended audience.
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

- `RATE_LIMIT_PEPPER`
- `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_SECRET`
- `LINE_CLIENT_SECRET`
- `TURNSTILE_SECRET_KEY`

Never place real values in Git, PR comments, terminal arguments, or test artifacts.
