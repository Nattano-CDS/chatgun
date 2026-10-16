# NEAR v91 visual restoration — Phase 1 review

Status: owner-review checkpoint. Phase 2 has not started.

## Implemented

- Added the original NEAR v91 Noto Sans Thai font files and license.
- Consolidated the active social shell onto the canonical violet `#6d42e5`, hover `#5931c5`, lavender `#eee8ff`, lime `#d0f17b`, background `#f7f7fb`, border, ink, and muted-text tokens.
- Restored the compact discovery toolbar, responsive search/filter behavior, fixed route navigation, canonical icon style, and visible keyboard focus.
- Restored the three-column desktop and two-column tablet/mobile discovery grid.
- Restored full-bleed portrait cards with media overlay, distance pill, name, bio, rating, and compact relationship action.
- Removed Game from the restored navigation; no empty Game destination remains.
- Moved the unchanged marketing landing page to `/welcome`.
- Made `/` a no-store internal rewrite to the existing authenticated discovery application. Existing server configuration and session/account-state checks still decide whether discovery can be used.
- Kept ChatGun branding, location privacy controls, friend authorization, blocking/reporting, moderation, quarantine, rate limits, upload quotas, feature flags, and account-state enforcement unchanged.

## Screenshots

| Viewport | NEAR v91 reference | ChatGun before | ChatGun Phase 1 |
| --- | --- | --- | --- |
| 390 px | [Reference](screenshots/near/home-mobile.png) | [Before](screenshots/chatgun/home-mobile.png) | [After](screenshots/chatgun-phase1-after/home-mobile.png) |
| 768 px | [Reference](screenshots/near/home-tablet.png) | [Before](screenshots/chatgun/home-tablet.png) | [After](screenshots/chatgun-phase1-after/home-tablet.png) |
| 1440 px | [Reference](screenshots/near/home-desktop.png) | [Before](screenshots/chatgun/home-desktop.png) | [After](screenshots/chatgun-phase1-after/home-desktop.png) |

The synthetic after-captures use portrait crops derived from NEAR v91's canonical `demo-portraits.png`. They are browser-only fixtures and are not served as member data or written to D1/R2.

## Intentional Phase 1 deviations

- ChatGun shows five navigation destinations because Game is prohibited and removed. Geometry and active-state treatment follow NEAR.
- ChatGun retains a compact, always-reachable location publication control. Removing it would weaken the current privacy UX.
- Refresh and account controls remain available. They use the restored component language but preserve existing access to session/settings behavior.
- Card count and copy depend on authenticated staging data; the deterministic screenshot uses two synthetic profiles while the layout supports NEAR's three-column desktop density.
- Signup, Acceptance, onboarding, full member profile, friends, chat, gallery, reviews, notifications, settings, deletion, and Admin are intentionally deferred to Phases 2–4.

## Validation

- Screenshot dimensions: 390, 768, and 1440 CSS pixels verified.
- Unit/integration/security suite: 86 passed, 0 failed.
- Local Playwright social regression: 17 passed, 0 failed, 1 expected desktop skip for a mobile-only assertion.
- The combined local auth/social run additionally produced four environment-only failures because local Wrangler has no Turnstile site key. These are not UI regressions; the same authentication checks must be rerun against the configured isolated Preview.
- Root route: `200`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`.
- `/welcome`: `200` and contains the previous marketing content.

## Owner review questions

1. Approve the desktop toolbar density and five-item fixed navigation.
2. Approve the compact location privacy row retained above discovery.
3. Approve the portrait card proportions and overlay information hierarchy at all three widths.
4. If approved, authorize proceeding to Phase 2 visual restoration only.
