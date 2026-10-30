# ChatGun Production readiness report

Assessment date: 2026-10-29 (Asia/Bangkok)  
UAT-approved application baseline: `fb0210090745cdbfaaf0eb0ca68bfcb24fd6e576`  
Live Production application: `a73ff21c615dabb6a0c19c0a22685c2370958ca1`  
Decision: **NO-GO** for a new Production release or broader access.

This assessment was read-only against Production except for creating a D1 export through the
supported export API. The export, local migration rehearsal and rollback artifacts are protected
locally. No Production row, schema, Pages deployment, flag, provider setting, R2 object or GitHub
branch setting was changed. No PR was merged.

## Executive result

The application implementation is technically strong and the approved UAT baseline passes the
complete local regression suite. Production and Preview use distinct D1 databases and R2 buckets;
both R2 buckets have no managed or custom public domain. Production public registration,
Discovery, Messaging, Presence, Media, Sensitive content, OTP and Demo remain disabled.

Release is blocked because Production is still schema 17 while the baseline requires schema 21;
the repository previously offered the UAT-only schema 22 migration through the same migration
directory; Cloudflare Access is not configured even though live moderation tools and two role
grants exist; Google/Meta/LINE provider publishing cannot be independently confirmed; the GitHub
release chain is a stack of Draft PRs with no protected branch or release tag; and legal,
age-assurance, moderation/appeal and media-review operating gates remain incomplete.

## Task-by-task status

| # | Area | Status | Executed evidence | Required remediation |
|---|---|---|---|---|
| 1 | Approved requirements and NEAR-derived feature set | **PASS — code; BLOCKED — launch** | The non-game NEAR inventory remains represented by authentication/onboarding, responsive shell, profiles, voluntary approximate Discovery, direct chat, Presence, privacy, block/report, gallery/media, ratings/reviews, moderation, account/session lifecycle and deletion. Game is excluded. Unit and browser tests exercise these surfaces. | Keep public activation closed until the legal, age and operations decisions below are complete. Do not restore Demo or game content. |
| 2 | GitHub PRs, dependencies, CI, branches | **FAIL** | PR #17 is Draft and stacked on Draft PR #14, which is stacked on Draft PR #12. `main` and all release branches are unprotected. There is no GitHub Release. Dependabot and vulnerability alerts are disabled; no code-scanning analysis exists. Secret scanning reports zero open alerts. `npm audit` reports zero vulnerabilities. Exact baseline CI run 40910120435 passed. | Establish a reviewed integration branch or clean PR to `main`; enable branch protection, required exact-head CI, Dependabot/security updates and code scanning; create a signed/annotated release tag only after approval. |
| 3 | Cloudflare isolation, D1, R2, variables and controls | **PASS — isolation; FAIL — readiness** | Production D1 `9738…959d`, Preview D1 `5bbf…ea`, Final UAT D1 `e3cb…68ae` are distinct. Production/Preview/UAT R2 buckets are distinct and private. Production has schema 17/FK0, one user, one identity, seven session rows, zero messages/media and two moderation grants. Production privacy/media cleanup Workers are not deployed. | Migrate only through the isolated Production lane to schema 21 under separate approval. Configure and verify Cloudflare Access before any moderation UI use. Keep every public/social/media flag closed during release. Prepare and separately approve cleanup Workers before enabling data-producing features. |
| 4 | Google, LINE and Facebook OAuth | **PASS — code/config metadata; BLOCKED — provider consoles** | All three Production client/secret entries are present and encrypted. Production Turnstile is restricted to `chatgun.social`. Callback paths are derived from the request origin and the required exact callbacks are documented. Live Production currently permits LINE only; registration remains invitation-only/closed. | Independently verify Google publishing/test-user state, Meta publication/app review/business status and LINE publication/channel status in their consoles. Test start, denial, callback, replay, returning login, logout and linking on the exact release only after explicit Production authorization. |
| 5 | Pending migrations | **PASS — isolated rehearsal; BLOCKED — live apply** | A mode-0600 Production export was restored locally. Migrations 0018–0021 advanced schema 17→21 with FK0, unchanged existing row counts and empty new tables. Schema 22 was explicitly excluded because it is Final-UAT-only. A fresh schema-17 restore also passed. | Obtain exact migration-window approval; take a fresh export/bookmark; apply only `migrations/production`; verify schema21/FK0/count invariants and absence of `uat_authorized_identities`. Never apply the generic schema22 lane to Production. |
| 6 | Backup and rollback | **PASS — artifact/rehearsal; BLOCKED — change window** | Current Production SHA `a73ff21…` was rebuilt from Git and matched all 39 live assets plus the release manifest. The private rollback artifact and D1 export use 0700/0600 permissions. Local rollback restore returned schema17, original counts and FK0. | Capture a fresh D1 Time Travel bookmark at the authorized window; retain the exact prior Pages deployment ID; rehearse operator commands; never destructively down-migrate additive schema. Replay pending deletion intents after any database restore. |
| 7 | Private media and moderation | **PASS — implementation; BLOCKED — operations** | Tests cover private authorization, magic-byte/type/size checks, metadata removal, quarantine, audited release/reject, category restrictions, block/grant revocation, appeals, upload quotas, R2 cleanup retries and exhausted-retry reporting. Production media is OFF and R2 is private. | Keep Media OFF until Access, trained review coverage, scanner/manual-review decision, escalation channel, appeal independence and cleanup monitoring are approved and verified. |
| 8 | 18+, blocking, reporting and privacy | **PASS — safeguards; BLOCKED — assurance/legal** | Bangkok-date age self-declaration, minimum-age holds, write guards, block in both directions, reporter privacy, rate limits, coarse location, opt-in Presence, session revocation and deletion are covered. | The 18+ flow is self-declaration, not independent verification. Qualified legal review, age-assurance decision, emergency/legal escalation and non-media appeal register remain mandatory before broader access. |
| 9 | Comprehensive testing | **PASS — local/isolated; BLOCKED — Production smoke** | 272/272 Node tests, 16/16 Issue-16 browser tests, 102/102 platform browser tests, 10/10 full-system handler tests and 35/35 closed-release checks passed. Desktop/mobile widths were exercised. Live isolated UAT chat ordering/realtime evidence remains preserved. | Re-run exact Draft-PR-head CI. Production-host OAuth and closed-flag smoke tests require separate deployment authorization and therefore were not executed. |
| 10 | Release recommendation | **NO-GO** | The code baseline is suitable for continued isolated UAT and remediation review, not a new Production release. | Close every P0 and obtain owner approval of one exact release SHA, policy set, schema plan, closed flag set and rollback package. |

