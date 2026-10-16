# Post-OAuth acceptance journey

Status: implemented and validated on isolated staging infrastructure. This document is technical evidence, not legal approval and not authorization to invite real participants.

## State machine

`users.status` remains the coarse operational disable/delete control. Migration `0008_post_oauth_acceptance.sql` adds a separate `users.account_state` with these transitions:

1. A newly invited OAuth identity is created as `pending_acceptance`.
2. The current adult notice, Terms, and Privacy versions must be confirmed through the authenticated, same-origin, CSRF-protected acceptance endpoint.
3. Versioned evidence and timestamps are stored in `account_acceptances`; the adult declaration is also recorded as a minimized `adult_18_plus` self-declaration event. No date of birth is requested or stored.
4. An account without a member profile moves to `pending_onboarding`.
5. Successful member-profile onboarding moves it to `active` and activates its Beta enrollment.

Existing active accounts with the current evidence and a profile go directly to Social. Missing current evidence redirects to `/acceptance`; an accepted account without a profile resumes onboarding. A version change requires one new acceptance record and does not repeat onboarding.

## Enforcement

- Normal social endpoints require current versioned acceptance and `account_state = active`.
- The onboarding endpoint accepts only a current acceptance and an eligible pending account; it cannot be reused as a profile-edit bypass.
- Pending accounts retain only authentication status, acceptance, eligible onboarding, logout, recent-provider reauthentication, and account-deletion access. Account linking is denied until setup is complete.
- Declining revokes the current session and leaves the account pending.
- Invitation-only account creation, OAuth state/nonce/PKCE, Turnstile, session cookies, CSRF, rate limiting, linking protections, and deletion protections remain in place.
- Self-declaration is not independent age verification. `sensitiveContentEnabled` remains false.
- Email and mobile OTP remain disabled.

## Staging migration evidence — 2026-10-16

- Confirmed Cloudflare account `23017b53386fb67fc62a52cdd017454c`.
- Applied only `0008_post_oauth_acceptance.sql` to `chatgun-auth-staging` (`5bbfd55d-eb22-4324-8a7d-57bef14110ea`).
- User aggregate remained 6 before and after; all six existing rows received the non-destructive default `account_state = active`.
- `account_acceptances` began empty, as expected. Migration history reported no remaining Preview migrations.
- Production D1 was not queried or modified.

## Automated evidence

- Node unit/integration/security suite: 72 passed, 0 failed.
- Focused Playwright acceptance UI: 2 passed (desktop and mobile), including unchecked defaults, policy links, versioned submission, responsive rendering, and onboarding redirect.
- Covered: pending-account bypass rejection, false/underage declaration rejection, stale-version rejection, acceptance recovery, Terms version change, one-time acceptance, onboarding activation, duplicate-onboarding rejection, decline/session revocation, same-origin/CSRF enforcement, invitation-bound OAuth creation, account-linking regression, and account-deletion regression.

## Remaining release blockers

- The Terms, Privacy Policy, adult notice wording, and their final version identifiers still require owner and qualified Thai legal approval before any real invitation.
- Real Google, Facebook, and LINE post-OAuth journeys must be rerun on the deployed stable Preview after this commit. Existing provider E2E evidence predates the new redirect/state-machine behavior.
- Self-declared 18+ is not independently verified and does not clear the previously documented age-assurance, moderation staffing, media-scanning, location-risk, policy, or provider-publishing launch gates.
- Migration 0008 has not been applied to Production, and this branch has not been deployed to Production.
