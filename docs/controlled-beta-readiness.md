# Controlled Beta readiness

Status: **NO-GO for real-user Beta, public launch, or Production.** The code is ready for
synthetic staging UAT, but the currently deployed Preview configuration is not an approved
real-participant environment. This document is operational evidence, not an approved policy
or legal statement.

## Technical boundary

- Public registration remains disabled (`NEW_ACCOUNT_REGISTRATION_ENABLED=false`). Preview alone may enable `BETA_INVITATION_REGISTRATION_ENABLED`; Production remains false.
- A new member needs a 256-bit, single-use invitation. Only its SHA-256 digest is stored. The OAuth flow stores the invitation record ID, not the code. Invitation claim, user/identity creation, and `pending_age` enrollment occur in one D1 transaction.
- Existing identities can sign in without a code. A new provider identity without a valid invitation still fails with `registration_closed`.
- An invited account cannot obtain a member profile until a recently authenticated session completes the server-side 18+ self-declaration. Passing this gate marks the Beta enrollment active. This is self-declared age, not independent age verification.
- Production social, discovery, messaging, media, moderation, adult onboarding, and Beta invitation flags remain false. Production has no `MEDIA` binding.
- Preview social/media flags are for authorized synthetic and invited staging tests only. Media quarantine bypass remains unacceptable for real participants; real-person uploads must stay off until scanning and staffed review are approved.

The current Preview has discovery, friend requests, messaging, ratings, and media upload on,
while media quarantine and moderation tools are off. That combination is intentional for
synthetic parity testing and is a **hard stop** for real invitations. Before a real Beta, create
an isolated Beta configuration or deliberately reconfigure the stable Preview to the Wave 1
values below, confirm the D1/R2 bindings, and rerun the acceptance evidence. Do not issue a
code against the current configuration.

## Invitation operation

Apply migration 0007 to staging first. Issue a one-use code without printing it:

```sh
node scripts/issue-beta-invitation.mjs --output /secure/operator/path/invite.txt --days 7 --label beta-wave-01
```

The tool refuses any Cloudflare account other than `23017b53386fb67fc62a52cdd017454c`, targets only `chatgun-auth-staging`, creates the output with mode `0600`, and removes it if D1 insertion fails. Transfer the code through an approved one-to-one channel, then securely remove the local file. Labels must be non-personal cohort references.

Revoke before use with an exact invitation ID after verifying the active account and row:

```sql
UPDATE beta_invitations
SET status = 'revoked', revoked_at = unixepoch()
WHERE id = '<exact-id>' AND status = 'active' AND use_count = 0;
```

Do not share codes in tickets, chat logs, analytics, URLs, screenshots, or source control. The cleanup worker removes expired, consumed, or revoked invitation records after a seven-day operational window; linked enrollment remains without the invitation reference.

## Operator launch gates

Before inviting any real participant, the owner must name at least one trained safety reviewer and one escalation owner, define coverage hours and participant support channel, approve the Beta notice/consent wording, confirm lawful age-assurance handling with qualified Thai counsel, and rehearse report, threat, NCII, account-deletion, and lost-access cases. Disable invitations immediately if review coverage is unavailable.

Media remains synthetic-only until a scanner/vendor decision, human review path, appeal path, and deletion SLA are approved. Location discovery should initially use synthetic accounts; real participants require explicit location-risk notice and abuse monitoring. The 250 m bands reduce disclosure but do not eliminate collusion or movement-based inference.

The decisions that require named owner approval are in
`docs/controlled-beta-owner-decisions.md`. Legal and operational decisions must not be inferred
from a successful test run.

## Feature activation boundary

| Capability | First real-participant state | Activation gate |
| --- | --- | --- |
| Google/Facebook/LINE login, logout, account linking | Enabled | Dedicated Preview credentials and callbacks already pass; keep public registration off |
| One-use invitations and adult onboarding | Disabled until approval | Owner plus qualified Thai legal review of 18+ threshold, self-declaration wording, correction, and evasion handling |
| Own profile create/edit | Wave 1 candidate | Approved Beta notice; no public discovery; privacy-first defaults |
| Blocking and report submission | Required before any member interaction | Named intake primary/backup, coverage, escalation owner, tested queue access, and participant contact channel |
| Friend requests/list | Wave 2 candidate | Report operations staffed and rehearsed; requests restricted to the invited cohort |
| Text messaging and notifications | Disabled initially | Staffed harassment/threat response, retention decision, escalation drill, and appeals process |
| Nearby discovery/location | Disabled initially | Approved location notice/lawful basis, field threat model, multi-account probing response, and rollback rehearsal |
| Ratings/private reviews | Disabled initially | Location activation plus abuse/appeal rules and moderation coverage |
| Gallery/chat images | Disabled initially | Quarantine enabled, scanner/vendor decision, trained human review, appeal path, and deletion monitoring |
| Identity verification | Disabled | Necessity, lawful basis, evidence minimization, reviewer access, and incident response approved |
| Email OTP, mobile OTP, LINE email, Demo, Game | Disabled | Outside this Beta scope |
| Moderation tools | Off for participants; required for assigned staff before Wave 1 | Individual reviewer accounts, least-privilege roles, recent authentication, purpose logging, and audit review |

