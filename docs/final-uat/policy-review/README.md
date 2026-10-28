# ChatGun Final UAT policy owner-review package

Status: **DRAFT — NOT APPROVED. UAT MUST REMAIN CLOSED.**

This package is the single review entry point for the proposed October 28 two-adult Social UAT. The four canonical documents are:

| Document | Proposed version | SHA-256 |
|---|---|---|
| [Adult/Social UAT Notice](../../../policies/final-uat/beta-notice.html) | `adult-social-uat-2026-10-28-rc2` | `99cfb4e96b9b43ab24fae190369e387c8c70743d9238d02c4abddb6aa4e82244` |
| [Terms of Service](../../../policies/final-uat/terms.html) | `terms-social-uat-2026-10-28-rc2` | `382679f326d165bf66d1263328ee76ebcc42ac5be07ee8782b57766686233aa5` |
| [Privacy Policy](../../../policies/final-uat/privacy.html) | `privacy-social-uat-2026-10-28-rc2` | `12ab34bac6b2a9a5699741b68f80bacaa2929e0ae5e5b1559ccf7344043cd534` |
| [Data Deletion Procedure](../../../policies/final-uat/data-deletion.html) | `deletion-social-uat-2026-10-28-rc2` | `bf532150640e2f0ceaeb6833b50221e0c72b2ae95843756d42a319c30c9d7f36` |

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

Participant A's genuine account must never be deleted automatically. Participant B's account may be deleted only after B gives separate explicit consent. Minimal security/audit evidence may remain only when necessary to prove consent/control, investigate defects or abuse, prevent invitation reuse, or evidence deletion; its final retention period is an owner decision because no unverified expiry is asserted.

Cloudflare backups and D1 Time Travel can outlive logical deletion and may not support per-row erasure. The seven-day target therefore means approved live-data logical cleanup, not physical erasure of every recovery copy within seven days. Restored snapshots must be constrained and cleaned again before use.

## Owner decisions still required

The owner must review the exact four files and hashes, then privately decide:

1. Approve or reject each proposed document/version/hash.
2. Accept or reject the seven-day logical-cleanup proposal and backup/Time Travel limitation.
3. Define any required retention limit for minimal security/audit evidence that is not already enforced.
4. Confirm Participant A and B privately: provider, account reference, distinct identity, age 20+, provider-test eligibility, and individual consent to each scope.
5. Record Participant B's separate YES/NO account-deletion decision.
6. Select one exact date and time within 19:00–22:00 Asia/Bangkok.

No answer is preselected. Until all mandatory entries validate, do not publish these drafts to UAT, issue invitations, create genuine accounts, enable Social, grant roles, start human E2E, or change Production.

## Consistency and test evidence

The activation validator binds approval to the four exact versions and SHA-256 values. It copies the reviewed UAT documents into a detached build of the frozen UAT application candidate, validates built bytes and version markers, records the UAT policy manifest in `release.json`, deploys only to the isolated UAT project, and verifies the displayed documents again. Any mismatch stops activation.

Automated results are recorded in [validation-results.md](validation-results.md). A passing draft-package check does **not** constitute policy approval or authorize activation.
