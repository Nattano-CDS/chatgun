# Primary Admin bootstrap and dashboard validation

Validation date: 2026-10-16 (Asia/Bangkok)

This evidence applies only to the isolated ChatGun Staging environment. It does not authorize a
Production deployment, PR merge, public registration, Sensitive content, or another person's
access.

## Target and safeguards

- Cloudflare account reverified as `23017b53386fb67fc62a52cdd017454c`.
- Target database: `chatgun-auth-staging`
  (`5bbfd55d-eb22-4324-8a7d-57bef14110ea`); Production D1 was not selected or mutated.
- The owner signed in interactively. The selected opaque account was active, onboarded, linked to
  one OAuth identity, and had a fresh authenticated session. Email, provider subject, cookies,
  tokens, and profile data were not copied into the operational record or repository.
- The owner explicitly confirmed the opaque target before mutation.
- Pre-change D1 Time Travel bookmark:
  `00000035-00000018-00005106-c490ad0c76ac5593c4abfbec56b5a86b`.
- Pre-change aggregates: five users, one active synthetic grant, four role events, and no foreign-
  key violations.

## Bootstrap result

The staging-only bootstrap created three independent, audited grants:

- `moderation_admin`;
- `report_reviewer`; and
- `safety_admin`.

All expire on 2026-11-15 at 22:48 Asia/Bangkok. `identity_reviewer` was deliberately excluded.
Post-change aggregates show four active grants in total (three owner grants plus the existing
time-bounded synthetic test grant), three matching owner grant events, and no foreign-key
violations. No permanent role, Production role, email allowlist, or shared Admin account was
created.

## Simplified routine dashboard

- An authorized reviewer opens the Dashboard and Overview loads immediately.
- The Overview endpoint assigns `routine_admin_dashboard_access` on the server and records it in
  `media_safety_audit_events`; it does not accept a browser-supplied replacement for that purpose.
- A valid session and explicit reviewer role remain mandatory. An ordinary member receives 403.
- Routine aggregate Overview does not require a fresh ten-minute reauthentication.
- Restricted queues, report narratives, private media, and evidence still require an explicit
  case-specific justification. Media/report/appeal actions still require decision reasons.
- Role administration, private-object access, writes, and account deletion retain applicable
  recent-authentication, CSRF, same-origin, role, purpose, and session controls.

## Deployed Preview and automated evidence

- Implementation commit: `f34a174`.
- Isolated Preview: `https://b5338fde.chatgun.pages.dev`.
- Unit/integration/security: 78 passed, 0 failed, 0 skipped.
- Focused Dashboard Playwright: 2 passed across desktop and mobile.
- Full deployed desktop/mobile Playwright: 32 passed, 0 failed, and four intentional duplicate-
  mutation skips.
- The routine Overview test verifies the fixed audit purpose, stale-but-valid routine session,
  ordinary-user denial, and two audited queue views.
- A live synthetic `safety_admin` request to the deployed Overview returned 200 without a purpose
  header; a live ordinary-member request returned 403. D1 recorded exactly one matching
  `queue_view` with `media_id=overview` and `purpose=routine_admin_dashboard_access`.
- Existing role-management tests verify unauthorized grant denial, self-grant denial, audited
  grant/revoke, immediate post-revocation denial, and stale-authentication denial.
- Existing deletion tests verify recent authentication and CSRF requirements.
- Staging migrations `0001`–`0010` have no pending work. Foreign-key and duplicate provider-
  subject checks returned no rows. The cleanup Worker completed all five due R2 operations.
  Pending/exhausted deletions, pending-deletion media, orphan reviews, active Sensitive media, and
  active Prohibited media are all zero. The three owner grants remained active after the run.
- Five staging users remained: two non-synthetic accounts were preserved and three reserved
  synthetic accounts remained after the destructive synthetic account-deletion scenario.
