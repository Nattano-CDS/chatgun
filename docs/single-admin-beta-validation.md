# Single-admin controlled Beta validation

Validation date: 2026-10-16 (Asia/Bangkok)
Implementation commit: `58dba13`
Isolated Preview: `https://6706d666.chatgun.pages.dev`

This is Staging evidence only. It does not authorize Production deployment, a PR merge, public
registration, real-user invitations, Sensitive content, or a real Admin grant.

## Implemented

- Added a unified severity-sorted urgent queue plus separate pending media, user report, media
  report, appeal, and audit views.
- Added Critical/High/Medium/Low triage indicators and open-item age. These are deterministic
  workload aids, not automated policy or legal decisions.
- Added aggregate rolling 24-hour intake/resolution, oldest-open-item, pending R2 deletion, and
  exhausted-cleanup indicators. Responses contain counts/timestamps, not reporter identity,
  object keys, provider subjects, or evidence.
- Added the approved daily 19:00–22:00 Asia/Bangkok coverage state to the dashboard. Reporting
  remains available 24/7 and queues outside the window; the UI makes no immediate-response claim.
- Preserved recent-authentication, purpose logging, CSRF, least-privilege roles, private object
  access, decision revisions, quarantine, and audit controls.
- Added the confirmed single-owner operating model, approved daily 19:00–22:00 Asia/Bangkok
  coverage, 24/7 queued-report/no-immediate-response notice, daily checklist,
  severity/escalation matrix, emergency limits, backup onboarding/handover, monitoring, release
  gate, and rollback sequence in `single-admin-beta-operations.md`.

## Test evidence

| Check | Result |
| --- | --- |
| Unit/integration/security | **78 passed, 0 failed, 0 skipped** |
| Playwright desktop/mobile | **32 passed, 0 failed, 4 intentional duplicate-mutation skips** |
| Focused local dashboard Playwright | **2 passed** across desktop and mobile before deployment |
| Deployed full Playwright regression | **32 passed, 0 failed, 4 intentional duplicate-mutation skips** on `6706d666` |
| Live overview endpoint | **200** with pending/general/Sensitive/rejected, user/media report, appeal, severity, rolling workload, oldest-open, and cleanup aggregates |
| Live private media/moderation | **PASS** for quarantine, audited view/release, report, prohibited reclassification, appeal, relationship/block revocation, and delete queue |
| Live account deletion | **PASS** for session/access revocation and queued R2 cleanup |

The deployed full suite used only reserved `cg-stage-*` identities. Before reseeding, Staging had
four users: three reserved synthetic users and one preserved unrelated account. A D1 Time Travel
bookmark was recorded before the latest run:
`00000033-00000000-00005106-35573f0f30bd21d3b8807aa216299dec`.

Post-test staging checks:

- migrations `0001`–`0010`: no pending migration;
- `PRAGMA foreign_key_check`: no rows;
- duplicate `(provider, subject)`: no rows;
- pending media deletion operations: `0`;
- exhausted media deletion operations: `0`;
- pending-deletion media rows: `0`;
- active Sensitive media: `0`;
- active Prohibited media: `0`; and
- final users: four, comprising one preserved unrelated account and three remaining reserved
  synthetic accounts after Charlie's destructive deletion E2E.

## Access decision

No real Admin/Moderator privilege was assigned. The seed created only a short-lived synthetic
`safety_admin` grant for `cg-stage-moderator`, limited to the staging test. The intended owner's
real ChatGun account has not been privately verified, and the bootstrap two-person comparison has
not occurred. Production keeps moderation disabled.

## Assessment

- **GO:** synthetic Staging exercises and owner review of the single-admin operating model.
- **NO-GO:** real-user controlled Beta or Production. Required owner actions are exact account
  verification, approved support/alert channels, qualified emergency/legal path,
  independent appeal/backup arrangement, content-scanning or demonstrated manual-review capacity,
  and qualified legal approval. Coverage is approved, but is not 24/7 and carries no immediate
  response guarantee. Public registration and Sensitive content remain disabled.