## Blockers

### P0 — must close before any Production deployment

1. Production schema is 17; the application release requires schema 21.
2. The old shared migration lane included UAT-only migration 0022. Production must use the new
   byte-verified `migrations/production` lane containing only 0001–0021.
3. Live `MODERATION_TOOLS_ENABLED=true` and two grants exist, but
   `ADMIN_ACCESS_STANDALONE_ENABLED`, `ADMIN_CLOUDFLARE_ACCESS_REQUIRED`, Access issuer and Access
   audience are absent. Treat admin access as unverified and do not use it.
4. No exact Production release SHA, closed flag set, migration window or rollback package has owner
   approval. UAT approval does not authorize Production.
5. Production-specific policies for any scope broader than the existing LINE owner pilot are not
   approved. The rc5 documents are isolated-UAT documents and must not be published as Production
   policy.

### P1 — must close before enabling another account or feature

1. Google and Meta provider publishing/review state, and current LINE channel publication state,
   require manual provider-console verification.
2. `main` has no protection; PR #17 is a Draft in a three-PR stack; Dependabot alerts and code
   scanning are disabled; there is no release tag.
3. The single-operator 19:00–22:00 moderation model has no confirmed backup, emergency/legal route
   or independent non-media appeal path.
4. Media has no approved automated scanner or demonstrated staffed review/cleanup capacity.
5. Self-declared adulthood is not independent age verification for a high-risk public Social,
   Discovery, Chat or Media launch.
6. Production privacy and media cleanup Workers are absent; retention/deletion enforcement is not
   operational for any newly enabled data-producing feature.

### P2 — hardening before public launch

1. Verify Cloudflare log retention/export destinations and approve retention wording.
2. Add ongoing restore drills, cleanup-alert tests and production monitoring ownership.
3. Enable repository dependency alerts, code scanning and required signed/reviewed releases.

## Remediation included in the Draft PR

- A separate Production migration lane, byte-identical through schema 21 and excluding schema 22.
- Fail-closed Production Wrangler defaults for OAuth, registration, Social, Discovery, Messaging,
  Presence, Media, Sensitive content, OTP, Demo and all admin/moderation features.
- Read-only sanitized Cloudflare/D1/R2 readiness evidence generation.
- Offline migration/rollback rehearsal from a protected export.
- Exact-current-release rollback artifact verification against every live asset.
- CI dependency audit and regression tests for migration isolation and fail-closed configuration.
- This report and the deployment/rollback checklist.

## Evidence files

- `live-infrastructure.json` — sanitized Production/Preview/Turnstile/binding/config snapshot.
- `migration-rehearsal.json` — schema17→21 offline rehearsal and schema17 rollback restore.
- `rollback-artifact.json` — exact SHA/manifest/39-asset rollback match.
- `test-results.json` — exact CI, local regression and isolated-UAT results plus unexecuted tests.
- `deployment-rollback-checklist.md` — stop gates and approved-window procedure.

Private exports, account data and rollback bytes are not committed and remain under
`~/.codex/private-backups/chatgun/` with restrictive permissions.
