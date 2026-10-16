# Media retention and scanning proposal

Draft only; no vendor, staffing, retention promise, or Production media activation is
approved.

## Current technical controls

- Private R2 only; no `r2.dev` or public custom domain.
- Authenticated application endpoints enforce owner, accepted-friend, block, and purpose
  checks. Responses use `private, no-store`, `nosniff`, and sandboxed content policy.
- JPG, PNG, and WebP are the only accepted formats. Maximum input is 8 MiB. The server
  validates magic bytes and image structure/dimensions, reserializes supported structures,
  and removes unnecessary PNG text, JPEG metadata, and WebP ICC metadata.
- Gallery capacity is 12; reusable chat images are capped at the five newest active assets.
- Deletion is two-phase: D1 access is revoked immediately, then a scheduled worker deletes
  R2 with retry/backoff. Account deletion queues every owned object before cascading D1.

## Quarantine design

Migrations 0005–0006 add `media_safety_reviews` and a single-winner decision nonce. When
`MEDIA_QUARANTINE_ENABLED=true`, uploads enter `pending`; normal owner/member endpoints
cannot retrieve them. Only a `safety_admin` with a recorded case purpose can view the object
and release or reject it. Every queue view, object view, and decision is audited. Rejection
immediately revokes access and adds an idempotent deletion-queue entry.

Preview uses `staging_bypass` for synthetic fixtures so parity tests remain usable. This
bypass is unacceptable for invited real-person Beta accounts. Until a scanner and staffed
review path exist, keep real-person uploads disabled and use synthetic media only. Production has quarantine enabled but
`MEDIA_UPLOAD_ENABLED=false` and no R2 binding, so uploads fail closed.

## Scanner options and launch gate

Evaluate at least two vendors for CSAM hash matching (through an authorized program), nudity
and sexual-content classification, violence, malware/polyglots, and duplicate abuse. Review
data residency, sub-processors, model error rates across Thai content, appeals, auditability,
human access, and deletion guarantees. Do not send identity-verification evidence through a
general UGC scanner without a separate privacy review.

A launch design should use automated quarantine, a short decision SLA, human escalation for
ambiguous/high-severity matches, hash-only blocking where lawful, an appeal channel, and
metrics that contain no image bytes or unnecessary personal data. There is no assumed human
review team; until a responsible team/vendor and on-call path are named, real-person media is **NO-GO**.

The moderator UI now exposes the audited pending-media queue, private object viewer, and
single-winner release/reject actions. Tool availability still does not establish staffing,
training, response times, or lawful scanning. A scanner integration should write only a
vendor result/reference and risk categories to the review record, keep media pending on
timeouts or errors, verify callback signatures and replay IDs, and never auto-release on a
scanner failure. Vendor credentials must be environment-specific encrypted secrets.

## Failure and retention requirements

Alert on deletion attempts exceeding the retry budget, aged pending reviews, missing R2
objects, and D1/R2 reconciliation mismatches. Keep failed objects private and inaccessible.
Rehearse account deletion with an injected R2 failure and prove that access is immediately
revoked and eventual retry succeeds. D1 Time Travel/manual exports may retain metadata after
live deletion; document restore-time deletion replay and never promise selective backup
erasure earlier than Cloudflare capabilities support.
