# Privacy and safety implementation

Status: staging implementation for owner, security and legal review. Nothing in this
document is a public retention promise or authorization to deploy to Production.

## Implemented controls

### Retention cleanup

`chatgun-privacy-cleanup-staging` is a dedicated scheduled Worker bound only to
`chatgun-auth-staging`. It runs daily at `03:17 UTC` and deletes at most 500 rows from
each category per invocation:

- expired OAuth flows (reauthentication context cascades with the flow);
- expired sessions and sessions revoked for at least 24 hours;
- expired rate-limit windows;
- expired OTP challenges; used/locked challenges are removed at expiry, with a 24-hour
  fallback for any record whose expiry is unexpectedly later;
- expired recent-authentication evidence;
- expired unconfirmed deletion requests; and
- expired deletion receipts.

Deletes are indexed, bounded and do not select/log row contents. The Worker logs only
aggregate deletion counts. A daily run can require multiple days to clear a backlog larger
than 500 rows per category; alerts and an owner-approved manual catch-up procedure remain
operational work.

The seven-day deletion-receipt TTL and 24-hour revoked-session/OTP safety windows are
provisional engineering defaults. They must not be copied to a published policy until the
owner and qualified counsel approve them.

### Account deletion

API surface:

- `POST /api/auth/account-deletion/request`
- `POST /api/auth/account-deletion/confirm`

Both endpoints require an active session, exact same-origin request and a matching CSRF
cookie/header. Request creation also requires authentication within the previous ten
minutes. An older session can refresh that evidence only by completing OAuth with an
identity already linked to the same ChatGun user and the same active session.

The request endpoint returns a one-time confirmation token; only its SHA-256 hash is stored.
The browser keeps the raw token in memory and must submit the exact Thai confirmation
phrase within ten minutes. Confirmation uses one D1 transactional batch:

1. atomically claim the pending request with a random operation ID;
2. disable the user and revoke all sessions;
3. remove provider identities and linked OAuth flows;
4. insert a receipt containing only random request ID, timestamps, code/policy versions and
   the result; and
5. delete the `users` row, cascading all remaining authentication records.

If any statement fails, D1 rolls back the batch. A concurrent or replayed confirmation
cannot claim the request again. No provider access/refresh tokens are stored, so ChatGun
cannot revoke provider authorization after deletion; the user still needs provider-specific
revocation guidance in the approved legal/user-help content.

The current repository has no social-content tables. The deletion transaction is therefore
complete only for current account/authentication data. Any future post, message, media,
notification, report, block or moderation table is launch-blocked until it declares a
reviewed deletion/anonymization rule and has tests.

### Registration and minor safety

`NEW_ACCOUNT_REGISTRATION_ENABLED=false` is the fail-closed default in Preview and
Production configuration. Existing provider identities may authenticate; an unknown
provider identity receives `registration_closed` and cannot create a user row. Email and
mobile OTP remain disabled.

The public configuration also declares these capabilities false:

- public discovery;
- unsolicited messaging; and
- minor registration.

No discovery or messaging endpoints exist. These values are defense-in-depth declarations,
not substitutes for authorization checks when those features are built.

## D1 and backup limitations

Deleting a live D1 row does not selectively remove it from provider-managed Time Travel.
Before Production, verify the actual plan/window and document a restore procedure that
keeps the application offline until completed deletion requests have been replayed. Inventory
all manual exports and local dumps separately. This implementation does not claim a 90-day
backup deletion guarantee.

## Staging runbook

1. Confirm `wrangler whoami` is account `23017b53386fb67fc62a52cdd017454c`.
2. Inspect `chatgun-auth-staging` migration history and schema without selecting user rows.
3. Apply `0002_privacy_safety.sql` to staging only.
4. Run unit/integration tests and `wrangler deploy --dry-run -c wrangler.cleanup.jsonc`.
5. Deploy `wrangler.cleanup.jsonc` only after confirming its sole D1 binding is
   `chatgun-auth-staging`.
6. Trigger a staging-only scheduled event with synthetic expired records and verify aggregate
   counts plus preservation of active records.
7. Deploy the application branch to Pages Preview, never Production, and run Playwright.

## Production blockers

- Owner/legal decision on the minor registration model.
- Approved receipt/session/OTP cleanup periods and operational alert ownership.
- Approved user-facing legal documents aligned with the implemented workflow.
- Social-content deletion/anonymization rules before any content feature activates.
- Backup/export inventory and deletion replay rehearsal.
- Reporting, blocking, moderation staffing and emergency escalation before discovery or
  messaging activates.

## Legal-document consistency review

The legal pages currently present on PR #3 predate this implementation. In particular,
`data-deletion.html` describes a manual tester request instead of the authenticated UI,
and `privacy.html` does not describe recent-authentication evidence, deletion requests,
receipts or the cleanup Worker. The more complete documents in PR #4 remain unpublished
drafts and were not copied into this implementation branch.

Before publication, the owner and qualified Thai counsel must approve final text that:

- describes the implemented primary-database deletion without claiming immediate D1 Time
  Travel erasure;
- states only verified cleanup periods and marks any justified exceptions;
- explains provider-side authorization revocation accurately;
- explains that new registration remains closed pending the approved minor model; and
- names the actual operator/contact consistently.
