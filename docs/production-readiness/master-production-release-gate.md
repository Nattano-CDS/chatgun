# ChatGun master Production release gate

Checked: 2026-10-30 (Asia/Bangkok)  
Scope: restricted LINE owner pilot plus separately gated Production Admin  
Decision: **NO-GO**  
Production mutations performed by this execution: **0**

This is the consolidated release package for Draft PR #20. It replaces the older phase-by-phase
decision summaries for release authorization; those files remain historical evidence. The exact
candidate commit is recorded in the protected, mode-0600 execution manifest generated after this
document is committed and must equal the PR head at approval and deployment time.

## Executive result

The application candidate is technically consistent and its isolated regression, security,
responsive-browser, performance, migration-rehearsal, and Production-preservation gates pass.
Production is not ready to change. The remaining release-scope blockers require privileged owner
actions or genuine Production evidence and cannot be converted into PASS by CI:

1. the bare `/api/admin` path is not covered by the current Cloudflare Access destinations;
2. Production is schema 17 and no fresh final-gate protected export exists;
3. Production does not contain the required encrypted Admin verifier/binding settings or Admin
   activation flags;
4. no Production application role is granted, and genuine Access-to-ChatGun RBAC has not run;
5. fresh LINE provider-console and owner login/session verification has not run;
6. accountable operational roles and monitoring/cleanup ownership are not assigned;
7. `main` is not protected and Dependabot security updates are disabled;
8. no physical iPhone was available; physical-device Safari remains NOT RUN.

No Critical defect was found in the isolated candidate. The unresolved items above are High release
gates for the restricted release, except physical iPhone coverage, which is a documented coverage
gap and must be accepted or completed before authorization. Public launch remains out of scope and
NO-GO.

## Evidence classification

| Area | Status | Evidence and boundary |
| --- | --- | --- |
| Exact PR baseline | PASS | PR #20 fetched at `baf0d1406e4124b179420fc215bfc34e868b77f2`; the final documentation commit and generated private manifest supersede this baseline. |
| PR dependency chain | PASS / constrained | PRs #17→#18→#19→#20 form the active stack. PR #21 is based on PR #20 but is stale relative to later PR #20 hardening and must not be merged ahead of it. No PR was merged or closed. |
| CI at baseline | PASS | Eight exact-head checks succeeded: local regression, three-browser master matrix, dedicated WebKit regression, JavaScript/CodeQL workflow, CodeQL analysis, and Cloudflare Pages Preview. Final-head CI must repeat after this package commit. |
| Unit/integration/security | PASS | 292/292 Node tests, including five consolidated-package integrity checks. |
| Isolated browser E2E | PASS | 840 master cases: 280 each on Chromium, Firefox, and WebKit. This is local isolated automation, not genuine Production OAuth or a physical device. |
| Dedicated WebKit regression | PASS | 105/105 local WebKit cases. |
| Responsive regression | PASS | Authentication, Social, and moderation surfaces at 320, 360, 390, 430, 768, 1024, 1440, and 1920 pixels. |
| Production preservation | PASS | 25/25 candidate configuration checks preserve the existing LINE owner pilot and keep restricted features disabled. Live read-only `/api/social/config` agreed with the expected restrictions. |
| Admin RBAC isolation | PASS | 24/24 focused cases: Access identity without role denied; active/expired/revoked role behavior; CSRF; purpose/recent-auth; audit; and sensitive-record isolation. No genuine Production RBAC result is claimed. |
| Performance | PASS | Local real-handler simulation, 20 samples per principal measurement: initial app p95 555.42 ms; moderation p95 537.32 ms; Discovery API p95 4.29 ms; profile API p95 3.57 ms; conversation list p95 1.30 ms; message send p95 1.71 ms; route transition p95 36.81 ms. A 250-message conversation rendered/paginated in 163.19 ms. This excludes edge, provider, and remote D1/R2 latency. |
| Dependency audit | PASS | `npm audit` reported zero vulnerabilities at the application baseline. |
| Desktop Safari | PASS / limited | Genuine local macOS Safari read-only UAT navigation, reload, chronological chat ordering, and latest-message/composer visibility were observed. No new message was sent. |
| Physical iPhone Safari | NOT RUN | No physical iPhone surface was accessible. WebKit simulation is not relabeled as physical testing. |
| Production OAuth journey | NOT RUN | No Production login, account mutation, invitation, or session write was authorized. |
| Production D1/R2 writes | NOT APPLICABLE | Prohibited by this task; none performed. |

