# Final UAT defect register

Classification: **PARTIAL UAT — SPECIFIC EXTERNAL GATES REMAIN**

No new engineering defect was discovered by the 28 October 2026 baseline recheck and bounded Social-campaign preparation. The full local suite passed 250/250, the live closed-host negative suite passed 17/17, and responsive closed-state checks passed at 390, 768 and 1440 pixels.

| ID | Severity | Status | Finding | Resolution / evidence |
|---|---:|---|---|---|
| CG-UAT-001 | P1 | FIXED / REGRESSION PASS | An earlier direct-upload package could omit plain-text UAT flags and the Turnstile site key while retaining encrypted secrets. | Deployment tooling now serializes and verifies flags/site key. `test/final-uat-infrastructure.test.js` and the live closed-host configuration checks pass. The frozen UAT deployment remains closed. |
| CG-UAT-002 | — | EXTERNAL GATE | Genuine Google, Facebook and LINE callbacks have not been executed by authorized humans. | Not an engineering defect. Keep OAuth/admission closed until the consolidated campaign is approved and scheduled. |
| CG-UAT-003 | — | EXTERNAL GATE | Protected UAT Access login with TOTP and recent-auth has not been completed. | Owner authenticator enrollment is verified, but enrollment is not application-MFA evidence. No role grant exists. |
| CG-UAT-004 | — | EXTERNAL GATE | Social/Location/Chat/Privacy test scope is approved, but A/B private admission facts, exact policy versions and the campaign window are not confirmed. | Do not invent a tester, issue invitations or enable features until the one private entry gate passes. Media remains outside scope. |
| CG-UAT-005 | — | EXTERNAL GATE | No independent media-appeal reviewer or backup moderator is confirmed. | Keep real media upload off unless an eligible reviewer and operating procedure are explicitly approved. Current coverage remains 19:00–22:00 Asia/Bangkok daily. |

Open P0 defects: **0**. Open P1 engineering defects: **0**. This does not make the release production-ready because genuine human UAT and operational gates remain incomplete.
