# NEAR v91 versus ChatGun release candidate — first visual comparison

Status: **STOP checkpoint for owner review**. No major UI restoration has been implemented. This is the first complete comparison required before design changes are finalized.

## Compared revisions

- NEAR canonical revision: `98bb83e44bf88eddb9822d7875f18cd4fe833ee2`
- ChatGun release-candidate revision: `e4ad266d2efaa060785efcc94740b67259959863`
- ChatGun branch: `codex/chatgun-release-candidate` / Draft PR #8
- ChatGun capture deployment: isolated Preview `https://20ad10a1.chatgun.pages.dev`
- Viewports: 390, 768, and 1440 CSS pixels
- Capture method: Chromium, device scale factor 1, full-page screenshot; authenticated screens use deterministic browser request mocks only and do not mutate D1 or R2.

## Executive finding

Visual parity is **NO-GO**. The current public and signup experiences are independent ChatGun marketing designs rather than adaptations of NEAR v91. The authenticated social application shares several NEAR colors, but its navigation, member-card composition, typography, spacing, and content density remain materially different. The gap is structural, not a polish-only issue.

No security regression was introduced by this audit. No application code, provider settings, Cloudflare resource, D1 record, R2 object, Production environment, PiggyPrice resource, or original NEAR source was modified.

## Direct visual evidence

### Discovery / homepage

| Viewport | NEAR v91 | ChatGun RC |
| --- | --- | --- |
| 390 | [NEAR](visual-audit/screenshots/near/home-mobile.png) | [ChatGun public home](visual-audit/screenshots/chatgun/home-mobile.png) |
| 768 | [NEAR](visual-audit/screenshots/near/home-tablet.png) | [ChatGun public home](visual-audit/screenshots/chatgun/home-tablet.png) |
| 1440 | [NEAR](visual-audit/screenshots/near/home-desktop.png) | [ChatGun public home](visual-audit/screenshots/chatgun/home-desktop.png) |

NEAR opens on searchable portrait discovery. ChatGun opens on a large promotional hero, feature cards, and a marketing footer. The information architecture, content priority, vertical length, card system, and navigation are not equivalent.

### Registration / social authentication

| Viewport | NEAR v91 | ChatGun RC |
| --- | --- | --- |
| 390 | [NEAR](visual-audit/screenshots/near/register-mobile.png) | [ChatGun](visual-audit/screenshots/chatgun/signup-mobile.png) |
| 768 | [NEAR](visual-audit/screenshots/near/register-tablet.png) | [ChatGun](visual-audit/screenshots/chatgun/signup-tablet.png) |
| 1440 | [NEAR](visual-audit/screenshots/near/register-desktop.png) | [ChatGun](visual-audit/screenshots/chatgun/signup-desktop.png) |

NEAR uses one compact centered panel. ChatGun uses a split marketing/auth layout with gradient headline art. OAuth provider ordering, Turnstile, invitation/public-registration state, legal disclosure, and backend behavior must remain; only the composition and tokens should be restored.

### Authenticated social shell

| Viewport | ChatGun RC deterministic authenticated baseline |
| --- | --- |
| 390 | [Social mobile](visual-audit/screenshots/chatgun/social-mobile.png) |
| 768 | [Social tablet](visual-audit/screenshots/chatgun/social-tablet.png) |
| 1440 | [Social desktop](visual-audit/screenshots/chatgun/social-desktop.png) |

This baseline demonstrates that the app is functional enough to restyle, but is not visually equivalent: it uses a left desktop sidebar, five-item mobile navigation, separate header controls, and text/placeholder-led member cards. NEAR uses a search/filter top toolbar, fixed navigation, and image-first cards with overlay information.

Additional three-viewport ChatGun baselines cover the major authenticated states:

| State | 390 | 768 | 1440 |
| --- | --- | --- | --- |
| Member onboarding | [Mobile](visual-audit/screenshots/chatgun/onboarding-mobile.png) | [Tablet](visual-audit/screenshots/chatgun/onboarding-tablet.png) | [Desktop](visual-audit/screenshots/chatgun/onboarding-desktop.png) |
| Friends and requests | [Mobile](visual-audit/screenshots/chatgun/friends-mobile.png) | [Tablet](visual-audit/screenshots/chatgun/friends-tablet.png) | [Desktop](visual-audit/screenshots/chatgun/friends-desktop.png) |
| Member profile | [Mobile](visual-audit/screenshots/chatgun/member-profile-mobile.png) | [Tablet](visual-audit/screenshots/chatgun/member-profile-tablet.png) | [Desktop](visual-audit/screenshots/chatgun/member-profile-desktop.png) |
| Chat | [Mobile](visual-audit/screenshots/chatgun/chat-mobile.png) | [Tablet](visual-audit/screenshots/chatgun/chat-tablet.png) | [Desktop](visual-audit/screenshots/chatgun/chat-desktop.png) |
| Reviews | [Mobile](visual-audit/screenshots/chatgun/reviews-mobile.png) | [Tablet](visual-audit/screenshots/chatgun/reviews-tablet.png) | [Desktop](visual-audit/screenshots/chatgun/reviews-desktop.png) |
| Profile, gallery, notifications, blocks | [Mobile](visual-audit/screenshots/chatgun/profile-mobile.png) | [Tablet](visual-audit/screenshots/chatgun/profile-tablet.png) | [Desktop](visual-audit/screenshots/chatgun/profile-desktop.png) |

### Post-OAuth acceptance

| Viewport | ChatGun-only screen |
| --- | --- |
| 390 | [Acceptance mobile](visual-audit/screenshots/chatgun/acceptance-mobile.png) |
| 768 | [Acceptance tablet](visual-audit/screenshots/chatgun/acceptance-tablet.png) |
| 1440 | [Acceptance desktop](visual-audit/screenshots/chatgun/acceptance-desktop.png) |

Acceptance has no NEAR source equivalent. Its security content is correct in concept, but its layout should inherit the NEAR authentication panel, typography, violet control, focus, and spacing system. The two confirmations must remain unchecked and the decline/logout path must remain explicit.

## Prioritized parity defects

| Priority | Area | Current difference | Restoration target |
| --- | --- | --- | --- |
| P0 | Public entry | Marketing landing page replaces discovery-first product surface | Make the NEAR discovery composition the product entry where authorization permits; retain ChatGun logo/copy and current access gates |
| P0 | Signup/login | Split promotional layout; unrelated typography and gradient system | NEAR compact auth canvas/panel with ChatGun OAuth providers, Turnstile, legal copy, and closed-registration state preserved |
| P0 | Discovery cards | Text/placeholder-led cards and controls below content | Image-first portrait cards, gradient overlay, distance pill, metadata/actions layered as in NEAR |
| P0 | Navigation | Desktop sidebar and a separate five-item mobile model | Restore NEAR geometry and active states; omit Game without leaving an empty control |
| P1 | Typography | Kanit on public pages and Inter in social app | Canonical Noto Sans Thai/Arial stack and NEAR weight/line-height scale |
| P1 | Search/filter controls | Multi-row form treatment and separate location panel | Match NEAR compact desktop toolbar and mobile collapsed-filter behavior |
| P1 | Profile/gallery/chat | Generic panels diverge from source hierarchy | Port NEAR component composition while keeping current endpoints, authorization, quota, and moderation state |
| P1 | Responsive behavior | Components reflow, but do not preserve NEAR density or geometry | Match 390/768/1440 reference compositions and safe-area behavior |
| P2 | Acceptance/account/admin | Independent visual systems | Apply shared NEAR tokens and components without removing security evidence or operational controls |
| P2 | Motion/focus | Inconsistent transitions and focus presentation across three CSS systems | Consolidate reduced-motion and focus-visible behavior from canonical system |

## Original/current/corrected value inventory