Overlapping suites are reported separately and are not summed into an artificial grand total.

## Production preservation fingerprint

The observed live Production application remains
`a73ff21c615dabb6a0c19c0a22685c2370958ca1`, on `main`, with D1 schema 17. Read-only dashboard and
public configuration checks found the following approved owner-pilot posture:

- LINE OAuth, invitation registration, policy acceptance, adult onboarding, Social shell, and
  moderation tools remain enabled.
- Public registration, Discovery, messaging, media uploads, Presence, ratings, Sensitive content,
  email/mobile OTP, Demo, account moderation, and identity verification remain disabled.
- Media quarantine remains enabled; the R2 binding remains private.
- The Production D1 and R2 identifiers and private account evidence are intentionally omitted.

The candidate's 25/25 preservation gate validates the same profile. Deployment is still prohibited
until the privileged gates below pass.

## Cloudflare Access and application Admin security

Read-only inspection verified the existing `ChatGun Production Admin` Access application has one
owner-only Allow policy, Authenticator MFA on every access, a ten-minute session, and no Bypass or
Service Auth policy. `/app/moderation` and `/api/admin/session` redirected anonymous requests to the
Access sign-in flow.

**BLOCKED:** the current destinations cover `/app/moderation*` and `/api/admin/*`, but the bare
`/api/admin` path returned the public static 404 rather than the Access challenge. The candidate
origin safely redirects GET/HEAD on that bare path to `/api/admin/session` and rejects unsafe methods,
but origin behavior does not satisfy the required edge-coverage invariant. A separate Access-policy
authorization must add and verify the exact bare path without changing the existing policy identity,
MFA, duration, or other applications.

The application itself fails closed unless all required verifier and binding values are present. It
validates RS256 signature, exact issuer/audience, token type and time bounds, owner identity, private
ChatGun owner binding, replay, CSRF, recent authentication, active role, expiration, and revocation.
Access admission never derives an application role. A `moderation_admin` can manage roles but cannot
read overview, reports, private media, identity evidence, or other safety-only records.

**BLOCKED:** Production currently has none of the `ADMIN_ACCESS_*` settings. The required encrypted
values are the exact issuer, application audience, privately verified owner Access identity, and
privately verified owner ChatGun UUID. The optional identity-lookup switch must stay off until a
genuine `/get-identity` read-back succeeds. Required activation settings are
`ADMIN_CLOUDFLARE_ACCESS_REQUIRED=true` and, only after every prior gate passes,
`ADMIN_ACCESS_STANDALONE_ENABLED=true`. Values must never be logged or committed.

Additional hardening decisions remain separately scoped: Access cookie HTTP-only/binding options,
Pages fail-open behavior, and currently unrestricted Preview URLs must be compatibility-tested before
any console change. They are not silently changed by this package.

Recovery rule: if Access or application verification fails, keep standalone Admin disabled, revoke
the bootstrap grant if present, preserve all public-feature restrictions, and restore no database
automatically.

## Schema 17→21 and recovery evidence

The only approved Production migration lane is byte-exact:

