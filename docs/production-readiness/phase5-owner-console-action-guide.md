# Phase 5 minimal owner console action guide

This is a private-console handoff, not authorization to execute. Never send passwords, MFA
codes, OAuth secrets, audience tags, private identities, cookies or tokens in chat or GitHub.

## Cloudflare Access

Owner action: follow the exact Production application checklist, personally complete genuine MFA,
and privately confirm the Production member UUID before any grant. Required evidence is a
sanitized read-back of destinations, policy action, MFA, 10-minute session, issuer/audience
match, successful owner challenge and successful independent revocation. Automated preparation
is complete; application creation, secrets, role grant and Production login remain owner-
authorized changes.

## Google OAuth

Current: dedicated Production Web client, exact `https://chatgun.social` origin and exact Google
callback are verified; audience is External/Testing with an authorized test user and no extra
sensitive/restricted scopes configured.

Owner action: decide whether to retain a closed owner test or publish; complete branding,
homepage/privacy/terms and verification requirements shown by Google; then authorize a genuine
cancel and owner login. Do not add scopes or publish automatically.

## Meta OAuth

Current: dedicated Production app is In development/Unpublished. Exact callback, domain,
privacy/deletion URLs, HTTPS and strict redirect matching are verified. Embedded-browser,
device and JavaScript SDK login are off. The required app icon is missing.

Owner action: add the icon, review the app's required actions and business/verification status,
confirm minimal `public_profile` permission, approve any necessary review/publishing, then
authorize genuine cancel/login. Do not add email permission without separate approval.

## LINE Business ID

Current: current read-back is blocked by a fresh LINE Business ID login and two-step verification.

Owner action: log in personally with two-step verification; open the dedicated Production LINE
Login channel and read back Developing/Published state, exact LINE callback, Web app type,
`profile openid` permissions and owner Admin/Tester eligibility. Keep email permission disabled
unless separately approved; then authorize genuine cancel/login while preserving the existing
owner identity.

## GitHub

Current: `main` is unprotected, rulesets are empty, Dependabot alerts/security updates are
disabled, and CodeQL has zero open alerts on the assessed stack.

Owner/admin action: protect `main` or apply a ruleset requiring pull requests, at least one
appropriate review, conversation resolution, `local-regression` and CodeQL checks; prohibit
force pushes/deletion and restrict bypass. Enable Dependabot alerts and security updates. Do not
merge the Draft PR stack as part of these settings changes.

## Legal and operations

Owner action: approve the exact Production policy versions/effective scope and retention
position; name the primary moderator/incident commander, backup moderator, independent appeal
reviewer, privacy/deletion operator, security alert owner and emergency/legal contact. Approve
cleanup schedules and alert destinations. Existing 19:00–22:00 Asia/Bangkok coverage is not
24/7 monitoring or immediate emergency response.
