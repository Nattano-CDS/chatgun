# NEAR to ChatGun migration architecture

Status: implementation design for isolated staging. This document does not authorize Production activation or data copying.

## Chosen migration shape

ChatGun remains a Cloudflare Pages project with its existing Pages Functions authentication backend. The NEAR non-game React experience will be ported component-by-component into a dedicated client application under `/app/`, retaining NEAR v91 markup, interaction behavior, responsive layouts, and design tokens. This avoids moving ChatGun authentication into the Sites-specific SIWC runtime and avoids copying NEAR's game Worker, game schema, or game assets.

The browser application will call new Pages Functions under `/api/social/*`. Every mutation will use the existing ChatGun session, exact-origin validation, CSRF cookie/header, input validation, scoped rate limits, and safe error/logging conventions. Provider identities remain solely in the existing `users`, `identities`, and `sessions` model.

## Fail-closed capabilities

All new capability checks are server-side. UI hiding is secondary.

| Variable | Default | Controls |
| --- | --- | --- |
| `SOCIAL_APP_ENABLED` | `false` | Read access to the migrated application shell |
| `ADULT_ONBOARDING_ENABLED` | `false` | 18+ declaration and member-profile creation |
| `PUBLIC_DISCOVERY_ENABLED` | `false` | Presence publication and nearby discovery |
| `FRIEND_REQUESTS_ENABLED` | `false` | Relationship requests and decisions |
| `MESSAGING_ENABLED` | `false` | Text/image messaging and unread state |
| `MEDIA_UPLOAD_ENABLED` | `false` | Gallery and chat R2 writes |
| `RATINGS_ENABLED` | `false` | Proximity ratings/private reviews |
| `IDENTITY_VERIFICATION_ENABLED` | `false` | Any ID/selfie verification workflow |
| `MODERATION_TOOLS_ENABLED` | `false` | Role- and purpose-gated report, message-audit, and identity-review endpoints |
| `DEMO_MODE_ENABLED` | `false` | Synthetic browser-only IndexedDB demo; never reads or writes D1/R2 |

The existing `NEW_ACCOUNT_REGISTRATION_ENABLED`, `EMAIL_OTP_ENABLED`, and `MOBILE_OTP_ENABLED` controls remain authoritative. Email and mobile OTP remain disabled.

## Identity and onboarding

`users.id` is the only ChatGun account key. A social profile has a one-to-one foreign key to it. NEAR SIWC IDs are not imported or inferred.

The requested 18+ gate is designed as a versioned adult declaration, not an assertion of legal sufficiency:

1. authenticate with an approved social provider;
2. display the owner/legal-approved adult notice;
3. require an explicit 18+ declaration with CSRF and recent authentication;
4. store an age-band event (`adult_18_plus`), notice version, assurance method, and timestamp without storing a birth date;
5. create the member profile only when both registration and adult onboarding flags are enabled;
6. keep discovery, messaging, media, and ratings independently disabled until their launch gates pass.

Production activation still requires qualified Thai legal review of the threshold, contractual capacity, notice, assurance strength, correction/appeal path, and anti-evasion handling.

## 2026-10-16 staging checkpoint

- The ChatGun Cloudflare account was re-confirmed as `23017b53386fb67fc62a52cdd017454c` before mutation.
- `0003_social.sql` and `0004_moderation_audit.sql` were applied only to D1 `chatgun-auth-staging` (`5bbfd55d-eb22-4324-8a7d-57bef14110ea`). Existing staging users were preserved and the foreign-key check passed.
- The repository default Pages binding now points to staging D1; only `[env.production]` points to `chatgun-auth`. This matches the configuration downloaded read-only from Pages.
- Preview is deployed at `https://codex-near-migration-zjaq.chatgun.pages.dev` with every social capability disabled and `noindex` behavior intact.
- R2 cannot yet be configured: the ChatGun account API returns `10042` and requires R2 enablement in the Cloudflare Dashboard. Media flags and the cleanup Worker must remain undeployed until that action is complete.
- Production migrations `0002`–`0004` remain pending and were not applied.

## Additive D1 model

Proposed tables use explicit foreign keys to `users(id)` and do not modify existing authentication columns.