Proposed Wave 1 server-side values, subject to owner/legal/staffing approval:

| Variable | Value |
| --- | --- |
| `NEW_ACCOUNT_REGISTRATION_ENABLED` | `false` |
| `BETA_INVITATION_REGISTRATION_ENABLED` | `true` only during the authorized invitation window |
| `SOCIAL_APP_ENABLED` | `true` |
| `ADULT_ONBOARDING_ENABLED` | `true` with the approved notice version |
| `PUBLIC_DISCOVERY_ENABLED` | `false` |
| `FRIEND_REQUESTS_ENABLED` | `false` |
| `MESSAGING_ENABLED` | `false` |
| `RATINGS_ENABLED` | `false` |
| `MEDIA_UPLOAD_ENABLED` | `false` |
| `MEDIA_QUARANTINE_ENABLED` | `true` |
| `IDENTITY_VERIFICATION_ENABLED` | `false` |
| `MODERATION_TOOLS_ENABLED` | `true` only after named reviewer roles and the queue drill pass |
| `EMAIL_OTP_ENABLED`, `MOBILE_OTP_ENABLED`, `LINE_EMAIL_ENABLED`, `DEMO_MODE_ENABLED` | `false` |

These values are a proposed configuration record, not authorization to change Cloudflare.

## Staged rollout

1. **Gate 0 — configuration rehearsal:** keep invitations at zero; select the isolated Beta
   hostname/configuration; verify ChatGun account, `DB -> chatgun-auth-staging`, private R2
   state, encrypted Preview secrets, migrations, flags, and zero synthetic residue. Run the
   report/threat/NCII/deletion/lost-access tabletop with the named primary and backup.
2. **Wave 1 — account and profile only:** after owner/legal approval, enable one-use invitations,
   adult onboarding, own-profile editing, block, and report intake. Keep discovery, location,
   friend requests, messaging, ratings, and all uploads off. The owner must set the cohort size
   and observation period; this document does not invent them.
3. **Wave 2 — consent-based contact:** enable friend requests and text messaging only after
   moderation coverage, escalation, appeals, and message-retention decisions are operational.
   Review report volume, time-to-triage, blocks, and authorization failures before expanding.
4. **Wave 3 — location:** enable discovery only after the location-risk decision, field tests,
   participant notice, coordinated-probing response, and monitoring are approved. Do not combine
   this wave with media activation.
5. **Wave 4 — private media:** enable uploads only with quarantine on and staging bypass off,
   scanner failure closed, staffed review, appeals, and deletion/reconciliation alerts proven.

Advancing a wave requires a written owner decision and a new acceptance run. Technical success
does not automatically advance the rollout.

## Rollback and pause plan

Pause immediately for loss of moderation coverage, credible threat/NCII/child-safety handling
failure, location inference, unauthorized cross-user access, public R2 exposure, scanner or
quarantine failure, deletion backlog, abnormal invitation use, or provider/session compromise.

Rollback order:

1. stop issuing invitations and set invitation registration false;
2. turn off the affected capability flags, starting with media, discovery/location, messaging,
   ratings, and friend requests; keep public registration false;
3. preserve only the minimum case/security evidence and do not perform bulk deletion as an
   incident reaction;
4. revoke affected sessions or disable affected accounts using exact targets;
5. confirm private R2 access, D1 integrity, deletion queues, audit logs, and provider callbacks;
6. notify affected participants through the approved channel when safe and legally reviewed;
7. document cause, scope, decision owner, remediation, and re-entry criteria before restoring a
   capability.

Runtime changes, invitation issuance, and user/session actions require a separately authorized
change window. This plan does not authorize them.

## Beta acceptance evidence

Required per release candidate:

1. Account ID, Preview binding, and pending migration checks.
2. Invalid, expired, revoked, reused, and concurrently claimed invitation tests.
3. OAuth success and cancellation for each provider with approved test accounts.
4. Under-18 rejection and adult activation tests; record that age is self-declared.
5. Cross-user authorization, blocking, report, moderation-audit, private-media, and location-inference regression tests.
6. Account deletion with injected R2 failure followed by successful cleanup retry.
7. D1 foreign-key check, migration history, R2/D1 reconciliation, and zero synthetic residue after the run.
