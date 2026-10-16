# NEAR → ChatGun migration validation

Date: 2026-10-16 (Asia/Bangkok)  
Branch: `codex/near-migration`  
Scope: isolated Preview and `chatgun-auth-staging` only

## Safety boundary

- Cloudflare account confirmed before mutation: `23017b53386fb67fc62a52cdd017454c` (ChatGun).
- No PiggyPrice or NEAR Cloudflare resource was accessed or modified.
- No ChatGun Production deployment, D1 migration, user-data mutation, PR merge, or legal publication occurred. Only clearly prefixed synthetic rows were created or replaced in staging.
- Preview branch alias: `https://codex-near-migration.chatgun.pages.dev`. Exact immutable validation URLs are recorded in PR #6 because each documentation-only deployment receives a new identifier.
- Preview enables the social shell, discovery, friend requests, text messaging, and ratings only. Registration, adult onboarding, media, moderation tools, identity verification, Demo, Game, email OTP, and mobile OTP remain disabled. The Production configuration keeps every social capability disabled.

## D1 result

Before the social migrations, staging contained the existing authentication/privacy tables and three users. Applied remotely to D1 `chatgun-auth-staging` only:

1. `0003_social.sql`
2. `0004_moderation_audit.sql`

Post-migration checks:

- pending staging migrations: none;
- preserved staging users: 3;
- member profiles/media/audit rows created by migration: 0;
- `PRAGMA foreign_key_check`: no violations;
- synthetic live-test state after validation: 3 users/profiles, 1 accepted relationship, 1 text message, 1 rating, 1 pending report, 0 retained blocks;
- Production remains read-only with `0002_privacy_safety.sql`, `0003_social.sql`, and `0004_moderation_audit.sql` pending.

## Automated evidence

| Suite | Result | Coverage summary |
| --- | --- | --- |
| Node unit/integration | 50 passed, 0 failed | OAuth/OTP regressions; staging/Production flag isolation; CSRF; rate limits; D1 migration/idempotency; retention; deletion retry/concurrency; discovery privacy; stable message cursors and private inbox previews; blocking; reports; ratings; gallery/R2 mock; private received-image forwarding; moderator media/purpose auditing; verification evidence lifecycle |
| Complete deployed-Preview Playwright suite | 28 passed, 2 intentional skips | Baseline auth/legal/social/moderation regressions plus live synthetic-account API/browser flows on desktop/mobile; offline recovery; Demo local media; Game absence. The mobile duplicate mutation test and desktop-only mobile-layout assertion are intentionally skipped. |
| Live Pages/API flow | passed | Accurate/inaccurate location; discovery; profile edit/validation; relationship request/duplicate/accept; accepted-friend and rejected messaging; rating/duplicate; report/category validation; block/unblock; missing-CSRF rejection |
| Real Preview HTTP | passed | `/app/` 200/no-store/noindex; same-origin geolocation policy; enabled safe staging flags; registration/media/moderation/verification/Demo/Game/OTP false |
| Preview D1 | passed | Dashboard and repository both confirm `DB → chatgun-auth-staging`; persisted aggregate counts match the live flow and foreign keys remain clean |

Playwright screenshots are generated locally under `test-results/artifacts/` for desktop and mobile. They are test artifacts, not Production assets.

## Security properties verified in code/tests

- ChatGun sessions, exact-origin CSRF, rate limits, active-account checks, recent-auth checks, and Thai safe errors are reused.
- Discovery never returns raw latitude/longitude and requires fresh, accurate presence.
- Browser geolocation permission loss clears the active watch, requests server-side location hiding, and immediately removes local discovery state; visible-session recovery refreshes stale presence.
- Blocking is enforced across discovery, profiles, galleries, friendships, messages, ratings, and media.
- Gallery comment bodies are returned only to the profile owner or accepted friends.
- Private media uses authorization checks plus `private, no-store`, `nosniff`, restrictive CSP, random object keys, byte-signature validation, and bounded size/count.
- Received chat images appear in the five-item reuse library only while an accepted, unblocked relationship grants access. Access is revoked when that relationship ends; forwarding creates a new relationship-gated message rather than making an object public.
- Moderation requires a D1 role, feature flag, explicit access purpose, and audit event. Decisions and their audit records are transactional.
- The restricted moderator console percent-encodes non-Latin access purposes for transport, records the decoded purpose, renders report/message data with `textContent`, and retrieves sensitive images through private purpose-audited endpoints.
- Verification evidence is never public, requires recent auth and explicit consent, and enters the deletion queue immediately after a decision. The feature remains disabled.
- Account deletion revokes access immediately, cascades social rows, queues object deletion, and does not claim binary deletion while work is pending.
- No game table, API, navigation destination, asset pack, or dependency was migrated.

## Remaining blockers

1. **R2 subscription owner action:** Cloudflare API returns `10042`. The ChatGun dashboard redirects to **R2 Object Storage → Plans** and offers “Add R2 subscription to my account” using the existing card ending `1973`, with `$0.00` due now, free monthly allowances, usage-based overage billing, and automatic renewal. The owner must explicitly approve and complete this billing transaction. After activation: rerun `wrangler r2 bucket list`, create only `chatgun-media-staging`, bind Preview `MEDIA`, keep Production unbound, then run private-media and cleanup E2E before enabling `MEDIA_UPLOAD_ENABLED`.
2. **Adult-only decision:** owner and qualified Thai legal review must approve the threshold, notice text/version, assurance strength, correction/appeal, and anti-evasion process. Do not set `ADULT_NOTICE_VERSION` or activate onboarding before approval.
3. **Moderation operation:** designate trained role holders, approve access/retention/escalation/appeal runbooks, and validate restricted moderator tooling.
4. **Location/media policy:** approve location retention/visibility and media moderation/scanning/deletion operations.
5. **Identity verification:** requires an explicit necessity/lawful-basis decision, approved notice, reviewer process, incident response, and R2. Keep disabled unless separately approved.
6. **Remaining authenticated E2E:** non-media synthetic live flows now pass. Real-provider login/linking/logout and destructive account deletion still require separately authorized test identities; R2 cleanup requires R2 activation.

## Assessment

- Code foundation for isolated staging: **GO**.
- Public social-feature activation: **NO-GO**.
- Production migration/deployment: **NO-GO**.
