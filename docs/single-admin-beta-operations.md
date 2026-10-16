# ChatGun single-admin controlled Beta operations

Status: owner-review draft for the isolated controlled Beta. The owner has confirmed that they
will be the Primary Administrator, Primary Content Moderator, and Primary Trust & Safety Decision
Maker for Phase 1. The approved staffed coverage is every day from **19:00–22:00
Asia/Bangkok (UTC+7)**, totaling 21 scheduled hours per week. Reports remain available 24/7 and
queue outside those hours. This decision does not create 24/7 monitoring, guarantee an immediate
response, approve a real account for access,
publish legal terms, or authorize Production deployment.

## Operating model and boundaries

One owner may hold `moderation_admin`, `report_reviewer`, and `safety_admin` as separate,
time-bounded grants on the same individually controlled ChatGun account. Role separation still
matters: the server checks the grant required for each endpoint, role administration does not
implicitly expose evidence, each queue/object access needs a case-specific purpose, and every
write requires recent authentication plus CSRF. Never create a shared admin account.

The intended account is not yet verified. No real grant may be inserted until the owner signs in
to Staging, supplies the opaque ChatGun user ID through a private authenticated workflow, and
explicitly confirms that exact account, environment, roles, reasons, and expiry. Follow
`admin-access-role-management.md`; never identify the account by display name alone or paste a
provider subject/email into SQL, Git, chat, or a PR. The initial bootstrap still requires the
staging account/database checks and an independent comparison of the prepared target. If no second
person is available, do not silently remove that safeguard: record bootstrap as blocked and keep
moderation/public features disabled until a trusted infrastructure reviewer is available.

Single-operator limitations:

- the owner cannot provide independent first-instance review and appeal review at the same time;
- high-risk events received outside coverage may wait until the next review window;
- the service must not advertise emergency response or continuous monitoring;
- when the owner is unavailable, new uploads remain quarantined and unreviewed; and
- messaging, discovery, uploads, or invitations must be paused when open risk exceeds the owner's
  demonstrated capacity.

## Dashboard and queue order

The Admin Dashboard now provides a unified **งานด่วน** queue, separate user-report/media-report/
appeal/media queues, severity indicators, age of each open item, a rolling 24-hour workload
summary, and aggregate R2 deletion health. It does not expose reporter identity in the UI and does
not make automated legal or policy decisions.

Process queues in this order:

1. Critical and already escalated reports: apply immediate in-product protection when opened.
2. High-severity privacy, location, violence, or sexual-content cases.
3. Appeals, starting with the oldest; record the conflict where the same owner made the original
   decision and obtain later backup review when available.
4. Reported media and remaining pending media, oldest first.
5. Routine harassment/impersonation, spam, audit review, and deletion reconciliation.

Severity is a triage aid and may be raised manually when context indicates greater risk. Never
lower severity merely to meet a workload target.

| Level | Dashboard examples | Required first action when reviewed | Escalation limit |
| --- | --- | --- | --- |
| Critical | Suspected NCII, minor safety, already escalated case, credible imminent violence | Quarantine/hide, block contact where applicable, preserve only necessary evidence, record the reason | Owner invokes the approved emergency/qualified legal route; do not investigate or redistribute evidence |
| High | Violence without confirmed imminence, privacy/location exposure, sexual content, reported pending media | Restrict exposure and assess continuing harm | Resolve or explicitly escalate within the same staffed coverage block |
| Medium | Harassment, impersonation, media appeal | Confirm block/contact safeguards and review history proportionately | Complete in the next staffed block; disclose reviewer conflict in an appeal |
| Low | Spam, other/routine pending media without reports | Rate-limit/restrict as supported and review oldest first | Batch only after higher levels are controlled |

The current schema has no dedicated severity column; severity is derived from normalized reason and
case status for display. Durable manual overrides, cross-case linkage, and non-media appeal records
remain future work requiring a reviewed migration.

## Approved coverage

- The owner staffs moderation **every day from 19:00–22:00 Asia/Bangkok (UTC+7)**: three hours
  per day and 21 scheduled hours per week.
