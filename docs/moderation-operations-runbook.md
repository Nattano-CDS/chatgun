# Moderation operating procedures

Draft updated for the confirmed Phase 1 model in which the owner is the single primary
administrator, moderator, and Trust & Safety decision maker. Staffed coverage is approved for
every day from 19:00–22:00 Asia/Bangkok (21 hours/week). Reporting remains available 24/7 and
queues outside coverage, without an immediate-response guarantee. The exact account, access
grant, training evidence, alert/support channel, emergency/legal route, and backup remain
unverified; real-user activation therefore remains blocked. See
`single-admin-beta-operations.md` for the daily procedure and owner-approval fields.

## Access and case handling

Use individual accounts with least-privilege roles: `moderation_admin` only for time-bounded role
administration, `report_reviewer` for report queues,
`identity_reviewer` for identity evidence, and `safety_admin` only for message/media access
and high-risk decisions. Require recent authentication, a case-specific purpose, and no
shared accounts. Review audit logs weekly; a reviewer must not handle a case involving
themselves or a close relationship. Remove access immediately on role change. Never export
case content to personal devices or informal chat.

For every case: acknowledge, preserve only necessary evidence, assess urgency, apply the
least intrusive effective action, record reason and decision, notify affected users when
safe/lawful, offer an appeal, and schedule evidence deletion under the approved policy.

The current tools provide report, message, identity-evidence, and quarantined-media queues.
Every queue/object view and decision requires a case-specific purpose and is audited. The
technical capability must remain disabled until named people are assigned the roles below:

| Duty | Minimum assignment before real Beta |
| --- | --- |
| Intake/reports | Owner primary; daily 19:00–22:00 coverage; backup unresolved; reports queue 24/7 |
| High-risk escalation | Named safety owner with a reachable escalation channel |
| Media review | Trained `safety_admin`; no reviewer may use a shared account |
| Privacy/security incident | Named technical owner for location, access, and deletion failures |
| Appeals | Different reviewer from the original decision where possible |

Role assignment and revocation follow `admin-access-role-management.md`. An admin role alone does
not reveal case queues or private evidence, and reviewer roles cannot manage access.

## Media review and classification

1. **Pending:** all gallery and chat images remain private after upload. A `safety_admin` opens only
   the necessary object with a case-specific purpose; never download it to a personal device.
2. **General:** release only when the image complies with the approved rules and the recorded reason
   explains the decision. Scanner output, if later approved, is triage evidence—not an automatic
   release decision.
3. **Sensitive:** classify for policy accuracy, but do not enable member delivery. Both Preview and
   Production keep `SENSITIVE_CONTENT_ENABLED=false`; self-declared adulthood is insufficient.
4. **Prohibited:** reject immediately. D1 access is revoked before R2 deletion, the selected profile
   photo is cleared, and the object enters the retrying deletion queue. Escalate NCII, suspected
   child sexual abuse material, credible threats, or other legally sensitive content through the
   approved process; do not independently redistribute or investigate it.
5. **Reclassification:** record why the prior category was wrong. Sensitive/prohibited changes take
   effect on the next request; optimistic revisions prevent silent reviewer overwrite.

Every decision needs a concise rule-based reason. Do not include names, contact information, image
descriptions beyond what is necessary, or copied report text in the reason field.

## Triage

| Report | Immediate action | Escalation |
| --- | --- | --- |
| Harassment | Confirm block protection; restrict contact; review pattern | Repeat/severe cases to safety lead |
| Credible threat | Do not promise emergency response; preserve minimum evidence; restrict account | Named emergency lead and local emergency/legal protocol |
| Impersonation | Limit discovery; request proportionate proof from claimant | Identity reviewer; appeal for accused user |
| NCII | Hide/quarantine immediately; prevent re-sharing; minimize viewing | Trained safety lead and qualified legal guidance |
| Child safety | Quarantine; stop contact; do not conduct amateur investigation | Designated child-safety/legal reporting process |
| Spam | Rate-limit/restrict; identify coordinated accounts | Abuse operations; preserve minimal linkage evidence |
| Privacy/location | Hide content/profile/location; block querying account | Security lead for inference or stalking pattern |

If someone appears in immediate danger, the product should direct them to local emergency
services; ChatGun must not claim 24/7 monitoring until it actually exists. Law-enforcement
requests require identity/authority verification and qualified legal handling. Never disclose
reporter identity to the reported user.

