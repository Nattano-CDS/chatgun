# Final NEAR migration UAT and Beta readiness

Date: 2026-10-16 (Asia/Bangkok)  
Branch: `codex/near-migration`  
Candidate tested: `bb5b4eeb983d6d7c2c7b73e2649619168967639d`

Stable Preview: `https://codex-near-migration.chatgun.pages.dev`

Exact deployment: `https://cd16a782.chatgun.pages.dev`
Scope: ChatGun Preview, `chatgun-auth-staging`, and `chatgun-media-staging` only

## Release decision

- **Synthetic isolated staging UAT: GO.** The complete automated and browser suite passed,
  live Pages/D1/R2 workflows persisted correctly, negative authorization paths failed
  closed, and all generated media/content residue was removed.
- **Real-user invitation-only Beta: NO-GO.** Real Google, Facebook, and LINE browser E2E now
  passes on the stable Preview. The operator has not confirmed named moderation coverage,
  escalation ownership/hours, approved age-assurance
  treatment, location/media notices, scanning/review capacity, appeal handling, or the Beta
  participation notice.
- **Production: NO-GO.** No Production deployment, migration, data access, or feature
  activation was performed.

## Environment verification

| Check | Actual result |
| --- | --- |
| Git | Local and `origin/codex/near-migration` were clean at the requested candidate before this evidence-only update |
| Pull request | PR #6 open and draft; base `codex/privacy-safety`; Cloudflare Pages check passed; not merged |
| Cloudflare identity | Wrangler 4.151.0 confirmed ChatGun account `23017b53386fb67fc62a52cdd017454c` |
| Preview deployment | Deployment `cd16a782-0cc9-4946-8f5e-bb823ffb4d0f`, source `bb5b4ee`; the stable branch alias served the same current branch head during the final Google/Facebook E2E continuation |
| Preview D1 | `DB` maps to `chatgun-auth-staging` (`5bbfd55d-eb22-4324-8a7d-57bef14110ea`); migrations 0001–0007 applied; none pending |
| Preview R2 | `MEDIA` maps to private `chatgun-media-staging`; final object count 0 and size 0 B |
| Production isolation | Production config keeps registration/Beta/social/media/moderation flags false, binds `DB` to `chatgun-auth`, has no `MEDIA` binding, and was not mutated |

## Exact test accounting

| Layer | Passed | Failed | Skipped/untested | Notes |
| --- | ---: | ---: | ---: | --- |
| Node unit/integration/security | 63 | 0 | 0 | OAuth state/PKCE/nonce, provider token validation, invitations, age gate, CSRF, sessions, rate limits, media validation/quarantine, moderation, deletion, location privacy, social authorization |
| Playwright desktop/mobile | 25 | 0 | 9 | Stable-Preview rerun; eight live-social tests skipped because synthetic session secrets were not loaded, plus one desktop exclusion for the mobile-only assertion |
| Dependency audit | 1 | 0 | 0 | `npm audit --audit-level=high`: 0 vulnerabilities |
| D1 integrity/cleanup | 7 | 0 | 0 | Media, pending/failed deletions, ratings, invitations, and enrollments all zero; foreign-key check empty; R2 zero objects |
| Real provider browser journeys | 3 | 0 | 0 | Google, Facebook, and LINE completed authorization, callback, session creation, authenticated access, logout, and denial/cancellation handling; Google-to-Facebook account linking also passed with a separate authorized identity |

The stable-Preview rerun intentionally omitted the state-mutating live-social tests because its
synthetic session secrets were not supplied. Those four tests were skipped in both projects;
the desktop project also skips the mobile-only navigation assertion. Earlier isolated live D1/R2
evidence remains documented separately and was not re-created with real-provider accounts.

## UAT coverage and parity result

The destination was compared against the 27-row inventory in
`docs/near-to-chatgun-feature-matrix.md` (26 NEAR non-game capabilities plus ChatGun account
deletion). No newly missing non-game behavior was found.

