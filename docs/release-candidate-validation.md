# ChatGun release-candidate validation

Validation date: 2026-10-16 (Asia/Bangkok)  
Branch: `codex/chatgun-release-candidate`  
Baseline: PR #7 head `4cb59b8d45e8778d2d5b436eb4424f0613668253`

This is staging evidence only. It does not authorize a merge to `main`, a Production deployment,
public registration, provider publication, Sensitive content, or publication of the legal drafts.

## Integrated scope and conflict result

PRs #3, #5, #6, and #7 form one linear chain. The release candidate therefore uses PR #7 as its
functional baseline instead of replaying or merging those commits a second time. PR #4 is
independent from `main`; its repository-only Markdown drafts were imported for review while its
older runtime HTML was not allowed to overwrite the newer authentication, privacy, and social
disclosures. The exact source graph, migration ownership, and conflict rules are recorded in
`docs/release-candidate-integration-strategy.md`.

The integrated release candidate contains secure social OAuth/session handling, post-OAuth
acceptance, onboarding, the five NEAR non-game destinations, private R2 media, relationship and
messaging controls, reporting/blocking, deletion/retention, and separated moderation access.
Email OTP, Mobile OTP, Game, identity verification, Demo, public registration, and Sensitive
content remain disabled. Production social/media/moderation/acceptance capabilities remain
disabled and Production has no R2 binding.

## Isolated Preview evidence

- Cloudflare account: `23017b53386fb67fc62a52cdd017454c` (reverified before staging work).
- Pages Preview deployment: `https://a4620500.chatgun.pages.dev`.
- Branch alias: `https://codex-chatgun-release-candid.chatgun.pages.dev`.
- Preview D1: `DB → chatgun-auth-staging`
  (`5bbfd55d-eb22-4324-8a7d-57bef14110ea`).
- Preview R2: `MEDIA → chatgun-media-staging`, private and accessible only through authorized
  Functions/Worker bindings.
- Production D1 was not migrated or mutated. No Production deploy occurred.
- One unrelated staging user was preserved. Four reserved synthetic identities were created for
  deterministic testing; the destructive account-deletion test removed only its reserved
  `cg-stage-charlie` identity.

Real Google, Facebook, and LINE OAuth were not repeated because the integration introduced no
provider callback, token-validation, cookie, or linking change. The authorized stable-Preview
provider evidence already recorded in PR #6 remains the applicable evidence. The release candidate
does verify the closed-registration path and the post-OAuth acceptance state machine in automated
security/browser tests.

## Test results

| Layer | Result | Evidence |
| --- | --- | --- |
| Unit/integration/security | **PASS — 76 passed, 0 failed, 0 skipped** | OAuth/PKCE/state/nonce, Turnstile, CSRF, linking/takeover denial, sessions, acceptance, onboarding, RBAC, media, location privacy, rate limits, deletion, cleanup, migrations, and feature isolation |
| Playwright desktop/mobile | **PASS — 32 passed, 0 failed, 4 intentional skips** | The four skips prevent destructive API mutations from running twice across browser projects; both browser projects executed responsive UI and moderation checks |
| Live non-media social APIs | **PASS** | Profile edit/validation, discovery, location accuracy denial, requests/duplicate denial, friendship, text message/non-friend denial, rating/duplicate denial, report validation, block/unblock, CSRF denial |
| Live private media | **PASS** | Anonymous denial, pending quarantine denial, audited moderator read/release, metadata stripping, friend authorization, like/comment, non-owner delete denial, report/reclassification/appeal, chat-image authorization, immediate block revocation, deletion queue |
| Account deletion | **PASS** | Recent authenticated synthetic account deleted; access and session were revoked; owned media was queued; the staging cleanup Worker completed all due operations |
| Admin moderation | **PASS** | Purpose requirement, ordinary-user denial, time-bounded `safety_admin`, safe rendering, report review, classification, appeal, and audit paths |
| Responsive/offline | **PASS** | Desktop/mobile social, acceptance, signup, moderation, notification preference, and offline recovery |