- User reporting remains available 24/7. Reports received outside coverage are stored in the same
  audited queue and reviewed during the next staffed window, with Critical and High items first.
- The service does not promise immediate acknowledgement or resolution outside—or within—the
  staffed window and must not describe this schedule as 24/7 monitoring.
- At 19:00 the owner checks Critical/High cases before routine queues. At 22:00 the owner records
  unresolved risk and applies available containment; an open inbox after 22:00 is not monitored
  coverage.
- If the owner cannot staff the approved window, media remains quarantined and invitations or
  affected real-time capabilities must be paused before the gap begins.

Remaining owner approval fields:

- [ ] Confirm the private alert channel used by Cloudflare/GitHub monitoring: ____________________
- [ ] Confirm the participant-facing report/support channel: ____________________
- [ ] Confirm the qualified legal/emergency escalation contact or keep real-user Beta blocked.
- [ ] Date and sign the operational decision: ____________________

## Emergency procedure

1. On opening a Critical case, record a case-specific purpose and minimize further evidence access.
2. Apply reversible protection immediately where available: quarantine media, restrict the
   reported account/contact path, and confirm blocking. Do not promise an external outcome.
3. For apparent immediate danger, direct the reporter to Thai/local emergency services. The owner
   must not represent ChatGun as dispatching or monitoring emergency services.
4. Suspected child sexual abuse material, NCII, law-enforcement demands, and credible threats use
   only an owner-approved qualified reporting/legal procedure. Do not download, forward, or conduct
   amateur identification/investigation.
5. Record the minimum reason, protection, time, and next action in the audited workflow. Do not
   copy sensitive evidence into email, chat, spreadsheets, or PRs.
6. If no qualified escalation path exists, keep the affected capability/content disabled and mark
   the real-user Beta **NO-GO**. Technical moderation access does not confer legal authority.
7. After containment, review role/object access, revoke compromised sessions/grants, reconcile D1/
   R2 deletion, and document a non-identifying incident outcome.

## Daily checklist

### Opening coverage at 19:00

- [ ] Reauthenticate; confirm the exact Staging hostname/account and case-specific purpose.
- [ ] Read Critical/High counts, oldest open item, and rolling 24-hour intake/resolution.
- [ ] Review escalated user/media reports, then pending appeals and reported media.
- [ ] Confirm new uploads remain quarantined and Sensitive delivery remains disabled.
- [ ] Check R2 deletion pending/exhausted counts; any exhausted item pauses media release.
- [ ] Check Cloudflare Pages/Functions/D1/R2 health and aggregate OAuth/Turnstile failure changes.

### During review

- [ ] Protect first, view the minimum evidence, and record rule-based reasons.
- [ ] Never expose reporter identity or copy private evidence to a personal system.
- [ ] Disclose self-review conflict on appeals and queue later independent review when available.
- [ ] Confirm every prohibited/rejected item is inaccessible before relying on asynchronous delete.

### Closing coverage at 22:00

- [ ] Recheck Critical/High and oldest-open counts; explicitly escalate unresolved Critical cases.
- [ ] Verify deletion queue has no exhausted retries and scheduled Worker is healthy.
- [ ] Review unusual role use, object access, generic purposes, or access outside approved hours.
- [ ] Record capability pauses and the next staffed block; do not call an inbox a handover.
- [ ] If capacity is exceeded, stop invitations and disable the affected Preview/Beta flags.

## Backup moderator onboarding and handover

No backup is currently confirmed. Until one is named, participant-facing materials must say that
coverage depends on one operator and appeals may not be independently reviewed.

When the owner selects a backup:

1. verify their individual account and acceptance/onboarding state without sharing credentials;
2. complete policy, evidence-minimization, NCII/child-safety, emergency, privacy, R2, and audit
   training using synthetic cases;
3. grant only `report_reviewer` first for a maximum 30-day probation; add `safety_admin` only after
   a private-media drill, and never add `moderation_admin` by convenience;
4. test denied access before grant, permitted least-privilege access, revocation, and post-revoke
   denial; review every audit event;
