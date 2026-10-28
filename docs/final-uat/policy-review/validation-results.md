# Validation results

Checked 2026-10-28 (Asia/Bangkok). Policy status remains **DRAFT — NOT APPROVED** regardless of technical PASS results.

| Check | Actual result | Evidence |
|---|---|---|
| Four-document policy consistency | **PASS (9/9)** | Exact versions, SHA-256 values, draft markers, cross-links, scope/exclusions, Social risks, retention language, frontend links, backend acceptance versions and fail-closed activation assertions passed in `test/final-uat-policy-package.test.js` plus the campaign tests. |
| Public build | **PASS** | `npm run build` completed and produced the static public asset package. No UAT policy was published by this local build. |
| Full regression suite | **PASS (257/257)** | `npm test`: 257 passed, 0 failed, 0 skipped/cancelled. |
| JavaScript syntax | **PASS** | `node --check scripts/activate-final-uat-social.mjs`. |
| Dependency security audit | **PASS** | `npm audit --audit-level=high`: 0 vulnerabilities. |
| Patch hygiene | **PASS** | `git diff --check` returned no errors. |
| Production source policy preservation | **PASS** | The four repository-root Production documents retain their approved SHA-256 values: `e01da689…394`, `7b381aae…dc3`, `be5d8578…48b`, `b55216f2…e4`. |
| Live Production read-only comparison | **PASS / UNCHANGED BY THIS WORK** | `https://chatgun.social/release.json` still reports controlled-beta commit `a73ff21c615dabb6a0c19c0a22685c2370958ca1`; each live policy byte hash matches its current `release-assets.json` entry. No Production write or deployment was performed. |
| Protected handoff structure | **PASS** | JSON parses; file mode remains `0600`; proposed rc2 versions/hashes were updated; personal references, decisions and date/time remain blank/null. |
| Mandatory approval gate | **BLOCKED (expected)** | The real planner rejects the handoff at `policyApproved: null` before activation. Participant confirmations, retention/recovery acceptance, B deletion decision and exact Bangkok window are also still missing. |
| Invitations/accounts/Social activation/human E2E | **BLOCKED (required by owner instruction)** | No invitations issued, genuine accounts created, roles granted, UAT Social gates enabled or E2E campaign started. Media, public registration, youth admission and Production remain unchanged/off as required. |

The technical PASS results establish package consistency only. They do not approve the policies or retention decision.
