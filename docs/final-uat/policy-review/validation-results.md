# Validation results

Checked 2026-10-28 (Asia/Bangkok). Policy status is **RC3 DRAFT — EXACT OWNER REAPPROVAL REQUIRED** regardless of technical PASS results. The exact approved rc2 bytes remain at commit `1468943`.

| Check | Actual result | Evidence |
|---|---|---|
| Four-document policy consistency | **PASS** | Exact rc3 versions, SHA-256 values, conditional-effect markers, cross-links, scope/exclusions, Social risks, 90-day retention language, frontend links, backend acceptance versions and fail-closed activation assertions passed. |
| 90-day minimized audit enforcement | **PASS (2/2 dedicated tests)** | Exact `90` days from actual campaign close, no scheduled-window substitution, optional outside the dedicated UAT, altered values fail closed, expired live evidence is removed by the UAT privacy worker. |
| Public build | **PASS** | `npm run build` completed and produced the static public asset package. No UAT policy was published by this local build. |
| Full regression suite | **PASS (260/260)** | `npm test`: 260 passed, 0 failed, 0 skipped/cancelled. |
| JavaScript syntax | **PASS** | `node --check scripts/activate-final-uat-social.mjs`. |
| Dependency security audit | **PASS** | `npm audit --audit-level=high`: 0 vulnerabilities. |
| Patch hygiene | **PASS** | `git diff --check` returned no errors. |
| Production source policy preservation | **PASS** | The four repository-root Production documents retain their approved SHA-256 values: `e01da689…394`, `7b381aae…dc3`, `be5d8578…48b`, `b55216f2…e4`. |
| Live Production read-only comparison | **PASS / UNCHANGED BY THIS WORK** | `https://chatgun.social/release.json` still reports controlled-beta commit `a73ff21c615dabb6a0c19c0a22685c2370958ca1`; each live policy byte hash matches its current `release-assets.json` entry. No Production write or deployment was performed. |
| Protected handoff structure | **PASS** | JSON parses; mode remains `0600`; approved seven-day/recovery decision and 90-day actual-close rule are recorded. rc3 exact approval, personal references/consents, B deletion decision and date/time remain pending. |
| Live isolated-UAT preflight | **PASS / CLOSED** | Frozen application SHA, schema21/FK0, empty users/identities/sessions/media/grants/invitations, private R2, Turnstile hostname, encrypted provider/Access metadata, private cleanup-worker bindings/schedules and Production isolation reverified read-only. The updated 90-day worker will deploy only after all gates pass. |
| Mandatory approval gate | **BLOCKED (expected)** | rc3 exact-byte approval is false and every A/B/window field remains blank/null. The real planner rejects activation before any Cloudflare mutation. |
| Invitations/accounts/Social activation/human E2E | **BLOCKED (required by owner instruction)** | No invitations issued, genuine accounts created, roles granted, UAT Social gates enabled or E2E campaign started. Media, public registration, youth admission and Production remain unchanged/off as required. |

The technical PASS results establish package consistency only. They do not approve rc3 or supply participant consent.
