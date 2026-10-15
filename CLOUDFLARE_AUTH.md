# Cloudflare Pages Auth Setup
This is a first implementation of ChatGun login on Cloudflare Pages Functions and D1. Email OTP uses Resend; SMS is intentionally disabled.
1. Create D1: npx wrangler d1 create chatgun-auth
2. Set D1 binding named DB in Cloudflare Pages project and run: npx wrangler d1 execute chatgun-auth --remote --file=schema.sql
3. Configure encrypted Pages secrets: OTP_PEPPER, RESEND_API_KEY, EMAIL_FROM, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET, LINE_CLIENT_ID, LINE_CLIENT_SECRET.
4. Verify your sending domain in Resend and configure provider callback URLs: https://chatgun.social/api/auth/oauth/PROVIDER/callback (replace PROVIDER with google/facebook/line).
5. Test all providers, OTP expiry, session and logout on staging before public launch.

Security review still required: Cloudflare Turnstile and edge WAF rate limits, CSRF on logout, provider-specific ID token and nonce verification, OAuth account linking, provider error handling, abuse protection, cleanup of expired rows, PDPA consent and privacy policy. Do not activate for real users until validated. No provider secrets should ever be committed to GitHub.
