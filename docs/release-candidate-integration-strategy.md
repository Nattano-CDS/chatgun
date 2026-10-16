# ChatGun release-candidate integration strategy

Prepared before integrating the independent legal-review branch. This document records the
dependency and conflict decisions for `codex/chatgun-release-candidate`; it does not authorize a
Production deployment, merge to `main`, provider publication, public registration, or policy
publication.

## Source graph and selected heads

| PR | Head | Base/dependency | Integration treatment |
| --- | --- | --- | --- |
| #3 Authentication | `59a58f71c7062fdd6c243d9f3a5347e09965dd28` | `main` | Already an ancestor through PR #5 |
| #4 Legal Review | `f4f87f4eab9fc338793808fb8e916d35324b8b8d` | independent from `main` | Import review-only Markdown documents; do not overwrite runtime legal HTML |
| #5 Privacy & Safety | `9c315cf51df15877290bec88d3c4ef705e21bb73` | PR #3 head | Already an ancestor through PR #6 |
| #6 NEAR Migration | `318d3018b9d0fbfa454b380b9968f176c706cd56` | PR #5 head | Already an ancestor through PR #7 |
| #7 Admin Moderation | `4cb59b8d45e8778d2d5b436eb4424f0613668253` | PR #6 head | Release-candidate baseline |

The correct functional order is therefore #3 → #5 → #6 → #7. Re-merging those branches would
duplicate commits and risk reverting later security fixes. PR #4 shares only the old `main`
ancestor and conflicts in `privacy.html`, `terms.html`, and `data-deletion.html`; those runtime
files are intentionally not imported. The PR #4 Markdown design/review files are excluded from
Pages assets by `.assetsignore` and remain repository-only drafts for owner/legal review.

## Migration ownership and order

Use exactly one copy of each additive migration:

1. `0001_auth.sql` — users, provider identities, sessions, OAuth/OTP/rate limits.
2. `0002_privacy_safety.sql` — recent-auth evidence and account deletion.
3. `0003_social.sql` — profiles, relationships, blocks, messages, private media and deletion queue.
4. `0004_moderation_audit.sql` — report/message/identity audit events.
5. `0005_trust_safety.sql` — media quarantine and safety audit.
6. `0006_media_review_concurrency.sql` — decision idempotency.
7. `0007_controlled_beta.sql` — dormant invitation/enrollment compatibility tables.
8. `0008_post_oauth_acceptance.sql` — versioned post-OAuth acceptance/account state.
9. `0009_media_moderation.sql` — classification, appeals, reports and sensitive-content gate.
10. `0010_moderation_access_management.sql` — separated, time-bounded moderation access.

Do not squash, rename, reorder, or replay applied migrations. The release candidate verifies the
existing staging migration history and applies no Production migration.

## Conflict rules

- Later server authorization and fail-closed behavior from PR #7 wins over earlier moderation code.
- Account deletion/session revocation from PR #5 remains the base for PR #6/#7 social-media cleanup.
- Post-OAuth acceptance from PR #6 remains authoritative; no signup-page age/terms checkbox returns.
- PR #4 legal text remains an unapproved review artifact. Runtime legal routes keep explicit draft
  warnings and are not treated as approved/public policy.
- Original ChatGun/NEAR HTML/CSS structure and all non-game social routes are preserved. No Game
  route, asset, capability, or navigation item is introduced.
- Preview social/media flags may be enabled only for authorized synthetic staging tests. New public
  account registration, Email OTP, Mobile OTP, Demo, identity verification, and Sensitive content
  remain disabled. Production remains fully fail-closed and has no `MEDIA` binding.

## Validation gates

Before pushing the release candidate: run migration/schema/index checks, Node unit/integration/
security tests, deployed Preview Playwright desktop/mobile, anonymous/RBAC checks, private-media
authorization, quarantine/reclassification, account deletion, cleanup retry, audit, location
privacy, registration denial, and Production-config isolation. Real provider OAuth need not be
repeated because this integration changes no provider callback/token code; preserve and reference
the recorded authorized-provider evidence from PR #6.

