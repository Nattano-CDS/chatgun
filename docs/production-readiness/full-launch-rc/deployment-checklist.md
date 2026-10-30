# Deployment, smoke-test and post-launch checklist

This checklist is review-only and grants no Production authorization.

## Before deployment

- Record the owner-approved commit, tree and configuration-free artifact inventory digest; require equality with the Draft PR head and exact-head CI.
- Capture two fresh read-only Production project snapshots and require zero effective drift across variables, opaque secret binding names/types, D1, private R2, compatibility settings and Access integration.
- Verify schema 21, FK0, record fingerprint, protected backup checksum, rollback deployment and responsible deploy/rollback operators.
- Verify approved public policy versions/hashes, all three provider console callbacks/publication, age gate, moderation escalation, cleanup schedules and monitoring ownership.
- Run isolated cloud-UAT and physical-device gates from the E2E matrix.

## Deployment smoke test (features still closed)

- Confirm exact served SHA and immutable asset inventory.
- Run Production preservation checks and verify the existing LINE owner pilot and restricted Admin isolation.
- Confirm registration, Discovery, Friends, Messaging, Media, Presence, Ratings, Sensitive, OTP and Demo remain closed.
- Confirm schema 21/FK0 and record fingerprint are unchanged; verify no deployment-time D1/R2 write.
- Roll back immediately on any asset, configuration, binding, authorization, owner-pilot or preservation mismatch.

## Activation-wave smoke tests

- Authentication: each approved provider, new/existing account, callback error, logout/re-login, age/policy/deletion and a denied unknown provider identity.
- Discovery/Presence: opt-in/withdrawal, approximate location, 100 m boundary, filters, pagination, privacy, block exclusion and background presence withdrawal.
- Friends/Messaging: request lifecycle, duplicate race, friend-only contact, chronological/pagination/reconnection ordering, unread/read/delivery, unsend, block/unfriend revocation and mobile keyboard.
- Ratings: distance boundary, daily/duplicate prevention, privacy and block denial.
- Media only under separate authorization: byte/MIME validation, private authorization, quarantine, moderation, revocation, quota and cleanup.

## Post-launch monitoring

- Review sanitized OAuth failure categories, registration anomalies, authorization denials, Worker errors, D1 latency/volume, message failures, report backlog and R2/cleanup failures at every wave checkpoint.
- Confirm alerts reach the assigned operator, reports remain available, out-of-hours limitations are disclosed and rollback authority is reachable.
- Keep the next wave closed until evidence is recorded. Never automatically restore/down-migrate D1 or broaden a flag to compensate for a failure.
