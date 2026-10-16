# NEAR → ChatGun migration validation

Date: 2026-10-16 (Asia/Bangkok)  
Branch: `codex/near-migration`  
Scope: isolated Preview and `chatgun-auth-staging` only

## Safety boundary

- Cloudflare account confirmed before mutation: `23017b53386fb67fc62a52cdd017454c` (ChatGun).
- No PiggyPrice or NEAR Cloudflare resource was accessed or modified.
- No ChatGun Production deployment, D1 migration, user-data mutation, PR merge, or legal publication occurred. Only clearly prefixed synthetic rows were created or replaced in staging.
- Validated immutable Preview: `https://3e548a7a.chatgun.pages.dev`.
- Preview enables the social shell, discovery, friend requests, messaging, ratings, and private gallery/chat media for synthetic authenticated members. Registration, adult onboarding, moderation tools, identity verification, Demo, Game, email OTP, and mobile OTP remain disabled. Production has no `MEDIA` binding and keeps media and every social capability disabled.
- R2 bucket `chatgun-media-staging` and Worker `chatgun-media-cleanup-staging` are staging-only. No custom domain or public R2 development URL was enabled.

## D1 result

Before the social migrations, staging contained the existing authentication/privacy tables and three users. Applied remotely to D1 `chatgun-auth-staging` only:

1. `0003_social.sql`
2. `0004_moderation_audit.sql`
3. `0005_trust_safety.sql`
4. `0006_media_review_concurrency.sql`

Post-migration checks:

- pending staging migrations: none;
- preserved staging users: 3;
- member profiles/media/audit rows created by migration: 0;
- `PRAGMA foreign_key_check`: no violations;
- live tests used only three `cg-stage-*` users and then reset them; final state is 3 users/profiles, 0 social-media rows, 0 pending media deletions, and no foreign-key violations;
- Production remains read-only with `0002_privacy_safety.sql` through
  `0006_media_review_concurrency.sql` pending.

## Automated evidence

| Suite | Result | Coverage summary |
| --- | --- | --- |
| Node unit/integration | 57 passed, 0 failed | Prior auth/social/privacy regressions plus Bangkok birthday boundaries, under-age rejection, coarse location disclosure, anti-probing limits, media quarantine/release authorization/audit, image validation, and deletion transitions |
| Complete deployed-Preview Playwright suite | 30 passed, 0 failed, 4 intentional project-specific skips | Real Pages/D1/R2 API flows plus desktop/mobile rendering, baseline auth/legal/social/moderation regressions, offline recovery, Demo isolation, and Game absence |
| Live Pages/API flow | passed | Existing non-media flows plus gallery/chat upload and download; owner/friend/stranger/anonymous authorization; selection, like, comment, delete; block revocation; MIME spoof rejection; metadata removal; account deletion |
| Real Preview HTTP | passed | `/app/` 200/no-store/noindex; same-origin geolocation; private-media flag true only in Preview; registration/moderation/verification/Demo/Game/OTP false |
| Preview D1/R2 | passed | `DB → chatgun-auth-staging`; `MEDIA → chatgun-media-staging`; scheduled queue drain completed all synthetic object operations; final bucket size/object count and D1 media/pending counts are zero; foreign keys clean |

Playwright screenshots are generated locally under `test-results/artifacts/` for desktop and mobile. They are test artifacts, not Production assets.

## Security properties verified in code/tests

- ChatGun sessions, exact-origin CSRF, rate limits, active-account checks, recent-auth checks, and Thai safe errors are reused.
- Discovery never returns raw latitude/longitude and requires fresh, accurate presence.
- Discovery returns only 100 m distance bands, hides accuracy/time from other members, and
  limits each user to 60 reads per ten minutes to reduce repeated-query inference.
- Browser geolocation permission loss clears the active watch, requests server-side location hiding, and immediately removes local discovery state; visible-session recovery refreshes stale presence.
- Blocking is enforced across discovery, profiles, galleries, friendships, messages, ratings, and media.
- Gallery comment bodies are returned only to the profile owner or accepted friends.
- Private media uses authorization checks plus `private, no-store`, `nosniff`, restrictive CSP, random object keys, structural byte validation, exact MIME matching, 8 MB/4,096 px/16 MP bounds, client resizing, and server-side EXIF/text/profile metadata removal.
- A quarantine table and separate audit trail now fail closed when enabled: pending media is
  unavailable to normal endpoints, and only a purpose-logged `safety_admin` can view/release
  or reject it. Synthetic Preview retains a named bypass; Production media remains disabled.
- Received chat images appear in the five-item reuse library only while an accepted, unblocked relationship grants access. Access is revoked when that relationship ends; forwarding creates a new relationship-gated message rather than making an object public.
- Moderation requires a D1 role, feature flag, explicit access purpose, and audit event. Decisions and their audit records are transactional.
- The restricted moderator console percent-encodes non-Latin access purposes for transport, records the decoded purpose, renders report/message data with `textContent`, and retrieves sensitive images through private purpose-audited endpoints.
- Verification evidence is never public, requires recent auth and explicit consent, and enters the deletion queue immediately after a decision. The feature remains disabled.
- Account deletion revokes access immediately, cascades social rows, queues object deletion, and does not claim binary deletion while work is pending. Live synthetic deletion and scheduled queue completion passed.
- No game table, API, navigation destination, asset pack, or dependency was migrated.

## Remaining blockers

1. **Adult-only decision:** owner and qualified Thai legal review must approve the threshold, notice text/version, assurance strength, correction/appeal, and anti-evasion process. Do not set `ADULT_NOTICE_VERSION` or activate onboarding before approval.
2. **Moderation operation:** designate trained role holders and approve media/report/message access, scanning, escalation, takedown, appeal, and incident runbooks. Media is technically verified in isolated staging but remains public-launch gated.
3. **Location/media policy:** approve location retention/visibility and media/content retention rules; confirm whether a malware/content-safety scanning provider is required before public uploads.
4. **Identity verification:** requires an explicit necessity/lawful-basis decision, approved notice, reviewer process, and incident response. Keep disabled.
5. **Provider/public E2E:** real Google/Facebook/LINE login, linking, and logout still require approved public-provider test identities and publishing status.

## Assessment

- Isolated private-media staging: **GO**.
- Public social-feature activation: **NO-GO**.
- Production migration/deployment: **NO-GO**.
