# Phase 6 defect and fix register

| ID | Severity | Finding | Root cause | Resolution | Status |
|---|---|---|---|---|---|
| PH6-CONFIG-001 | P1 release blocker | Checked-in Production vars would disable the existing owner pilot in 11 ways | Earlier Phase 3 package intentionally modeled a fully closed release, not preservation of the subsequently verified live pilot | Added exact live fingerprint, fail-closed comparison and three regression tests; prepared a review-only 25/25 preservation profile | **OPEN/BLOCKED** until exact deployable Production config is owner-reviewed and authorized |
| PH6-TOOL-001 | P3 test tooling | Initial performance run returned Discovery 429 | Repeated application loads and direct samples shared one synthetic rate-limit identity | Separated measurement identities and added an explicit 30-allowed/31st-throttled assertion | **FIXED; rerun PASS** |

No reproducible application defect remained after regression. No authentication, authorization, validation or privacy control was weakened to obtain a pass.
