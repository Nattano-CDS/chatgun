# Controlled Beta policy consistency review

Status: **draft review; not approved or published**  
Reviewed: 2026-10-16 against commit `50f0020`

## Findings

| Document | Matches implementation | Gap before real Beta |
| --- | --- | --- |
| `docs/legal-drafts/policy-set-th-en.md` | Correctly describes Google/Facebook/LINE, linked identities, sessions, D1, Turnstile, private R2, social data, transient DOB, self-declaration, location controls, deletion queue, and disabled OTP/LINE email | Owner and qualified Thai legal approval; approved retention/backup wording; final dispute/liability/content-license clauses; operational appeal/support channel |
| `privacy.html` | Correct for OAuth, secure cookies, Turnstile, disabled OTP, and verified-email linking | Public page omits profiles, friends, messages, notifications, ratings/reviews, blocks/reports, precise location storage, private R2 media, moderation access/audit, adult self-declaration, automated cleanup, and the implemented self-service deletion workflow. It still describes a generic invitation-channel deletion process |
| `terms.html` | Correctly restricts abuse and identifies social-login providers | Still says operator, contact, age, and governing jurisdiction are unknown even though the owner supplied operator/contact and the proposed Beta is 18+. Missing Beta/invitation rules, location inference, messaging/media/community rules, appeals limits, and an approved Thai legal framework |
| `data-deletion.html` | Correctly distinguishes provider revocation from ChatGun deletion | Describes manual contact only. The application now supports authenticated recent-provider reauthentication, CSRF/replay protection, immediate session/access revocation, D1 cascade, R2 deletion queue/retry, and a minimized receipt. Backup/exception wording and fallback support channel still require approval |
| Beta participation notice | None published | Draft prepared in `docs/legal-drafts/beta-participation-notice-th-en.md`; owner/legal approval, versioning, and presentation/acceptance evidence are missing |
| Community, location, and media policy | Consolidated draft exists in `policy-set-th-en.md` | No approved participant-facing standalone versions; moderation staffing, location activation, scanning, response, appeals, and enforceable retention remain unresolved |

The static HTML pages are materially incomplete for real social-feature participants. They must
not be treated as an approved notice merely because they are reachable on Preview. Updating the
drafts in this PR does not publish or approve them.

## Implementation alignment decisions

- The proposed Beta is invitation-only and 18+; the code stores only an adult age-band event and
  explicitly reports `self_declaration`, not verified age.
- Exact coordinates are stored only while discovery is active, expire after two minutes, and are
  never returned cross-user; coarse bands still carry inference risk.
- Messaging and media are private by access rule, not end-to-end encrypted. Notices must not call
  them end-to-end encrypted. Authorized safety staff may access message/media content only under
  the audited, approved moderation process.
- Media scanning is not integrated. Current Preview `staging_bypass` is synthetic-only; notices
  must not imply that real uploads are scanned or reviewed.
- Account deletion removes live relational data transactionally and queues R2 deletion, but D1
  Time Travel/manual backup limitations remain. No unsupported deletion deadline should be
  promised.
- The application has report/block controls and audited moderation queues, but no confirmed staff,
  participant notification workflow, appeal table, SLA timers, or 24/7 response.

## Required pre-invitation action

1. Obtain owner and qualified Thai legal review of the consolidated policy set and Beta notice.
2. Decide the Wave 1 features; keep location, messaging, ratings, and media out unless their gates
   are separately completed.
3. Replace or approve the participant-facing Privacy, Terms, and Data Deletion pages so they match
   the exact enabled feature set and confirmed operator information.
4. Version the approved notices and record acceptance without storing unnecessary personal data.
5. Verify every rendered URL, Thai/English text, mobile layout, and deletion/support route on the
   exact isolated Beta deployment before issuing any invitation.
