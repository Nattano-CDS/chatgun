# Controlled Beta owner decision checklist

Status: **owner/legal/operations approval required; no real invitations authorized**  
Candidate: `50f00208825925b4118f2b1477055e91e6e20c1b`  
Date: 2026-10-16 (Asia/Bangkok)

Record each decision with the approver, date, reviewed document version, conditions, and review
date. A checked box without that record is not approval. Qualified Thai legal review is required
where marked; this checklist is not legal advice.

## 18+ eligibility and assurance

- [ ] Confirm that the Beta is limited to adults and obtain qualified Thai legal advice on the
  threshold, contractual capacity, and whether the available social/location features change
  the required assurance.
- [ ] Decide whether invitation plus DOB self-declaration is proportionate for Wave 1. It is not
  independent age verification and must never be described as verified age.
- [ ] Approve the exact adult notice version, correction/appeal path, re-check triggers,
  anti-evasion response, and minimized evidence retention.
- [ ] Decide whether any feature requires a privacy-preserving age-assurance vendor before it is
  enabled. Approve vendor privacy, accessibility, error, appeal, data-transfer, and deletion
  terms before integration.
- [ ] Confirm that 13–17 accounts are out of scope. If that changes, stop and design a separate
  parental-authorization and child-safety program.

## Location privacy

- [ ] Choose the Wave 1 position: **recommended—location/discovery off**.
- [ ] Before any later activation, approve the purpose/lawful basis, foreground consent notice,
  50 m input-accuracy rule, two-minute expiry, 250 m output bands, off/revocation behavior, and
  residual home/workplace inference risk.
- [ ] Approve the multi-account/collusion detection approach and retention of minimized abuse
  identifiers; run dense and rural field tests and a stalking/triangulation tabletop.
- [ ] Name the person authorized to disable discovery immediately during an incident.

## Moderation staffing and escalation

- [x] Owner is the intake primary; staffed coverage is every day 19:00–22:00 Asia/Bangkok
  (21 hours/week). Reporting remains available 24/7 and queues outside coverage.
- [ ] Name a backup moderator using an individual account and document absence handoff. No backup
  is currently assigned.
- [ ] Approve participant-facing wording that there is no 24/7 monitoring or guaranteed immediate
  response, plus the report/support and restricted alert channels.
- [ ] Name the safety escalation owner and technical privacy/security owner, with reachable
  channels during the approved coverage period.
- [ ] Assign least-privilege roles (`report_reviewer`, `safety_admin`, and, only if later needed,
  `identity_reviewer`); prohibit shared accounts.
- [ ] Select the participant support/report channel and a restricted, auditable case/appeal
  register. The application does not yet provide participant notifications or an appeal table.
- [ ] Rehearse harassment, credible threat, impersonation, NCII, child-safety, spam, location
  stalking, deletion failure, provider compromise, and lost-access cases.
- [ ] Approve when invitations/contact features pause: no qualified coverage, overdue high-risk
  case, audit misuse, or unavailable escalation owner.

## Appeals and participant communications

- [ ] Define who may notify reporters and reported users, when notice is unsafe or legally
  restricted, and how reporter identity remains confidential.
- [ ] Require an independent appeal reviewer where possible and define conflict handling.
- [ ] Approve appeal intake, acknowledgement, evidence minimization, outcome recording, and
  deletion. Do not publish response-time promises before measured staffing evidence exists.

## Media scanning and review

- [ ] Keep gallery/chat uploads off for real participants until all items below are approved.
- [ ] Select and review scanner coverage for CSAM hash matching through an authorized program,
  sexual content, violence, malware/polyglots, and duplicate abuse, including Thai error rates,
  residency, subprocessors, callbacks, auditability, and deletion.
- [ ] Enable quarantine, remove the synthetic `staging_bypass`, and prove scanner timeout/error
  stays pending rather than releasing media.
- [ ] Name trained human reviewers and an escalation/appeal path; approve necessary-access rules
  for intimate or illegal content and staff wellbeing safeguards.
- [ ] Approve deletion/backlog alerts, failed-object response, and D1/R2 reconciliation.

## Legal and Beta notice

- [ ] Owner approves the operator name and contact already confirmed in the legal draft; qualified
  Thai counsel reviews Privacy, Terms, Data Deletion, Community, Location, Media, and Beta notice
  wording before use with real participants.
- [ ] Resolve the discrepancies in `docs/controlled-beta-policy-consistency.md`.
- [ ] Approve the exact Beta notice, feature list, experimental-service warning, no-24/7-support
  statement, withdrawal/deletion route, and version shown before invitation acceptance.
- [ ] Approve retention and backup wording that matches enforceable behavior; do not promise
  selective Time Travel/backup deletion earlier than Cloudflare supports.

## Release authorization

- [ ] Select an isolated Beta hostname/configuration and confirm it cannot access Production or
  PiggyPrice resources.
- [ ] Approve Wave 1 flags, cohort size, observation period, pause thresholds, and rollback owner.
- [ ] Sign the final acceptance record after tests pass on that exact configuration.
- [ ] Issue invitations only under a separate explicit authorization. This checklist does not
  authorize invitation issuance, Production deployment, provider publishing, or PR merge.
