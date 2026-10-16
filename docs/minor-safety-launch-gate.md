# Minor safety launch gate

This is a technical/product decision record, not legal advice. A minimum age of 13 is not
treated as sufficient consent or contractual capacity under Thai law.

## Current fail-closed state

- New-account registration is disabled server-side.
- Existing linked accounts may sign in so staging testers are not locked out.
- Public discovery and unsolicited messaging are disabled and have no API implementation.
- Email OTP, mobile OTP and LINE email permission remain disabled.
- No date of birth, government ID or parent contact is collected while the lawful and
  proportionate model is unresolved.

## Owner and legal decision required

Choose one launch model after qualified Thai legal review:

1. **Existing testers only:** keep registration closed. Safest interim option and current
   implementation.
2. **Adults only:** define the legally reviewed age threshold and proportionate assurance
   method. Do not assume “18+” or “20+” without counsel.
3. **Ages 13–17 supported:** fund parental-authorization, age-appropriate notices,
   privacy-by-default, moderation and child-safety operations before registration opens.

The code must not set `NEW_ACCOUNT_REGISTRATION_ENABLED=true` until a model is approved and
its tests pass.

## Implemented adult self-declaration (not independent verification)

- The gated onboarding UI asks for a date of birth and the server calculates age against the
  `Asia/Bangkok` calendar date, including leap-day and birthday boundaries.
- Impossible, future, implausibly old, and under-18 dates are rejected. The full date is not
  stored; D1 records only `adult_18_plus`, method `self_declaration`, notice version, and time.
- This control is easy to evade by entering a false date and must never be represented as
  independently verified age.
- `NEW_ACCOUNT_REGISTRATION_ENABLED` and `ADULT_ONBOARDING_ENABLED` remain false in deployed
  configuration. The implementation therefore does not open registration.

## Additional age-assurance design requiring approval

- Ask for the minimum information needed to assign an age band before starting OAuth.
- Do not infer age from a provider photo, name or profile.
- Store a versioned age-band/assurance event rather than exposing full birth date where a
  full date is unnecessary.
- Under-13 attempts remain blocked with a minimized, short-lived anti-circumvention marker.
- Route 13–17 users to an approved parental-authorization decision; a child-entered parent
  email alone is not proof.
- Give the user/parent correction, withdrawal and rights-request paths without exposing age
  publicly.

Proposed tables, verification vendor and evidence retention require a privacy/security
review before migration work begins.

## Required privacy defaults for a supported minor account

- Profile hidden from public search and external indexing by default.
- School, precise location, birth date, email, phone and activity state never public by
  default.
- Narrowest audience for posts and profile attributes.
- No adult search filters targeting minors by age, school or location.
- No unsolicited adult-to-minor direct messages; require an approved relationship or
  moderated shared context.
- Server-side controls for mentions, follows, groups and presence—not UI hiding alone.
- No targeted advertising/profiling without separate child-rights and legal approval.

## Reporting, blocking and moderation launch requirements

- One-action block immediately stops messages, discovery and new contact requests.
- Reports available on profiles, content and messages with child-safety categories.
- Reporter identity never disclosed to the reported user.
- Evidence stored with purpose, access controls and an approved expiry.
- Staff roles, reviewer audit, escalation, appeals and emergency/child-protection runbooks
  staffed and rehearsed.
- Abuse tests cover grooming patterns, sexual requests, off-platform migration, repeated
  contact, bulk requests, impersonation and disclosure of private details.

## Activation gate

Registration, discovery and messaging remain **NO-GO** until the selected age model,
minor-safe defaults, moderation operations, data-retention rules and approved legal notices
are all implemented and independently tested.