| Table | Key relationships | Deletion behavior |
| --- | --- | --- |
| `age_assurance_events` | one current event per `user_id`; versioned notice/method | cascade with user; minimized event only |
| `member_profiles` | `user_id` primary/foreign key | cascade; precise presence fields cleared whenever discovery is disabled |
| `relationships` | sender/receiver user IDs; normalized pair uniqueness | cascade when either account is deleted |
| `social_blocks` | blocker/blocked user IDs | cascade when either account is deleted |
| `social_messages` | sender/receiver user IDs; optional media reference | anonymize or delete according to the approved conversation policy; inaccessible immediately on account disable |
| `social_media` | owner user ID, R2 key, purpose, state | row becomes inaccessible in the deletion transaction; R2 key enters bounded deletion queue |
| `profile_photos` | media owner and selected-profile relationship | cascade with owner/media |
| `photo_likes` | photo and user IDs | cascade with photo/user |
| `photo_comments` | photo and sender user IDs | delete or anonymize under approved policy |
| `proximity_ratings` | sender/receiver user IDs and local day | policy decision required for delete vs anonymize |
| `social_reports` | reporter/subject user IDs, category, state | retain only when justified; restricted moderator access and approved expiry |
| `moderation_roles` | user ID and least-privilege role | explicit operator assignment; no email-string admin bypass |
| `media_deletion_queue` | R2 key, random operation ID, retry state | scheduled Worker deletes objects idempotently without logging personal data |

Game tables (`pets`, `pet_mates`, `pet_babies`, `garden_visits`, `garden_actions`, `estate_rooms`, `estate_wardrobes`, and `estate_rewards`) are never added.

## API contracts

NEAR behavior is preserved while routes are namespaced to avoid collisions with authentication.

| ChatGun route | Preserved NEAR behavior |
| --- | --- |
| `GET/POST /api/social/profile` | read/edit profile, privacy state, block list |
| `POST /api/social/onboarding/adult` | recent-authenticated 18+ declaration and profile activation |
| `GET/POST /api/social/discovery` | nearby results; publish/refresh/hide presence |
| `GET/POST /api/social/relationships` | list, request, accept, reject, cancel, unfriend |
| `GET/POST /api/social/messages` | inbox/thread pagination, send, read, unsend |
| `GET /api/social/media/:id` | private authorized R2 response with no-store/nosniff headers |
| `GET/POST /api/social/gallery` | upload, delete, select cover, list, like, comment |
| `GET/POST /api/social/ratings` | proximity eligibility, submit, recipient-private list |
| `POST /api/social/blocks` | block/unblock enforced across every social query |
| `POST /api/social/reports` | categorized report creation |
| `GET/POST /api/social/moderation/*` | role-gated queue and decisions with audit events |

Compatibility adapters in the client may retain NEAR action names during the initial port, but the server contracts above must be typed and tested directly.

## Account deletion integration

The current PR #5 transaction is extended without weakening its claim/replay protection:

1. atomically claim the deletion request;
2. disable the user and revoke every session;
3. remove identities and unpublished presence immediately;
4. apply the approved delete/anonymize action to each social table;
5. mark all owned R2 media inaccessible and enqueue object keys;
6. commit the D1 transaction;
7. let the scheduled Worker delete R2 objects with bounded, idempotent retries;
8. complete a minimized receipt only when the defined completion condition is satisfied.

The UI must not claim complete media deletion while the queue is pending. D1 Time Travel and external backup restore procedures remain operational constraints.

## Design and client migration

- Port NEAR v91 non-game components, not screenshots or static mockups.
- Preserve discovery cards, filters, friend requests, profile/gallery routes, chat inbox/thread states, private reviews, settings controls, empty/error/loading states, and mobile/desktop breakpoints.
- Replace only NEAR brand strings, favicon, and wordmark with approved ChatGun assets/copy.
- Remove the game tab, game query/deep links, game invitation cards, Pig Studio, game CSS/assets, `three`, and every game import.
- Retain shared error recovery, image optimization, visible polling, portrait, dialog, and accessibility behavior.
- Keep feature-disabled screens inaccessible server-side; do not ship clickable placeholders.

## Staging validation sequence

1. Apply additive migration to `chatgun-auth-staging` only and inspect schema/indexes.
2. Bind a dedicated staging R2 bucket; never use NEAR, PiggyPrice, or Production media.
3. Seed synthetic adult test accounts through authorized Preview OAuth identities.
4. Run unit tests for every capability flag, authorization edge, CSRF, rate limit, block, deletion, and R2 queue transition.
5. Run API integration tests against Pages Preview and isolated D1/R2.
6. Run Playwright desktop/mobile parity flows and capture NEAR-v91/ChatGun screenshots.
7. Keep all social activation flags false outside the isolated test environment.
8. Record evidence per row in `near-to-chatgun-feature-matrix.md`; only then change a row to **Migrated and verified**.

## Launch gates

Production remains NO-GO until all of the following are approved and tested: adult-only legal/assurance model; location retention and visibility; media moderation/abuse handling; staffed reporting/escalation/appeal procedures; content deletion/anonymization; R2 deletion operations; D1 restore/deletion replay; final legal notices; provider publishing; and end-to-end evidence for all enabled features.
