# Solo Operator architecture and security

## Responsibility model

One owner may combine infrastructure, support, privacy/deletion intake, incident coordination, primary moderation and cost monitoring. The product must not claim 24/7 human monitoring or a guaranteed response time.

The owner may reconsider their own original account decision only through the explicitly non-independent workflow. They still cannot decide an **independent appeal** against that decision. If no eligible independent reviewer exists, an independent appeal remains pending; the system does not create an override.

## State model

`account_reconsiderations` has `pending`, `upheld` and `lifted` states. A request records the restriction revision observed at submission. A decision requires:

1. genuine authenticated member submission with CSRF and recent-authentication evidence;
2. an active restriction owned by that member;
3. no pending independent appeal for the restriction;
4. `safety_admin`, recent authentication, CSRF and moderation-purpose controls for the decision;
5. the deciding user to equal the original `created_by` decision-maker;
6. matching request and restriction revisions; and
7. a single decision nonce tying the reconsideration, restriction and audit event together.

The independent-appeal table, endpoint and self-review prohibition are unchanged. A pending reconsideration blocks creation of a parallel independent appeal and vice versa. A stale or repeated decision returns a conflict and writes nothing.

## Privacy and suspended-account behavior

- A suspended member can access only the existing restricted-account/authenticated privacy paths, including submission and status.
- Queue output omits `report_id`, reporter identity and unrelated cases.
- Evidence is text-only, bounded to 2,000 characters, and shown only to the original authorized decision-maker.
- Lifting a restriction restores eligible account access but never republishes location, presence or private-album grants.
- Minimal audit events do not duplicate evidence text or reporter identity.
- Audit rows are append-only through SQLite triggers. This is tamper resistance, not an absolute cryptographic immutability claim.

## Activation boundary

The workflow remains unavailable unless all three flags are true: `SOCIAL_APP_ENABLED`, `ACCOUNT_MODERATION_ENABLED`, and `ACCOUNT_RECONSIDERATION_ENABLED`. The last flag is new and defaults closed. Enabling it requires separately approved policy text, retention rules, schema migration and environment change.

