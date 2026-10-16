# NEAR to ChatGun feature matrix

Status: source-discovery and migration-planning baseline. No NEAR source, production data, or production deployment was modified.

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
- **Partially migrated**: a destination foundation exists, but NEAR-equivalent behavior or verification is incomplete.
- **Missing**: no equivalent destination implementation exists.
- **Blocked**: implementation requires an unresolved security, legal, product, infrastructure, or data-mapping decision.
- **Excluded: Game only**: intentionally omitted under the migration brief.

Static source inspection and a successful NEAR deployment prove what exists in NEAR. They do not prove ChatGun migration completion. No row below is marked migrated and verified unless the corresponding ChatGun behavior already exists and has tests.

No standalone feed, communities/groups, notification center, or settings route was discovered in v91. The discovery grid, profile gallery, device-notification toggle, and profile tab are the actual NEAR equivalents; this migration must not invent additional products under those names. Email OTP and mobile OTP are also absent from NEAR and remain disabled in ChatGun.

## Complete non-game feature inventory

| Feature | Original source files | Original route/page | API endpoints | Database tables | UI components | Dependencies | Current NEAR functionality | ChatGun destination | Migration status | Verification evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Authentication and session entry | `app/chatgpt-auth.ts`, `app/login/page.tsx`, `app/logout-button.tsx`, `app/auth-link.tsx`, `app/site-shell.tsx` | `/login`, dispatch-owned sign-in/sign-out routes | Dispatch-owned SIWC routes | Identity is supplied by Sites; profile data uses `profiles` | Login panel, account state, logout link | ChatGPT SIWC, request identity headers | Signs visitors in, preserves a stable site-scoped user ID, and returns to the app | Keep ChatGun Google, Facebook, and LINE OAuth, secure sessions, logout, linking, CSRF, Turnstile, and rate limits from PR #3/#5; do not migrate SIWC | **Partially migrated** | PR #3 tests cover destination auth internals; real-provider public-launch approval remains separate. NEAR v91 source proves SIWC behavior. |
| New-member registration and onboarding | `app/register/page.tsx`, `app/register/register-form.tsx`, `app/api/near/route.ts` | `/register` | `POST /api/near` (`profile`) | `profiles` | Registration form, authenticated return flow | SIWC, D1 | Creates a display profile with name, gender, bio, and interests | Add authenticated ChatGun member onboarding after social login; connect `users.id` to the social profile model | **Blocked** | ChatGun currently has `NEW_ACCOUNT_REGISTRATION_ENABLED=false`; PR #5 has no member-profile table or approved age gate. |
| Age eligibility | No age field or gate exists in NEAR | None | None | None | None | None | NEAR does not collect or enforce age | Add the requested 18+ gate only after owner/legal approval of threshold, assurance method, evidence minimization, correction, and evasion controls | **Blocked** | `docs/minor-safety-launch-gate.md` explicitly records that neither 18+ nor 20+ may be assumed without legal review. |
| Application shell and navigation | `app/site-shell.tsx`, `app/near.tsx`, `app/bottom-nav.tsx`, `app/layout.tsx` | `/` | None directly | None | Desktop/sidebar-derived shell, sticky toolbar, six-item mobile bottom navigation | Next/Vinext, React, Lucide | Navigates discovery, friends, chat, private reviews, game, and profile; preserves badges and route state | Recreate five non-game destinations with ChatGun branding; omit game navigation | **Missing** | ChatGun currently exposes landing, signup, account, and legal pages only. |
| Live/demo mode switching | `app/near.tsx`, `app/demo.ts`, `app/demo-store.ts` | `/` | Reuses normal UI actions in demo mode without network writes | IndexedDB `near-demo` only | Demo banner, mode switch, sample profiles/content | IndexedDB, FileReader | Lets anonymous/signed-in users explore representative discovery, friendships, chat, gallery, reviews, moderation, and verification data | Decide whether a safe ChatGun demo remains a product requirement; never mix demo data with real D1 data | **Missing** | No demo store or mode exists in ChatGun. |
| Geolocation consent and presence | `app/near.tsx`, `lib/near.ts`, `app/api/near/route.ts`, `app/visible-poll.ts` | Discovery and profile tabs | `POST /api/near` (`location`, `hide`) | `profiles` | Location banner, enable/disable controls, accuracy/freshness messages | Browser Geolocation and Permissions APIs | High-accuracy watch updates at most once per minute while visible; disables discovery and clears coordinates when hidden/denied | Implement consent-first presence with explicit off state and server-side visibility enforcement | **Blocked** | PR #5 intentionally disables public discovery; retention and precise-location policy are not approved. |
| Nearby discovery | `app/near.tsx`, `app/discovery-grid.tsx`, `app/portrait.tsx`, `lib/near.ts`, `app/api/near/route.ts` | `/` → หาเพื่อน | `GET /api/near` | `profiles`, `friendships`, `blocks`, `ratings`, `photos` | Portrait discovery cards, responsive grid, distance badges, empty states | Geolocation, D1 | Returns visible/fresh profiles within 5 km without returning raw coordinates; includes distance, rating, relationship, and photo | Add a ChatGun discovery service tied to `users`; preserve authorization and privacy defaults | **Blocked** | Destination declares `PUBLIC_DISCOVERY_ENABLED=false`; minor/adult-only safety and moderation gates are unresolved. |
| Discovery search and filters | `app/near.tsx`, `app/discovery-grid.tsx` | `/` → หาเพื่อน | Client-side filtering of `GET /api/near` result | Indirectly `profiles`, `friendships` | Search field, desktop/mobile filter controls, applied chips | React state | Filters by name/interests, gender, interest, friendship status, and 100 m/1 km/5 km radius | Preserve behavior and visual interaction after discovery is approved | **Blocked** | Depends on blocked discovery and an approved rule for sensitive gender/location filtering. |
| Public/member profile presentation | `app/profile-view.tsx`, `app/portrait.tsx`, `app/near.tsx`, `app/people/[id]/page.tsx` | `/people/:id` | `GET /api/near`, `GET /api/gallery?user=…` | `profiles`, `photos`, `ratings`, `friendships`, `blocks` | Full-screen profile, portrait, facts, interests, rating, verification badge | Next dynamic routes, Lucide | Shows identity, bio, interests, gender, approximate distance, rating, gallery, relationship actions, and badge explanation | Add member profile routes and a profile table linked by `user_id`; apply privacy/audience rules | **Blocked** | No destination profile/content model; visibility and adult/minor policy not approved. |
| Profile editing and privacy controls | `app/near.tsx`, `app/api/near/route.ts` | `/` → โปรไฟล์ | `POST /api/near` (`profile`, `hide`, `unblock`) | `profiles`, `blocks`, `verification` | Profile form, hide-discovery button, device notification toggle, blocked-user list | Notification API, localStorage | Edits name/gender/bio/interests; a name change invalidates verification; disables location; manages blocked users | Add profile settings plus existing ChatGun account deletion/session controls | **Partially migrated** | ChatGun has account/session/deletion controls but no NEAR profile, discovery, notification, or block settings. |
| Profile and gallery photo management | `app/photos/page.tsx`, `app/upload-photos.tsx`, `app/optimize-photo.ts`, `app/api/gallery/route.ts`, `app/api/gallery/file/route.ts`, `lib/private-image.ts` | `/photos` | `GET/POST /api/gallery`, `GET /api/gallery/file` | `photos`, `profiles`, `photo_likes`, `photo_comments` | Upload editor, preview, cover selector, 12-photo manager | R2 `BUCKET`, Canvas image optimization, magic-byte checks | Uploads JPG/PNG/WebP up to 8 MB, optimizes client-side, stores privately, chooses a profile photo, deletes photos, caps at 12 | Add isolated ChatGun R2 and additive D1 content schema with authorization and deletion rules | **Blocked** | No ChatGun R2/content binding or reviewed media retention/moderation/deletion policy. |
| Gallery browsing | `app/profile-view.tsx`, `lib/gallery.ts`, `app/api/gallery/route.ts`, `app/api/gallery/file/route.ts` | `/people/:id/gallery`, `/people/:id/gallery/:photoId` | `GET /api/gallery`, `GET /api/gallery/file` | `photos`, `friendships`, `blocks` | Gallery summary, 3-column grid, post viewer, previous/next controls | R2, dynamic routes | Profile owner, discoverable people, and accepted friends can be viewed according to server checks; images are private/no-cache | Add profile-scoped gallery with reviewed audience model | **Blocked** | Same media, discovery, and moderation blockers as photo management. |
| Photo likes | `app/profile-view.tsx`, `app/api/gallery/route.ts` | Gallery post | `POST /api/gallery` (`like`) | `photo_likes`, `photos` | Like button and count | D1 | Authorized viewers can toggle one like per photo/user | Add content interaction table with idempotent toggle and deletion cascade | **Missing** | No destination content tables or endpoint. |
| Photo comments | `app/profile-view.tsx`, `app/api/gallery/route.ts` | Gallery post | `POST /api/gallery` (`comment`) | `photo_comments`, `photos`, `profiles`, `friendships` | Comment composer/list | D1 | Authorized viewers can comment; only owner and accepted friends receive comment bodies; 500-character limit | Add comment model with moderation, audience, retention, and deletion rules | **Blocked** | PR #5 launch gate requires content reporting/moderation and a deletion/anonymization rule before activation. |
| Friend requests | `app/near.tsx`, `app/profile-view.tsx`, `app/people-actions.tsx`, `app/api/near/route.ts` | `/` → เพื่อน and profile routes | `POST /api/near` (`request`, `accept`, `reject`, `cancel`) | `friendships`, `blocks`, `profiles` | Incoming badge, request cards, accept/reject/cancel controls | D1 | Mutual-consent relationship workflow prevents duplicates and respects blocks | Add relationship table keyed to ChatGun users; enforce blocks server-side | **Blocked** | Public contact remains disabled pending the approved adult/minor and moderation model. |
| Friend list and unfriend | `app/near.tsx`, `app/profile-view.tsx`, `app/people-actions.tsx`, `app/api/near/route.ts` | `/` → เพื่อน | `GET /api/near`, `POST /api/near` (`unfriend`) | `friendships`, `profiles` | Friend cards, empty state, unfriend confirmation | D1 | Shows accepted friends and removes the relationship on confirmation | Add after relationship model and account-deletion behavior are approved | **Missing** | No destination relationship model. |
| Text messaging | `app/chat.tsx`, `app/near.tsx`, `app/api/chat/route.ts`, `app/api/near/route.ts`, `lib/chat.ts` | `/` → แชท | `GET /api/chat?target=…`, `POST /api/near` (`message`), `POST /api/chat` (`read`, `unsent`) | `messages`, `friendships`, `blocks`, `profiles` | Inbox, thread view, composer, unread counts, pagination, unsend dialog | D1, visible polling | Only accepted/unblocked friends can chat; 2,000-character limit; 50-message pages; read receipts; sender can unsend | Add a relationship-gated ChatGun messaging API with CSRF, abuse controls, retention, deletion, and moderation | **Blocked** | Destination declares unsolicited messaging disabled; no messaging schema or staffed safety operation exists. |
| Chat image upload and reuse | `app/chat.tsx`, `app/optimize-photo.ts`, `app/api/chat/route.ts`, `app/api/chat/file/route.ts`, `lib/chat.ts`, `lib/private-image.ts` | Chat thread and image library | `GET/POST /api/chat`, `GET /api/chat/file` | `chat_assets`, `messages`, `friendships`, `blocks` | Upload picker, five-image library, forward flow, unavailable-image state | R2, Canvas, magic-byte checks | Stores up to five recent images per owner; can resend/forward accessible images; older binary is removed and messages degrade safely | Add only with isolated R2, access-control tests, scanning/moderation policy, and message deletion design | **Blocked** | No destination R2/content policy; media safety requirements unresolved. |
| Unread polling and device notifications | `app/near.tsx`, `app/chat.tsx`, `app/visible-poll.ts` | App shell and chat | `GET /api/near`, `GET /api/chat` | `messages` | Badges, toast, profile notification toggle | Page Visibility API, Notification API, localStorage | Polls visible pages, displays unread badges/toasts, and optionally uses device notifications | Preserve polling semantics initially or replace with an approved event design | **Missing** | ChatGun has no messaging or notification model. |
| Nearby ratings and private reviews | `app/near.tsx`, `app/profile-view.tsx`, `lib/near.ts`, `app/api/near/route.ts` | Discovery/profile; `/` → ความคิดเห็น | `POST /api/near` (`rate`), `GET /api/near` | `ratings`, `profiles` | Five-star dialog, private review list | Geolocation, D1 | Allows one rating per target/day only when both fresh locations are within 100 m and accuracy is at most 50 m; comments are visible only to the recipient | Add only after legal/privacy review of proximity proof, abuse/appeal handling, and retention | **Blocked** | No destination ratings schema; precise-location and moderation decisions unresolved. |
| Blocking | `app/people-actions.tsx`, `app/profile-view.tsx`, `app/near.tsx`, `app/api/near/route.ts`, `lib/chat.ts`, `lib/gallery.ts` | Profiles, gallery, profile settings | `POST /api/near` (`block`, `unblock`) | `blocks`, `friendships`, `messages`, `profiles` | Block confirmation, blocked-user list | D1 | A server-side block removes users from discovery/gallery/contact and prevents chat; users can later unblock | Add as a cross-cutting authorization primitive before discovery or messaging activates | **Blocked** | Safety design requires this, but destination has no social authorization model yet. |
| Reporting | `app/people-actions.tsx`, `app/chat.tsx`, `app/api/near/route.ts`, `app/api/chat/route.ts` | Profiles/gallery and Admin chat view | `POST /api/near` (`report`), `GET /api/chat?reports=1`, `POST /api/chat` (`review-report`) | `reports`, `profiles` | Report dialog, Admin report queue/review action | D1, admin email allowlist | Captures a reason, hides reporter identity from the reported user, and lets the configured admin mark reports reviewed | Replace single-email admin gate with roles/audit; add categories, evidence rules, escalation, appeals, and staffing | **Blocked** | PR #5 identifies moderation staffing/runbooks as launch blockers. |
| Admin message audit | `app/chat.tsx`, `app/api/chat/route.ts` | Admin subview in chat | `GET /api/chat?admin=1` | `messages`, `chat_assets`, `profiles` | Paginated audit list and images | D1, R2, admin email allowlist | Configured admin can inspect recent messages, including unsent records, and related images | Redesign around least privilege, purpose logging, access audit, retention, and incident workflow | **Blocked** | Existing destination has no moderation role or audit policy; direct migration would be over-broad. |
| Identity verification badge | `app/verify.tsx`, `app/profile-view.tsx`, `app/api/verification/route.ts`, `app/api/verification/file/route.ts` | Profile verification panel and profile badge | `GET/POST /api/verification`, `GET /api/verification/file` | `verification`, `profiles` | Evidence upload, consent, pending/rejected/approved states, badge explanation, Admin review | R2, admin email allowlist, image validation | User submits ID/selfie; admin compares name/face; evidence is private and deleted after decision; name change revokes badge | Do not copy as-is; conduct necessity, biometric/ID handling, operator access, retention, and lawful-basis review before choosing an assurance provider | **Blocked** | ChatGun has no verification storage/binding; NEAR’s manual workflow involves high-risk identity evidence. |
| Offline and API recovery UX | `app/api-client.ts`, `app/api-recovery.tsx`, `app/near.tsx` | Global | Applies to all API calls | None | Offline banner, API issue state, retry guidance | `navigator.onLine`, custom browser events | Detects offline/API failure and prevents stale live-mode assumptions | Port generic recovery behavior into the future ChatGun application shell | **Missing** | No equivalent social-app shell exists. |
| Responsive and accessible interaction behavior | `app/globals.css`, all app components, `components/ui/*`, `hooks/use-mobile.ts` | All pages | None | None | Desktop shell, mobile bottom nav, dialogs, focus states, keyboard-safe chat, reduced-motion mode | Base UI/Radix, shadcn, Tailwind, Lucide | Responsive breakpoints at 1400/1100/700/360 px; focus-visible styles; ARIA labels; visual viewport handling; reduced-motion support | Preserve behavior while changing only the `near` wordmark/logo to approved ChatGun branding | **Missing** | Current ChatGun signup is responsive but does not implement NEAR application layouts. |
| Account deletion (destination-required integration) | No NEAR account-deletion workflow exists | None | None | None | None | None | Not implemented in NEAR | Preserve PR #5 authenticated, recent-auth, CSRF- and replay-protected deletion flow; extend it transactionally to migrated social content and R2 objects | **Partially migrated** | PR #5 tests auth-data deletion, retry, replay, and concurrency; its documentation explicitly blocks activation once social content tables exist without deletion rules. |

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
8. The requested 18+ gate is not present in NEAR or ChatGun. It is a launch blocker until the threshold and assurance model receive owner and qualified Thai legal approval.

## Inventory conclusion

- Original NEAR source: **identified confidently**.
- Last stable implementation: **Sites version 91 / commit `98bb83e`**, active and successfully published.
- NEAR non-game product features inventoried: **26**, plus **1** destination-required account-deletion integration row.
- Migrated and verified: **0** (the destination authentication/privacy foundation is not yet a verified migration of a NEAR feature).
- Partially migrated: **3** (authentication/session foundation, profile/privacy settings foundation, and account deletion).
- Missing: **7**.
- Blocked: **17**.
- Excluded game areas: **11 groups**, covering all current game UI, logic, APIs, tables, assets, dependencies, and tests.
- Verified migration completion: **0%** of non-game NEAR features. This percentage intentionally counts only fully migrated and evidenced features.

Production activation remains blocked until the data model, 18+ age-assurance, social safety/moderation, location, media, and content-deletion decisions are approved. Development may proceed only behind fail-closed flags on isolated staging data. The next safe engineering step is an additive architecture/migration plan that maps ChatGun `users.id` to new non-game social tables while preserving PR #3/#5 security controls.
