# ChatGun — consolidated restoration and gated canary

Owner scope: PR #8 comments [6222016662](https://github.com/Nattano-CDS/chatgun/pull/8#issuecomment-6222016662) and [6221959824](https://github.com/Nattano-CDS/chatgun/pull/8#issuecomment-6221959824).

Open [the complete screenshot package](index.html). It groups all restored surfaces at 390, 768 and 1440px alongside the existing canonical NEAR v91 reference captures. Earlier before/after evidence remains in [Phase 1](../visual-audit/phase1-restoration.md) and [Phase 2](../visual-audit/phase2-restoration.md).

## Product behavior

The public canary opens directly into Discovery with an explicit Thai fictional-demo notice. It contains 20 fictional adult Thai profiles and project-owned portrait assets, 10 friendships, five requests, 10 conversations with 120 Thai messages, galleries with comments/reactions, 15 private review examples, unread counts and notifications. Friend actions, text/image chat, profile editing, gallery interactions, reporting and ratings are simulated inside one browser. The demo does not create provider identities, real friendships, live reports, real messages or user-location records.

The fixture is versioned as `chatgun-browser-demo-v1`. The separately retained staging batch remains `chatgun-owner-review-v1`. Public assets are built from an explicit fictional manifest and local project-owned portraits, never exported from D1/R2. The public build does not contain scripts, docs, credentials, test results, session bundles or backups.

The canonical source remains NEAR commit `98bb83e44bf88eddb9822d7875f18cd4fe833ee2`. Shared styling follows its Noto Sans Thai, violet/lime tokens, compact toolbar/fixed navigation, portrait discovery, image-first profile, request cards, inbox/thread, gallery, private reviews, and form composition. ChatGun-only acceptance, deletion, quota and Admin controls use the same visual system. Game is excluded. OAuth controls, explicit legal confirmations, privacy controls and moderation safeguards create intentional differences from NEAR; this is not a claim of literal pixel identity between different security flows.

## Restored and corrected

| Surface | Result |
| --- | --- |
| Discovery | Populated portrait grid, responsive filters, explicit fictional distance labels |
| Login | Compact centered auth; Preview Google/Facebook/LINE and Turnstile hooks preserved |
| Acceptance/onboarding | Matching auth composition; initially unchecked confirmations; original server state machine |
| Member profile | Full-height portrait, interests, actions, private gallery; reload/history supported |
| Friends | Compact request/friend cards, positive heading spacing, no negative subtitle overlap |
| Chat | Portrait inbox, unread counters, bounded message scrolling, composer above fixed navigation and keyboard |
| Gallery | Three-column grid, full-screen post, comments/reactions, image selection/deletion controls |
| Reviews/notifications | Recipient-private review layout, ratings, readable notification cards |
| Account/deletion | Noto Sans Thai auth shell, linking/reauthentication/deletion/logout preserved; external CSP-compatible stylesheet |
| Admin | Responsive overview, coverage/workload, queues, reasons, protected evidence; RBAC remains authoritative |
| Legal drafts | Consistent staging-only visual styling; Production build substitutes a factual demo notice for unapproved policies |

Functional corrections include asynchronous form reset handling (reports, ratings, appeals and verification), truthful demo report confirmations, persistent demo message history, unread updates, independent local upload counters and Bangkok-day reset. Proximity ratings can be initiated without treating rounded distance as an eligibility decision; the backend still enforces fresh location, actual 100m proximity, daily limits and privacy protections.

## Production gates and isolation

| Gate | Evidence |
| --- | --- |
| Account | `23017b53386fb67fc62a52cdd017454c`, reverified with Wrangler |
| Domain | `chatgun.social` Active; HTTPS verified |
| Production D1 | `chatgun-auth`, `9738a051-d914-42d0-8e7b-8098ef2b959d` |
| Preview D1/R2 | `chatgun-auth-staging` / `chatgun-media-staging`, separate from Production |
| Schema | Production 0001–0012 present; no pending migrations; zero FK violations; `quick_check=ok` |
| Data preservation | Production users/identities/sessions/media/seed batches are all zero before/after the schema change |
| Recovery | Protected preflight SQL export and Time Travel bookmark under the operator-only private release directory; backup restored and all eleven pending migrations rehearsed in an isolated SQLite database |
| Turnstile | Dedicated Production managed widget allows `chatgun.social`; separate Preview widget retained |
| Credentials | Production provider, Turnstile and pepper secret entries present; values never included in the review package |
| Media | Production R2 remains unbound and live uploads disabled |
| Public access | Browser demo only; live social, public/invitation registration, Sensitive Content, OTP and identity verification disabled |
| Authentication | Production OAuth initiation/callbacks explicitly unavailable pending independent provider/callback/legal verification; Preview behavior retained |
| Legal | Unapproved policies are not shipped as approved Production documents; a factual demo-only notice is served instead |

