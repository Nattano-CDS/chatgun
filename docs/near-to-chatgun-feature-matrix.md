# NEAR to ChatGun feature matrix

Status: implementation checkpoint on `codex/near-migration`. No NEAR source, Production data, or Production deployment was modified.

## Canonical source identification

The original implementation is confidently identified as the owner-controlled ChatGPT Site below.

| Evidence | Result |
| --- | --- |
| Sites project | `appgprj_6ac39c734d2c8191a0f37e9cb44c34fa` |
| Product title and description | **Near · เพื่อนใกล้คุณ** — “ค้นหาเพื่อนใกล้เคียง แชทกับเพื่อน และรีวิวเมื่ออยู่ใกล้กัน” |
| Canonical deployment | `https://near-friends.nate-tanoi7.chatgpt.site` (private/custom audience) |
| Source repository | Sites-managed `cloudflare_artifact` repository, default branch `main` |
| Repository history | 97 commits from 2026-10-05 through 2026-10-15; one branch (`main`) |
| Saved releases | 91 Sites versions |
| Last stable release | Version 91, commit `98bb83e44bf88eddb9822d7875f18cd4fe833ee2` |
| Release verification | Latest publish deployment `appgdep_6ad117da5d288191b2ea43cfd5a75266` reports `succeeded` |
| Storage | D1 binding `DB`; R2 binding `BUCKET` |
| D1 schema verification | Sites read-only overview and the 25 versioned Drizzle migrations agree on 19 tables |
| Design evidence | Version 91 deployment screenshot exists in Sites; source includes complete responsive CSS, fonts, icons, demo atlases, and game art |

The source was opened into an audit-only checkout at `/Users/nattano/.codex/worktrees/near-source-audit`. No source file or source commit was changed. The destination baseline is PR #5 (`codex/privacy-safety`, commit `9c315cf`), which already contains PR #3 authentication plus the staging privacy/safety controls. PR #4 remains a separate legal draft and was not merged.

## Status definitions

- **Migrated and verified**: implemented in ChatGun and backed by current test evidence.
- **Live staging verified; launch-gated**: NEAR-equivalent behavior passed real Pages/D1 API and browser tests with synthetic accounts, but safety, legal, or operational approval still prevents public activation.
- **Partially migrated**: a destination foundation exists, but NEAR-equivalent behavior or verification is incomplete.
- **Missing**: no equivalent destination implementation exists.
- **Blocked**: implementation requires an unresolved security, legal, product, infrastructure, or data-mapping decision.
- **Excluded: Game only**: intentionally omitted under the migration brief.

Static source inspection and a successful NEAR deployment prove what exists in NEAR. They do not prove ChatGun migration completion. No row below is marked migrated and verified unless the corresponding ChatGun behavior already exists and has tests.

No standalone feed, communities/groups, notification center, or settings route was discovered in v91. The discovery grid, profile gallery, device-notification toggle, and profile tab are the actual NEAR equivalents; this migration must not invent additional products under those names. Email OTP and mobile OTP are also absent from NEAR and remain disabled in ChatGun.

## Current implementation checkpoint

The row-level status/evidence cells below are preserved as the source-discovery baseline that justified the architecture. This checkpoint supersedes those baseline cells for current destination status:

| Current status | Features | Evidence / remaining gate |
| --- | --- | --- |
| **Migrated and verified** | Application shell/navigation; optional browser-only demo; responsive/accessibility layout; offline/recovery UX | ChatGun `/app/` implements the five non-game destinations and no game route/import. Desktop/mobile Playwright passes against deployed Preview assets. Demo profiles, relationships, reports, gallery images, chat images, and the five-item reuse library stay in IndexedDB/data URLs without D1/R2 writes. Offline/online state and recovery are exercised in both layouts. |
| **Live staging verified; launch-gated** | Geolocation/presence; discovery/filters; member profile/edit/privacy; friend workflow/list; text and image chat; private gallery/upload/select/likes/comments; unread/device notifications; ratings/private reviews; blocking; reporting; account deletion | Three synthetic adult staging accounts exercised real Pages Functions, `chatgun-auth-staging`, and private `chatgun-media-staging`, including success/failure paths, authorization, persistence, deletion queue/cleanup, and desktop/mobile UI. Public activation remains gated by safety, legal, moderation, and provider decisions. |
| **Staging-complete; release-gated** | Provider publishing; moderator operations/message/media audit | Google, Facebook, and LINE authentication now pass real stable-Preview browser E2E. Production provider publishing, approved age assurance, and staffed moderation remain separate gates. |
| **Blocked** | Adult-age eligibility approval; identity verification activation | The 18+ declaration mechanism and a disabled identity-verification prototype exist, but threshold/assurance review is unresolved. Identity evidence also requires necessity/lawful-basis review, an approved notice/reviewer process, and isolated R2 before any test submission. |