| Token or component | NEAR v91 source value | ChatGun RC current value | Corrected value after approval | Affected areas |
| --- | --- | --- | --- | --- |
| Page canvas | `#f7f7fb` | Public `#fff`/radial blue-lilac; signup and acceptance use separate gradients; social `#f7f7fb` | `#f7f7fb` with only canonical contextual surfaces | All pages |
| Primary ink | `#21212a`, card name `#292431` | Public `#182043`; social `#21212a` | `#21212a` / `#292431` | Typography, controls, cards |
| Primary action | `#6d42e5`, hover `#5931c5` | Public gradient `#5369f6` → `#9b49ed`; social `#6d42e5`, dark `#5230bb` | `#6d42e5`, hover `#5931c5` | Buttons, links, active navigation |
| Accent | `#d0f17b` on dark/photo surfaces | Public blue/pink gradient; social lime exists but is used in a different banner composition | `#d0f17b` only for canonical contextual actions | Location and photo-card actions |
| Active surface | `#eee8ff` / `#f0eaff` | Social `#f0ebff`; public has no equivalent | `#eee8ff` / `#f0eaff` | Nav, filter chips, selected states |
| Border | `#e9e7ef` / card `#e5e1ec` | Public `#eceafa`; social `#e9e7ef`; signup has independent border values | Canonical border pair | Cards, inputs, panels |
| Body typography | Arial, Noto Sans Thai, Tahoma | Public Kanit; social Inter/system | Noto Sans Thai/Arial stack | All non-game pages |
| Brand treatment | Compact wordmark aligned to product controls | Large ChatGun marketing lockup, different sizing in each CSS system | ChatGun logo/name in canonical NEAR placement and scale | Header, auth, nav, footer |
| Product entry | Discovery grid with immediate search/filters | Marketing hero, feature grid, CTA, footer | Discovery-first composition subject to existing access gates | `/` and `/app/` |
| Discovery card | 22 px portrait card, full-bleed image, dark overlay, overlaid distance/name/actions | 20 px card, pastel placeholder header, metadata and actions below | Canonical image-first composition; current permissions and moderation status retained | Nearby, friends, member profiles |
| Desktop navigation | Compact product toolbar plus fixed centered route navigation in canonical capture | 248 px fixed left sidebar | Canonical placement and proportions; Game removed cleanly | Authenticated product |
| Mobile navigation | Fixed six-item icon navigation with safe-area handling | Fixed five-item flex navigation with separate geometry | Canonical geometry for five permitted items | Authenticated product |
| Authentication panel | ~440 px white panel, 22 px radius, single-column hierarchy | Two-column marketing/auth page and separate CSS palette | Canonical panel with three providers, Turnstile, legal and closed-registration copy | Signup/login, Acceptance |
| Main card radius | 22 px for portrait/auth; controls 10–14 px | Public feature 24 px, CTA 28 px; social cards 20 px; page-specific values | Canonical per-component radii | All pages |
| Elevation | Low-opacity violet shadow and borders | Large colorful hero glow; mixed shadow strengths | Restrained canonical shadow | Cards, dialogs, authentication |
| Chat bubble | Neutral lavender and mine `#eae0ff` / dark violet text | Similar intent but distinct thread container, typography, and spacing | Canonical bubble color, radius, rhythm; keep safety notice | Chat/image messaging |
| Gallery | Tight three-column mobile grid and full-screen lightbox | Card/panel gallery composition with different density | Canonical grid/lightbox; keep private R2, quarantine, quota, deletion | Profile gallery |
| Focus/motion | Violet focus-visible; reduced-motion disables transitions/animation | Separate page rules; social defines motion only when no preference | One shared focus and reduced-motion layer | All interactive pages |
| Admin | No original equivalent | Separate dense moderation palette/components appended to social CSS | NEAR-derived tokens/primitives only; keep operational density and severity meaning | Admin Moderation |

## Page-by-page comparison status