| Migration | SHA-256 | Result |
| --- | --- | --- |
| `0018_cloudflare_admin_sessions.sql` | `d7ab7d2a438ff1c5d3c3d83cdbf35b4b7837146af3898c282714d382a7e822d6` | MATCH |
| `0019_member_age_safety_holds.sql` | `696683be68db9f43efd0d62973173f28b1c4e916aca0adaaf887aab859d347e6` | MATCH |
| `0020_age_hold_write_guards.sql` | `ec4774ca2db46c4525b64fe5ca266040d70443b311400579e909009c767411b9` | MATCH |
| `0021_eligibility_review_requests.sql` | `0e4d2bfe7a3adcd5a86dc4f9ac6ebc5b1e21c2964aea23c709d19199586968a4` | MATCH |

Migration `0022_always_on_private_uat_cohort.sql` is UAT-only and excluded.

The prior protected schema-17 export rehearsal is PASS: permissions 0600, source and target checks,
all four migrations, row-count preservation, zero foreign-key violations, schema-21 compatibility,
and recovery into an isolated schema-17 database all passed with zero Production writes. That is
valid technical evidence but not a fresh final-gate backup.

**BLOCKED:** the active Wrangler session is authenticated to a different Cloudflare account. The
workflow failed closed before any remote command. A fresh Production export, current row/schema
read-back, and fresh recovery-access verification must be performed under the correct account before
Gate A. A restore into Production is destructive and always requires its own authorization; the
rollback artifact is a recovery input, not permission to restore.

## Authentication providers

- **LINE — BLOCKED:** retained as the only provider for the restricted owner pilot. Fresh genuine
  Business ID/2-step-verification, published channel state, exact callback, `openid profile` scopes,
  cancellation, login/logout, expiry, continuity, and unauthorized-user rejection were not run.
  Owner console login and MFA are required. Existing provider settings were not changed.
- **Google — NOT APPLICABLE to this release:** keep disabled. Prior UAT configuration is not
  Production authorization.
- **Meta — NOT APPLICABLE to this release:** keep disabled and unpublished. Prior UAT configuration
  is not Production authorization.

Google or Meta activation is a later, separate release and must not be treated as a condition for the
explicit LINE-only pilot.

## Repository and supply-chain enforcement

Actual GitHub settings inspection found secret scanning and push protection enabled and exact-head
CodeQL successful. **BLOCKED:** `main` has no branch protection or ruleset, and Dependabot security
updates/automated security fixes are disabled. Required pull requests, independent review,
conversation resolution, required CI/CodeQL, force-push protection, deletion protection, Dependabot
alerts, and security updates therefore are not demonstrably enforced. Repository-setting changes
need separate owner authorization; none were made.

## Privacy, cleanup, moderation, and operations

Isolated tests cover deletion scope, retries, audit behavior, moderation authorization, reports,
blocking, appeals, purpose/recent-auth controls, and fail-closed feature flags. No Production Worker
was deployed or scheduled.

**BLOCKED:** Production has no verified cleanup-worker schedules, failure alerts, or named operational
owners. The following accountable assignments remain absent: primary moderator/incident commander,
backup moderator, independent appeal reviewer, privacy/deletion operator, security-alert owner,
emergency/legal escalation contact, monitoring owner, release operator, independent migration
verifier, and rollback decision maker. Known human moderation coverage is limited to
19:00–22:00 Asia/Bangkok. Until names, access rights, coverage, escalation, and backups are confirmed,
public messaging, Discovery, Media, Presence, Sensitive content, ratings, and public registration must
remain disabled.

## Initial role bootstrap proposal

After Gates A–C succeed, a separately authorized atomic transaction may grant exactly one existing,
privately bound owner account `moderation_admin` for 3,600 seconds. It must create the matching role
event with the same timestamp and reviewed reason, and first verify the account is active,
unrestricted, adult, and not age-held. It must not grant `safety_admin`, `report_reviewer`, or
`identity_reviewer`. Expiry and revocation are authoritative on every request.

## Independently approvable actions

Every item below is a separate approval. Approval of one is not approval of later items.

