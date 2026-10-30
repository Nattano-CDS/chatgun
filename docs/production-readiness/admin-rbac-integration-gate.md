# Production Admin RBAC integration gate

Status: **NO-GO**. This package performs no Production writes and does not authorize deployment, migration, secrets, role grants, flags, or merge.

## Authentication and authorization dependency map

1. Cloudflare Access protects `/app/moderation*` and `/api/admin/*` and supplies a signed application JWT.
2. ChatGun validates the RS256 signature from the configured Access issuer, exact issuer and audience, application-token type, timestamps, verified owner email, subject, and the privately configured owner user binding. Missing or partial configuration fails closed.
3. A valid Access identity does not create a ChatGun member session and grants no application role.
4. `/api/admin/session` requires an active, unrestricted adult ChatGun account and at least one unexpired, unrevoked application role. It creates a separate, bounded Admin session with its own HMAC CSRF token.
5. Every Admin request rechecks the authoritative D1 role. Restricted evidence additionally requires a recorded purpose and recent authentication. Revocation is immediately authoritative.

The slashless `/api/admin` root now redirects safe GET/HEAD requests to `/api/admin/session`, which is inside the existing protected wildcard. Unsafe methods and a disabled standalone Admin feature return 404.

## Schema prerequisites

The exact application candidate requires Production schema 21. Production is currently recorded at schema 17, so the following byte-exact lane must be applied only after a fresh protected backup and separate authorization:

| Migration | SHA-256 |
| --- | --- |
| `0018_cloudflare_admin_sessions.sql` | `d7ab7d2a438ff1c5d3c3d83cdbf35b4b7837146af3898c282714d382a7e822d6` |
| `0019_member_age_safety_holds.sql` | `696683be68db9f43efd0d62973173f28b1c4e916aca0adaaf887aab859d347e6` |
| `0020_age_hold_write_guards.sql` | `ec4774ca2db46c4525b64fe5ca266040d70443b311400579e909009c767411b9` |
| `0021_eligibility_review_requests.sql` | `0e4d2bfe7a3adcd5a86dc4f9ac6ebc5b1e21c2964aea23c709d19199586968a4` |

Migration 22 is UAT-only and must not be applied. The offline rehearsal from the protected schema-17 export passed forward migration, foreign-key checks, row-count preservation, and rollback restoration with zero Production writes.

## Minimum initial role proposal

Grant one `moderation_admin` role to the already privately bound owner ChatGun user for exactly one hour. The grant and matching `moderation_role_events` audit record must be inserted atomically with fresh random identifiers, the same grant timestamp, an expiration exactly 3,600 seconds later, and a reviewed reason. The account must be active, unrestricted, and without an age hold at execution time.

This role permits only role administration. It does not permit moderation overview, reports, private media, member/deletion inspection, account moderation, identity review, or safety decisions. Initial bootstrap cannot use the self-grant API and therefore needs a separately authorized, reviewed D1 transaction. Expiration and revocation are checked on every request.

## Isolated verification

- Backend security and migration targets: 24/24 PASS.
- Complete Node test suite: 287/287 PASS.
- Exact local build browser coverage: 6/6 PASS across desktop and mobile Chromium.
- Valid Access identity with no role: PASS (403).
- Expired role: PASS (403).
- Active `moderation_admin`: PASS for role management; PASS for denial of overview, reports, and private media.
- Separate `safety_admin`: PASS for report access only after purpose and recent-authentication gates.
- Immediate role revocation: PASS.
- CSRF, assertion replay, member-session isolation, purpose audit, and logout tombstones: PASS.
- Production preservation: 25/25 PASS; restricted flags unchanged.
- Production migration rehearsal: PASS offline; no Production writes.

No genuine connected Production RBAC result is claimed. No remote UAT or Production mutation was performed.

## Separately approvable Production actions

Each item requires its own exact authorization and must stop on any mismatch:

1. **Backup and schema 17→21 migration:** create a fresh protected Production D1 export, verify permissions/hash/foreign keys/schema/current counts, apply only the four migrations above, and run post-migration integrity checks. Do not include migration 22.
2. **Production Pages secrets:** configure the exact Access issuer, application audience, privately verified owner email, and owner ChatGun user binding. Treat them as secrets and verify fail-closed configuration without logging values. Enabling the optional Access identity lookup requires separate successful verification of the genuine identity endpoint.
3. **Initial one-hour role grant:** execute only the atomic `moderation_admin` grant and audit event described above. Do not grant `safety_admin`, `report_reviewer`, or `identity_reviewer`.
4. **Exact application deployment and Admin activation:** deploy only the separately approved commit, preserve the LINE owner pilot and every restricted flag, keep Access required, and enable only standalone Admin routing. Verify authorized access, unauthorized denial, recent authentication, CSRF, audit, expiration, and revocation before any broader approval.

Production remains **NO-GO** until all four actions are independently authorized and successfully verified against the exact release commit.