Implementation evidence at this checkpoint:

- Migrations `0003_social.sql` and `0004_moderation_audit.sql` were applied only to `chatgun-auth-staging`; three pre-existing staging users were preserved and `PRAGMA foreign_key_check` returned no violations.
- Production was inspected read-only and still has migrations `0002`–`0004` pending; none were applied.
- Validated stable Preview for commit `b1510c728daad06e64581e352be984ee4d8781a9`:
  `https://codex-near-migration.chatgun.pages.dev` (deployment `https://135cd46a.chatgun.pages.dev`). Social shell, discovery, relationships, messaging,
  ratings, private media, and invitation-only adult onboarding are enabled against isolated
  staging only. Public registration, moderation tools, identity verification, Demo, Game,
  email OTP, and mobile OTP remain disabled. Production has no R2 binding and overrides
  Beta/social/media capabilities to `false`.
- Current automated evidence: 63 unit/integration tests pass; the stable-Preview browser suite passed 25 tests with 9 intentional environment/project skips. Real Google, Facebook, and LINE login/callback/session/logout journeys also passed with authorized existing staging identities. The LINE journey was rerun successfully after rotating the dedicated Preview channel secret; Production was unchanged. Details and screenshots are recorded in `docs/near-migration-validation.md` and PR #6.
- R2 is active. Private bucket `chatgun-media-staging` and scheduled Worker `chatgun-media-cleanup-staging` are staging-only. Live tests verified private reads, metadata removal, deletion/account-deletion queues, and an empty post-test bucket. No NEAR, PiggyPrice, or Production resource was accessed or mutated.

## Complete non-game feature inventory

