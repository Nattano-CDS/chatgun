# Provider publishing readiness

Reviewed on 16 October 2026 and rechecked during PR #6 trust-and-safety preparation.

## Release decision

Google, Facebook, and LINE are individually **NO-GO** for public launch. No provider
publishing or review submission was performed. The application was not deployed to
Production.

## Legal-page audit

The repository previously contained only `privacy.html`. It had no standalone Terms of
Service or data-deletion page and described Email OTP and Resend as active even though
both Email OTP and Mobile OTP are disabled for Phase 1.

This branch now:

- describes the social-login data actually stored by the D1 schema;
- describes required cookies, hashed session/CSRF data, OAuth-flow data, hashed
  rate-limit identifiers, Turnstile, and the known 30-day session maximum;
- states that Email OTP, Mobile OTP, and Resend delivery are not active;
- adds owner-review drafts for Terms of Service and standalone data-deletion instructions;
- links the legal pages from the signup notice and site footer.

Production URL probes currently return the homepage for all three legal paths, despite
HTTP 200 responses:

- `https://chatgun.social/privacy.html`
- `https://chatgun.social/terms.html`
- `https://chatgun.social/data-deletion.html`

Therefore none of these URLs is acceptable for provider publishing yet. They must be
owner-reviewed and included in a separately approved Production deployment before any
provider is published or submitted for review.

Owner decisions still required (not invented in the drafts):

- legal name/status of the service operator;
- durable public support and privacy contact;
- effective date, minimum user age, and governing law/jurisdiction;
- account/security-log retention and verified deletion-completion timeframe;
- content rules, reporting/appeal process, and final limitation-of-liability language.

The owner should obtain appropriate legal review before approving public versions.

## Brand asset

`assets/provider/meta-app-icon-1024.png` is a deterministic 1024 x 1024 RGBA PNG render
of the existing `logo.svg`. It preserves the existing ChatGun gradient and geometry and
is below Meta's 5 MB limit. It has not been uploaded, because uploading to the provider
was not part of this preparation-only authorization.

## Google — NO-GO

Verified configuration:

- dedicated `ChatGun Production` Web OAuth client exists;
- authorized JavaScript origin is `https://chatgun.social`;
- redirect URI is exactly
  `https://chatgun.social/api/auth/oauth/google/callback`;
- audience is External and publishing status is Testing;
- homepage and privacy-policy fields are saved as `https://chatgun.social/` and
  `https://chatgun.social/privacy.html`;
- authorized domains include `chatgun.social` and the Preview Pages domain;
- only the standard OpenID Connect identity scopes used by the application are needed:
  `openid`, `email`, and `profile`.

Outstanding work:

1. Owner approves the legal content and supplies all unresolved details above.
2. Deploy the approved legal pages to Production under separate authorization.
3. Verify each public URL returns its intended document, not the homepage fallback.
4. Optionally upload the ChatGun logo to Google branding; this can trigger brand
   verification after publishing.
5. Verify `chatgun.social` ownership in the Google account/Search Console if Google asks
   for domain verification.
6. In Google Auth Platform > Audience, select **Publish app** only after explicit approval.
7. Complete any brand-verification workflow Google presents. The current Verification
   Center says verification is not required while the app remains in Testing; this is not
   a promise that no verification will be required after publishing.
8. Run a real Production login/callback/session/logout test after an independently
   approved Production deployment.

Current official Google guidance says apps using only non-sensitive scopes do not require
full sensitive-scope verification, but displaying a public app name/logo can require brand
verification. Confirm the console's scope classification immediately before publishing:
<https://support.google.com/cloud/answer/13463073>.

## Facebook / Meta — NO-GO

Verified configuration:

- dedicated `ChatGun Production` app exists and remains Unpublished;
- app domain is `chatgun.social`;
- privacy and data-deletion fields point to ChatGun URLs;
- category is Social networks & dating;
- Facebook Login callback is exactly
  `https://chatgun.social/api/auth/oauth/facebook/callback`;
- strict redirect matching and HTTPS are enabled; JavaScript SDK login, embedded-browser
  OAuth, device login, and forced reauthentication are disabled;
- App Review is Not submitted and currently lists `public_profile`;
- the Verification screen requires a business portfolio;
- the available portfolio list contains no ChatGun-named portfolio and all listed
  portfolios are unverified. None was selected or modified.

Outstanding work:

1. Owner approves the legal content and Production deploys the approved pages under
   separate authorization.
2. Upload `assets/provider/meta-app-icon-1024.png` in App settings > Basic.
3. Set the final Terms URL after the reviewed page is live.
4. Create a new ChatGun-owned Meta business portfolio or provide its Business ID. Do not
   use any existing unrelated or PiggyPrice portfolio.
5. Complete Meta business verification using the real operator identity and documents.
6. In App Review, prepare reviewer instructions and a test path that demonstrates
   Facebook Login, account creation, session creation, logout, and data deletion.
7. Submit App Review only after explicit approval and satisfy any requested permissions.
8. After approval, use Meta's Publish flow only with explicit approval.
9. Run real Production positive, denial, replay, and logout tests after an independently
   approved Production deployment.

## LINE — NO-GO

Verified configuration:

- dedicated provider `ChatGun` and channel `ChatGun Production` exist;
- channel region/owner region is Thailand and app type is Web app;
- callback is exactly `https://chatgun.social/api/auth/oauth/line/callback`;
- Privacy Policy URL points to `https://chatgun.social/privacy.html`;
- scopes/permissions are `PROFILE` and `OPENID_CONNECT`;
- email-address permission is Unapplied, which is acceptable while the implementation
  requests only `openid profile` and does not depend on LINE email;
- status remains Developing.

Outstanding work:

1. Owner approves the legal content and Production deploys the approved pages under
   separate authorization.
2. Add the reviewed Terms of Use URL to the channel.
3. Review channel name, icon, description, privacy URL, Terms URL, region, roles, and
   callback one final time.
4. If ChatGun later needs LINE email, separately apply for email permission before adding
   the `email` scope; it is not required for Phase 1.
5. With explicit approval, select **Developing > Publish** and confirm. LINE warns that
   this makes the channel available to any LINE user and cannot be undone except by
   deleting and recreating the channel.
6. Run real Production positive, cancellation, invalid-state, replay, session, and logout
   tests after an independently approved Production deployment.

LINE's current documentation confirms that Developing channels are limited to Admin/Tester
roles and cannot be returned to Developing after publication. Treat Publish as irreversible:
<https://developers.line.biz/en/docs/line-login/getting-started/>.

## Test evidence

- `npm test`: 19/19 passed after the legal-content changes.
- `npm run test:e2e`: 10/10 passed on desktop and mobile Chromium against the updated
  Cloudflare Preview branch alias. The suite covers the social-only signup UI, Turnstile
  presence, legal pages, disabled OTP configuration, same-origin enforcement, and the
  unauthenticated account redirect.
- The initial Playwright run against the old Preview correctly failed because the newly
  added legal pages had not yet been deployed. The complete rerun passed after the
  automatic Preview build for commit `e2d08a1` completed.