The private-media scenario legitimately takes about 34 seconds because it exercises upload,
quarantine, object review, release, report, prohibited reclassification, appeal, second release,
chat image, block revocation, relationship restoration, and deletion. Its test budget was raised to
90 seconds; behavior and assertions were not weakened.

Screenshots are produced in the ignored Playwright result directories for acceptance, signup,
moderation, social desktop/mobile, and live persisted social state. They intentionally contain only
synthetic staging data.

## D1 migrations and integrity

- Remote staging migration history reports **no migrations to apply** for `0001`–`0010`.
- All ten migration files remain single, ordered, version-controlled copies; none were renamed,
  squashed, replayed, or applied to Production.
- Migration unit tests are idempotent and verify the required tables/indexes.
- Post-E2E `PRAGMA foreign_key_check` returned no rows.
- Duplicate `(provider, subject)` query returned no rows.
- Orphan media-safety-review count: `0`.
- Active Sensitive media count: `0`.
- Active Prohibited media count: `0`.
- Pending media deletion operations before the cleanup drain: `4`; after invoking the existing
  staging-only scheduled Worker: `0`.
- Pending-deletion media rows after the drain: `0`.
- The final staging user count is `4`: one preserved unrelated account plus Alice, Bob, and the
  time-bounded synthetic moderator. Charlie was intentionally deleted by the deletion E2E.

## Security review

| Control | Assessment |
| --- | --- |
| Authentication and CSRF | Same-origin mutations require session cookie plus matching CSRF; OAuth state/nonce/PKCE and provider validation retain PR #3/#6 coverage |
| Registration | Unknown identities fail closed because public and invitation registration flags are both false; existing provider identities may sign in |
| Account state | Pending accounts are restricted to acceptance/onboarding/privacy/deletion/logout paths; direct-route/API bypass is denied |
| RBAC | Moderation is disabled without its flag, requires an explicit non-expired grant and recorded purpose, and separates grant administration from case review |
| Media | R2 has no public URL path; bytes/signatures/dimensions are validated, unnecessary metadata is stripped, pending content is quarantined, and reads are relationship/owner/moderator scoped |
| Sensitive content | Feature flag is false; released Sensitive/Prohibited object counts are zero |
| Location privacy | Cross-user responses omit coordinates/accuracy, use 250 m bands, expire stale presence, and throttle repeated discovery reads |
| Deletion/retention | Access is revoked transactionally; binary deletion is asynchronous, bounded, retryable, and confirmed by the staging scheduled Worker |
| Audit | Role changes, queue/object access, decisions, reports, appeals, and message/media inspection require purpose-bearing audit events |
| Environment isolation | Preview uses staging D1/R2. Production has a distinct D1 binding, no R2 binding, and fail-closed social/media/moderation flags |

## Remaining blockers

1. Owner and qualified Thai legal review of Terms, Privacy, Data Deletion, Beta notice, adult
   eligibility/assurance, location processing, retention, and appeals is incomplete. Imported PR #4
   documents remain drafts and are not published as approved policies.
2. Named moderation primary/backup, coverage hours, emergency escalation, appeal independence,
   takedown intake, and access-review ownership are not confirmed.
3. No approved automated content-safety scanner or confirmed staffed pre-release review service
   exists. Quarantine must remain enabled and real-user uploads/social activation must remain gated.
4. Provider Production publishing/approval and Production callback validation remain separate
   operational gates. This release candidate did not publish provider applications.
5. Self-declared 18+ is not independent age verification. Sensitive content remains disabled and
   no launch claim may describe it as verified age.
6. Production migration `0002`–`0010`, backup/bookmark, rollback/recovery rehearsal, secrets,
   bindings, custom-domain verification, and launch monitoring require a separately approved
   Production change window.

## Assessment

- **GO — isolated release-candidate Preview and continued synthetic staging review.** The combined
  code, schema, private media, security controls, moderation paths, cleanup, and responsive UI are
  technically coherent and passing.
- **NO-GO — Production or real-user/public Beta.** Legal approval, moderation ownership, scanning
  operations, provider publishing checks, and the approved Production migration/recovery window
  remain unresolved. Public registration and Sensitive content must stay disabled.