| Feature | Original source files | Original route/page | API endpoints | Database tables | UI components | Dependencies | Current NEAR functionality | ChatGun destination | Migration status | Verification evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Authentication and session entry | `app/chatgpt-auth.ts`, `app/login/page.tsx`, `app/logout-button.tsx`, `app/auth-link.tsx`, `app/site-shell.tsx` | `/login`, dispatch-owned sign-in/sign-out routes | Dispatch-owned SIWC routes | Identity is supplied by Sites; profile data uses `profiles` | Login panel, account state, logout link | ChatGPT SIWC, request identity headers | Signs visitors in, preserves a stable site-scoped user ID, and returns to the app | Keep ChatGun Google, Facebook, and LINE OAuth, secure sessions, logout, linking, CSRF, Turnstile, and rate limits from PR #3/#5; do not migrate SIWC | **Live staging verified; production-publishing gated** | Authorized existing staging identities completed real Google, Facebook, and LINE authorization, callback, session, account access, and logout on the stable Preview. Provider denial/cancellation paths returned a safe Thai error and consumed the issued state. The LINE success/logout/denial journey was rerun after rotating its dedicated Preview secret. The newest session was revoked and D1 retained one identity per provider with zero invitations/enrollments. NEAR v91 source proves SIWC behavior. |
| New-member registration and onboarding | `app/register/page.tsx`, `app/register/register-form.tsx`, `app/api/near/route.ts` | `/register` | `POST /api/near` (`profile`) | `profiles` | Registration form, authenticated return flow | SIWC, D1 | Creates a display profile with name, gender, bio, and interests | Add authenticated ChatGun member onboarding after social login; connect `users.id` to the social profile model | **Implemented for controlled staging; launch-gated** | Public registration stays off. A one-use hashed invitation is bound to OAuth and consumed transactionally; the new account remains `pending_age` until recent-authenticated server-side 18+ onboarding creates its profile. |
| Age eligibility | No age field or gate exists in NEAR | None | None | None | None | None | NEAR does not collect or enforce age | Add the requested 18+ gate only after owner/legal approval of threshold, assurance method, evidence minimization, correction, and evasion controls | **Technically implemented; policy-gated** | Bangkok-date DOB calculation rejects under-18/invalid claims and stores only an adult self-declaration event. It is not independent verification; owner and qualified Thai legal approval remain required. |
| Application shell and navigation | `app/site-shell.tsx`, `app/near.tsx`, `app/bottom-nav.tsx`, `app/layout.tsx` | `/` | None directly | None | Desktop/sidebar-derived shell, sticky toolbar, six-item mobile bottom navigation | Next/Vinext, React, Lucide | Navigates discovery, friends, chat, private reviews, game, and profile; preserves badges and route state | Recreate five non-game destinations with ChatGun branding; omit game navigation | **Migrated and verified** | Deployed Preview desktop/mobile tests cover all five non-game destinations; Game has no route, control, API, schema, asset pack, or dependency. |
| Live/demo mode switching | `app/near.tsx`, `app/demo.ts`, `app/demo-store.ts` | `/` | Reuses normal UI actions in demo mode without network writes | IndexedDB `near-demo` only | Demo banner, mode switch, sample profiles/content | IndexedDB, FileReader | Lets anonymous/signed-in users explore representative discovery, friendships, chat, gallery, reviews, moderation, and verification data | Decide whether a safe ChatGun demo remains a product requirement; never mix demo data with real D1 data | **Migrated and verified, disabled by default** | Browser-only IndexedDB demo covers local gallery/chat images and five-image reuse without network persistence; deployed Preview keeps `DEMO_MODE_ENABLED=false`. |
| Geolocation consent and presence | `app/near.tsx`, `lib/near.ts`, `app/api/near/route.ts`, `app/visible-poll.ts` | Discovery and profile tabs | `POST /api/near` (`location`, `hide`) | `profiles` | Location banner, enable/disable controls, accuracy/freshness messages | Browser Geolocation and Permissions APIs | High-accuracy watch updates at most once per minute while visible; disables discovery and clears coordinates when hidden/denied | Implement consent-first presence with explicit off state and server-side visibility enforcement | **Live staging verified; launch-gated** | Real Preview accepted accurate synthetic location, rejected accuracy over 50 m, persisted visibility, omitted raw coordinates, and passed permission-revocation/unit coverage. Public policy approval remains required. |
| Nearby discovery | `app/near.tsx`, `app/discovery-grid.tsx`, `app/portrait.tsx`, `lib/near.ts`, `app/api/near/route.ts` | `/` → หาเพื่อน | `GET /api/near` | `profiles`, `friendships`, `blocks`, `ratings`, `photos` | Portrait discovery cards, responsive grid, distance badges, empty states | Geolocation, D1 | Returns visible/fresh profiles within 5 km without returning raw coordinates; includes distance, rating, relationship, and photo | Add a ChatGun discovery service tied to `users`; preserve authorization and privacy defaults | **Live staging verified; launch-gated** | Exact metres are replaced with 250 m bands; equal-band results are not exact-distance ordered. Accuracy/time/coordinates are absent cross-user; 2-minute expiry, permission revocation, block exclusion, and 30-read/10-minute anti-probing limit are tested. This intentional privacy variance from NEAR is documented. |
| Discovery search and filters | `app/near.tsx`, `app/discovery-grid.tsx` | `/` → หาเพื่อน | Client-side filtering of `GET /api/near` result | Indirectly `profiles`, `friendships` | Search field, desktop/mobile filter controls, applied chips | React state | Filters by name/interests, gender, interest, friendship status, and 100 m/1 km/5 km radius | Preserve behavior and visual interaction after discovery is approved | **Live staging verified; launch-gated** | Desktop/mobile filters remain, with the smallest radius intentionally raised from NEAR's 100 m to 250 m to match privacy bands. Unit/browser regressions cover the controls. |
| Public/member profile presentation | `app/profile-view.tsx`, `app/portrait.tsx`, `app/near.tsx`, `app/people/[id]/page.tsx` | `/people/:id` | `GET /api/near`, `GET /api/gallery?user=…` | `profiles`, `photos`, `ratings`, `friendships`, `blocks` | Full-screen profile, portrait, facts, interests, rating, verification badge | Next dynamic routes, Lucide | Shows identity, bio, interests, gender, approximate distance, rating, gallery, relationship actions, and badge explanation | Add member profile routes and a profile table linked by `user_id`; apply privacy/audience rules | **Live staging verified; launch-gated** | Real synthetic profiles rendered on desktop/mobile and deep routes; blocked/non-visible authorization is enforced. Gallery/verification subsections remain independently gated. |
| Profile editing and privacy controls | `app/near.tsx`, `app/api/near/route.ts` | `/` → โปรไฟล์ | `POST /api/near` (`profile`, `hide`, `unblock`) | `profiles`, `blocks`, `verification` | Profile form, hide-discovery button, device notification toggle, blocked-user list | Notification API, localStorage | Edits name/gender/bio/interests; a name change invalidates verification; disables location; manages blocked users | Add profile settings plus existing ChatGun account deletion/session controls | **Live staging verified; launch-gated** | Real API edit and invalid-input paths persisted in staging; desktop/mobile render the persisted profile, notification control, and privacy actions. |
| Profile and gallery photo management | `app/photos/page.tsx`, `app/upload-photos.tsx`, `app/optimize-photo.ts`, `app/api/gallery/route.ts`, `app/api/gallery/file/route.ts`, `lib/private-image.ts` | `/photos` | `GET/POST /api/gallery`, `GET /api/gallery/file` | `photos`, `profiles`, `photo_likes`, `photo_comments` | Upload editor, preview, cover selector, 12-photo manager | R2 `BUCKET`, Canvas image optimization, magic-byte checks | Uploads JPG/PNG/WebP up to 8 MB, optimizes client-side, stores privately, chooses a profile photo, deletes photos, caps at 12 | Add isolated ChatGun R2 and additive D1 content schema with authorization and deletion rules | **Live staging verified; launch-gated** | Private R2 upload/read/delete and metadata stripping passed. A role-gated quarantine/release/reject workflow is implemented and unit-tested; synthetic Preview uses an explicit bypass. Public launch still requires an approved scanner or staffed review operation. |
| Gallery browsing | `app/profile-view.tsx`, `lib/gallery.ts`, `app/api/gallery/route.ts`, `app/api/gallery/file/route.ts` | `/people/:id/gallery`, `/people/:id/gallery/:photoId` | `GET /api/gallery`, `GET /api/gallery/file` | `photos`, `friendships`, `blocks` | Gallery summary, 3-column grid, post viewer, previous/next controls | R2, dynamic routes | Profile owner, discoverable people, and accepted friends can be viewed according to server checks; images are private/no-cache | Add profile-scoped gallery with reviewed audience model | **Live staging verified; launch-gated** | Anonymous retrieval was rejected; owner/friend retrieval used no-store private endpoints; blocking immediately revoked the friend’s gallery access. |
| Photo likes | `app/profile-view.tsx`, `app/api/gallery/route.ts` | Gallery post | `POST /api/gallery` (`like`) | `photo_likes`, `photos` | Like button and count | D1 | Authorized viewers can toggle one like per photo/user | Add content interaction table with idempotent toggle and deletion cascade | **Live staging verified; launch-gated** | A synthetic accepted friend toggled a like on a real private R2-backed photo and the persisted count/viewer state matched. |
| Photo comments | `app/profile-view.tsx`, `app/api/gallery/route.ts` | Gallery post | `POST /api/gallery` (`comment`) | `photo_comments`, `photos`, `profiles`, `friendships` | Comment composer/list | D1 | Authorized viewers can comment; only owner and accepted friends receive comment bodies; 500-character limit | Add comment model with moderation, audience, retention, and deletion rules | **Live staging verified; moderation launch-gated** | A synthetic accepted-friend comment persisted and was readable through the authorized post view; public launch remains blocked on content moderation/retention operations. |
| Friend requests | `app/near.tsx`, `app/profile-view.tsx`, `app/people-actions.tsx`, `app/api/near/route.ts` | `/` → เพื่อน and profile routes | `POST /api/near` (`request`, `accept`, `reject`, `cancel`) | `friendships`, `blocks`, `profiles` | Incoming badge, request cards, accept/reject/cancel controls | D1 | Mutual-consent relationship workflow prevents duplicates and respects blocks | Add relationship table keyed to ChatGun users; enforce blocks server-side | **Live staging verified; launch-gated** | Real request/accept and duplicate-request rejection persisted in staging; block checks and CSRF were exercised. |
| Friend list and unfriend | `app/near.tsx`, `app/profile-view.tsx`, `app/people-actions.tsx`, `app/api/near/route.ts` | `/` → เพื่อน | `GET /api/near`, `POST /api/near` (`unfriend`) | `friendships`, `profiles` | Friend cards, empty state, unfriend confirmation | D1 | Shows accepted friends and removes the relationship on confirmation | Add after relationship model and account-deletion behavior are approved | **Live staging verified; launch-gated** | Accepted relationship appeared in real API and desktop/mobile friends UI; block removed it transactionally and a later mutual flow restored it. |
| Text messaging | `app/chat.tsx`, `app/near.tsx`, `app/api/chat/route.ts`, `app/api/near/route.ts`, `lib/chat.ts` | `/` → แชท | `GET /api/chat?target=…`, `POST /api/near` (`message`), `POST /api/chat` (`read`, `unsent`) | `messages`, `friendships`, `blocks`, `profiles` | Inbox, thread view, composer, unread counts, pagination, unsend dialog | D1, visible polling | Only accepted/unblocked friends can chat; 2,000-character limit; 50-message pages; read receipts; sender can unsend | Add a relationship-gated ChatGun messaging API with CSRF, abuse controls, retention, deletion, and moderation | **Live staging verified; launch-gated** | Real accepted-friend message persisted and appeared in inbox; non-friend, blocked, and missing-CSRF sends were rejected. Pagination/unsend/read behavior has unit/integration coverage. |
| Chat image upload and reuse | `app/chat.tsx`, `app/optimize-photo.ts`, `app/api/chat/route.ts`, `app/api/chat/file/route.ts`, `lib/chat.ts`, `lib/private-image.ts` | Chat thread and image library | `GET/POST /api/chat`, `GET /api/chat/file` | `chat_assets`, `messages`, `friendships`, `blocks` | Upload picker, five-image library, forward flow, unavailable-image state | R2, Canvas, magic-byte checks | Stores up to five recent images per owner; can resend/forward accessible images; older binary is removed and messages degrade safely | Add only with isolated R2, access-control tests, scanning/moderation policy, and message deletion design | **Live staging verified; moderation launch-gated** | Real sender/recipient upload/read passed; strangers and blocked former friends received 404; anonymous access failed; five-item retention/reuse and revoked-access forwarding remain covered by integration tests. |
| Unread polling and device notifications | `app/near.tsx`, `app/chat.tsx`, `app/visible-poll.ts` | App shell and chat | `GET /api/near`, `GET /api/chat` | `messages` | Badges, toast, profile notification toggle | Page Visibility API, Notification API, localStorage | Polls visible pages, displays unread badges/toasts, and optionally uses device notifications | Preserve polling semantics initially or replace with an approved event design | **Live staging verified; launch-gated** | Real inbox preview/unread state rendered on desktop/mobile; deterministic permission flow persisted the device preference, while visible polling remains covered by regression tests. |
| Nearby ratings and private reviews | `app/near.tsx`, `app/profile-view.tsx`, `lib/near.ts`, `app/api/near/route.ts` | Discovery/profile; `/` → ความคิดเห็น | `POST /api/near` (`rate`), `GET /api/near` | `ratings`, `profiles` | Five-star dialog, private review list | Geolocation, D1 | Allows one rating per target/day only when both fresh locations are within 100 m and accuracy is at most 50 m; comments are visible only to the recipient | Add only after legal/privacy review of proximity proof, abuse/appeal handling, and retention | **Live staging verified; launch-gated** | Real proximity-qualified rating persisted, rendered only for the recipient, and duplicate same-day rating was rejected. Policy/appeal approval remains required. |
| Blocking | `app/people-actions.tsx`, `app/profile-view.tsx`, `app/near.tsx`, `app/api/near/route.ts`, `lib/chat.ts`, `lib/gallery.ts` | Profiles, gallery, profile settings | `POST /api/near` (`block`, `unblock`) | `blocks`, `friendships`, `messages`, `profiles` | Block confirmation, blocked-user list | D1 | A server-side block removes users from discovery/gallery/contact and prevents chat; users can later unblock | Add as a cross-cutting authorization primitive before discovery or messaging activates | **Live staging verified; launch-gated** | Real block removed the relationship and prevented reverse messaging; blocked list persisted and unblock restored eligibility. |
| Reporting | `app/people-actions.tsx`, `app/chat.tsx`, `app/api/near/route.ts`, `app/api/chat/route.ts` | Profiles/gallery and Admin chat view | `POST /api/near` (`report`), `GET /api/chat?reports=1`, `POST /api/chat` (`review-report`) | `reports`, `profiles` | Report dialog, Admin report queue/review action | D1, admin email allowlist | Captures a reason, hides reporter identity from the reported user, and lets the configured admin mark reports reviewed | Replace single-email admin gate with roles/audit; add categories, evidence rules, escalation, appeals, and staffing | **Live staging verified; moderator operation launch-gated** | Categorized synthetic report persisted; invalid category was rejected. Role/purpose/audit moderator implementation passes tests but remains disabled until staffing/runbooks are approved. |
| Admin message audit | `app/chat.tsx`, `app/api/chat/route.ts` | Admin subview in chat | `GET /api/chat?admin=1` | `messages`, `chat_assets`, `profiles` | Paginated audit list and images | D1, R2, admin email allowlist | Configured admin can inspect recent messages, including unsent records, and related images | Redesign around least privilege, purpose logging, access audit, retention, and incident workflow | **Implemented/tested; operation launch-gated** | Destination uses D1 roles, explicit purpose, audit records, safe rendering, and private media checks. It stays disabled until staffing/runbooks are approved and R2 is available. |
| Identity verification badge | `app/verify.tsx`, `app/profile-view.tsx`, `app/api/verification/route.ts`, `app/api/verification/file/route.ts` | Profile verification panel and profile badge | `GET/POST /api/verification`, `GET /api/verification/file` | `verification`, `profiles` | Evidence upload, consent, pending/rejected/approved states, badge explanation, Admin review | R2, admin email allowlist, image validation | User submits ID/selfie; admin compares name/face; evidence is private and deleted after decision; name change revokes badge | Do not copy as-is; conduct necessity, biometric/ID handling, operator access, retention, and lawful-basis review before choosing an assurance provider | **Blocked** | ChatGun has no verification storage/binding; NEAR’s manual workflow involves high-risk identity evidence. |
| Offline and API recovery UX | `app/api-client.ts`, `app/api-recovery.tsx`, `app/near.tsx` | Global | Applies to all API calls | None | Offline banner, API issue state, retry guidance | `navigator.onLine`, custom browser events | Detects offline/API failure and prevents stale live-mode assumptions | Port generic recovery behavior into the future ChatGun application shell | **Migrated and verified** | Desktop/mobile E2E forces offline state, verifies the warning, restores connectivity, and verifies recovery feedback. |
| Responsive and accessible interaction behavior | `app/globals.css`, all app components, `components/ui/*`, `hooks/use-mobile.ts` | All pages | None | Desktop shell, mobile bottom nav, dialogs, focus states, keyboard-safe chat, reduced-motion mode | Base UI/Radix, shadcn, Tailwind, Lucide | Responsive breakpoints at 1400/1100/700/360 px; focus-visible styles; ARIA labels; visual viewport handling; reduced-motion support | Preserve behavior while changing only the `near` wordmark/logo to approved ChatGun branding | **Migrated and verified** | Desktop/mobile deployed-asset tests cover navigation, dialogs, deep routes, keyboard profile activation, accessible media controls, and responsive layouts with ChatGun branding. |
| Account deletion (destination-required integration) | No NEAR account-deletion workflow exists | None | None | None | None | None | Not implemented in NEAR | Preserve PR #5 authenticated, recent-auth, CSRF- and replay-protected deletion flow; extend it transactionally to migrated social content and R2 objects | **Live staging verified; launch-gated** | A recent-auth synthetic account with owned R2 media was deleted through the real Preview API; access was revoked, media entered the queue, the scheduled Worker completed deletion, and final D1/R2 checks were clean. |

