# Full-launch release-candidate E2E matrix

This matrix distinguishes deterministic local/isolated evidence from genuine provider, device, and Production evidence. A local PASS never implies a Production PASS.

| # | Journey | Candidate evidence | Result | Remaining genuine evidence |
|---|---|---|---|---|
| 1 | Register → login → profile | Account/onboarding handler tests and existing browser suites | PASS (isolated) | Google, Facebook and LINE provider login on isolated cloud RC |
| 2 | Login → discovery → profile | Existing responsive/cross-device suites | PASS (isolated) | Physical-device cloud RC smoke |
| 3 | Discovery → request → accept | `production-launch-rc.spec.js` at 390/768/1440 | PASS (isolated) | Two genuine provider identities in cloud UAT |
| 4 | Friends → chat → send → read | New handler-backed RC suite | PASS (isolated) | Genuine remote dual-device RC |
| 5 | Two users exchange/order messages | Existing chat ordering and real-time suites | PASS (isolated) | Genuine remote dual-device RC |
| 6 | Unsend | Existing messaging regression | PASS (isolated) | Genuine remote RC smoke |
| 7 | Upload → gallery | Private R2/media regression | PASS (isolated) | BLOCKED for launch: media activation not approved |
| 8 | Report → admin review | Moderation and restricted-admin suites | PASS (isolated) | Public operating coverage and escalation ownership |
| 9 | Block → restrictions | Social/security tests | PASS (isolated) | Genuine remote RC smoke |
| 10 | Unblock → restored non-friend visibility | Social/security tests | PASS (isolated) | Genuine remote RC smoke; friendship is intentionally not restored |
| 11 | Logout → login → recovery | Auth/session suites | PASS (isolated) | Genuine provider re-login |
| 12 | Delete account → revoke access | Account-deletion/privacy tests | PASS (isolated) | Approved cleanup schedule and cloud RC smoke |
| 13 | Restricted user → protected API | Authorization/security tests | PASS (isolated) | None before cloud RC |
| 14 | Mobile keyboard → send | Responsive browser suites | PASS (emulated) | Physical iOS Safari and Android |
| 15 | Refresh → restore state | Responsive/cross-device suites | PASS (isolated) | Genuine remote RC smoke |
| 16 | Network interruption → recovery | Existing social browser regression | PASS (isolated) | Genuine network-transition smoke |
| 17 | High-volume ordering | Deterministic timestamp/id ordering tests | PASS (isolated) | Remote latency/reconnection smoke |
| 18 | Expired session → reauthenticate | Auth/session security tests | PASS (isolated) | Genuine provider expiry smoke |

Mandatory cloud/provider/device items remain BLOCKED or NOT RUN until the owner-controlled consoles, accounts and physical devices are available. They must not be converted to PASS from local evidence.
