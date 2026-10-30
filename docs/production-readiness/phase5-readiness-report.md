# Phase 5 Production Admin security and readiness report

Assessment date: 2026-10-30 Asia/Bangkok. Package baseline:
`c2451ee114d4afeef8553878c4149e16b9b1dc92`; assessed application:
`cfb94c92190a17ebb73983cef4017ca227df5d42`. No Production deployment, Access
configuration, D1/R2/feature/account mutation, provider publication, GitHub setting change or PR
merge was performed.

## Completed

- Read-only Access inventory proves there is one UAT-only application and no Production app.
- Exact Production issuer and destinations, policy shape, MFA/session requirements, protected
  configuration names, validation sequence and rollback are documented.
- Application controls reject invalid signature/algorithm, issuer/audience/identity/UUID/time,
  service tokens, partial configuration, JWKS outage, stale auth, missing RBAC, CSRF and replay.
- Focused verification: 37 PASS, 0 FAIL, 0 SKIP; 5 genuine Production scenarios BLOCKED.
- Existing operations runbook covers reports/blocking, moderation, privacy/deletion, appeals,
  emergency and child-safety escalation, incident response, audit/retention and cleanup safety.
- Production fingerprint, D1 integrity, R2 isolation, release manifest and Draft PR stack were
  rechecked read-only.

## Production fingerprint comparison

| Property | Current deployed owner pilot | Assessed PR #19 candidate |
|---|---|---|
| Application SHA | `a73ff21c615dabb6a0c19c0a22685c2370958ca1` | `cfb94c92190a17ebb73983cef4017ca227df5d42` |
| Release/schema | controlled-beta; schema17; FK0 | closed candidate; requires schema21; schema22 excluded |
| Manifest | asset digest `943f00f3add31f9214e43d7ae70a0c032ea8315effeb9c91b6c9da776364b433` verified | exact git tree and migration hashes pinned in Phase 3 manifest |
| Owner admission | LINE OAuth on; invitation-only; public registration off | OAuth/admission flags closed by default |
| Member surfaces | Social shell/onboarding on; Discovery, messaging, Media, Presence, Sensitive, youth, OTP and Demo off | all public/member activation flags closed |
| Moderation/Admin | moderation UI on; ordinary unauthenticated overview denied 401; `/api/admin/*` absent | Access-protected Admin implementation present but standalone activation false |
| R2 | dedicated Production bucket present and unchanged | exact Production-only private binding prepared |

The candidate must not be deployed blindly: its intentionally closed variables would disable
parts of the working owner pilot. An exact owner-approved preservation configuration is required
alongside the Access release. It must preserve the four existing owner-pilot capabilities without
opening Discovery, messaging, Media, Presence, public registration or any restricted service.

## Operational readiness

| Area | Implemented | Remaining decision / responsible role | Verification |
|---|---|---|---|
| Reports/blocking/moderation | Role separation, purpose/audit, privacy, quarantine and reversible restrictions | Name primary and backup moderators; owner | Genuine queue exercise through Access |
| Appeals | Independent media-review enforcement and account conflict audit | Name independent appeal reviewer; owner | Original reviewer denial and second-reviewer decision |
| Incident/emergency/child safety | Triage and fail-closed procedure; no emergency-service claim | Name incident commander and emergency/legal contact; owner/legal | Tabletop during confirmed coverage |
| Privacy/deletion | Authenticated deletion, rollback/retry, minimal receipt and retention cleanup tests | Approve policy and privacy operator; owner/legal | Isolated time-advanced deletion rehearsal |
| Cleanup/monitoring | Workers are scoped, retryable, audit-aware and exact-flag inert | Approve cron, alert thresholds/destination and responder; owner/operations | Isolated scheduled invocation plus failed-retry alert |
| Retention | Backup/Time Travel limitations documented | Approve final Production policy/effective versions; owner/legal | Exact published version/hash read-back |

## Remaining blockers

1. Production Access app/audience and genuine MFA/RBAC/revocation evidence do not exist.
2. Schema21 and the Access candidate are not authorized for Production.
3. A reviewed owner-pilot preservation configuration is required before deployment.
4. Google/Meta/LINE publishing and genuine login gates remain owner-controlled.
5. GitHub `main` protection and Dependabot repository controls remain disabled.
6. Named operations, cleanup schedules/alerts, retention and legal approvals remain unresolved.
7. Exact deployment, migration, Access secrets, grants and activation scope remain unauthorized.

## Recommendation

**NO-GO for Production deployment, schema migration or Admin activation.** The code controls and
isolated verification are ready. The next safe step is owner review of the exact Access checklist
and preservation gate, followed by separately authorized console configuration and genuine MFA
verification. The existing controlled owner pilot remains unchanged.
