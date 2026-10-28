# ChatGun Final UAT policy owner-review package

Status: **RC3 DRAFT — EXACT OWNER REAPPROVAL REQUIRED. UAT MUST REMAIN CLOSED.** The previously approved rc2 bytes remain recorded at commit `1468943`; rc3 adds the owner's subsequently decided 90-day minimum-audit period and removes the self-contradictory “not approved” display statement.

This package is the single review entry point for the proposed October 28 two-adult Social UAT. The four canonical documents are:

| Document | Proposed version | SHA-256 |
|---|---|---|
| [Adult/Social UAT Notice](../../../policies/final-uat/beta-notice.html) | `adult-social-uat-2026-10-28-rc3` | `bed1712129fa59f26683bfa5f00b4c5de6ca3a88de103c8c48b6ca55d7d703a0` |
| [Terms of Service](../../../policies/final-uat/terms.html) | `terms-social-uat-2026-10-28-rc3` | `ca712150dcf45a93854325215e4eaf4b5a7eaa25f9817f809ff30daf16af4240` |
| [Privacy Policy](../../../policies/final-uat/privacy.html) | `privacy-social-uat-2026-10-28-rc3` | `38a01bd8731481aafab92b480a002bc411c37b0f9e48281cc4aad8890d52d0ed` |
| [Data Deletion Procedure](../../../policies/final-uat/data-deletion.html) | `deletion-social-uat-2026-10-28-rc3` | `8112d26ec9a0ad5bbef74d737e38662a1c0050f3fe0910ac4d190dbbe5bb3c9a` |

See [before-after.md](before-after.md) for every material correction and [policy-package.json](policy-package.json) for the machine-readable manifest.

## Proposed controlled scope

- Dedicated `chatgun-final-uat` environment only; Production remains unchanged.
- Exactly two distinct, consenting adults aged 20+ using authorized Google, Facebook or LINE test accounts and private one-time invitations.
- Genuine OAuth, Turnstile and applicable provider MFA; real profiles and account/session lifecycle.
- Voluntary approximate-location Discovery, direct text Chat, opt-in Online presence (default OFF), privacy controls, blocking and reporting.
- Media upload/sharing/moderation, Sensitive Content, youth admission, OTP, Demo and public registration remain OFF.
- Primary moderator coverage is 19:00–22:00 Asia/Bangkok; no confirmed backup moderator, 24/7 monitoring, emergency capability, independent age verification, automated scanning or legal certification.

## Seven-day cleanup proposal and recovery limit

Within seven days after campaign close, the proposed process disables UAT gates, revokes invitations and provider-linked sessions, then cleans approved live D1 campaign data with recorded counts, foreign-key checks and bounded retries. Media is OFF, so no new UAT R2 media should exist; any unexpected object is a defect and must be identified before an auditable R2 cleanup/retry.

Participant A's genuine account must never be deleted automatically. Participant B's account may be deleted only after B gives separate explicit consent. Strictly necessary minimized security/audit evidence is retained for 90 days from the actual campaign close, excluding full Chat content, location, raw account references, credentials, media and profiles; live expired evidence is then removed by the dedicated UAT cleanup worker.

Cloudflare backups and D1 Time Travel can outlive logical deletion and may not support per-row erasure. The seven-day target therefore means approved live-data logical cleanup, not physical erasure of every recovery copy within seven days. Restored snapshots must be constrained and cleaned again before use.

## Owner decisions still required

The owner must review the exact four files and hashes, then privately decide:

1. Approve or reject each proposed document/version/hash.
2. Confirm rc3 faithfully carries forward the already-approved seven-day logical cleanup, backup/Time Travel limitation and 90-day minimized-audit decision.
3. Confirm Participant A and B privately: provider, account reference, distinct identity, age 20+, provider-test eligibility, and individual consent to each scope.
4. Record Participant B's separate YES/NO account-deletion decision.
5. Select one exact date and time within 19:00–22:00 Asia/Bangkok.

No answer is preselected. Until all mandatory entries validate, do not publish these drafts to UAT, issue invitations, create genuine accounts, enable Social, grant roles, start human E2E, or change Production.

## Consistency and test evidence

The activation validator binds approval to the four exact versions and SHA-256 values. It copies the reviewed UAT documents into a detached build of the frozen UAT application candidate, validates built bytes and version markers, records the UAT policy manifest in `release.json`, deploys only to the isolated UAT project, and verifies the displayed documents again. Any mismatch stops activation.

Automated results are recorded in [validation-results.md](validation-results.md). A passing draft-package check does **not** constitute policy approval or authorize activation.
