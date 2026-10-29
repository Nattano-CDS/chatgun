# Production preservation diff

Read-only verification at 2026-10-30 00:44 Asia/Bangkok confirmed Production still serves `a73ff21c615dabb6a0c19c0a22685c2370958ca1`, schema17/FK0, one owner identity, private `chatgun-media-production`, LINE OAuth on, invitation-only admission on, acceptance/onboarding/Social shell/moderation on, and all restricted features off. Production writes: 0.

The checked-in `wrangler.jsonc` Production candidate **fails** preservation. It would change 11 required values: disable OAuth login, remove LINE, disable invitation admission, add a different enrollment requirement, disable acceptance, onboarding, Social and moderation, and replace the three approved policy versions. It activates zero restricted features, but disabling the owner pilot is itself release-blocking (`PH6-CONFIG-001`).

`production-owner-pilot-fingerprint.json` captures the read-only live contract. `verify-production-preservation.mjs --enforce` fails on any missing pilot value or any enabled restricted feature. The review-only `owner-pilot-preservation-profile.json` passes all 25 checks, but it is not a deployable authorization and was not applied anywhere.

The generic non-Production root variables enable Discovery, messaging and Media for isolated testing. They must never be substituted for Production. The gate evaluates only the explicit Production candidate and prevents both broad enablement and pilot shutdown.