Passed against the live Preview with synthetic accounts:

- invitation-only UI/config and closed public registration;
- server-side Bangkok-date 18+ declaration logic, including under-age/invalid rejection in
  the automated security suite; this is self-declaration, not independent verification;
- profile edit, discovery/filtering, coarse proximity bands, anti-probing rate limits, friend
  request/acceptance, list state, blocking/unblocking, and authorization failures;
- text messages, image messages, read/unread state, inbox notification state, pagination,
  unsend rules, relationship revocation, and offline recovery;
- private gallery upload/read/select/like/comment/delete and private chat-image upload/reuse;
- magic-byte/MIME/dimension/size checks, metadata removal, anonymous/stranger denial, and
  no public R2 URL;
- proximity rating persistence, recipient-only review display, and duplicate-day rejection;
- synthetic reports, category rejection, role/purpose/audit moderation controls, and safe UI
  rendering (moderator operation remains disabled);
- authenticated account deletion, immediate session revocation, queued object deletion,
  retry-safe cleanup, and concurrent-confirmation behavior;
- desktop/mobile responsive shells, deep links, focus/accessibility behavior, and online/offline
  recovery;
- absence of Game routes, navigation, APIs, tables, asset packs, and dependencies. A source
  scan found no game implementation outside documentation/test assertions.

Intentional safety differences from NEAR v91 are not parity defects: ChatGun returns 250 m
distance bands instead of precise metres/100 m filtering, applies anti-inference throttling,
keeps media private/quarantinable, and uses role/purpose-audited moderation.

## Provider E2E evidence

The active Preview client/channel identifiers were matched to the dedicated ChatGun Preview
applications without exposing secrets. Existing callback URLs were preserved and the exact
stable-Preview callback was added to each provider. Google also retains both authorized
JavaScript origins. Meta has Client OAuth Login, Web OAuth Login, HTTPS enforcement, and strict
redirect matching enabled; the stable Preview hostname is present in App Domains. LINE's
callback was added to the actual Preview channel, not the separate Production channel.

| Provider | Success path | Negative path | Persistence/session result |
| --- | --- | --- | --- |
| Google | **PASS** — real account selection returned to `/account` | **PASS** — issued-state denial returned the Thai cancellation message | Existing identity reused; newest session revoked on logout; `/account` redirected to signup afterward |
| Facebook | **PASS** — real provider consent returned to `/account` | **PASS** — provider **Cancel** returned the Thai cancellation message | Existing identity reused; newest session revoked on logout |
| LINE | **PASS** — real **Continue as Nat** login returned to `/account` after Preview secret rotation | **PASS** — issued-state denial returned the Thai cancellation message | Existing identity reused; newest session revoked on logout; `/account` redirected to signup afterward |

Read-only D1 verification after the journeys found six users and four provider identities:
one Facebook identity, one LINE identity, and two Google identities. The Facebook staging user
owns its original Facebook identity plus the separately authorized Google identity; the original
Google-only user remains separate. The `(provider, subject)` primary key has no duplicates,
`PRAGMA foreign_key_check` returned no rows, and invitations/enrollments remained zero. The
session created by the successful link was revoked by logout, and direct `/account` access then
redirected to signup. Invalid callbacks without usable state also failed closed with the Thai
expired-request message. No invitation or new ChatGun user was created.

Live account-linking evidence now covers both directions required for release review. Linking an
already-owned Google identity from the Facebook session was rejected with the Thai
`identity_linked` error and left the Facebook session usable. Linking a distinct authorized
Google identity then returned to the same Facebook-backed ChatGun account and persisted both
providers on that single user. Automated tests separately cover CSRF/session requirements,
duplicate-provider races, and unauthorized cross-user linking.

## Data and cleanup evidence

The live run seeded only the three reserved synthetic members. After UAT, reseeding removed
their social data and queued their generated objects. The staging cleanup Worker reported
`selected=4`, `completed=4`, `failed=0`. Final read-only checks reported:

- `social_media`: 0;
- incomplete `media_deletion_queue` rows: 0;
- failed incomplete deletions: 0;
- `proximity_ratings`: 0;
- `beta_invitations`: 0;
- `beta_enrollments`: 0;
- D1 foreign-key violations: 0;
- R2 objects/bytes: 0 / 0 B.

## Screenshot evidence

Screenshots are local ignored test artifacts and contain only synthetic UI data:

| View | Path | SHA-256 |
| --- | --- | --- |
| Signup desktop | `test-results/screenshots/signup-desktop.png` | `202aa594f2bbc9b21cdf26d7bf46ae001abd11e175031116e8499906be05b809` |
| Signup mobile | `test-results/screenshots/signup-mobile.png` | `e051e24c1ad0128ea1ed4622359be3f0a9c22c79d119ae43cd69b43b462c6630` |
| Social shell desktop | `test-results/artifacts/social-desktop-social-shel-810bc-ws-and-profile-without-game-desktop-chromium/social-desktop.png` | `28f66452fc81217371c01377509570172118ec55f9d593802fa179f08e718dfe` |
| Mobile navigation | `test-results/artifacts/social-mobile-social-shell-48531-vigation-and-remains-usable-mobile-chromium/social-mobile.png` | `ef4c3be6754ea174ad6bb035faec4f492708d5752a75b3edbcc343fb27fad5c1` |

## Owner review checklist (must be explicitly completed)

- [ ] Approve the 18+ eligibility model with qualified Thai legal advice, including whether
  self-declaration is proportionate, correction/appeal, anti-evasion, and minimized evidence.
- [ ] Approve the location notice, 250 m bands, 2-minute expiry, revocation behavior, and
  residual movement/collusion inference risk.
- [ ] Select and validate a media malware/content-safety scanner, or approve a documented
  staffed quarantine-review alternative; do not allow unreviewed real-user uploads.
- [ ] Name a trained moderation primary and backup and provision least-privilege roles.
- [ ] Define coverage hours, response targets, emergency/NCII/threat escalation contacts,
  reviewer wellbeing, and out-of-coverage shutdown criteria.
- [ ] Rehearse report intake, preservation minimization, decisions, notices, appeals, audit
  review, abuse of moderator access, and urgent law-enforcement requests.
- [ ] Approve Privacy Policy, Terms, Data Deletion Policy, Community Guidelines, Location
  Privacy Policy, retention schedule, D1 Time Travel limitation language, and support contact
  after qualified legal review.
- [ ] Approve a plain-language real-user Beta notice covering experimental status, 18+
  eligibility, location inference residual risk, moderation coverage, media review/scanning,
  data retention/deletion limitations, reporting/support, and withdrawal.
- [x] Complete and document Google, Facebook, and LINE success/cancel/logout browser E2E with
  authorized existing staging accounts.
- [ ] Approve the PR dependency/rebase plan and separately authorize any Production migration
  or deployment. This UAT does not grant that authority.

## Remaining blockers

1. Provider publishing/approval status and production callback readiness.
2. Owner/legal approval of adult assurance, location, legal notices, retention, and appeals.
3. Named moderation primary/backup, coverage hours, escalation contacts, access provisioning,
   and rehearsed procedures.
4. Production-grade media scanning or an approved staffed review path; Preview bypass is
   synthetic-only.
5. PR #3/#5 dependency completion and the documented conflict-free rebase sequence.
6. Separately approved Production migrations 0002–0007 and deployment change window.

These blockers are operational and external to the validated synthetic staging workflows;
they must not be represented as completed by passing automated tests.

## OAuth UAT continuation

The stable branch alias `codex-near-migration.chatgun.pages.dev` was verified byte-for-byte
against the Preview deployment built from commit `918fd85`. The first real OAuth attempt then
identified Turnstile error `110200`: the dedicated Preview widget allowed only the earlier
authentication-branch hostname. The stable branch hostname was added without changing the
Production widget.

