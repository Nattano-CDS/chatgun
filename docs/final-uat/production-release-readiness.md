# Production release readiness

Final classification: **PARTIAL UAT — SPECIFIC EXTERNAL GATES REMAIN**

Production deployment is **not authorized**. Draft PR #17 must not be merged automatically.

## Release identity and current evidence

| Item | Result |
|---|---|
| PR #17 engineering HEAD at execution start | `9c8689566b78f87952e38d7be3504b5a9e419451` (Draft, mergeable) |
| Latest GitHub CI at execution start | SUCCESS, run `40110238957`, exact engineering HEAD |
| Frozen/tested UAT application | `4a7dee32c52bc474ee3cc50d13e293e66e771c1a` |
| Current Production | `a73ff21c615dabb6a0c19c0a22685c2370958ca1` |
| Local regression | 248 pass, 0 fail, 0 skip |
| Live closed-UAT security | 17 pass, 0 fail |
| Genuine human UAT | 0 pass; 50 blocked/not executed |
| Open P0/P1 engineering defects | 0 / 0 |

## Technical boundary verification

- Cloudflare account is `23017b53386fb67fc62a52cdd017454c`.
- Dedicated UAT D1 `e3cb426c-b88a-4b93-90fd-39df524f68ae` is schema 21, FK0, and contains zero users, identities, sessions, invitations, media or grants.
- Dedicated R2 `chatgun-final-uat-media` has r2.dev disabled and no custom public domain.
- UAT privacy and media cleanup Workers retain exact UAT bindings and private endpoints. Their first scheduled execution is still not evidenced.
- Google, Facebook, LINE, Turnstile and Access verifier metadata are configured as dedicated Preview values. No Production credentials were reused.
- Production remained on the verified deployment SHA and received zero writes from this workstream.

## Owner approval package for expanded UAT

The following identifiers are the exact proposed expanded-UAT acceptance versions. They are **proposals only** and must not be activated or represented as approved until the owner explicitly approves the scope:

| Record | Proposed version | Artifact SHA-256 |
|---|---|---|
| Adult/Social UAT notice | `adult-social-uat-2026-10-28-rc1` | `e01da689a1d91bbcc994f47eb734a191852fb2f162db0d19025bdab4fb4bb394` (`beta-notice.html`) |
| Terms | `terms-social-uat-2026-10-28-rc1` | `7b381aaed9ab52f0033a7aec0d2ec4c3951317ad52ed23acc981ff0bc7717dc3` |
| Privacy | `privacy-social-uat-2026-10-28-rc1` | `be5d8578da6a3e3fd0d6180a37fdde7667565d719b35ec880ffe6105d703f48b` |
| Deletion procedure | `deletion-social-uat-2026-10-28-rc1` | `b55216f2b9853d70476484042644896431e9abdbe9daecd9d641bd7e2105d4e4` |

Approval must explicitly cover: adults only; two distinct consenting participants; approximate location/distance disclosure and residual inference; direct chat; public and private galleries; quarantine and manual review; reports, blocks, appeals and emergency closure; disposable test content; account/session deletion; and operating coverage.

Proposed operating decisions:

1. Run one coordinated campaign only within 19:00–22:00 Asia/Bangkok while the owner is actively moderating. No 24/7 service, response SLA, scanner or backup moderator is claimed.
2. Keep public registration, youth admission, ages 18–19 pending the existing eligibility decision, Sensitive content, email/mobile OTP, demo/game and identity-document collection off.
3. Keep real media uploads off unless a distinct eligible appeal reviewer is named. If none is named, execute Authentication/Admin/Social/Privacy groups only and retain Media as BLOCKED.
4. Admit only approved A and B through separate 30-minute, single-use, SHA-256-hashed invitations delivered privately through URL fragments. Never log or publish tokens.
5. Preserve the genuine owner's account. Delete only an explicitly disposable Participant B account during the approved lifecycle case. Retain minimum audit evidence; do not promise erasure from Cloudflare recovery systems beyond documented capability.
6. On an authorization, privacy, media, provider or moderation failure, close the affected UAT flags, revoke only approved UAT sessions/grants, preserve sanitized evidence and investigate. Do not restore or roll back D1 destructively without separate approval.

## Staged UAT flags

Current Stage 0 remains closed. The following is a proposal, not authorization:

| Stage | Enable | Keep off |
|---|---|---|
| 1 — identity | `OAUTH_LOGIN_ENABLED`, provider allowlist for the specifically approved participant providers, invitation registration, acceptance, adult onboarding | public registration, discovery, messaging, presence, ratings, media upload, Sensitive, OTP, demo |
| 2 — two-person Social | discovery, messaging, presence, ratings after both accounts finish acceptance/onboarding | media upload, Sensitive, public registration, youth |
| 3 — moderated media | media upload with quarantine, moderation tools and exact bounded roles only after reviewer/coverage approval | Sensitive, public registration, youth, OTP, demo |

Every stage requires live config read-back, D1 count/integrity checks and negative authorization regression before proceeding. Production flags remain unchanged.

## Production release gate

Before a production candidate can be recommended for approval:

- Complete all 50 genuine-human scenarios or explicitly remove an unapproved feature from release scope; record actual PASS/FAIL/BLOCKED results.
- Run genuine Google/Facebook/LINE coverage agreed for the release, real Turnstile, owner Access TOTP, fresh-auth, least-privilege role expiry and ordinary-user denial.
- Resolve any P0/P1 found, add regression coverage, deploy the exact fix to isolated UAT and rerun affected journeys plus security regression.
- Obtain a fresh Production D1 backup/recovery point and verify schema compatibility. Rehearse/apply migrations 18–21 only if the chosen production release requires them; never replay raw `ALTER` blindly or restore destructively without separate approval.
- Reconfirm private Production R2, exact OAuth callbacks/credentials, moderation staffing, monitoring thresholds, request usage and rollback package.
- Require completed CI on the exact release SHA and confirm the tested artifact matches that SHA.

## Proposed restricted Production rollout after a full UAT pass

Start invitation-only with the smallest approved adult cohort and a single approved provider. Keep public registration, public discovery, direct chat, presence, media upload, youth and Sensitive content off for the first production wave. Add Social, then media, only through separate observed gates during moderation coverage. Stop on auth/privacy leakage, unauthorized media access, error/usage threshold breach or moderation backlog.

Rollback is flag-first and artifact-first: close admission/affected features, preserve D1/R2, restore the last verified frontend artifact if needed, and verify SHA, APIs, flags, FK integrity and private storage. Database restore remains a separately authorized incident action.

## Remaining human decisions/actions — consolidated

1. Privately confirm Participant A's authorized UAT provider identity and Participant B as a distinct consenting eligible adult, including media/deletion consent.
2. Explicitly approve or reject the exact expanded-UAT versions and operating decisions above, and choose a window within 19:00–22:00 Asia/Bangkok.
3. If media is in scope, name an eligible independent appeal reviewer; otherwise confirm media remains off and BLOCKED.
4. After A authenticates, approve the exact genuine UAT UUID and a maximum-eight-hour `report_reviewer` + `safety_admin` grant before it is executed.
5. Personally complete OAuth, Turnstile, provider consent and protected Access TOTP during the single coordinated campaign. No authenticator re-enrollment is requested.
