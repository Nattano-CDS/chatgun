# NEAR → ChatGun migration validation

Date: 2026-10-16 (Asia/Bangkok)  
Branch: `codex/near-migration`  
Scope: isolated Preview and `chatgun-auth-staging` only

## Safety boundary

- Cloudflare account confirmed before mutation: `23017b53386fb67fc62a52cdd017454c` (ChatGun).
- No PiggyPrice or NEAR Cloudflare resource was accessed or modified.
- No ChatGun Production deployment, D1 migration, user-data mutation, PR merge, or legal publication occurred.
- Preview branch alias: `https://codex-near-migration.chatgun.pages.dev`. Exact immutable validation URLs are recorded in PR #6 because each documentation-only deployment receives a new identifier.
- All social, demo, registration, media, moderation, verification, email-OTP, and mobile-OTP capabilities are disabled in the deployed environment.

## D1 result

Before the social migrations, staging contained the existing authentication/privacy tables and three users. Applied remotely to D1 `chatgun-auth-staging` only:

1. `0003_social.sql`
2. `0004_moderation_audit.sql`

Post-migration checks:

- pending staging migrations: none;
- preserved staging users: 3;
- member profiles/media/audit rows created by migration: 0;
- `PRAGMA foreign_key_check`: no violations;
- Production remains read-only with `0002_privacy_safety.sql`, `0003_social.sql`, and `0004_moderation_audit.sql` pending.

## Automated evidence

| Suite | Result | Coverage summary |
| --- | --- | --- |
| Node unit/integration | 49 passed, 0 failed | OAuth/OTP regressions; flags; CSRF; rate limits; D1 migration/idempotency; retention; deletion retry/concurrency; discovery privacy; stable message cursors and private inbox previews; blocking; reports; ratings; gallery/R2 mock; private received-image forwarding; moderator media/purpose auditing; verification evidence lifecycle |
| Complete deployed-Preview Playwright suite | 21 passed, 1 intentional skip | Signup and Turnstile; legal/account regressions; desktop/mobile social shell; chat preview/safety guidance; deep profile routes and browser history; fail-closed screen; IndexedDB demo; explicit game absence; purpose-gated moderator queue; untrusted report markup rendered as text |
| Real Preview HTTP | passed | `/app/` 200/no-store/noindex; same-origin geolocation policy; `/api/social/config` all false; disabled social API returns 404 `feature_disabled` |
| Preview D1 | passed | Migrations applied only to staging and foreign keys verified |

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

1. **R2 not enabled:** Cloudflare API returns code `10042`. Enable R2 for the ChatGun account before creating `chatgun-media-staging`, adding the Preview `MEDIA` binding, or deploying the cleanup Worker.
2. **Adult-only decision:** owner and qualified Thai legal review must approve the threshold, notice text/version, assurance strength, correction/appeal, and anti-evasion process. Do not set `ADULT_NOTICE_VERSION` or activate onboarding before approval.
3. **Moderation operation:** designate trained role holders, approve access/retention/escalation/appeal runbooks, and validate restricted moderator tooling.
4. **Location/media policy:** approve location retention/visibility and media moderation/scanning/deletion operations.
5. **Identity verification:** requires an explicit necessity/lawful-basis decision, approved notice, reviewer process, incident response, and R2. Keep disabled unless separately approved.
6. **Authenticated live E2E:** use authorized test accounts only after the above gates allow Preview activation; then verify real D1 rows, sessions, logout, linking, deletion, and R2 cleanup.

## Assessment

- Code foundation for isolated staging: **GO**.
- Public social-feature activation: **NO-GO**.
- Production migration/deployment: **NO-GO**.