1. **Access route correction** — target: existing Production Admin Access application; add exact bare
   `/api/admin` protection while preserving current destinations/policy/MFA/session. Risk: admin
   lockout or route overreach. Rollback: remove only the new exact destination. Verify anonymous
   challenge on all three route families, owner MFA, unauthorized denial, and recovery. Excludes
   Pages, D1, deployment, roles, OAuth, repository settings, and feature activation.
2. **Fresh backup and migration** — target: Production D1, schema 17→21; authenticate to the correct
   account, export to protected storage, verify hash/permissions/schema/counts/FK, apply only 0018–0021,
   then recheck. Risk: migration failure/data incompatibility. Abort on any fingerprint mismatch.
   Recovery: prepare isolated restore verification; never restore Production without new approval.
   Excludes migration 0022, application deployment, roles, and feature flags.
3. **Encrypted Admin settings** — target: Production Pages encrypted variables; install only the exact
   verifier and private owner bindings, keep identity lookup off unless genuinely verified, and keep
   standalone Admin off until deployment authorization. Risk: lockout/misbinding. Rollback: remove
   only new Admin variables and keep Admin disabled. Excludes D1, deployment, Access policy, and roles.
4. **Exact candidate deployment** — target: Production Pages; deploy only the private manifest SHA
   with the fingerprint above. Risk: regression despite isolated tests. Rollback: redeploy the verified
   Production artifact; do not restore D1 automatically. Verify SHA/assets/config, pilot login, and
   every disabled feature. Excludes schema work, role grant, OAuth publication, and public activation.
5. **One-hour bootstrap grant** — target: Production D1; atomic `moderation_admin` grant/event only.
   Risk: unauthorized admin capability. Rollback: immediate revocation event. Verify no-role denial,
   role-management access, sensitive-record denial, expiry, revocation, CSRF, recent-auth, and audit.
   Excludes all safety/reviewer roles and account changes.
6. **Genuine owner E2E** — target: deployed restricted pilot; perform Access MFA, LINE login/session,
   Admin denial/allow/revocation, and preservation checks. Risk: limited Production account/session
   writes inherent to authorized login. Stop on mismatch. Excludes public users/messages/media.
7. **Repository enforcement** — target: GitHub `main`; require PR, independent review, conversation
   resolution, exact CI/CodeQL, and force-push/deletion protection; enable Dependabot alerts/security
   updates. Risk: merge lockout. Recovery: preserve a separately approved break-glass owner path.
   Excludes PR merge and application/Cloudflare changes.
8. **Operations and cleanup** — target: named human assignments, alerts, and separately reviewed
   Production cleanup Workers/schedules. Risk: deletion or missed incident. Use dry-run/isolated
   time-advanced evidence before activation and an emergency disable path. Excludes existing data
   deletion and public feature enablement.
9. **LINE console verification** — target: existing Production LINE channel; owner performs genuine
   login/MFA and read-only verification first. Risk: accidental provider change. Make no callback,
   publishing, or scope change without a new exact approval. Excludes Google and Meta.

## Controlled release sequence and abort rules

Gate A: fresh backup and authorized schema migration.  
Gate B: authorized encrypted verifier/binding settings.  
Gate C: authorized exact-SHA restricted deployment.  
Gate D: authorized one-hour role bootstrap.  
Gate E: genuine owner Access/LINE/RBAC/preservation E2E.  
Gate F: fingerprint, operations, evidence, and scope sign-off.

Before Gate A, correct and verify bare-path Access coverage and assign the required operators. Each
gate stops on any identity, SHA, hash, schema, count, flag, policy, or audit mismatch. Keep all
excluded features disabled. Recovery never implies automatic Production database restoration.

## Final recommendation

**NO-GO for Production change.** The candidate is suitable to retain as the immutable technical
release candidate, but genuine Production authentication, edge-route completeness, fresh backup and
migration evidence, encrypted configuration, operations, repository enforcement, and separately
authorized deployment/bootstrap remain unresolved. The existing restricted Production owner pilot
should continue unchanged.

