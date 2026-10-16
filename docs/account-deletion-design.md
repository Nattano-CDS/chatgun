# Authenticated account deletion design

Status: technical proposal only. Do not run these operations against Production until a
separate implementation PR, Preview test evidence, data inventory and explicit Production
approval exist.

## Security and user flow

1. From an authenticated account page, the user opens account deletion.
2. `GET /api/account/deletion` returns eligibility, linked providers, content categories,
   unresolved restrictions and a CSRF token already bound to the session.
3. `POST /api/account/deletion/reauth/start` requires same-origin, a valid session, CSRF,
   Turnstile and rate limiting. It starts a purpose-bound OAuth flow (`purpose=delete`) with
   state, nonce and PKCE where supported.
4. The callback must resolve to a provider identity already linked to the same user. It must
   not create/link accounts. Issue a single-use deletion-confirmation token valid for no
   more than 10 minutes.
5. A confirmation screen lists consequences, proposed treatment of each content class,
   backup limitations, cancellation window (if approved) and provider revocation steps.
6. `POST /api/account/deletion/confirm` requires same-origin, CSRF, session and the
   single-use reauthentication token. It ignores client-supplied user IDs.
7. In one D1 transaction, insert a deletion request, change the current `users.status` to
   `disabled`, revoke all sessions and consume the confirmation token. Clear browser
   cookies in the response. Access stops immediately even if erasure is asynchronous.
8. A dedicated queue/maintenance Worker processes the request idempotently. Manual email
   requests enter the same controlled workflow only after secure identity verification.

## Proposed schema migration

Do not add `deletion_pending` to the existing `users.status` CHECK in the first migration;
SQLite would require rebuilding the table and all dependent foreign keys. Reuse the
existing `disabled` status for immediate lockout and track deletion separately.

```sql
CREATE TABLE account_deletion_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'blocked')),
  requested_at INTEGER NOT NULL,
  eligible_after INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  failure_code TEXT,
  CHECK (eligible_after >= requested_at)
);

CREATE INDEX idx_deletion_requests_status
  ON account_deletion_requests(status, eligible_after);

CREATE TABLE deletion_receipts (
  request_id TEXT PRIMARY KEY,
  completed_at INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  implementation_version TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('deleted', 'anonymized', 'mixed')),
  category_counts_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
```

`deletion_receipts` must not contain `user_id`, email, provider subject, IP address, free
text or raw record identifiers. Validate `category_counts_json` against a fixed schema.
Delete receipts when their approved audit/complaint period ends.

## Deletion transaction and processing order

### Immediate confirmation transaction

- Verify request/session/CSRF/reauth server-side.
- Insert the request with a cryptographically random ID.
- Set `users.status='disabled'` and update `updated_at`.
- Set `revoked_at` for every live session belonging to the user.
- Consume the reauthentication artifact and clear session/CSRF/OAuth cookies.

### Background erasure job

1. Lock/claim one pending request using an atomic status transition.
2. Snapshot only category counts needed for the receipt; never export full personal rows.
3. Delete private/draft data whose content policy requires deletion.
4. For shared conversation or public content, apply the separately approved deletion vs.
   anonymization rule. Remove profile pointers, mentions, search indexes, notification
   payloads, media object metadata and cached copies.
5. Delete provider identities. The current schema will also cascade these when the user is
   deleted, but explicit counts improve verification.
6. Delete sessions and outstanding OAuth flows linked to the user.
7. Delete or anonymize other account/profile fields and finally delete the `users` row.
8. Delete the request row and insert a non-identifying deletion receipt in the same final
   transaction where feasible.
9. Send completion notice only through a verified channel and do not include sensitive
   data. If the only stored email was erased first, use an encrypted, short-lived delivery
   address or require the user to retain the request ID and check status before logout.

## Content-safety rules that must exist first

The repository has no social-content schema. Before implementation, every new table must
declare an account-deletion rule:

| Content class | Proposed default | Required review |
| --- | --- | --- |
| Drafts, private profile fields, device/session data | Delete | Confirm no other user relies on it. |
| Direct messages | Remove sender's copy; determine recipient/conversation treatment | Privacy, evidence, abuse-report and other-party rights review. |
| Public posts/comments | Delete or anonymize author according to owner-approved product rule | Copyright, conversation integrity, legal claim and moderation review. |
| Reports, blocks and safety evidence | Restrict and retain only for a specific approved period when justified | Child-safety, legal basis, access controls and appeal process. |
| Aggregated analytics | Retain only if irreversibly anonymized | Re-identification test and documented aggregation threshold. |

## Provider behavior

- Removing an `identities` row removes ChatGun's link to the provider account.
- PR #3 does not persist provider access or refresh tokens, so ChatGun cannot later call a
  provider revocation endpoint with a retained token.
- Show provider-specific links/instructions so users can revoke ChatGun directly in
  Google, Facebook or LINE. Do not claim that ChatGun deletion revokes provider-side
  authorization unless this is implemented and verified.

## Backup and restore lifecycle

D1 Time Travel can restore a deleted row during its provider-managed window. The design
therefore needs a deletion replay runbook:

1. Before any restore, export the set of deletion request IDs completed after the target
   restore time from an operational ledger isolated from the restored database.
2. Restore D1 only with explicit destructive-operation approval.
3. Keep the application offline or accounts disabled while migrations and deletion replay
   run.
4. Reapply completed deletions/anonymization before serving traffic.
5. Verify counts and produce a non-identifying restore audit.

An external suppression ledger may contain pseudonymous personal data. If used, store a
keyed, non-reversible value with strict access and an expiry no longer than the verified
backup window; obtain legal approval for its basis and retention.

## Failure, cancellation and legal-hold states

- Retries must be idempotent and never reactivate the account.
- `blocked` requires a controlled reason code, reviewer, expiry/review date and no free-text
  personal data in general logs.
- Whether users receive a cancellation/grace period is an owner decision. If provided,
  cancellation requires provider reauthentication and must not silently restore sessions.
- Any legal hold must identify a concrete legal basis, scope and expiry/review date. A broad
  “security” hold with no end date is not acceptable.

## Required tests

- CSRF, same-origin, recent reauthentication and single-use token enforcement.
- A user cannot delete another account by changing request data.
- All sessions are revoked atomically and cookies cleared.
- Concurrent confirmation is idempotent.
- Positive deletion and mixed delete/anonymize content cases.
- Provider identities disappear and cannot be replay-linked through stale OAuth state.
- Failed jobs retry without duplicate receipts or account reactivation.
- Restore rehearsal replays deletion requests before traffic resumes.
- Receipt/log assertions confirm absence of email, provider subject, tokens and IP address.
