# Final NEAR migration UAT and Beta readiness

Date: 2026-10-16 (Asia/Bangkok)  
Branch: `codex/near-migration`  
Candidate tested: `9fb0eeeb2fd625a0dd2688cbc6a38d9868e62a2d`  
Exact-head Preview: `https://8d5486db.chatgun.pages.dev`  
Scope: ChatGun Preview, `chatgun-auth-staging`, and `chatgun-media-staging` only

## Release decision

- **Synthetic isolated staging UAT: GO.** The complete automated and browser suite passed,
  live Pages/D1/R2 workflows persisted correctly, negative authorization paths failed
  closed, and all generated media/content residue was removed.
- **Real-user invitation-only Beta: NO-GO.** Real Google, Facebook, and LINE browser E2E is
  incomplete because Preview Turnstile required a human challenge. The operator has also not
  confirmed named moderation coverage, escalation ownership/hours, approved age-assurance
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
| Preview deployment | Deployment `8d5486db-42ac-4fa7-857a-99522dca57d4`, source `9fb0eee`, URL above |
| Preview D1 | `DB` maps to `chatgun-auth-staging` (`5bbfd55d-eb22-4324-8a7d-57bef14110ea`); migrations 0001–0007 applied; none pending |
| Preview R2 | `MEDIA` maps to private `chatgun-media-staging`; final object count 0 and size 0 B |
| Production isolation | Production config keeps registration/Beta/social/media/moderation flags false, binds `DB` to `chatgun-auth`, has no `MEDIA` binding, and was not mutated |

## Exact test accounting

| Layer | Passed | Failed | Skipped/untested | Notes |
| --- | ---: | ---: | ---: | --- |
| Node unit/integration/security | 63 | 0 | 0 | OAuth state/PKCE/nonce, provider token validation, invitations, age gate, CSRF, sessions, rate limits, media validation/quarantine, moderation, deletion, location privacy, social authorization |
| Playwright desktop/mobile | 30 | 0 | 4 | Four intentional reciprocal project exclusions, not runtime failures |
| Dependency audit | 1 | 0 | 0 | `npm audit --audit-level=high`: 0 vulnerabilities |
| D1 integrity/cleanup | 7 | 0 | 0 | Media, pending/failed deletions, ratings, invitations, and enrollments all zero; foreign-key check empty; R2 zero objects |
| Real provider browser journeys | 0 | 0 | 3 | Google, Facebook, and LINE stopped at the common interactive Turnstile prerequisite before redirect |

The state-mutating live Pages tests intentionally run once on desktop to avoid racing a shared
synthetic dataset. The mobile project independently renders the persisted results. The desktop
project skips the mobile-only navigation assertion; these account for all four Playwright skips.

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

Staging D1 contains one existing identity for each of `google`, `facebook`, and `line`, so no
invitation or account creation is needed for the authorized login tests. The browser reached
the exact-head signup page and displayed all three social buttons. Selecting Google caused
Turnstile to display the Thai message requesting confirmation that the visitor is not an
automated program. The challenge was not solved or bypassed. Because the same frontend gate
precedes every provider start, no provider redirect/callback, account page, secure session,
linking, or logout result is claimed.

Required completion evidence for **each** provider:

1. A human completes Turnstile in the retained UAT tab.
2. Use the authorized existing staging identity; do not create an invitation or a real user.
3. Complete provider account selection/consent/password/MFA personally if prompted.
4. Verify callback returns to `/account`, `/api/auth/me` identifies the same existing user,
   cookies are `Secure`, `HttpOnly`, and appropriate `SameSite`, then perform CSRF-protected
   logout and verify the session is rejected.
5. Repeat cancellation/denial and replay-negative checks. Account-link positive/negative
   logic already passes automated tests, but a live provider linking test is still required
   before Beta.

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
| Signup desktop | `test-results/screenshots/signup-desktop.png` | `82e23c06ce449b786a82fe371531ee0f8ac4e00bb16b83156ccb780e2efcf061` |
| Signup mobile | `test-results/screenshots/signup-mobile.png` | `e0c2caf4d17b500b30b426f2852684705178bc8d9911fb104fa7676605b2f6e3` |
| Live social desktop | `test-results/artifacts/live-social-desktop-and-mo-0bab5-y-notifications-and-reviews-desktop-chromium/live-social-desktop-chromium.png` | `7a7d0180504e76291c35f36e117b58cbe50412edc2bcc2da00d088b8b116229d` |
| Live social mobile | `test-results/artifacts/live-social-desktop-and-mo-0bab5-y-notifications-and-reviews-mobile-chromium/live-social-mobile-chromium.png` | `9ff4c4a3c0ffa5f9539b455a612aeab7a229b23d11a384bc2b969bef5f69368b` |
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
- [ ] Complete and document Google, Facebook, and LINE success/cancel/logout browser E2E with
  authorized existing staging accounts.
- [ ] Approve the PR dependency/rebase plan and separately authorize any Production migration
  or deployment. This UAT does not grant that authority.

## Remaining blockers

1. Human-completed Turnstile and real Google/Facebook/LINE E2E evidence.
2. Provider publishing/approval status and production callback readiness.
3. Owner/legal approval of adult assurance, location, legal notices, retention, and appeals.
4. Named moderation primary/backup, coverage hours, escalation contacts, access provisioning,
   and rehearsed procedures.
5. Production-grade media scanning or an approved staffed review path; Preview bypass is
   synthetic-only.
6. PR #3/#5 dependency completion and the documented conflict-free rebase sequence.
7. Separately approved Production migrations 0002–0007 and deployment change window.

These blockers are operational and external to the validated synthetic staging workflows;
they must not be represented as completed by passing automated tests.
