# NEAR v91 visual restoration — Phase 2 owner review

Status: owner-review checkpoint. Phase 3 has not started.

Working isolated Preview: <https://codex-chatgun-release-candid.chatgun.pages.dev>

Validated immutable deployment: <https://eb8f98d4.chatgun.pages.dev>

## Restored in this phase

- Login/signup now uses NEAR v91's compact centered authentication shell, Noto Sans Thai typography, violet/lime palette, spacing, border, and surface treatment.
- Google, Facebook, LINE, Turnstile, retry messaging, and post-OAuth routing retain their original DOM and JavaScript hooks.
- Age & Terms Acceptance uses the same visual system while preserving two initially unchecked confirmations, legal links, decline, CSRF, and versioned server evidence.
- Member Onboarding uses the canonical compact registration composition while preserving the server-side acceptance/onboarding state machine and existing fields.
- Member Profile is restored as an image-first, full-viewport portrait experience with dark image shading, profile hierarchy, interest chips, lime primary action, private gallery access, and the existing relationship/report/block/rating authorization paths.
- The `chatgun-owner-review-v1` D1/R2 fixture batch was neither seeded, reset, edited, nor deleted.

## Screenshot comparison

| Surface | Viewport | NEAR v91 reference | ChatGun before | ChatGun Phase 2 |
| --- | ---: | --- | --- | --- |
| Login | 390 | [Reference](screenshots/near/login-mobile.png) | [Before](screenshots/chatgun/signup-mobile.png) | [After](screenshots/chatgun-phase2-after/signup-mobile.png) |
| Login | 768 | [Reference](screenshots/near/login-tablet.png) | [Before](screenshots/chatgun/signup-tablet.png) | [After](screenshots/chatgun-phase2-after/signup-tablet.png) |
| Login | 1440 | [Reference](screenshots/near/login-desktop.png) | [Before](screenshots/chatgun/signup-desktop.png) | [After](screenshots/chatgun-phase2-after/signup-desktop.png) |
| Acceptance | 390 / 768 / 1440 | ChatGun-only state | [Before](screenshots/chatgun/acceptance-mobile.png) | [Mobile](screenshots/chatgun-phase2-after/acceptance-mobile.png) · [Tablet](screenshots/chatgun-phase2-after/acceptance-tablet.png) · [Desktop](screenshots/chatgun-phase2-after/acceptance-desktop.png) |
| Onboarding | 390 / 768 / 1440 | Adapted from NEAR register | [Before](screenshots/chatgun/onboarding-mobile.png) | [Mobile](screenshots/chatgun-phase2-after/onboarding-mobile.png) · [Tablet](screenshots/chatgun-phase2-after/onboarding-tablet.png) · [Desktop](screenshots/chatgun-phase2-after/onboarding-desktop.png) |
| Member profile | 390 / 768 / 1440 | NEAR image-first profile | [Before](screenshots/chatgun/member-profile-mobile.png) | [Mobile](screenshots/chatgun-phase2-after/member-profile-mobile.png) · [Tablet](screenshots/chatgun-phase2-after/member-profile-tablet.png) · [Desktop](screenshots/chatgun-phase2-after/member-profile-desktop.png) |

## Intentional differences

- ChatGun has three OAuth providers and Turnstile, so its authentication panel is taller than NEAR's email/password panel.
- Acceptance is a ChatGun-only security state. Its composition derives from the NEAR registration shell but its legal text and two explicit confirmations are unchanged.
- The full profile keeps ChatGun's friend-gated gallery, report, block, and proximity-rating controls. These are functional security controls, not decorative NEAR elements.
- Game remains removed. Public registration and Sensitive Content remain disabled.

## Validation evidence

- Unit/integration/security: 91 passed, 0 failed.
- Preview Playwright authentication/social/moderation regression: 33 passed, 0 failed, 1 expected desktop skip for a mobile-only assertion.
- Synthetic owner-review UI validation: 2 passed (desktop and mobile), confirming 19 discovery profiles, 10 friends, 5 pending requests, 10 conversations with 12 messages each, gallery, reviews, and notifications render from the preserved batch. Four moderation-only assertions were blocked because the stored synthetic Admin session no longer satisfies recent-authentication; the standard RBAC/moderation regression still passed on both viewports.
- Screenshot widths: 390, 768, and 1440 CSS pixels.
- Visual captures use deterministic browser fixtures. The deployed Preview is separately checked with the preserved staging dataset.
- Cloudflare account verified before Preview deployment: `23017b53386fb67fc62a52cdd017454c`.
- Preview packaging excludes `test-results/` and `playwright-report/`. Three superseded Phase 2 deployments that briefly contained ignored local test artifacts were removed; their immutable URLs now return `404`.

## Owner approval checkpoint

Please review the compact authentication density, Acceptance hierarchy, onboarding form composition, and image-first member profile at all three widths. Phase 3 should not begin until these Phase 2 surfaces are approved.
