# Issue #10 — owner-rejected components: structural correction

Owner requirement: [comment 6230230738](https://github.com/Nattano-CDS/chatgun/issues/10#issuecomment-6230230738). The rejected Production baseline is `1873fd3c9aae5a0efc26fef47b98753d8fa31308`. This report supersedes the previous blanket visual-completion assessment, not the historical evidence.

## Implementation

- `app/near-components.js` ports the component hierarchy from canonical NEAR `98bb83e44bf88eddb9822d7875f18cd4fe833ee2`: `near.tsx`'s person/profile form, `profile-view.tsx`, and `upload-photos.tsx`.
- Cards now contain the original overlay button, portrait, shade, distance pill, name button, biography/rating and eligibility-gated rate action. Friend/request actions use the original profile/request flow rather than extra portrait shortcuts.
- Member/own Profile and Gallery are full-screen routed compositions, not native-dialog approximations. Gallery uses real tile wrappers, source summary/facts/actions, owner uploads/deletion and post/image/comment/navigation structure. One existing navigation instance is retained; no cloned footer.
- Own profile edit and dedicated image management restore source field/action order, responsive avatar, cover/editor/kind selection/preview/save/cancel/manage grid. Verification remains disabled when its existing server gate is disabled.
- `app/near-components.css` preserves source rule order, breakpoints and class names. The reproducible porter removes obsolete component adapter selectors from the three previous stylesheets, including high-specificity avatar and absolute gallery-action conflicts. Chat and other unrelated canonical styles remain.
- Icons are rendered from the canonical source's Lucide components. Branding, fictional-distance labels, small fiction notices and required quota/moderation/privacy controls are explicit adapters, not a claim of literal pixel identity.
- Both upload surfaces delegate to the same existing CSRF/idempotency/optimization/quota/API handler. No new upload endpoint, quota exemption, automatic moderation approval or public/private-media URL is introduced.

## Actual rendering and fixtures

Canonical NEAR runs from an isolated archive, not a recreated mockup; the original checkout remains untouched. The public, project-owned fictional portrait/text dataset is adapted into disposable browser IndexedDB contexts on both applications. NEAR's independently initialized profile-form defaults are normalized through browser inputs to the same fictional text, without saving to an original service.

Viewports: 390×844, 768×1024, 1440×1100. `before/` records actual rejected Production, `near/` the actual source runtime, `after/` the stable authorized Preview, and `production/` the subsequently verified public release. `capture.json` pins served commit and records failed captures. `measurements.json` records actual DOM/computed dimensions and hierarchy. Browser-only empty-state variations never delete staging records.

[Illustrated comparison](comparison.html) contains full states, component crops, 50% overlays and red pixel diagnostics. Diagnostics are not an acceptance score. Component width/height measurements are checked separately; the shared discovery banner positions the card grid 2–4px above the reference, and the profile edit form may have subpixel scroll-position differences. These are disclosed rather than hidden by screenshot cropping. Final owner visual acceptance remains outstanding; Issue #10 must stay open until that acceptance.

## Functional/security scope

The full journey covers Discovery → Profile → Gallery → Post → Like/Comment/Next/Back → Profile → Discovery, Friends → Profile, own profile/gallery/selection/management, deep-link/reload, interrupted navigation, keyboard/focus, long Thai names, failed portraits, landscape images, empty galleries, upload/delete/no quota refund and local persistence. Private comments are absent for strangers and available only through owner/accepted-friend data permissions. Fictional changes are browser-local, not represented as server writes.

Backend authentication, acceptance/onboarding, sessions, CSRF, RBAC, rate limits, D1 migrations, R2 authorization, moderation and cleanup implementation are unchanged. Public registration, real social/media/authentication capabilities, Sensitive Content and Game remain disabled/excluded. Existing public 20 profiles/120 messages and protected staging batch `chatgun-owner-review-v1` are not reset, reseeded or cleaned up. No staging D1/R2 mutations occur.

## Release gates and rollback

Only the ChatGun account `23017b53386fb67fc62a52cdd017454c` is in scope. `infrastructure-check.json` records binding isolation, closed Production gates, active custom domain and aggregate foreign-key integrity without personal data. Production D1 migration listing reports no pending migrations; no migration is applied. Production MEDIA remains unbound; Preview uses `chatgun-media-staging` and its isolated D1.

Build/deploy **only `dist`**, never the repository root. Production package must use `CHATGUN_CANARY_BUILD=true` (or the configured main build) so unapproved legal drafts are replaced by the factual canary notice. Test/session/backups/docs/scripts stay outside the public package. Verify the public fictional manifest remains unchanged, then run the full stable-Preview regression/security suite and source-render comparison before releasing.

Rollback target before this correction: Cloudflare deployment `2178dada-7508-4f4f-9c7c-1001150cef48`, SHA `1873fd3c9aae5a0efc26fef47b98753d8fa31308`. Roll back the immutable public application deployment only; do not restore/delete/migrate databases or storage. Verify custom-domain `release.json`, shutdown gates and smoke tests again after any rollback.

## Validation status

Pre-release local unit/integration/security suite: **100 passed, 0 failed, 0 skipped**. Stable Preview and final Production evidence will be recorded in the release-result section after execution. Interactive OAuth callbacks, live-user D1/R2 mutation suites and real-user Beta operations are not claimed as newly tested by this UI-only release. Real-user launch remains separately gated by provider/legal/age/moderation/scanning operational decisions; a public-fiction UI release is not approval to open live services.
