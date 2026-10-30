# Phase 6 E2E test plan

## Scope and safety

This plan assesses automation SHA `70f2e41716f3e748ad197f022c8516f812f9151c`, application SHA `cfb94c92190a17ebb73983cef4017ca227df5d42`, and read-only Production SHA `a73ff21c615dabb6a0c19c0a22685c2370958ca1`. All destructive journeys use synthetic identities in local SQLite/in-memory R2. Production access is limited to GET/SELECT inventory. No Production deployment, migration, authentication, provider change, feature change, account mutation, or repository-setting mutation is authorized.

## Execution matrix

| Phase | Coverage | Method | Exit condition |
|---|---|---|---|
| A | PR, SHAs, Phase 3/5 evidence, Production isolation | Git, GitHub and Cloudflare read-only inventory | Exact state recorded; writes = 0 |
| B | Unit, integration, static, supply chain, security | `npm test`, `npm audit --audit-level=high` | Zero failures/high vulnerabilities |
| C | Auth, account, profile, navigation and failure states | issue16 and platform Playwright | All executable scenarios pass |
| D | Discovery, relationships, messaging, Media, privacy, moderation | Node handlers plus real-handler Playwright | Authorization and lifecycle invariants pass |
| E | Access JWT, RBAC, CSRF, replay, audit and fail-closed behavior | Isolated signed assertions and Admin browser tests | Zero unresolved High/Critical security defects |
| F | 360/390/430/768/1280/1440 and p50/p95 | six-project Chromium matrix and measurement script | No browser failures; limitations recorded |
| G | Existing owner pilot and restricted flags | deterministic configuration fingerprint | Candidate passes before release authorization |
| H | Fixes, regression, evidence and decision | rerun affected/full suites | Exact PASS/FAIL/BLOCKED/NOT RUN package |

Genuine provider authentication, Production Access MFA, physical-device keyboards, remote load, deployment and migration are never inferred from mocks. They remain BLOCKED or NOT RUN until separately authorized.
