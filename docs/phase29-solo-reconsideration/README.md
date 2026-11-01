# Phase 29 — Solo operator and account reconsideration

Status: **internal implementation draft; not approved for publication or Production**.

This package separates two processes that must never be presented as equivalent:

- **Request for reconsideration:** the original decision-maker reviews new context. It is not independent.
- **Independent appeal:** another eligible reviewer decides the appeal. Existing server-side self-review prevention remains unchanged.

Implementation is fail-closed behind `ACCOUNT_RECONSIDERATION_ENABLED=true`. The new migration is development/UAT migration `0023`; no Production migration or configuration change is included.

Documents:

- `architecture-and-security.md` — states, authorization and data boundaries.
- `legal-applicability.md` — authoritative-source assessment and open legal questions.
- `policy-draft-addendum.md` — unpublished proposed wording.
- `solo-operator-runbook.md` — minimum daily operating procedure.

