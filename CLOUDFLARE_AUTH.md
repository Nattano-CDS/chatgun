# ChatGun Cloudflare authentication

The backend uses Cloudflare Pages Functions, a D1 binding named `DB`, and Cloudflare Turnstile. Phase 1 enables only Google, Facebook, and LINE. Email and mobile OTP remain implemented for future use but are disabled at the API boundary by feature flags.

## Deployment gate

Do not run any remote command until `wrangler whoami` shows the dedicated ChatGun account. If the account contains PiggyPrice projects or databases, stop. Never create ChatGun resources in, bind ChatGun to, or deploy ChatGun from the PiggyPrice account.

The authentication branch is deployed only to Preview. Production activation requires explicit approval and a separate production-readiness review.

## 1. Verify the ChatGun account and existing resources

```sh
npx wrangler@latest whoami
npx wrangler@latest pages project list
npx wrangler@latest d1 list
```

Confirm both exact names exist:

- Pages project: `chatgun`
- D1 database: `chatgun-auth`

Before applying a migration, inspect the remote schema without selecting user data:

```sh
npx wrangler@latest d1 execute chatgun-auth --remote --command="SELECT name, type, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
npx wrangler@latest d1 migrations list chatgun-auth --remote
```

If any auth table already exists with a different shape, stop and create a reviewed, additive migration for that exact schema. Do not drop tables, overwrite the database, or blindly apply the baseline migration.

## 2. Apply and verify migrations

For an empty/new `chatgun-auth` database:

```sh
npx wrangler@latest d1 migrations apply chatgun-auth --remote
npx wrangler@latest d1 execute chatgun-auth --remote --command="PRAGMA foreign_key_check"
npx wrangler@latest d1 execute chatgun-auth --remote --command="SELECT name, type FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
```

The version-controlled baseline is `migrations/0001_auth.sql`. It creates `users`, `identities`, `sessions`, `otp_challenges`, `oauth_flows`, and `rate_limits`, with foreign keys, uniqueness rules, checks, and lookup/expiry indexes.

## 3. Bind D1 to Pages

In Cloudflare Dashboard, open **Workers & Pages → chatgun → Settings → Bindings**, add a D1 binding whose variable name is exactly `DB`, and select `chatgun-auth`. Configure production and preview deliberately; do not select any PiggyPrice database. Redeploy after changing a binding.

The repository's reviewed `wrangler.jsonc` binds production to `chatgun-auth` and Preview to the isolated `chatgun-auth-staging` database. Preview deployments must use the `env.preview` override. Never replace either UUID with a PiggyPrice resource.

## 4. Configure secrets and variables

Set these as encrypted Pages secrets for project `chatgun`:

- `OTP_PEPPER` — at least 32 random bytes
- `RATE_LIMIT_PEPPER` — separate value, at least 32 random bytes
- `RESEND_API_KEY`
- `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_SECRET`
- `LINE_CLIENT_SECRET`
- `TURNSTILE_SECRET_KEY`

Set these non-secret environment variables:

- `EMAIL_OTP_ENABLED=false` — Phase 1 server-side gate; do not enable without a reviewed rollout
- `MOBILE_OTP_ENABLED=false` — Phase 1 server-side gate; no mobile OTP implementation is active
- `LINE_EMAIL_ENABLED=false` — request only `openid profile` until LINE grants email permission
- `NEW_ACCOUNT_REGISTRATION_ENABLED=false` — keep new account creation closed until the
  age-assurance/parental-authorization model is approved
- `EMAIL_FROM` — sender on a Resend-verified domain
- `GOOGLE_CLIENT_ID`
- `FACEBOOK_CLIENT_ID`
- `FACEBOOK_GRAPH_VERSION` — an explicitly supported `vN.0` value from the Meta app dashboard; verify it before launch
- `LINE_CLIENT_ID`
- `TURNSTILE_SITE_KEY`

Never place client secrets, peppers, or API keys in HTML, JavaScript, Git, build logs, or Pages variables visible to the browser.

## 5. Provider configuration

Register these exact production callback URLs:

- `https://chatgun.pages.dev/api/auth/oauth/google/callback`
- `https://chatgun.pages.dev/api/auth/oauth/facebook/callback`
- `https://chatgun.pages.dev/api/auth/oauth/line/callback`

For the current Preview branch, also register these staging callbacks in dedicated test applications:

- `https://feature-cloudflare-auth.chatgun.pages.dev/api/auth/oauth/google/callback`
- `https://feature-cloudflare-auth.chatgun.pages.dev/api/auth/oauth/facebook/callback`
- `https://feature-cloudflare-auth.chatgun.pages.dev/api/auth/oauth/line/callback`

Do not reuse production OAuth applications or production Resend/Turnstile credentials for Preview.

Google and LINE use authorization code flow with S256 PKCE, state, and nonce. Google ID tokens are verified against Google JWKS. LINE ID tokens are verified through LINE's server endpoint. Facebook access tokens are checked with `debug_token`, bound to the configured app ID, and profile calls use `appsecret_proof`.

Facebook does not return an `email_verified` assertion in this flow, so its email is never used to auto-link accounts. An authenticated user can explicitly link a provider by POSTing `{ "link": true, "turnstileToken": "..." }` to its start endpoint with the session CSRF header.

## 6. Resend and Turnstile

Verify the `EMAIL_FROM` domain in Resend. Configure the Turnstile widget for `chatgun.pages.dev` and any explicit preview host used for testing. Both OTP and OAuth initiation fail closed when Turnstile secrets are missing or verification fails.

When explicitly enabled in a future phase, email OTPs are six digits, stored only as keyed hashes, valid for five minutes, limited to five verification attempts, single-use, subject to a 60-second resend cooldown, and rate-limited by normalized email and hashed client IP. With `EMAIL_OTP_ENABLED=false`, both OTP API endpoints return `otp_disabled` before delivery or challenge access.

## 7. Pre-production checks

Run locally:

```sh
npm test
npm run test:coverage
```

On a preview deployment, test success, denial, expiry, callback replay, provider revocation/failure, logout CSRF, mobile layout, and throttling for all three providers. Confirm the signup UI has no OTP controls and both OTP feature flags remain false. Do not merge or promote production until those checks pass.

## 8. Privacy cleanup Worker and account deletion

Migration `0002_privacy_safety.sql` adds recent-authentication evidence, OAuth reauthentication
context, one-time deletion requests and non-identifying deletion receipts. Apply it to
`chatgun-auth-staging` before deploying `wrangler.cleanup.jsonc`.

The cleanup configuration is deliberately staging-only and binds only
`chatgun-auth-staging`. It deletes expired security rows in bounded daily batches and has no
public route. Do not copy it to a Production Worker until retention periods, monitoring,
backup replay and ownership are approved.

See `docs/privacy-safety-implementation.md` and `docs/minor-safety-launch-gate.md` for the
security model, staging runbook and launch blockers.