During the readback, Wrangler unexpectedly emitted the existing Preview widget secret. It was
immediately treated as compromised. A replacement Preview-only managed widget was created for
the two authorized Preview hostnames, both encrypted Preview bindings were replaced without
printing their values, and a new Preview deployment was triggered. The superseded widget must
be removed only after the replacement deployment passes browser and server-side verification.
No Production credential or configuration was changed.

After the replacement deployment became active, Turnstile passed on the stable branch alias.
The exact stable callbacks were then added to the dedicated Preview applications while all
existing Preview/Production entries were preserved:

| Provider | Callback registration | Real E2E result |
| --- | --- | --- |
| Google | Saved and read back with stable Preview origin and callback | **PASS** — login, callback, session, account access, logout, issued-state denial |
| Facebook | Saved and read back with stable callback and App Domain | **PASS** — consent, callback, session, account access, logout, provider Cancel |
| LINE | Saved and read back on the actual Preview channel | **PASS** — login, callback, session, account access, logout, issued-state denial |

The required callbacks are:

- `https://codex-near-migration.chatgun.pages.dev/api/auth/oauth/google/callback`
- `https://codex-near-migration.chatgun.pages.dev/api/auth/oauth/facebook/callback`
- `https://codex-near-migration.chatgun.pages.dev/api/auth/oauth/line/callback`

During the final readback, the LINE Developers accessibility surface unexpectedly exposed the
Preview channel secret. It was immediately treated as compromised. With owner confirmation,
only the dedicated LINE Preview channel secret was rotated and only Cloudflare Pages Preview
`LINE_CLIENT_SECRET` was replaced as an encrypted secret. LINE issued the final replacement a
few minutes after the rotation request; the first redeployment therefore failed the token
exchange closed while the old value was still visible. After the console exposed the final
issued value, the Preview secret was replaced again and deployment
`135cd46a-7834-4f7b-9704-a5939c9401d7` succeeded. No Production or PiggyPrice credential was
read, changed, reused, or deployed.

The post-rotation LINE rerun passed authorization, callback, session creation, authenticated
account access, logout, session invalidation, unauthenticated `/account` redirect, and
issued-state cancellation handling. Read-only D1 checks retained one identity for each provider,
zero invitations, zero enrollments, and no foreign-key violations; the newest LINE session had a
non-null `revoked_at`. The stable-Preview regression rerun again passed 63/63 Node tests and
25/25 executed Playwright tests, with the same 9 intentional skips.

The stable alias served source `bb5b4ee` during the final checks. The first Playwright command
accidentally used the suite's older default branch hostname and was stopped after reproducing
stale-host failures; the correctly targeted stable-Preview rerun passed 25 tests with 9
documented skips. No Production deployment, provider publishing, invitation issuance, or
real-user account creation occurred.

## Google and Facebook account-linking continuation

The final continuation used the stable Preview at source `bb5b4ee` and the isolated
`chatgun-auth-staging` database. Google and Facebook standalone login, callback, authenticated
account access, logout, post-logout denial, provider cancellation, and consumed-state replay
rejection all passed. The active Google authorization request visibly used PKCE S256, nonce,
state, and the exact stable callback. Facebook used the dedicated Preview application and exact
stable callback.

For the positive linking case, a fresh OAuth flow created from the authenticated Facebook
account was verified read-only in D1 as `is_link_flow=1`, with no invitation and a 600-second
TTL. Selecting the separately authorized Google identity returned to `/account` as the existing
Facebook ChatGun member. D1 then reported `facebook,google` on that user, two Google identities
across two users, no duplicate provider subjects, no foreign-key violations, and zero Beta
invitations/enrollments. Logout revoked the newest linked-account session, and direct account
access redirected to signup. No Production, PiggyPrice, provider-publishing, or invitation state
was changed.
