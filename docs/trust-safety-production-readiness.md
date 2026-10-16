# Trust & Safety production-readiness review

Status: **draft for owner, security, operations, and qualified Thai legal review**. This
document does not authorize Production deployment, provider publishing, or public
registration. Reviewed against commit `21ab7834ce9107c92a5826d00920e999efc829e9` and the
changes in this branch on 16 October 2026.

## Implemented in this review

- The adult gate now requires a syntactically valid date of birth and calculates age on the
  current `Asia/Bangkok` calendar date. Future, impossible, implausibly old, and under-18
  dates fail server-side. The full date is not persisted; D1 stores only the adult age band,
  notice version, time, and `self_declaration` method.
- API responses explicitly distinguish `adult_self_declared` from
  `age_independently_verified`. ChatGun has no independent age verification today.
- Cross-user profile responses no longer disclose location accuracy, location timestamp,
  discovery state, or age-assurance state.
- Discovery discloses only 250-metre bands (including “under 250 m”), never coordinates,
  does not exact-distance-sort people inside a band, and is limited to 30 reads per user per ten minutes. Coordinates require reported
  accuracy of 50 m or better, expire after two minutes, and are erased when discovery is
  hidden, permission is revoked, or retention cleanup runs.
- Reports now preserve specific reason codes for threats, non-consensual intimate images,
  and child safety while retaining backward-compatible broad categories.
- Additive migrations `0005_trust_safety.sql` and `0006_media_review_concurrency.sql`
  introduce a media review queue, audit log, and single-winner decision nonce.
  With quarantine enabled, pending objects are unavailable even to their owner until a
  `safety_admin` records a purpose and releases them. Rejection queues the private object
  for deletion. Production sets quarantine on but leaves all media and social capabilities
  off. Synthetic Preview retains an explicit bypass until a scanner or staffed review is
  approved.

## 18+ assurance assessment

The implemented model is a **self-declared date**, not proof of age. It prevents accidental
under-age onboarding and handles birthday boundaries correctly, but a person can enter a
false date. It must not be described as “verified age.”

Risk-proportionate launch options, in increasing assurance:

1. Keep registration closed and admit only authorized testers (current state).
2. For a low-risk adult-only service, combine the current declaration with strong reporting,
   private defaults, behavioural risk signals, and targeted re-checks.
3. Before public nearby discovery, adult dating-like discovery, private messaging, or user
   media, procure a privacy-preserving age-estimation/age-verification service with a
   documented error, appeal, accessibility, deletion, and data-transfer model. Store only a
   provider assertion/reference and age band, never an ID image unless strictly necessary.
4. If ages 13–17 are ever supported, design a separate child-safety and legally valid
   parental-authorization program. Do not reuse the adult flow.

Owner and qualified Thai counsel must decide the lawful minimum age, whether Thai civil
capacity rules require additional consent, whether the feature set is dating/high-risk, the
acceptable assurance method, and the evidence/appeal retention period. Registration stays
closed until those decisions are approved and implemented.

## Control status

| Area | Technical state | Launch state |
| --- | --- | --- |
| Registration | Public flag false; one-use hashed invitations enabled only in Preview; Production Beta flag false | Controlled staging only |
| Age | DOB calculation; age band only; self-declared | Insufficient for high-risk public launch |
| Location | Private coordinates, 50 m accuracy ceiling, 2-minute expiry, 250 m output bands, no exact ordering, read throttling | Needs independent abuse test and policy approval |
| Messaging | Accepted-friend and block checks; CSRF/rate limits | Needs staffed response and retention decision |
| Media | Private R2, signatures, 8 MB limit, metadata stripping, quarantine workflow | Scanner/staffing and SLA unresolved |
| Reports/blocking | Immediate block; expanded reasons; role/purpose/audit controls | No confirmed moderation staffing |
| Deletion | Recent auth, CSRF, transactional account erasure, media deletion queue | Backup replay and operational drill unresolved |

## Decision

**NO-GO for public launch.** The code is materially safer and remains suitable for controlled
synthetic staging. Public launch is blocked by the absence of approved age assurance,
moderation staffing/on-call ownership, a production media-scanning decision, reviewed legal
documents, provider publishing, and an approved Production deployment/smoke test.

## Validation evidence

- Committed-candidate Preview: `https://d0db539e.chatgun.pages.dev` (Preview only).
- Node unit/integration/security: **63 passed, 0 failed, 0 skipped**.
- Final Playwright: **30 passed, 0 failed, 4 intentional project-specific skips** across
  desktop and mobile Chromium. Stateful live mutations run once on desktop; the mobile
  project skips those three duplicate mutations and the desktop project skips the
  mobile-layout-only assertion.
- An earlier run produced one relationship race because desktop/mobile mutated the same
  synthetic accounts concurrently. A second run then correctly hit persisted report rate
  limiting; a later exact-build run similarly exposed a retained synthetic account-deletion
  limiter. The harness was fixed to one worker and the synthetic seed now resets only named
  social/account-deletion test scopes. The complete post-fix rerun above passed; failures
  were not hidden.
- Staging migrations 0005–0007: applied; none pending; controlled-Beta tables/indexes present;
  report reason-code backfill count missing = 0; `PRAGMA foreign_key_check` empty.
- Post-test staging cleanup: six queued R2 operations selected/completed across two drains, zero failed;
  0 `social_media` rows, 0 pending media operations, 0 review rows, R2 0 objects/0 B.
- Production read-only check: no FK violations, but only migration 0001 is applied. Migrations
  0002–0007 remain pending and were not applied.
- Real Google/Facebook/LINE public-user login was **not tested** in this pass because the
  provider apps remain unpublished/development and no Production application was deployed.
