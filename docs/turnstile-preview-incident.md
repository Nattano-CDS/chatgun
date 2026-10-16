# Preview Turnstile incident — release candidate

Date: 2026-10-17 (Asia/Bangkok)  
Scope: ChatGun Cloudflare Preview only  
Stable test origin: <https://codex-chatgun-release-candid.chatgun.pages.dev>

## Root cause

The release-candidate branch alias was not present in the hostname allowlist for the
`ChatGun Preview Authentication v2` Turnstile widget. The page loaded the expected
Preview site key and the Turnstile JavaScript successfully, but the challenge endpoint
rejected the unlisted hostname. This produced the user-visible `Unable to connect to
website` widget.

Before the fix, both the immutable deployment (`80b06647.chatgun.pages.dev`) and the
release-candidate alias received an HTTP 400 response from the Turnstile challenge
flow. Cloudflare documents client error `110200` as “Domain not authorized.” The page
CSP already permitted `challenges.cloudflare.com`, so CSP was not the Turnstile root
cause. A separate CSP issue that blocked the approved web fonts was corrected at the
same time.

## Configuration resolution

- Verified Cloudflare account: `23017b53386fb67fc62a52cdd017454c`.
- Confirmed the Preview page's public site-key fingerprint matches the Preview widget,
  not the Production widget. No key or secret value was printed or committed.
- Added `codex-chatgun-release-candid.chatgun.pages.dev` to the Preview widget hostname
  allowlist.
- Preserved the existing `codex-near-migration.chatgun.pages.dev` and
  `feature-cloudflare-auth.chatgun.pages.dev` entries.
- Did not authorize immutable deployment hostnames. Automated and manual authentication
  checks must use the stable branch alias.
- A human-completed challenge produced a token accepted by server-side Siteverify,
  confirming that the encrypted Preview secret and public Preview site key form a
  working pair. Server validation still requires the exact request hostname and
  `auth_start` action.

The post-fix stable alias renders the managed challenge normally. The diagnostic
immutable hostname remains rejected by design.

## Application hardening

- Added explicit success, error, expiry, timeout, and unsupported-browser callbacks.
- Added Thai guidance for connectivity/content-blocker failures and a manual retry
  control.
- Configuration errors such as an unauthorized hostname now tell the visitor to contact
  ChatGun instead of retrying indefinitely.
- OAuth buttons still require a non-empty Turnstile token. No bypass or test key was
  introduced.
- Added Playwright coverage for failure guidance, retry, OAuth handoff, and CSP console
  errors on desktop and mobile.
- Changed the Playwright default and provider setup documentation to the stable
  release-candidate hostname.

## Provider callback registration

The stable release-candidate callbacks are:

- Google: `https://codex-chatgun-release-candid.chatgun.pages.dev/api/auth/oauth/google/callback`
- Facebook: `https://codex-chatgun-release-candid.chatgun.pages.dev/api/auth/oauth/facebook/callback`
- LINE: `https://codex-chatgun-release-candid.chatgun.pages.dev/api/auth/oauth/line/callback`

Google and Facebook Preview applications retain their older Preview callbacks and now
also contain the release-candidate callback. Google also contains the stable JavaScript
origin. Facebook Client OAuth Login, Web OAuth Login, HTTPS enforcement, and strict
redirect matching remain enabled. LINE registration and the final three-provider
initiation recheck are recorded in the PR evidence after interactive console access.

## Automated evidence

- Unit/integration/security: **86 passed, 0 failed, 0 skipped**.
- Playwright desktop/mobile full suite: **33 passed, 0 failed, 9 skipped**. The skips are
  the existing live-social tests that require an explicitly supplied synthetic session
  bundle; no Turnstile/auth test was skipped.
- Focused Playwright auth suite: **14 passed, 0 failed, 0 skipped**.
- Public registration, Email OTP, and Mobile OTP remain disabled.

Screenshots:

- `docs/turnstile-preview-evidence/signup-desktop.png`
- `docs/turnstile-preview-evidence/signup-mobile.png`

## Test URL rule

Use <https://codex-chatgun-release-candid.chatgun.pages.dev/signup.html> for manual
release-candidate authentication testing. Do not distribute or register an immutable
`<deployment-id>.chatgun.pages.dev` hostname because it changes on every deployment.

