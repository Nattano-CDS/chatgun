# Moderation retention and deletion validation

Status: staging-only technical evidence. Retention periods remain subject to owner, privacy, and
qualified Thai legal review.

## Enforced behavior

| Scenario | Enforced result | Evidence |
| --- | --- | --- |
| Pending upload | Member endpoints return not found; private object is available only to a recent-authenticated `safety_admin` with a logged purpose | `media-moderation.test.js`, `moderation.test.js` |
| General release | Authorized owner/friend access resumes; private R2 access remains through the application | media classification regression |
| Sensitive reclassification | Selected profile photo is cleared and member access is denied immediately while Sensitive is disabled | media classification regression |
| Prohibited/rejected | D1 media state becomes `pending_deletion` and an idempotent R2 deletion entry is queued | media classification regression |
| Account deletion | Sessions and identities are revoked/deleted; owned objects are queued before account rows cascade; unrelated accounts remain | privacy/safety deletion tests |
| R2 transient failure | Object remains inaccessible, attempt count increases, error is normalized, and retry uses bounded exponential backoff | `media-cleanup.test.js` |
| Retry exhaustion | Worker no longer loops indefinitely and emits an aggregate exhausted count without object identifiers | `media-cleanup.test.js` |
| Successful cleanup | R2 delete runs before the pending D1 media row is removed and the queue completion is recorded | `media-cleanup.test.js` |
| Completed receipt cleanup | Completed queue entries are retained for the configured short engineering window, then removed by retention cleanup | privacy cleanup test |

The R2 delete occurs outside the D1 transaction. If D1 completion fails after R2 succeeds, the next
attempt repeats the idempotent delete and completes metadata cleanup. If R2 fails, D1 media remains
`pending_deletion`, so no member endpoint can retrieve it.

## Audit minimization

Moderation decisions retain media ID, opaque actor ID, state/category transition, short reason,
revision and time. Role events retain opaque actor/target IDs, role, action, short reason and time.
Foreign keys use `ON DELETE SET NULL` for reviewer/subject identifiers where audit continuity is
needed; they do not retain email, provider subject, image bytes, reporter identity, or R2 URL.
Reviewers must not place unnecessary personal data or copied evidence in free-text reasons.

There is no approved automatic deletion period for moderation decisions, role events, report
records, appeals, or rejected-media evidence. Adding one before policy approval would create an
unsupported legal/operational promise and could erase needed appeal evidence. Conversely, keeping
them forever is not approved. This unresolved schedule is a launch blocker.

## Required operations not yet staffed

- Alert on `exhausted > 0`, aged pending media, missing private objects, and D1/R2 count mismatch.
- Name the person allowed to reset an exhausted entry after the underlying fault is fixed.
- Reconcile at least by aggregate purpose/state; never export image bytes or object keys to general
  monitoring.
- After D1 Time Travel/backup restoration, replay all deletion intents before enabling media reads.
- Run a periodic synthetic delete with an injected R2 failure and record recovery evidence.
- Approve retention separately for reports, appeals, audit events, scanner references, rejected
  objects, completed deletion receipts, and backups.

## Staging validation result

The automated suite covers normal deletion, transient failure/backoff, exhaustion visibility,
account deletion, immediate authorization revocation, appeal restoration, concurrency, and foreign
keys. The staging database migration and remote integrity results are recorded in PR #7. Production
was not migrated, queried for user data, or changed.