## Design-preservation baseline

The source of truth is `app/globals.css` plus the current component markup at NEAR v91. Migration must preserve these characteristics unless an approved accessibility/security change requires otherwise:

- Core surfaces: background `#f7f7fb`, foreground `#21212a`, primary violet `#6d42e5`, light border `#e9e7ef`, and lime action highlight `#d0f17b`.
- Typography: Arial with `Noto Sans Thai` and Tahoma fallbacks; bundled Noto Sans Thai and Mali fonts are present. Game-only Mali styling is excluded unless a non-game screen is proven to use it.
- Discovery uses edge-to-edge portrait cards, dark gradient scrims, rounded 22 px cards, distance chips, verification badges, and filter chips.
- Desktop uses a left navigation/application shell; mobile uses a safe-area-aware bottom navigation and sticky compact toolbar.
- Profile and gallery are image-led, full-screen responsive layouts; chat has distinct inbox and thread screens with keyboard/visual-viewport handling.
- Focus-visible outlines, labelled icon buttons, status/error regions, minimum touch targets, and `prefers-reduced-motion` behavior must be retained.
- Branding changes are limited to NEAR → ChatGun wordmark/logo and approved copy; this inventory does not authorize a redesign.

## Infrastructure and dependency inventory

### Runtime and integrations

