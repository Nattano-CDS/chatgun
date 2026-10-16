# Issue #10 — consolidated parity remediation

Status: release-candidate validation passed for the fictional demonstration; not a claim of pixel identity or real-user launch readiness. Actual Production publication is verified separately.

## Reference and evidence

Canonical NEAR v91: `98bb83e44bf88eddb9822d7875f18cd4fe833ee2`. The original read-only checkout was archived into an isolated temporary directory and its actual React application rendered using its declared dependencies. No original NEAR files were edited. `scripts/extract-near-v91.mjs` extracts ordered non-game component rules from that running application's CSSOM; the generated stylesheet is scoped to ChatGun.

`near/` contains rendered canonical screenshots using the same approved **public** fictional dataset through a browser-only IndexedDB adapter. One approved public portrait also illustrates the recent-chat-image library in that isolated browser. This is not a reconstruction of NEAR markup and not a staging database copy. `before/` contains actual pre-remediation Production screenshots at main `5d8fb15a37031c2d150ab39fa60fd473e13e7418`. `after/` contains corrected browser screenshots. `fixtures/` contains explicitly mocked, protected acceptance/onboarding/account/Admin states; these are NOT authenticated Production evidence.

Viewports: 390×844, 768×1024, 1440×1100. [Side-by-side comparison and pixel overlays](comparison.html). Raw difference percentages include branding, removed Game, timestamps and required safety controls; they are diagnostics, not acceptance scores.

## Confirmed defects addressed together

| Surface | Confirmed mismatch | Consolidated correction |
| --- | --- | --- |
| Shared shell | Oversized floating navigation, excess main padding, divergent canvas/type metrics | Full-width original 72px footer, original max-width and responsive padding, Arial/Noto Sans Thai metrics |
| Discovery | Large demo/location panels; wrong desktop/tablet columns; different portrait shade/crop | Compact original toolbar/disclosure, no geolocation prompt in demo, original 4/2/2 columns, 390/390/290px cards, original crop/gradient |
| Discovery interaction | Missing original pagination and advertisement placeholders | 16 members/page with next/previous, all 20 retained; inert ad slots without a vendor or tracking |
| Search/filters | Inline flyout rather than original modal; unhelpful search empty state | Centred native dialog, focus containment/Escape, clear-filters recovery |
| Friends/requests | Horizontal compact cards instead of original portraits | Original portrait grids, separate request decision strip, counts, non-overlapping headings |
| Chat | Two-pane dashboard instead of inbox/thread; composer and header composition | Inbox-or-thread layout, circular avatars, full-height conversation, original safety band and composer above footer |
| Chat images | Missing inline recent-image picker and explicit forwarding destination | Source carousel and friend-choice library restored; reuse/forwarding does not consume another upload slot |
| Member profile | Mixed primary/safety actions, absent persistent navigation | Separate action hierarchy, original image/shade/facts, persistent non-game navigation; safe bottom clearance |
| Gallery/post | Missing owner summary and original two-column post hierarchy | Summary/facts/interests, three-column tiles, owner header, image/social columns, like/comment/navigation controls |
| Own images | `/app/photos` did not restore dedicated image management in demo | Separate profile-image management route, working settings/back navigation; quotas/quarantine preserved |
| Auth/acceptance/account | Canvas/type mismatch and absent persistent navigation | Original auth canvas/type metrics and five-destination footer; existing secure workflows retained |
| Recovery/accessibility | Unbounded broken portraits and inconsistent reduced-motion handling | Labelled bounded image fallback, keyboard activation, Escape, reduced-motion override |
| Routed actions | Closing a profile through reporting/blocking/chat could reopen it on reload | Profile route is cleared on every modal close; friendship/blocking persistence covered by browser regressions |

## Cascade audit

The actual product entry loads `app/social.css`, generated `app/near-v91.css`, and the scoped adapters in `app/restoration.css`, in that order. Original component selectors use an ID-scoped boundary so legacy horizontal-card/sidebar declarations cannot silently win. Auth uses `auth-shell.css` plus each page's functional styles. `style.css` (legacy Kanit/marketing gradients) is not loaded by the product entry, acceptance, onboarding, profile or Admin. It remains confined to the explicitly separate `/welcome` marketing surface. The canonical non-game canvas is plain `#f7f7fb`; no reported dot pattern was reproduced in either rendered product entry. Auth intentionally uses the original elliptical lavender canvas.

The historical overlapping Friends headings were already corrected in the Production baseline. This remediation preserves and re-tests that correction; it does not misattribute it as a newly discovered defect. Actual remaining baseline defects were horizontal cards, missing canonical image interactions and divergent shared composition. Direct screenshot review also caught missing Gallery-context action controls, summary counts and background/type metrics; those are included in the consolidated correction.

## Intentional deviations and non-equivalent surfaces

