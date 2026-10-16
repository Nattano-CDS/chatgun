# Admin access and moderation role management

Status: staging engineering procedure. It does not name or authorize an operator and does not
activate Production moderation.

## Role separation

| Role | May do | Must not gain implicitly |
| --- | --- | --- |
| `moderation_admin` | Inspect, grant and revoke time-bounded moderation roles | Reports, messages, identity evidence, private media, media decisions |
| `report_reviewer` | Review report queues and aggregate moderation overview | Private media/message objects, identity evidence, appeals, role management |
| `identity_reviewer` | Review identity evidence only while that feature is approved and enabled | Reports, messages, general media queues, role management |
| `safety_admin` | Review private media/messages, classify media, decide appeals, inspect decision history | Role assignment unless separately granted `moderation_admin` |

Every person uses an individual active ChatGun account. Shared accounts, email allowlists, frontend
checks, and provider-console access are not authorization. The server checks an unrevoked,
unexpired grant on every request. Moderation also requires a session authenticated within ten
minutes, a case-specific purpose, and CSRF/same-origin validation for writes. Production keeps
`MODERATION_TOOLS_ENABLED=false`.

## Initial bootstrap

There is deliberately no self-service first-admin path. The owner must first approve a named
person, roles, reason, expiry, and environment. A trusted infrastructure operator then performs
one reviewed, staging-only D1 import to insert the approved initial grants and matching
`moderation_role_events` grant events. For the single-owner Phase 1 model, the least-privilege
initial set is `moderation_admin`, `report_reviewer`, and `safety_admin`; do not include
`identity_reviewer` while identity verification is disabled. Before running it, the operator must:

1. confirm Cloudflare account `23017b53386fb67fc62a52cdd017454c`;
2. confirm the selected database is `chatgun-auth-staging`, never `chatgun-auth`;
3. create a D1 Time Travel bookmark and record aggregate counts;
4. resolve the approved user's opaque D1 user ID without copying email or provider identifiers;
5. use fresh UUIDs and a maximum 90-day expiry (30 days for the initial owner bootstrap); and
6. have a second person compare the target, environment and owner approval before execution.

Do not place a bootstrap SQL command containing a real user ID in Git, PR comments, tickets, or
chat. Use `scripts/bootstrap-moderation-staging.mjs` only after the exact opaque ID is confirmed;
the script is pinned to the ChatGun account and staging database, requires an exact confirmation,
requires a recently authenticated active/onboarded target, refuses existing grants, uses fresh
UUIDs, and verifies the result. After bootstrap, use the authenticated API rather than direct SQL.

The owner-confirmed Phase 1 bootstrap was completed in isolated Staging on 2026-10-16. Three
separate 30-day grants expire on 2026-11-15 at 22:48 Asia/Bangkok. The opaque user ID is retained
only in the restricted operational record, not this repository. Production moderation remains
disabled and unchanged.

## Grant procedure

1. Owner or designated access approver records the named person, least-privilege role, business
   reason, environment and expiry (between one hour and 90 days).
2. A different current `moderation_admin` signs in again and records a case-specific purpose.
3. The admin submits `POST /api/social/moderation/roles` with `action=grant`, opaque user ID, role,
   reason and Unix expiry. The server rejects self-grants, inactive/incomplete accounts, duplicate
   active roles, invalid roles, missing CSRF, stale authentication and excessive changes.
4. The recipient confirms only the assigned queue is available. A role administrator alone cannot
   read a report or private media.
5. The approver schedules review before expiry. Expired grants fail closed without relying on a
   background job.

## Revocation and emergency access removal

Use `action=revoke` with the grant ID and a reason. Revocation is authoritative immediately and
also removes a matching legacy role. Confirm the former reviewer receives HTTP 403 on the next
request; do not wait for session expiry. For suspected compromise, revoke the role first, then
revoke the user's sessions and disable the account if justified. Preserve only the minimum audit
record and start the incident procedure.

If the only `moderation_admin` is unavailable or compromised, pause moderation-enabled features.
The owner-approved infrastructure operator may perform an audited staging break-glass revoke or
replacement using the same account/database/backup/two-person checks as bootstrap. Never weaken
the endpoint or assign a broad role to restore convenience.

## Audit and periodic review

Grant, revoke and inspect events are append-only in `moderation_role_events`; actor and target IDs
become null when their accounts are deleted, while role/action/reason/time remain. Review active
grants and events at least weekly during an authorized Beta, and immediately after staff changes.
Investigate self-interest conflicts, unnecessary `safety_admin` access, repeated grant attempts,
after-hours changes, generic purposes, and grants near the 90-day ceiling. Retention for these
events is not yet approved; reviewers must keep reasons concise and free of unnecessary personal
or case-content data.