- Next 16/Vinext on Cloudflare Workers/Sites.
- Cloudflare D1 (`DB`) for relational state.
- Cloudflare R2 (`BUCKET`) for gallery, chat, and identity-evidence images.
- ChatGPT SIWC identity headers and dispatch routes (to be replaced by ChatGun OAuth/session identity, not copied).
- Browser Geolocation, Permissions, Notifications, Page Visibility, Visual Viewport, Canvas/FileReader, IndexedDB, and Clipboard APIs.
- Drizzle ORM/migrations; React 19; Base UI/Radix/shadcn; Tailwind; Lucide; Zod/forms; `three` for game-only rendering.

### NEAR non-game tables to map additively

| NEAR table | Purpose | ChatGun relationship |
| --- | --- | --- |
| `profiles` | Member profile, discovery state, location, verification flag, selected photo | New social profile table keyed to `users.id`; do not duplicate authentication identity fields |
| `friendships` | Pending/accepted relationships | New relationship table keyed to ChatGun users |
| `messages` | Text/image messages, unsend and read timestamps | New table; requires retention/deletion/moderation design |
| `ratings` | Daily proximity ratings and private comments | New table; requires location/privacy/appeal design |
| `blocks` | Cross-cutting contact/access denial | New table and mandatory server-side authorization checks |
| `verification` | Manual ID/selfie review metadata and R2 keys | Do not migrate until a separate high-risk data review approves a replacement |
| `photos` | Profile/gallery R2 objects and captions | New table with reviewed media lifecycle |
| `photo_likes` | Per-user likes | New table with cascade/deletion rules |
| `photo_comments` | Gallery comments | New table with audience/moderation/deletion rules |
| `chat_assets` | Five-image chat library and R2 keys | New table with private-object authorization and retention rules |
| `reports` | User safety reports and review state | New moderated table with roles, evidence, retention, audit, and escalation |

