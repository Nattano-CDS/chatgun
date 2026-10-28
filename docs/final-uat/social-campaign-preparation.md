# Social / Location / Chat / Privacy campaign preparation

Owner authorization: PR #17 comment `6470727761`, 28 October 2026. Scope approval is valid for isolated UAT only. It is not policy-version approval, participant verification, an Admin grant, or Production authorization.

## Completed independent preparation

- Reverified PR #17 baseline, exact-head CI, frozen UAT application SHA, closed live flags, schema 21/FK0, empty UAT cohort, private R2, cleanup Workers, provider credential metadata, Turnstile, Access redirect boundary and Production isolation.
- Added a fail-closed campaign gate for exactly two distinct privately verified adults and only their approved provider allowlist.
- Prepared exact proposed acceptance versions/hashes and a mode-0600 private handoff outside Git.
- Prepared staged Social/Location/text Chat/presence/privacy flags with Media, public registration, youth, Sensitive, OTP, demo, Admin roles and Production changes hard-disabled.
- Prepared a scheduled activation executor that verifies the frozen application, exact D1/R2, encrypted provider/Turnstile/Access metadata, empty pre-campaign cohort, policy hashes, rollback and post-deploy flag read-back.
- Prepared an invitation executor that can act only inside the approved 19:00–22:00 Bangkok window. It inserts exactly two SHA-256 hashes in one UAT-only statement, creates 32-byte single-use tokens with 30-minute expiry, writes raw URLs only to a new mode-0600 local file and prints no token.
- Added regression tests proving the campaign gate rejects missing policy approval, duplicate participant references, Media, public/youth/Production activation and out-of-coverage windows.

## Proposed active UAT scope

Enable only OAuth for the privately approved A/B providers, invitation-only admission, acceptance, adult onboarding, member profiles, Discovery, voluntary approximate location, direct text Chat and presence. Ratings and all Media capabilities remain off.

Exact policy proposal:

| Record | Version | SHA-256 artifact |
|---|---|---|
| Adult notice | `adult-social-uat-2026-10-28-rc1` | `e01da689a1d91bbcc994f47eb734a191852fb2f162db0d19025bdab4fb4bb394` |
| Terms | `terms-social-uat-2026-10-28-rc1` | `7b381aaed9ab52f0033a7aec0d2ec4c3951317ad52ed23acc981ff0bc7717dc3` |
| Privacy | `privacy-social-uat-2026-10-28-rc1` | `be5d8578da6a3e3fd0d6180a37fdde7667565d719b35ec880ffe6105d703f48b` |
| Deletion | `deletion-social-uat-2026-10-28-rc1` | `b55216f2b9853d70476484042644896431e9abdbe9daecd9d641bd7e2105d4e4` |

Proposed retention decision: logical UAT cleanup within seven days after campaign close, with minimum sanitized audit evidence retained and an explicit acknowledgement that Cloudflare recovery/backup lifecycle is not individually rewritten. The owner's account is never deleted. Participant B account deletion is run only if B gives specific consent.

## Entry gate still required

The single private handoff must confirm:

1. A and B are distinct genuine adults aged 20+, each individually consenting to Social, voluntary approximate location, text Chat, presence/privacy and disposable UAT data.
2. Each chosen Google/Facebook/LINE identity is eligible for the corresponding UAT provider application. No password, OTP, token, cookie, DOB or identity document is collected.
3. Explicit approval of the four exact policy versions/hashes and the retention/recovery decision above.
4. One exact campaign date/start/end entirely within 19:00–22:00 Asia/Bangkok.
5. Whether B specifically consents to deleting the disposable UAT account during the lifecycle case.

Until all five are complete, UAT remains closed and empty; no invitation is issued. Once complete, activation, two invitations and one coordinated human campaign can run without another preparation cycle.
