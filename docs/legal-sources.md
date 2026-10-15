# Legal and infrastructure sources

Reviewed 16 October 2026. Links are primary official sources where available. This list
supports review; it is not legal advice.

## Thailand

- [Personal Data Protection Act B.E. 2562 — Royal Gazette](https://ratchakitcha.soc.go.th/documents/17082307.pdf)
  - Section 19: consent requirements.
  - Section 20: consent and rights involving minors/incapacitated persons.
  - Sections 21–23: purpose limitation, data minimization and notice information including
    retention and controller contact.
  - Sections 30–36: data-subject rights including access, portability, objection, erasure,
    restriction and correction.
  - Section 37: security, deletion system and breach duties.
- Civil and Commercial Code provisions referenced by PDPA section 20 require a current
  official-text and Thai-counsel check before launch. The product design must not interpret
  a minimum age of 13 as automatic capacity to consent or contract.
- [Office of the Personal Data Protection Committee](https://www.pdpc.or.th/)

## Cloudflare

- [D1 Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)
  — automatic recovery history; 30 days on Workers Paid or 7 days on Workers Free.
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/)
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
  — documented native retention is at most seven days.
- [Turnstile overview](https://developers.cloudflare.com/turnstile/)
  — Turnstile processes data necessary for bot/security challenges and does not process
  form entries or user communications according to Cloudflare's product documentation.

## Provider privacy notices

- [Google Privacy Policy](https://policies.google.com/privacy)
- [Meta Privacy Policy](https://www.facebook.com/privacy/policy/)
- [LINE Privacy Policy](https://terms.line.me/line_terms_privacy?lang=th)
- [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/)

These links explain provider-side processing. They do not replace ChatGun's own notice or
establish each provider's controller/processor role for every service; contract and role
mapping remains an owner/legal task.

## Repository evidence

- PR #3 migration `0001_auth.sql`: account, identity, session, OTP, OAuth-flow and
  rate-limit schema.
- PR #3 `functions/_lib/db.js`: 30-day session TTL, HMAC/hashed identifiers, session and
  identity behavior.
- PR #3 `functions/api/auth/[[path]].js`: 10-minute OAuth TTL, feature-flag-disabled OTP,
  Turnstile verification, OAuth callback, CSRF and logout behavior.
- PR #3 `functions/_lib/oauth.js`: Google/Facebook/LINE scopes, server-side provider
  validation, verified-email and account-takeover controls.
