# Moderation operating procedures

Draft for an operator who has not yet confirmed moderation staffing. The tools remain
disabled until named reviewers, coverage, training, and escalation contacts exist.

## Access and case handling

Use individual accounts with least-privilege roles: `report_reviewer` for report queues,
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
| Intake/reports | Named primary and backup; published coverage hours |
| High-risk escalation | Named safety owner with a reachable escalation channel |
| Media review | Trained `safety_admin`; no reviewer may use a shared account |
| Privacy/security incident | Named technical owner for location, access, and deletion failures |
| Appeals | Different reviewer from the original decision where possible |

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

The implemented report statuses are `pending`, `reviewed`, `escalated`, and `closed`. The code
does not yet provide a separate appeal case table, participant notification delivery, SLA
timers, on-call paging, or emergency-service integration. Until the owner selects an approved
support channel and a durable appeal register, these are operational blockers—not features to
claim in participant notices.

## Shift opening and closing

At coverage start, the assigned reviewer confirms access, reads pending and escalated counts,
checks deletion/quarantine alerts, and records the handoff. At coverage end, they hand every
open high-risk case to a named person; if no qualified handoff exists, pause invitations and
contact features. Never leave a high-risk case assigned to an unmonitored shared inbox.

The owner must set coverage hours, acknowledgement targets, escalation contacts, and the
participant-facing support channel. Do not publish numerical response targets until staffing
has demonstrated them.

## Appeals and quality

Appeals must be reviewed by someone other than the original decision-maker when possible.
Track reversals and category-specific error rates. Sample closed cases for consistency and
misuse. Audit searches, bulk access, unusual reviewer volume, after-hours access, and access
without a valid purpose. Suspend tools on audit failure. Publish response targets only after
staffing and coverage have been demonstrated.

Appeals received before an in-product appeal workflow exists must use the owner-approved
support channel and a restricted, auditable register. Record the original case reference,
appeal grounds, independent reviewer, outcome, and notification date without copying more
content than necessary. The current application does not implement that register; owner and
privacy review must select it before real Beta access.