5. run shadow decisions on synthetic General/Prohibited cases and an appeal conflict; and
6. record handover using only opaque case ID, severity, current protection, next action, owner,
   approved target, deletion/appeal state, and explicit acceptance—never copied evidence.

The backup should review appeals decided originally by the owner where feasible. If the backup is
unavailable, label the conflict, keep protective restrictions in place, and do not claim
independent appeal review.

## Operational monitoring

| Signal | Check | Trigger | Safe response |
| --- | --- | --- | --- |
| Pages/Functions | Deployment health, 5xx rate, moderation API availability | sustained failures or unexpected Production deployment | pause Beta flags; verify last known release; rollback Preview alias/deployment only after scope check |
| D1 | query errors, foreign keys, migration history, oldest/open workload | any FK violation, unexpected migration, inaccessible queue | stop writes/features; create bookmark; investigate without Production mutation |
| Authentication | aggregate callback failure reasons, Turnstile rejection/rate changes, session errors | unexplained provider-wide increase or replay/CSRF signal | keep registration closed; verify provider status/config; revoke affected sessions if justified |
| R2/media | pending/exhausted deletion counts, missing object errors, quarantine age | `exhausted > 0`, member-visible pending media, or D1/R2 mismatch | stop media release/upload; repair binding/Worker; retry only after cause is fixed |
| Moderation access | active/expiring grants, after-hours access, generic purpose, unusual object volume | unauthorized/compromised access or expired responsibility | revoke grant and sessions immediately; disable account/tools; preserve minimal audit evidence |
| Workload | Critical/High count, oldest open item, intake vs resolution | any uncontained Critical item or sustained intake above capacity | pause invitations and implicated social features; do not broaden access to compensate |

Alerts must contain counts/reason codes only—never object keys, content, email, provider subject,
precise location, or report narrative. An alert channel and recipient are not yet approved, so this
is a monitoring checklist rather than a claim that paging exists.

## Controlled Beta release and rollback

### Release gate

- [x] Owner approved daily staffed coverage of 19:00–22:00 Asia/Bangkok (21 hours/week).
- [ ] Owner approves the support/alert channels, emergency/legal route, policies, and participant
  notice; qualified Thai legal review remains required.
- [ ] Exact owner account is privately verified; time-bounded grants and revocation drill pass.
- [ ] No unresolved Critical case; workload is within two daily blocks.
- [ ] Quarantine is enabled, Sensitive is disabled, and no public R2 access exists.
- [ ] D1 `0001`–`0010`, foreign keys, backup/bookmark, R2 cleanup, and restore/deletion replay pass
  in Staging. Production change window still needs separate approval.
- [ ] Provider, session, CSRF, RBAC, cross-user, deletion, and desktop/mobile tests pass.
- [ ] Public registration remains disabled; no real invitation is issued by this change.

### Rollback triggers

- unauthorized moderator/private-media access;
- pending or Sensitive/Prohibited media becomes member-visible;
- failed account deletion or exhausted R2 deletion;
- precise-location disclosure/inference regression;
- unexplained authentication/session/CSRF bypass;
- uncontained Critical report or operator unavailability; or
- legal/provider/Cloudflare suspension or material policy mismatch.

### Rollback sequence

1. Disable affected social/media/moderation flags and stop invitations; preserve login/logout and
   necessary privacy/deletion access where safe.
2. Revoke compromised grants/sessions; quarantine or restrict implicated objects/accounts.
3. Pin/restore the last validated Preview deployment only after verifying its bindings and commit.
4. Create a Staging D1 bookmark, reconcile D1/R2, and drain deletion intents. Never restore deleted
   content to visibility merely because Time Travel restored metadata.
5. Run focused security tests, then the full suite. Reopen only after owner review and documented
   corrective action. Production rollback requires a separately approved change window.

## Current assessment

- **GO:** dashboard engineering, synthetic Staging drills, and owner review of this operating model.
- **NO-GO:** real-user Beta or Production. The intended admin account, support/alert channels,
  emergency/legal route, independent appeal capacity, scanning/review plan, and legal approval are
  not yet verified. The coverage schedule is approved but is not 24/7 and has no guaranteed
  immediate response. Sensitive content and public registration remain disabled.
