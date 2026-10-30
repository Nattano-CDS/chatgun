# Full Production activation plan (not authorized for execution)

## Preconditions

Pin the exact approved PR head, tree and configuration-free Pages artifact; repeat the configuration snapshots and zero-drift comparison; verify schema 21/FK0, protected backup, rollback deployment, policy versions, provider callbacks, moderation coverage, cleanup schedules and monitoring ownership. Any mismatch is a stop condition.

## Sequence

1. Deploy the exact approved artifact with no feature change. Smoke health, owner LINE login, Admin Access/RBAC isolation, assets, D1 and private R2. Roll back on any preservation failure.
2. Activate registration and the approved OAuth providers with profiles only. Verify new/existing login, logout, session recovery, age gate and deletion. Stop on provider mismatch, callback error or registration leakage.
3. Activate Discovery and opt-in Presence. Verify approximate-location permission, 100 m eligibility, filters, privacy and blocked-user exclusion.
4. Activate Friends and text Messaging together. Verify request/accept/reject/duplicate protection, friend-only contact, ordering, unread/read/delivery status, block/unfriend revocation and mobile keyboard behavior.
5. Activate Ratings only after proximity and abuse-control checks pass.
6. Keep Media disabled until its separate legal, moderation, cleanup and operational gates pass; then use a separate canary.

Each wave requires a quiet observation interval, sanitized error/latency/D1-volume review, and a signed checkpoint before the next wave. Roll back the application artifact for code/asset failures; restore the previous individual flags for activation failures. Never down-migrate or destructively restore D1 automatically.

## Monitoring and rollback conditions

Monitor OAuth failures, registration attempts, authorization denials, Worker errors, D1 latency/read-write volume, message delivery failures, report backlog and R2 errors without logging private data. Roll back or close the affected flag immediately on authorization leakage, provider-subject mismatch, elevated 5xx, message loss/duplication, private-media exposure, broken block enforcement, schema/FK change or preservation-check failure.

No step in this document authorizes a deployment, flag change, provider-console change, database mutation or public activation.