Backup SHA-256: `8fd58fe2f51f54f7b2551190ccecee33515aeafc824762067e15d0e603354d4e`.

The rollback code tag is `chatgun-pre-canary-20261017`, pointing to `d135049a2c5a8ede84aeb36e0feb57e846ff1a24`. The previous successful Production Pages deployment is `b667dbdc-0823-4dbb-93ce-ebd75ad8b569`. Its availability was verified read-only. Application rollback does not require dropping the additive schema. Restoring the database is destructive and is reserved for an independently authorized incident after assessing later writes. No destructive rollback rehearsal was performed on Production.

## Regression evidence

- Unit/integration/security: 95 passing tests, including OAuth state/PKCE/nonce, CSRF, account linking, account state, deletion/retry/concurrency, quotas, private media, quarantine, RBAC, retention, migration compatibility, public build boundary and canary denial.
- Full browser suite: 39 passed, 0 failed, 23 intentional/environment skips. Explicit 390/768/1440 tests run once; duplicate mobile execution is skipped. Existing live mutation/deletion suites are skipped to preserve the existing staging dataset.
- Dedicated authorized read-only staging browser test passed: 10 accepted friendships, five pending requests, 120 persisted messages, 15 reviews, authorized gallery media, anonymous media denial, and real staging profile captures at all three widths.
- Staging integrity verification passed: 20 batch users, 120 messages, 10 accepted/five pending relationships, 33 R2 objects verified by hash/size, two pending media reviews, five user reports, one media report, one appeal, 15 reviews, no fabricated provider identities and zero FK violations. Unrelated users/messages/relationships/media counts were unchanged.
- Browser fixtures used for acceptance, onboarding, account and Admin screenshots are labeled as fixtures. They are not real OAuth or Production Admin proof.
- Production runtime results, exact merged/deployed SHA, public smoke results and final URL are recorded in the final PR #8 release comment and `/release.json`; no deployment is claimed solely from a build or test pass.

## Historical Preview artifact containment

The audit identified 21 superseded ChatGun Preview deployments containing old synthetic test-session bundles. Those deployment artifacts were removed; no staging users, content, R2 objects or provider configuration was deleted. Six sessions belonging to verified synthetic accounts with no provider identities were revoked. Three replacement fixture sessions have no manufactured recent-authentication evidence. The revoked session returns 401; the replacement returns 200 for ordinary authenticated access. Current builds publish an explicit asset allowlist and cannot ship test bundles. Availability of a historical public artifact is not evidence that no one accessed it; no such assurance is made.

## Remaining gates for genuine owner/live social use

1. Independently confirm Production Google, Facebook and LINE applications, publishing/tester eligibility and exact callbacks `https://chatgun.social/api/auth/oauth/{provider}/callback`. Stored secret presence does not establish callback registration or provider approval. No Production provider E2E pass is claimed.
2. Complete owner/qualified Thai legal approval for Terms, Privacy, deletion, adult assurance, location processing and retention before enabling actual registration/acceptance. Self-declared 18+ is not verified age.
3. Identify and authenticate the genuine Production owner account, obtain exact account confirmation before assigning narrowly scoped Admin roles, and test real access. Production currently has no users; no fabricated identity or privilege grant was introduced.
4. Establish a private Production media bucket, dedicated binding, cleanup Worker and authorized quarantine/deletion tests before enabling live media. Staging storage must not be reused.
5. Confirm emergency escalation, backup moderation, appeals handling, support intake and media-scanning decisions. The owner is primary; coverage is daily 19:00–22:00 Asia/Bangkok, without guaranteed immediate response outside those hours.

Assessment: GO for the protected fictional-demo canary once live smoke checks pass. NO-GO for public registration, Sensitive Content or a real-user social launch. The public canary and the restricted live service have separate readiness conclusions.

## Selective cleanup — prepare only

Nothing in this workstream schedules dataset expiry or runs cleanup. The existing staging cleanup script still requires its dry-run/explicit batch confirmation and must target only `chatgun-owner-review-v1`. Browser-demo cleanup, when the owner requests it, should delete only key `chatgun-browser-demo-v1` in the `state` store of IndexedDB `chatgun-demo`; it must not clear other databases, cookies or live accounts. Public fixture assets can be removed only by an approved code release scoped to `assets/demo/`. Normal authentication-session expiration does not delete either fixture dataset.
