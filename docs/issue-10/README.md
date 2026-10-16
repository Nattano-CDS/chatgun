# Issue #10 — consolidated parity remediation

Status: validation in progress; not a claim of pixel identity or real-user launch readiness.

## Reference and evidence

Canonical NEAR v91: `98bb83e44bf88eddb9822d7875f18cd4fe833ee2`. The original read-only checkout was archived into an isolated temporary directory and its actual React application rendered using its declared dependencies. No original NEAR files were edited. `scripts/extract-near-v91.mjs` extracts ordered non-game component rules from that running application's CSSOM; the generated stylesheet is scoped to ChatGun.

`near/` contains rendered canonical screenshots using the same approved **public** fictional dataset through a browser-only IndexedDB adapter. This is not a reconstruction of NEAR markup and not a staging database copy. `before/` contains actual pre-remediation Production screenshots at main `5d8fb15a37031c2d150ab39fa60fd473e13e7418`. `after/` contains corrected browser screenshots. `fixtures/` contains explicitly mocked, protected acceptance/onboarding/account/Admin states; these are NOT authenticated Production evidence.

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
| Member profile | Mixed primary/safety actions, absent persistent navigation | Separate action hierarchy, original image/shade/facts, persistent non-game navigation; safe bottom clearance |
| Gallery/post | Missing owner summary and original two-column post hierarchy | Summary/facts/interests, three-column tiles, owner header, image/social columns, like/comment/navigation controls |
| Auth/acceptance/account | Canvas/type mismatch and absent persistent navigation | Original auth canvas/type metrics and five-destination footer; existing secure workflows retained |
| Recovery/accessibility | Unbounded broken portraits and inconsistent reduced-motion handling | Labelled bounded image fallback, keyboard activation, Escape, reduced-motion override |

## Intentional deviations and non-equivalent surfaces

- ChatGun name/logo retained; Game omitted everywhere in ChatGun, including the footer. Original screenshots still show Game as reference evidence.
- Google/Facebook/LINE and Turnstile replace NEAR's ChatGPT authentication. Production remains fictional-demo-only, with real OAuth, public registration, social APIs, media and Admin gated off.
- Original NEAR has no equivalent post-OAuth acceptance state machine, versioned legal acceptance, secure account deletion, media quarantine/appeals or role-audited moderation dashboard. Those are tested as labelled browser fixtures and backend regressions, not falsely marked pixel-equivalent.
- Synthetic distances remain labelled as fictional, and no actual coordinates or device geolocation are requested by demo mode.
- Safety/report/block/delete/quota controls remain available where authorized; private comments remain permission checked. Source's smaller controls are not copied where this would undermine minimum touch targets or conceal safety actions.
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

## Remaining non-visual launch constraints

No public registration, real-user invitations, Sensitive Content or live Production media/Admin enablement is authorized by this remediation. Legal approval, provider publishing, verified Production Admin bootstrap, moderation backup/coverage limitations and content-safety operations remain separate real-user Beta blockers. This report must not be used as approval to remove those gates.