No production user/content data migration is authorized. Identity mapping cannot rely on NEAR’s site-scoped SIWC IDs matching ChatGun OAuth users.

## Game exclusion inventory

All items in this section are classified **Excluded: Game only**. Shared modules used by non-game features must not be removed merely because a game imports them.

| Excluded area | Source evidence | Exclusion action |
| --- | --- | --- |
| Game navigation and deep links | `app/bottom-nav.tsx`, `app/near.tsx` (`game` tab and `?tab=game&estate=`), `app/chat.tsx` game invite cards | Omit the game tab, game routing, invite composer/cards, and game-specific query handling |
| Pig/garden UI | `app/pet-game.tsx`, `app/pig-garden.tsx`, `app/game-cover.tsx`, `app/game-guide.tsx`, `app/game-tutorial.tsx` | Do not migrate |
| Pig Studio | `app/pig-studio/page.tsx`, `app/pig-studio/studio.tsx`, `app/pig-studio/studio.css` | Do not migrate route or editor |
| Estate board game | `app/estate-*.tsx`, `app/estate.css` | Do not migrate |
| Game domain/business logic | `lib/pet*.ts`, `lib/garden-*.ts`, `lib/estate*.ts`, `lib/pig-*.ts`, `lib/game-tutorial.ts`, `lib/premium-pig-frames.json` | Do not migrate; extract no shared behavior without proof |
| Game APIs | `/api/pet`, `/api/pet/baby`, `/api/pet/friends`, `/api/pet/mates`, `/api/pet/presence`, `/api/pet/visit`, `/api/estate` | Do not recreate in ChatGun |
| Game tables | `pets`, `pet_mates`, `pet_babies`, `garden_visits`, `garden_actions`, `estate_rooms`, `estate_wardrobes`, `estate_rewards` | Do not add to ChatGun D1 |
| Game migrations | `drizzle/0009_*` through `drizzle/0024_estate.sql` | Exclude entirely; non-game migrations `0000`–`0008` must be redesigned additively for ChatGun |
| Game assets/fonts | `public/pig-*`, `public/garden-*`, `public/crop-states-atlas.webp`, `app/game-fonts.css`, related asset pack scripts | Do not migrate |
| Game tests | `tests/check-estate*`, `tests/check-game-api.cjs`, `tests/check-garden*`, `tests/check-pig*`, `tests/check-placement.cjs`, `tests/check-tutorial-demo.cjs`, `tests/run-game.cjs`, `tests/sqlite-game-bridge.py` | Do not port to ChatGun regression suites |
| Game-only dependency | `three` | Remove from the migration dependency plan unless a non-game use is later demonstrated |