| Page/feature | Source evidence | ChatGun evidence | Assessment |
| --- | --- | --- | --- |
| Homepage / discovery | Direct 3-viewport capture | Public home and authenticated social captures | Major structural mismatch |
| Login / signup | Direct NEAR login/register captures and ChatGun signup captures | Direct 3-viewport capture | Major structural mismatch |
| Acceptance | No canonical page | Direct 3-viewport ChatGun capture | Must inherit auth system; preserve security behavior |
| Onboarding | Canonical profile creation components reviewed | Current onboarding route/code reviewed | Needs side-by-side implementation pass after approval |
| Friends / requests | Canonical source components reviewed | Current social source and existing E2E reviewed | Functional preservation required; visual composition differs |
| Member profile | Canonical full-profile and gallery source reviewed | Current dialog/deep-link source reviewed | Image hierarchy and actions differ |
| Chat | Canonical chat source reviewed | Current conversation/thread source and E2E reviewed | Layout, bubbles, safety notice, and navigation need token/component alignment |
| Gallery | Canonical IG-style grid/lightbox source reviewed | Current private-media source and tests reviewed | Grid/lightbox can be ported; quarantine and quotas must remain |
| Reviews / ratings | Canonical source reviewed | Current social source and tests reviewed | Visual alignment needed; proximity/authorization stays unchanged |
| Notifications | Canonical navigation/badge source reviewed | Current notification source reviewed | Badge and navigation geometry differ |
| Account/privacy/deletion | No exact canonical deletion workflow | Current pages/source reviewed | Use NEAR surfaces and typography; preserve destructive confirmations and recent auth |
| Admin moderation | No canonical admin equivalent | Current moderation source and E2E reviewed | Use common tokens only; retain dense operational hierarchy, RBAC, reasons, and audit logs |

## CSS architecture difference

ChatGun currently has three visual dialects:

1. `style.css`: Kanit, blue/violet/pink marketing gradients, large hero and feature cards.
2. `signup.css` and `acceptance.css`: separate pale-blue/lilac authentication compositions.
3. `app/social.css`: closer NEAR palette, but Inter typography and different component/navigation structures.

NEAR v91 uses one evolved `app/globals.css` system across authentication and the social product. A safe restoration should first establish shared tokens and primitives, then port page composition in small, testable slices. Copying the entire historical stylesheet would also restore obsolete layers and Game styles, so it is not recommended.

## Proposed implementation sequence after owner approval

1. Extract the non-game NEAR tokens, local Noto Sans Thai fonts, focus rules, reduced-motion rules, and reusable surface/button/input primitives into a ChatGun shared layer.
2. Restore signup/login and Acceptance composition without changing OAuth, Turnstile, invitation/public-registration, account state, CSRF, or legal behavior.
3. Restore the social shell and navigation, explicitly removing the Game item.
4. Restore discovery search/filters and portrait cards while preserving location privacy, relationship authorization, quarantine, rate limits, and daily upload quotas.
5. Restore profile, gallery/lightbox, friends, chat, reviews, and notifications one vertical slice at a time.
6. Apply the shared visual system to account/privacy/deletion and Admin, where no exact source page exists.
7. Run screenshot diffs at all three viewports plus complete unit, integration, security, and Playwright regression tests.

## Required owner decision at this checkpoint

Approve or revise the following interpretation before major changes begin:

- ChatGun should retain its logo and product name but adopt NEAR v91's discovery-first composition, non-game component geometry, violet/lime palette, Noto Sans Thai typography, and responsive navigation.
- The current promotional homepage should no longer define the signed-in product UI; whether it remains as a separate public marketing route is an owner product decision.
- Game remains excluded.
- All current authentication, acceptance, privacy, moderation, quota, invitation/public-registration, and feature-flag behavior remains authoritative even where NEAR had no equivalent.

Until this interpretation is approved, visual restoration remains paused.

## Baseline validation evidence

- Screenshot manifest: 39 PNGs; every `*-mobile.png`, `*-tablet.png`, and `*-desktop.png` was programmatically verified at 390, 768, and 1440 pixels respectively.
- Unit/integration/security suite: 84 passed, 0 failed, 0 skipped.
- Playwright auth/social regression on isolated Preview: 27 passed, 0 failed, 1 expected desktop skip for a mobile-only assertion.
- The audit did not change runtime code, so corrected-page visual diffs and accessibility regression results are intentionally deferred until owner approval permits implementation.
