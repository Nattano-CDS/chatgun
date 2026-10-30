# Phase 3 owner approval checklist

Candidate application SHA: `cfb94c92190a17ebb73983cef4017ca227df5d42`
Current Production source: `a73ff21…`
Current verdict: **NO-GO**

Every box requires fresh evidence. Checking this document into Git is not approval and must not
contain private account identifiers, tokens, audience values or credentials.

## Cloudflare Access and privileged operations

- [ ] Create a Production Access application protecting only the intended Production admin
  paths; privately record the exact issuer and application audience.
- [ ] Require the genuine owner identity and MFA on every access; record a sanitized successful
  login/cancel receipt without the JWT or email.
- [ ] Privately confirm the genuine Production owner member UUID before any narrow, expiring D1
  role grant.
- [ ] Exercise report review, RBAC denial, grant expiry/revocation, logout and Access-session
  revocation; prove member authentication alone cannot reach admin routes.

## OAuth providers

- [ ] Google: approve moving from External/Testing or explicitly retain a closed owner test;
  confirm origin/callback and run genuine cancel/login while Production services stay closed.
- [ ] Meta: add the required app icon, complete any Review/Verification prerequisites, approve
  publishing, reconfirm minimal permissions, and run genuine cancel/login.
- [ ] LINE: complete Business ID login and 2-step verification; read back the dedicated
  Production channel status, callback, `profile openid` permissions and owner role; run genuine
  cancel/login. Do not enable email permission without separate approval.

## Data, recovery and operations

- [ ] Authorize the exact 17→21 migration hashes, maintenance window, migration operator,
  rollback operator and immediately-pre-change protected backup. Schema 22 is excluded.
- [ ] Approve the retention/deletion policy, privacy and media cleanup Worker SHAs/configs,
  exact schedules, alert destinations and non-Production time-advanced rehearsal.
- [ ] Name the primary moderator/incident commander, backup moderator, independent appeal
  reviewer, privacy operator, security alert owner and emergency/legal contact.
- [ ] Approve the operating procedure, coverage limitation and absence/incident shutdown rule.

## GitHub governance

- [ ] Protect `main` (or apply a ruleset): pull requests, required `local-regression` and CodeQL
  checks, conversation resolution, no force push/deletion and restricted bypass.
- [ ] Enable Dependabot alerts and security updates; retain weekly bounded update configuration.
- [ ] Confirm CodeQL remains required and has zero unresolved release-blocking alerts.

## Exact release authorization

- [ ] Review the final manifest and explicitly authorize the exact SHA and scope. Deployment,
  migrations, OAuth/public activation, cleanup schedules and role grants must be separately
  stated; none are implied by a general “approve”.
- [ ] Keep registration, Social, Discovery, messaging, Presence, Media, Sensitive, youth, OTP,
  Demo and Admin grants disabled until their own genuine-human and operating gates pass.
