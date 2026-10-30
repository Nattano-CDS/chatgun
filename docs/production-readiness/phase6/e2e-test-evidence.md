# Phase 6 E2E evidence

Executed on 30 October 2026 (Asia/Bangkok) against automation SHA `70f2e41716f3e748ad197f022c8516f812f9151c`.

| Evidence | Actual result |
|---|---|
| `npm audit --audit-level=high` | 0 vulnerabilities (all severities) |
| `npm test` | 284 passed, 0 failed, 0 skipped |
| `playwright.issue16.config.js` | 16 passed |
| `playwright.platform-local.config.js` | 102 passed |
| `playwright.phase6-cross-device.config.js` | 204 passed across six widths |
| `playwright.full-system-local.config.js` | 10 passed against real local handlers |
| `test-closed-release.mjs --local` | 35 passed; 27 assets hash-verified |
| Offline schema 17→21 rehearsal | row counts preserved, FK violations 0, schema22 excluded, rollback restored schema17 |
| Performance measurement | seven p50/p95 metrics passed; discovery request 31 returned expected 429 |
| Production preservation profile | proposed profile 25/25 PASS; checked-in candidate BLOCKED with 11 regressions |
| Production inventory | SHA unchanged, schema17, FK0, private R2, owner pilot live, restricted features off, writes 0 |

Machine-readable scenario records are in `e2e-test-results.json`; raw browser evidence is in `cross-device-playwright.json`, `performance-measurements.json`, and `closed-release/local-static-tests.json`. Logs and reports contain no credentials, cookies, provider subjects, member UUIDs, or private invitation data.