## Report workflow mapped to the implementation

1. **Receive (`pending`):** the participant submits a category and details. The intake primary
   opens only the pending queue, supplies a case-specific purpose, and checks for immediate
   protective action. Queue access is recorded in `moderation_audit_events`.
2. **Triage:** validate the category without demanding unnecessary evidence. For credible
   threats, NCII, child-safety, or location-stalking reports, protect first (block/restrict,
   hide/quarantine where available) and set the case to `escalated`. Do not promise emergency
   monitoring or investigate outside the approved procedure.
3. **Review (`reviewed`):** record the decision and a concise reason. Message or media access is
   allowed only to a `safety_admin`, only where necessary, with a case-specific purpose. Avoid
   downloading or copying evidence outside ChatGun.
4. **Escalate (`escalated`):** route to the named safety owner. Legal, child-safety, law-
   enforcement, and emergency actions require the applicable verified process; reviewer tools
   do not confer legal authority.
5. **Resolve (`closed`):** confirm the protective action, participant communication where safe,
   appeal route, and evidence-deletion follow-up. A closed case must not be silently reopened;
   create a new linked case or operational record if later facts require review.
6. **Quality review:** a different person samples decisions and audit events, checks role use,
   purpose quality, unusual access, reversals, and overdue escalations.

The implemented report statuses are `pending`, `reviewed`, `escalated`, and `closed`. Media
rejections have an in-product appeal table and decision notification; broader account/report
actions do not yet have a participant appeal register. The code does not provide SLA timers,
on-call paging, or emergency-service integration. Until the owner selects an approved support
channel and a durable register for non-media appeals, these are operational blockers—not
features to claim in participant notices.

## Shift opening and closing

At 19:00 Asia/Bangkok, the owner confirms access, reads Critical/High and escalated counts,
checks deletion/quarantine alerts, and records the opening check. At 22:00, they record every
open high-risk case and apply available containment; if no qualified handoff exists, pause
invitations and affected contact features. Never leave a high-risk case assigned to an
unmonitored shared inbox.

The coverage hours are approved. The owner must still set escalation contacts and the
participant-facing support/alert channels. Outside coverage, incoming reports remain queued;
there is no guaranteed immediate response. Do not publish numerical response targets until
staffing has demonstrated them.

Use this handover record without copying evidence: open case ID, severity, current protection,
next required action, owner, approved deadline (if any), deletion/appeal state, and confirmation
that the receiving reviewer accepted it. If no qualified recipient accepts a high-risk case,
suspend the affected capability and notify the named owner; a note in an unmonitored inbox is not
a handover.

## Takedown and external requests

Treat a user takedown request as a report unless an approved legal process establishes another
route. Verify the requester's account or authority proportionately, protect the content while the
request is assessed, preserve only necessary evidence, record the legal/safety escalation owner,
and separate a safety decision from a legal-demand decision. Do not disclose reporter identity or
account data to a requester. Law-enforcement, court, copyright, privacy-rights, and emergency
requests require an owner-approved intake channel and qualified legal review; the moderation UI
does not authenticate external authority.

## Deletion and queue failures

Rejection and account deletion deny application access before R2 cleanup. The scheduled worker
uses exponential retry and an idempotent object delete; after ten failed attempts it stops normal
retry and reports an aggregate `exhausted` count. A nonzero count requires the technical owner to
keep media disabled, compare private R2/D1 counts, repair the underlying binding/service issue, and
run a controlled retry. Never log object keys, bytes, user emails, or provider identities in
alerts. Restores from D1 Time Travel or backup must replay deletion intents before media access is
enabled.

## Appeals and quality

Appeals must be reviewed by someone other than the original decision-maker when possible.
Track reversals and category-specific error rates. Sample closed cases for consistency and
misuse. Audit searches, bulk access, unusual reviewer volume, after-hours access, and access
without a valid purpose. Suspend tools on audit failure. Publish response targets only after
staffing and coverage have been demonstrated.

Media appeals use the in-product queue and notification. Appeals for broader account/report
actions must use the owner-approved support channel and a restricted, auditable register. Record
the original case reference, appeal grounds, independent reviewer, outcome, and notification date
without copying more content than necessary. The current application does not implement that
broader register; owner and privacy review must select it before real Beta access.
