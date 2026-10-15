# ChatGun authentication provider setup

This runbook is for the ChatGun Cloudflare account only.

- Cloudflare account ID: `23017b53386fb67fc62a52cdd017454c`
- Pages project: `chatgun`
- Preview database: `chatgun-auth-staging`
- Stable Preview origin: `https://feature-cloudflare-auth.chatgun.pages.dev`
- Environment: Cloudflare Pages **Preview** only until provider E2E testing passes

## Staging configuration status (2026-10-16)

- Google: separate `ChatGun` project and `ChatGun Preview` web client created; Preview
  origin/callback registered; external testing mode with an authorized test user; Preview
  client ID and secret configured.
- Facebook: separate `ChatGun` app created in development mode; Facebook Login and
  `email` permission enabled for testing; Preview callback registered. App-secret export
  remains blocked on Meta password reauthentication.
- LINE: separate `ChatGun` provider and LINE Login channel created in Developing status;
  Preview callback registered; Preview channel ID and secret configured. Email permission
  remains blocked on screenshot upload and LINE review approval.
- Resend: the only visible team, `nat.tanouxui`, is empty and cannot be identified as the
  PiggyPrice integration owner. No API key or domain was created.
- Turnstile: the existing dedicated ChatGun Preview widget and its Preview secrets were
  preserved. SMS OTP remains disabled.

Do not copy credentials from PiggyPrice. Reusing a developer account means creating a
separate ChatGun project, application, channel, widget, or API key in that account.

## Preview callback URLs

Register these exact HTTPS callback URLs:

- Google: `https://feature-cloudflare-auth.chatgun.pages.dev/api/auth/oauth/google/callback`
- Facebook: `https://feature-cloudflare-auth.chatgun.pages.dev/api/auth/oauth/facebook/callback`
- LINE: `https://feature-cloudflare-auth.chatgun.pages.dev/api/auth/oauth/line/callback`

Do not register an immutable deployment hostname such as `<deployment>.chatgun.pages.dev`.
The branch alias above remains stable across Preview deployments.

## Google

1. In the existing Google developer account, create a separate Google Cloud project named
   `ChatGun` (do not add the client to the PiggyPrice project).
2. Configure the OAuth consent screen for ChatGun.
3. Create an OAuth 2.0 client of type **Web application** named `ChatGun Preview`.
4. Add the Preview origin as an authorized JavaScript origin.
5. Add the exact Google callback URL above as an authorized redirect URI.
6. Keep the application in testing mode and add only authorized test users for Preview.
7. Store the new client ID as `GOOGLE_CLIENT_ID` and the new secret as
   `GOOGLE_CLIENT_SECRET` in the ChatGun Pages Preview environment.

## Facebook Login

1. In the existing Meta developer account, create a separate app named `ChatGun`.
2. Add the Facebook Login use case/product for a web application.
3. Set the site URL to the stable Preview origin.
4. Add the exact Facebook callback URL above to **Valid OAuth Redirect URIs**.
5. Keep the app in development mode and add authorized developer/tester accounts.
6. Use the Graph API version selected for the new app as `FACEBOOK_GRAPH_VERSION`.
7. Store the new app ID as `FACEBOOK_CLIENT_ID` and the new app secret as
   `FACEBOOK_CLIENT_SECRET` in the ChatGun Pages Preview environment.

## LINE Login

1. In the existing LINE developer account, create a separate **LINE Login** channel named
   `ChatGun` under the appropriate provider. Never reuse the PiggyPrice channel.
2. Select **Web app** and Thailand as the service region where applicable.
3. Add the exact LINE callback URL above in the LINE Login tab.
4. Request email-address permission before relying on the `email` scope.
5. Keep the channel in Developing status and add authorized testers for Preview.
6. Store the new channel ID as `LINE_CLIENT_ID` and the new channel secret as
   `LINE_CLIENT_SECRET` in the ChatGun Pages Preview environment.

## Resend

1. Use the existing Resend team only after confirming which login owns the PiggyPrice
   integration. Do not reuse an existing API key.
2. Add and verify a dedicated ChatGun sending domain or transactional subdomain. A
   subdomain such as `auth.chatgun.social` isolates transactional-mail reputation.
3. Create a restricted API key named `ChatGun Preview`; restrict it to the ChatGun domain
   when the Resend plan and UI support that option.
4. Store it as `RESEND_API_KEY` in the ChatGun Pages Preview environment.
5. Set `EMAIL_FROM` to a sender on the verified ChatGun domain.

## Cloudflare Turnstile

Create a separate managed widget in the ChatGun Cloudflare account:

- Name: `ChatGun Preview Authentication`
- Hostname: `feature-cloudflare-auth.chatgun.pages.dev`
- Mode: Managed
- Pre-clearance: disabled / no clearance

Store the public sitekey as `TURNSTILE_SITE_KEY` and the secret as
`TURNSTILE_SECRET_KEY` in the Pages Preview environment. Do not create this widget in the
PiggyPrice Cloudflare account.

## Pages Preview variables and secrets

Non-secret variables:

- `EMAIL_FROM`
- `GOOGLE_CLIENT_ID`
- `FACEBOOK_CLIENT_ID`
- `FACEBOOK_GRAPH_VERSION`
- `LINE_CLIENT_ID`
- `TURNSTILE_SITE_KEY`

Secrets:

- `OTP_PEPPER`
- `RATE_LIMIT_PEPPER`
- `RESEND_API_KEY`
- `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_SECRET`
- `LINE_CLIENT_SECRET`
- `TURNSTILE_SECRET_KEY`

Generate `OTP_PEPPER` and `RATE_LIMIT_PEPPER` independently with a cryptographically secure
random generator. Never place any value in this repository, shell history, CI logs, issue,
or pull-request comment.

Set each secret interactively so it is not present in a command argument:

```sh
npx wrangler@4.151.0 pages secret put SECRET_NAME --project-name chatgun --env preview
```

Configure non-secret variables in Cloudflare Dashboard under **Workers & Pages > chatgun >
Settings > Variables and Secrets > Preview**. Verify the environment selector before every
change.

## Verification gate

Before enabling a provider outside Preview:

1. Confirm `/api/auth/config` reports only the intended configured providers.
2. Exercise start, cancel/error, callback, existing-account login, and new-account login.
3. Confirm invalid, expired, and replayed state is rejected.
4. Confirm provider identities cannot link to an existing account through an unverified
   email address.
5. Confirm logout invalidates the session and clears the secure cookie.
6. Confirm no secret appears in browser source, network responses, Pages logs, screenshots,
   or test artifacts.
7. Record untested flows as blocked; never report them as passing.