The shared `api-client`, `visible-poll`, `Portrait`, chat, profile, demo-store, dialog/UI primitives, and responsive styles are non-game capabilities even where game components import them.

## Schema and security discrepancies requiring design before code migration

1. NEAR uses a Sites-scoped SIWC subject directly as `profiles.id`; ChatGun uses `users.id` plus provider identities. A new profile/content schema must reference ChatGun users and must not assume IDs are portable.
2. NEAR tables mostly lack declared foreign keys to a central user table. ChatGun migrations must add explicit foreign keys and intentional delete/anonymize behavior without weakening PR #5’s deletion transaction.
3. NEAR uses request `Origin` checks but has no ChatGun session-CSRF token contract. All migrated mutations must use the existing ChatGun same-origin and CSRF controls.
4. NEAR rate limits are not evident on social write endpoints. ChatGun must apply scoped rate limits to discovery, requests, messages, uploads, ratings, reports, and verification.
5. NEAR’s manual admin authorization is an email comparison. ChatGun needs role-based authorization, access logs, and separation of moderation/identity-review duties.
6. NEAR stores precise coordinates and high-risk identity evidence. Retention, access, encryption, deletion, incident response, and lawful-basis decisions are unresolved.
7. PR #5 deletes authentication data only. Adding content tables requires a reviewed, transactional content and R2 deletion/anonymization plan plus D1 Time Travel restore/replay procedures.
8. The requested 18+ gate is absent from NEAR. ChatGun has a disabled technical prototype, but it remains a launch blocker until the threshold and assurance model receive owner and qualified Thai legal approval.