- ChatGun name/logo retained; Game omitted everywhere in ChatGun, including the footer. Original screenshots still show Game as reference evidence.
- Google/Facebook/LINE and Turnstile replace NEAR's ChatGPT authentication. Production remains fictional-demo-only, with real OAuth, public registration, social APIs, media and Admin gated off.
- Original NEAR has no equivalent post-OAuth acceptance state machine, versioned legal acceptance, secure account deletion, media quarantine/appeals or role-audited moderation dashboard. Those are tested as labelled browser fixtures and backend regressions, not falsely marked pixel-equivalent.
- Synthetic distances remain labelled as fictional, and no actual coordinates or device geolocation are requested by demo mode.
- Safety/report/block/delete/quota controls remain available where authorized; private comments remain permission checked. Source's smaller controls are not copied where this would undermine minimum touch targets or conceal safety actions.
- Existing authorized ChatGun quick actions remain available on portrait cards. Their visible shortcuts and clearer request wording are retained functionality, not a claim that every original NEAR card has an identical action set.
- Production legal routes remain a factual demo notice, not publication of unapproved legal drafts. `/welcome` retains the separate marketing page.
- Fictional review/message text and timestamps differ from original's built-in eight-person sample; the comparison adapter supplies the approved 20-person public fixture instead.

## Release guardrails

Confirmed ChatGun account: `23017b53386fb67fc62a52cdd017454c`. Production D1 migration listing is read-only and reports no pending migrations. No migration or data mutation is required by this UI release. Backend Functions, Wrangler configuration, migrations, public fictional assets and staging fixtures are unchanged from main. No staging seed, cleanup, role assignment or session rotation is run.

Build uses the explicit `dist` public-asset boundary. Credentials, tests, documentation, private sessions and backups must not be deployed. Production real-user gates and unbound Production R2 must remain unchanged. Rollback targets the pre-remediation Production SHA above; no D1 restore is necessary for a frontend-only rollback.

## Validation record

- Unit/integration/security: 95 passed, 0 failed (initial final-code run).
- New measured-layout/keyboard/pagination/image-failure suite: 4 passed at all three explicit widths.
- Initial local full browser run: 33 passed, 8 failed, 23 skipped. Six failures required configured Preview auth settings; two exposed the duplicate close-selector regression, subsequently fixed. This failed run is retained honestly; it is not release approval.
- Full configured Preview rerun, final screenshot review, release guardrails and actual Production deployment verification: pending below.
- A temporary immutable Preview hostname produced a real Turnstile hostname-denial message in one mobile check. This is not treated as a CAPTCHA success. The final configured suite uses the existing authorized stable alias; its mobile widget-initialization check passed separately. No allowlist, key, secret, provider application or server verification was changed.

## Remaining non-visual launch constraints

No public registration, real-user invitations, Sensitive Content or live Production media/Admin enablement is authorized by this remediation. Legal approval, provider publishing, verified Production Admin bootstrap, moderation backup/coverage limitations and content-safety operations remain separate real-user Beta blockers. This report must not be used as approval to remove those gates.

## Final release-candidate validation

Validated runtime commit: `a1e5463aa9681cb1d01acba207e0f5433457f475` on the [authorized stable Preview](https://codex-chatgun-release-candid.chatgun.pages.dev). Subsequent evidence-only commits must preserve this runtime tree.

| Check | Actual result |
| --- | --- |
| Unit, local database integration and security regressions | **96 passed; 0 failed; 0 skipped**, including every deployable JavaScript file parsing |
| Full configured Playwright desktop/mobile suite | **48 passed; 0 failed; 26 skipped** (74 total) |
| Three explicit reference widths | 390×844, 768×1024, 1440×1100; geometry, overflow, fixed navigation and composer clearance passed |
| Browser-only network workflows | Profile edit, request/accept/reject, blocking/unblocking, chat persistence, image upload/reuse/forwarding, gallery likes/comments, reports, quotas and recovery passed |
| Protected workflows | Acceptance/onboarding/account/deletion/Admin displayed in labelled browser API fixtures; authorization and deletion server regressions in local integration tests |
| Production database | No pending migrations; foreign-key violations **0**; integrity query wrote **0** rows and did not change the database |
| Isolation | Different D1 IDs; staging R2 preserved; Production R2 unbound; all real-user Production gates unchanged |
| Rollback | Previous successful Production deployment and SHA verified; frontend rollback requires no database restore |

The 26 browser skips comprise 16 live-session/D1/R2 suites deliberately not enabled, 9 duplicate explicit-width tests in the mobile project, and 1 desktop-inapplicable mobile-only test. No skipped scenario is called a PASS. Real Google/Facebook/LINE callbacks were **not repeated**: provider configurations and the authentication backend are unchanged. Widget initialization on the authorized hostname is not proof of successful CAPTCHA verification or an OAuth callback.

Decision: **GO for the corrected fictional demonstration release**, subject to actual Production smoke/SHA verification. **NO-GO for real-user Beta or enabling live Production features**. Native iOS keyboard/assistive-technology behavior, a new real OAuth callback run, live media/deletion mutations and human moderation operations are not newly certified by these browser captures.

Production publication results and the exact served SHA are recorded in the release comment on PR #11 and the final owner-review package; they must not be inferred from a successful Preview build alone.
