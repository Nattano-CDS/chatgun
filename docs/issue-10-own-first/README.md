# Issue #10 — consolidated owner review package

Requirement: [owner comment 6231305643](https://github.com/Nattano-CDS/chatgun/issues/10#issuecomment-6231305643) and the attached final restoration/deployment request.

Verified Production runtime: `12e55fde423832152d7317c3e85bfd42f53eaf01`. Canonical NEAR: `98bb83e44bf88eddb9822d7875f18cd4fe833ee2`. Previous Production: `0a4bd1d25c730d131615960e892c77b257b16947`.

## Own profile first

The current session's `state.profile` is pinned ahead of other members and ads, only if its user ID matches the current session user. No globally configured owner/Admin identity is used. Anonymous visitors use their browser-only `demo-me` profile, labelled “โปรไฟล์ของคุณ · ตัวอย่าง” and “คุณ”. The portrait uses the current selected photo or the original NEAR fallback. There is no self-distance, verification claim, rating or self-social action. The arrow/name/overlay open the own-profile route.

Other-member filters, counts and pagination exclude the shortcut. Each page retains up to 16 other members: 17 cards on page 1, five on page 2, including the pinned shortcut on both. All 20 other fictional profiles remain available. Ads follow the original two-row/end placement using the displayed grid. With no matching members the self shortcut remains, beside the genuine empty-results state. The count's title and accessible label identify it as other-member count.

Profile edits, primary-photo selection and selected-photo deletion refresh the shortcut. Local demo changes persist only in that browser. This convenience never changes discovery visibility, location, blocking or server authorization. A stale API self entry is removed rather than displayed twice. A hidden authenticated profile remains visible only to its own viewer in the mocked authorization regression.

## Source restoration and visual evidence

This builds on the existing structural port of `near.tsx`/`discovery-grid.tsx`, `profile-view.tsx`, `portrait.tsx`, `people-actions.tsx` and `upload-photos.tsx`, not a generic replacement UI. Full-screen routes, photo crop/shade, source cards, three-column galleries, post layout, owner management, private comments and back/history behavior remain in use.

The remaining confirmed shared-layout defects were corrected from actual source measurements: the missing 1px header separator and incorrect Discovery heading margins. Cards previously appeared 2px high on mobile and 4px high on tablet/desktop; Friends and own edit were 1px high. These offsets are now zero in the recorded comparisons. Gallery's missing rating star and the eligible card's rating icon were also restored from the canonical component, without adding eligibility or allowing self-rating.

The matched liked-photo/comment state also restores NEAR's inline comment confirmation and error feedback instead of extra post-action toasts. Pending mutations disable both post actions without destroying their icons, preserve unsent comment drafts during likes, and do not reopen a route after the viewer exits. A focused failed-photo test found an inherited absolute `::before` fallback spanning the desktop post controls; the scoped canonical adapter now suppresses that obsolete pseudo-element and hides the failed image, retaining one bounded accessible fallback. Normal clicks pass; no force-click workaround is used.

Private comments display newest first, as in canonical NEAR. The renderer sorts a copied array, retaining server-side authorization and the original API/IndexedDB records without mutation. The matched source/Production comment screenshot and explicit browser assertion verify the new comment appears first, not merely somewhere in the list.

Actual NEAR runs from an isolated archive of the canonical commit. Its original checkout remains unchanged. Public fictional fixtures are adapted into disposable browser IndexedDB contexts for matched content; no original NEAR service or staging data is written. Viewports are 390×844, 768×1024 and 1440×1100.

[Illustrated side-by-side comparison](comparison.html) includes 36 state/viewport comparisons, including the liked photo with a successful private friend comment, original/current full frames, component crops, overlays and diagnostic pixel differences. `geometry.json` contains 30 measurements with zero width, height or vertical-position discrepancy. This is not a claim of pixel identity: branding, Game removal, fiction/privacy notices and the pinned self shortcut are intentional differences. The canonical application itself does not have the new self shortcut; the separate other-member-card comparison retains identical portrait content. The extra shortcut necessarily changes subsequent grid positions and page height.

`near/` records actual canonical source, `before/` actual previous Production (the pinned immutable `94825247.chatgun.pages.dev` deployment, independently verified as `0a4bd1d`), `after/` the stable authorized Preview, and `production/` the final deployed domain. The immutable previous deployment is used because the custom domain has advanced to the new release. Capture manifests identify served commits and failures. Protected account/Admin screenshots are explicitly mocked fixtures, not proof of real Admin access.

## Tests and release status

| Final verification | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Unit/integration/security | 101 | 0 | 0 |
| Full stable Preview browser suite | 67 | 0 | 35 |
| Actual Production own/member journey, three viewport sizes | 6 | 0 | 0 |
| Additional actual Production media/control journeys | 3 | 0 | 0 |

The 35 browser skips comprise 16 live protected-session/D1/R2 scenarios, 18 duplicate explicit-viewport cases and one desktop-inapplicable mobile-only case. Protected-session tests are deliberately not activated because this task prohibits staging dataset mutations. No synthetic session bundle is generated or consumed. Authenticated self-card identity/hidden-profile/deduplication tests use explicit mocked API fixtures, not an invented real staging login. Production browser journeys have no API interception and record zero server writes.

`unit.log`, `playwright-preview-final.log`, `playwright-production.log` and `production-controls/results.json` are the final evidence. Selected-photo deletion/recovery is included in the full suite and Production own-card checks. The separate earlier `playwright-preview-photo-delete.log` is historical, not an additional final-candidate count. `production-smoke.json` verifies closed live gates, anonymous/private-route denial, Game exclusion and unpublished-legal-page substitution over actual HTTPS. `deployed-assets.json` verifies SHA-256 equality of all four changed public assets against the deployed Git commit, not merely a release stamp.

An initial full local run had 59 passes, six failures and 35 skips: the six were the two-project copies of three authentication/configuration tests whose local environment lacks the authorized Preview configuration. The stable-host run passed those tests. The local log is retained, not relabelled as passing or silently discarded. An initial self-test selector matched two clear-filter buttons; it was scoped to the actual results empty state and rerun successfully.

An interrupted Preview run retained in `playwright-preview-network-interruption.log` had 63 passes, four failures and 35 skips. The four were navigation failures (`ERR_NETWORK_IO_SUSPENDED`, `ERR_NETWORK_CHANGED`, disconnected/timeout), not application assertions. They are not counted as passing. The frozen final candidate is rerun separately. The focused Gallery failure test initially reproduced the real desktop fallback interception defect (one failed/one passed); `inline-negative-initial-failure.log` retains it and the corrected focused checks pass desktop and mobile, including draft, icon, busy and exit behavior.

Interim gated Production deployment `92bec86a-47af-4458-a103-507231d1dc59` served `43d0d60cefd850f98ec91bea2019e00e357be15f` and passed six actual Production journeys. Subsequent `665497f9-dea6-4362-ac20-338cbf4b1e42` (`292164a`) restored the Gallery score star and passed its complete release gates and Production checks. The expanded matched-comment/error audit added inline feedback, draft/busy/exit protections and the failed-image correction in `69f0741` (deployment `8087749a-d052-4867-a1dd-f64160470f15`), again fully tested. Final `12e55fd` also aligns newest-first comments and repeats the complete gates. These were intermediate deployments, not silently represented as a single deployment. An auxiliary Production script initially expected the obsolete 16-card total; its recorded failure was corrected to the required 17 and all three viewport checks passed. Interim logs/metadata remain in `candidate-43d0/`, `candidate-292164a/` and `candidate-69f0741/`; development-only images are recoverably archived at `/tmp/chatgun-own-first-development-BidLHr`, `/tmp/chatgun-own-first-292-evidence-BL3v4e` and `/tmp/chatgun-own-first-69-evidence-T5nPVm`, not confused with final evidence. No staging records were removed.

Covered journeys include own/member card → full profile → gallery → post → back/history; Friends → Profile/Chat; local editing/primary selection/reload; all 20 other members across pagination; filter-empty shortcut; authenticated-user deduplication; keyboard/focus; long Thai text; failed portraits; gallery load failure/retry; local upload/delete/no quota refund; messages, reviews, reports, offline recovery and privacy protections. Real provider callbacks are not rerun or claimed: Production OAuth remains intentionally disabled.

## Infrastructure, data and deployment safeguards

Verified ChatGun account: `23017b53386fb67fc62a52cdd017454c`. Production D1 is `chatgun-auth` (`9738a051-d914-42d0-8e7b-8098ef2b959d`); Preview D1 is `chatgun-auth-staging` (`5bbfd55d-eb22-4324-8a7d-57bef14110ea`). Preview R2 is `chatgun-media-staging`; Production R2 remains unbound. The migration listing reports no pending Production migrations. Its MEDIA-not-in-production warning is intentional, not an instruction to enable media.

No D1 migrations or user-data writes, R2 writes/copies, provider configuration changes, seed/reset/cleanup operations, or feature-flag changes are performed. The protected staging batch `chatgun-owner-review-v1` is not touched. The public manifest is byte-identical to the previous release: 20 other profiles, 10 friendships, five requests, ten conversations/120 messages, galleries, 15 reviews and notifications. Demo mutations occur only in disposable browser contexts.

`package-check.json` verifies the actual runtime SHA, unchanged backend/migrations/infrastructure, identical public fixture bytes, private-path exclusions and canary-notice substitution for unapproved legal drafts. Deployment uses only the explicit public build directory, never the repository root. Production stays a fictional canary: OAuth, registration, live social/media/moderation, identity verification, OTP and Sensitive Content gates remain closed. Game remains excluded.

Rollback: return Pages to deployment `94825247-c404-4eef-98cc-7fea8b378025` (SHA `0a4bd1d25c730d131615960e892c77b257b16947`). This UI-only release requires no database rollback. No rollback is executed unless verification fails.

## Remaining launch decisions

This work does not confer legal approval or real-user Beta readiness. Outstanding gates include approved legal policies, adult-assurance decisions, location-inference risk acceptance, media scanning/moderation operations, appeals/emergency procedures and a confirmed backup operator. Owner coverage is daily 19:00–22:00 Asia/Bangkok, not 24/7 or a guaranteed response SLA. No new real-user invitations or Admin grants are made.

## Final deployment verification

- Production: [https://chatgun.social](https://chatgun.social).
- Stable authorized Preview: [https://codex-chatgun-release-candid.chatgun.pages.dev](https://codex-chatgun-release-candid.chatgun.pages.dev).
- Successful canonical Production deployment: `f8206788-ecba-4999-a95f-bfcd3c47a69f`.
- Actual served runtime SHA: `12e55fde423832152d7317c3e85bfd42f53eaf01`, independently verified by canonical deployment metadata, custom-domain `release.json`, public asset hashes and pinned screenshot captures.
- Active HTTPS custom domain; zero aggregate Production foreign-key violations; no pending migrations; isolated Preview D1/R2 and all closed live gates reconfirmed after deployment.
- Production captures completed without failures at all three requested sizes. The final 36 comparisons use actual Production, not a local surrogate.

Assessment: **GO for this guarded fictional frontend release; NO-GO for real-user/public Beta activation.** No critical release-security or database blocker was found. Legal/operational decisions and the intentionally unrun live authenticated scenarios above are not represented as resolved.

[Draft PR #12](https://github.com/Nattano-CDS/chatgun/pull/12) carries the current component correction; the historical PR #8 is already merged. No PR is merged during this work. GitHub main remains `1873fd3c9aae5a0efc26fef47b98753d8fa31308`; this owner-authorized direct Pages release does not change GitHub main. A subsequent main deployment could replace the unmerged frontend, so retain the release SHA/rollback evidence when planning a later approved merge. Later evidence-only commits do not alter the deployed runtime assets.
