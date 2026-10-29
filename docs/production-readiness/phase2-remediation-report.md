# Phase 2 Production blocker remediation

Baseline: PR #18 at `f1759505fe3b6d99fdfe524ed81091d734b859d3`.
Scope: offline implementation, read-only verification and isolated testing only. No Production
deployment, migration, flag, provider, account, R2 or repository-setting mutation was authorized.

Read-only Cloudflare verification on 2026-10-29 used the explicit `chatgun` auth profile and
account `23017b53386fb67fc62a52cdd017454c`. Production remains deployment source `a73ff21…`,
schema17 with FK0 and zero D1 writes from the audit. The Production R2 bucket still exists and
the secret-name inventory contains provider, Turnstile and pepper entries but no Access
issuer/audience entry. The default Wrangler profile points to an unrelated account and must not
be used for ChatGun; every future command must pin both the `chatgun` profile and exact account ID.

## Results

| Area | Result | Evidence and remediation | Remaining gate |
|---|---|---|---|
| Cloudflare Access issuer/audience | **PASS — implementation; BLOCKED — live configuration** | RS256 signature, exact `iss`, exact audience, application token type, owner email, owner UUID, expiry/not-before, fixed issuer JWKS URL and outage fail-closed tests pass. `DEPLOYMENT_ENVIRONMENT=production` now makes missing/false/partial Access configuration an error, eliminating member-session fallback. | Owner must create/read back the Access application, exact audience, issuer, owner identity and MFA policy in the Cloudflare console. Secrets/identity values must be stored privately. |
| Admin authentication and RBAC | **PASS — implementation; BLOCKED — live proof** | Access identity cannot create a D1 role. Active account, restrictions, age hold, expiring D1 grant, recent-auth evidence, purpose, CSRF, audit, revocation and logout tombstones are independently enforced. | Genuine Access login/MFA and fresh-auth evidence must be exercised with a named, time-bounded grant after schema21 and separate authorization. |
| D1 schema17→21 | **PASS — package/rehearsal; BLOCKED — live authorization** | Isolated lane contains exactly 1–21 and byte-matches source; hashes/runbook are recorded; protected-export rehearsal preserves counts and FK0; schema22 is excluded; restore rehearsal returns schema17. | Fresh backup plus exact migration authorization and maintenance/rollback owner are required. No live migration was run. |
| OAuth Google/LINE/Meta | **PASS — server controls; BLOCKED — consoles/genuine login** | State, nonce, PKCE where applicable, token audience/expiry, provider identity and callback tests pass. Exact Production callbacks and owner-console actions are documented. | Provider-console read-back, mode/tester eligibility and genuine Production-domain login/cancel tests require owner access. Keep all providers disabled. |
| Privacy/media cleanup Workers | **PASS — isolated implementation; BLOCKED — operations** | Prepared configs have no cron, no preview URL, exact Production bindings and false flags. Runtime now requires exact lowercase `true`; missing/mistyped flags are inert. Existing retention, retry, lease, R2 deletion, exhausted queue and deletion tests run locally only. | Approve schedules, monitoring/alert owner, deletion policy and a non-Production time-advanced rehearsal before deployment. |
| Moderation workflow | **PASS — implementation; BLOCKED — staffing** | Role separation, purpose logging, reporter privacy, appeal concurrency, private media quarantine, account restriction and audit tests pass. | Named moderation, appeal, escalation and emergency/legal contacts; service hours/SLA; genuine Access proof. Media remains off. |
| GitHub dependency updates | **PASS — configuration; BLOCKED — repository setting** | `.github/dependabot.yml` adds bounded weekly npm and Actions updates. `npm audit --audit-level=high` remains CI-enforced. | Dependabot alerts/security updates are disabled at repository level and require owner/admin enablement. |
| GitHub code scanning | **PASS — workflow prepared; PENDING — first run** | CodeQL JavaScript/TypeScript workflow uses an immutable official action commit and minimum permissions. | The workflow must complete on this Draft PR; repository code-scanning status cannot be called PASS before analysis exists. |
| Branch protection | **FAIL/BLOCKED** | GitHub read-only audit found `main` unprotected and no rulesets. | Owner/admin must require PRs, required `local-regression` and CodeQL checks, conversation resolution, no force pushes/deletions and restricted bypass. Do not silently change repository governance. |
| Production isolation | **PASS** | Proposed config binds only Production D1/R2, uses the Production-only migration lane and keeps OAuth, registration, Social, Discovery, messaging, Presence, media, moderation, OTP, Demo and public canary closed. | Re-run read-only live comparison immediately before any authorized release. |

## Decision

**NO-GO for Production activation.** The code/package blockers are remediated or prepared, but
Cloudflare Access live proof, provider-console proof, schema migration authorization, cleanup
operations approval, moderation staffing, Dependabot repository enablement and branch protection
remain external gates. A closed, no-service deployment is also not authorized by this report.