## Inventory conclusion

- Original NEAR source: **identified confidently**.
- Last stable implementation: **Sites version 91 / commit `98bb83e`**, active and successfully published.
- NEAR non-game product features inventoried: **26**, plus **1** destination-required account-deletion integration row.
- Migrated and verified without a launch dependency: **4** (application shell/navigation, optional browser-only demo, offline/recovery UX, and responsive/accessibility layout).
- Live staging verified but public-launch gated: **18** (presence, coarse-distance discovery,
  filters, member profile, profile/privacy settings, profile-photo management, gallery, likes,
  comments, friend requests, friend list, text messaging, chat images, unread/device
  notifications, ratings, blocking, reporting, and account deletion).
- Technically implemented but policy/operationally gated: **3** (invitation onboarding,
  self-declared adult eligibility, and moderator message/media audit).
- Partially migrated: **0**. Provider authentication is staging-verified; provider publishing
  and Production credentials remain release gates rather than missing migration behavior.
- Blocked on an external prerequisite: **1** (high-risk identity verification activation).
- Excluded game areas: **11 groups**, covering all current game UI, logic, APIs, tables, assets, dependencies, and tests.
- Verified technical implementation/parity evidence exists for **26 of 27 rows** (4
  dependency-free, 19 isolated live-staging including provider authentication, and 3
  technically verified but operationally gated). Identity verification is deliberately
  blocked. Launch-gated rows are not represented as
  Production-ready.

Production activation remains blocked until the 18+ age-assurance decision, staffed social
  safety operations, location/media policy approval, production scanner decision, provider
  publishing, Production migrations 0002–0007, and identity-verification decision are approved.
Staging R2 and real private-media authorization/deletion E2E pass; public media remains off.
