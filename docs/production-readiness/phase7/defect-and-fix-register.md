# Phase 7 defect and fix register

| ID | Priority | Finding | Fix | Verification | State |
|---|---|---|---|---|---|
| PH7-TEST-001 | P1 release CI | Four tests still expected the superseded fully closed candidate and rejected the owner-pilot-preserving configuration. | Rebased assertions on the same 25-point preservation contract while retaining explicit restricted-feature, migration, Access and R2 checks. | Focused 18/18 and full 284/284 application tests passed. | FIXED |
| PH7-TOOL-001 | P3 test tooling | The initial long-thread performance fixture attempted 60 real-handler sends and correctly triggered the anti-spam 429 control. | Retained real-handler latency/rate measurements and used deterministic browser-only fixtures solely for 250-message rendering/scroll measurement. No security control changed. | Final collector passed and the 31st discovery probe still returned 429. | FIXED |

No application functional or security regression was found. `PH7-TEST-001` was a release-test regression, not a Production configuration change. The fixes are limited to test assertions, the Phase 7 browser/performance harness and evidence.
