# Physical device validation

## Actual results

- **WebKit simulation:** PASS, 272/272 across 320–1920 pixels in the master matrix.
- **Dedicated WebKit regression:** PASS, 102/102 at 390, 768 and 1440 pixels.
- **Actual desktop macOS Safari:** PASS for the performed read-only isolated-UAT scope. An authenticated session survived reload; Discovery and Chat navigation loaded; existing messages remained oldest-to-newest; the latest message and composer were visible. No message, location, report, block or account mutation was submitted.
- **Physical iPhone Safari:** BLOCKED. No physical mobile device was connected to the execution environment. WebKit and desktop Safari do not prove virtual-keyboard, device safe-area, touch hardware, radio or mobile LINE handoff behavior.

## Owner physical-device checklist

Record device/iOS/Safari versions and actual PASS/FAIL for: LINE handoff and return; onboarding/profile; Discovery with voluntary location and revocation; long Chat upward scroll; latest-message position; composer visibility before/during/after keyboard; image viewer close/zoom; top/bottom safe areas; background/foreground session continuity; logout/relogin; and touch targets. Use isolated UAT, do not expose identifiers, and do not mutate Production.
