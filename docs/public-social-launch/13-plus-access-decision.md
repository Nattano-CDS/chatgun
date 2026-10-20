# 13+ membership and Cloudflare Access: approved direction, incomplete activation

Decision date: 20 October 2026, Asia/Bangkok. This supersedes the proposed adults-only
public admission direction, not the safeguards of the currently deployed owner pilot.

## Confirmed by the owner

- Intended minimum membership age: **13**, not unrestricted/all ages.
- Intended Admin Access identity: **natttano@outlook.com** only.
- Policies may take effect upon publication on **20 October 2026**. No later publication
  may be backdated automatically to that date.
- Limit visibility by age. This does not authorize publishing prohibited content,
  removing quarantine, or bypassing independent appeal review.

The previous public policy draft describes an adult-only service. Owner approval of
that package is not evidence that the new youth notices, capacity/authorization model,
or a qualified review of those new texts have been completed. It is not published.

## Implemented in this preparation

- Transient Bangkok-calendar age-band classifier: under 13, 13–17, 18–19, 20+.
  Returns no date of birth and makes no independent-verification claim. It is NOT
  wired to admission, so it cannot open youth registration accidentally.
- Optional additional backend Access gate on moderation capabilities and every
  moderation handler using `moderationAccess`. Existing ChatGun authentication,
  CSRF, recent-authentication checks, audit purposes and unexpired D1 roles still apply.
- The assertion must have a valid RS256 signature, configured issuer and AUD,
  application type, live numeric timestamps, human subject and exact allowed email.
  A second owner binding matches the already privately verified ChatGun UUID.
- No trust in plain email headers, cookie contents, token-supplied certificate URLs,
  service tokens, another application's token, or a role inferred from email.
- The opt-in flag is unset on Production. No roles granted/extended, migrations,
  user writes, Access app changes, policy publication or deployments performed.

## Actual infrastructure blocker

Wrangler account identity was verified as `23017b53386fb67fc62a52cdd017454c`.
Read-only API checks for Access organization, applications and identity providers all
returned HTTP **403**. This proves current API authorization is insufficient; it does
not prove that no organization or application exists. No mutation was attempted.

### Required authorized Cloudflare setup

1. In the **ChatGun account only**, open Zero Trust / Access controls / Applications.
   Inspect existing configuration; do not edit unrelated applications.
2. If organization onboarding or a plan/billing decision is required, pause for the
   owner. Do not silently create a paid subscription.
3. Create a dedicated ChatGun Admin self-hosted Access application. Protect the actual
   moderation HTML/JS entry routes and `/api/social/moderation/*`, including capabilities,
   media, reports, audit, decisions and role-management endpoints. Keep member OAuth
   callbacks and ordinary member routes outside this Admin app. Inventory routes first.
4. Allow only exact `natttano@outlook.com` via a verified identity provider. Prefer
   MFA-backed IdP authentication; an email OTP by itself is not MFA. No Everyone,
   broad email-domain allowlist, bypass rule or service-token Admin access.
5. Use the same Access application audience across the Admin entry and API paths.
   Verify path matching and cookies before enforcing the origin gate. An email input
   alone or successful Cloudflare dashboard login is not sufficient authentication.
6. Configure `ADMIN_CLOUDFLARE_ACCESS_REQUIRED=true`, `ADMIN_ACCESS_ISSUER` (exact HTTPS
   team domain), `ADMIN_ACCESS_AUDIENCE` (64-hex application AUD), `ADMIN_ACCESS_EMAIL`
   and private `ADMIN_ACCESS_OWNER_USER_ID`. Never put the owner UUID or assertions in
   GitHub. Each environment has its own issuer/AUD/owner binding and separate approval.
7. Stage an allow/deny/revocation/expiry/alternate-hostname test with genuine Access
   login before Production activation. API aliases must not bypass origin verification.
8. Current code adds Access as a **second identity boundary** to the existing member
   session. Standalone CF-only Admin session issuance is NOT implemented. Any future
   bridge needs a privately verified subject mapping, session rotation, recent-auth
   evidence, logout/revocation and CSRF tests; never auto-link by provider email.
9. Existing owner grants still expire 27 October 2026 at 11:01:45 Asia/Bangkok. Define
   and audit any new grant duration after genuine Access identity verification; do not
   turn this email allowlist into permanent privileges or role administration.

Alternatively provide an appropriately scoped **local** API credential permitting
Access application/policy configuration in this account only, using the protected
credential mechanism. Never paste credentials in chat or GitHub. A token is not
required if an authorized owner completes dashboard setup.

## Required youth implementation before admitting ages 13–19

| Area | Required behavior | Current readiness |
| --- | --- | --- |
| Age evidence | Versioned bands/assurance and corrections, no public DOB, no inference from OAuth profile | Classifier only; admission/storage migration not implemented |
| Under 13 | Server rejection; no active member/social permissions | Existing adult gate rejects; new youth flow not activated |
| Ages 13–17 | Private defaults, no proximity discovery or presence publication, no unsolicited adult contact, approved age/capacity/parental-authorization workflow | Not implemented end-to-end |
| Ages 18–19 | Separate legally reviewed capacity/authorization treatment; do not infer full capacity from an 18+ checkbox | Pending qualified review and implementation |
| Adults | Explicit eligibility evidence, privacy and block restrictions; unknown ages denied youth contact | Existing adult-only self-declaration is not proof of independent age |
| Media | Quarantine, manual review, deny prohibited content for every age, Sensitive off | Existing controls retained |
| Age visibility | Central backend policy on discovery/profile/chat/notifications/gallery/thumbs/comments, not CSS or client state | Youth policy not implemented |
| Existing users | Do not relabel stored `adult_18_plus` declarations as 20+, verified, or minor-safe | No records changed |
| Policies | Youth-appropriate notices, lawful basis, capacity and any parental authorization, withdrawal/correction, retention and safeguarding operations | Previous adult-only package insufficient |
| Operations | Child-safety report handling/escalation, coverage limitations, separate appeal reviewer, Production cleanup verification | No new staffing/reviewer claimed |

Until this table is implemented and tested, keep public signup, real Discovery, Chat,
Presence and uploads closed. Do not simply replace the old 18+ wording with 13+ or
remove the `adult_18_plus` SQL eligibility predicates. No youth-safety claim is made.

## Evidence and references

Tests generate their own RSA keypair and local synthetic accounts; they are not a
genuine Cloudflare Access login. Live API authorization remains BLOCKED.

Current result: **213 unit/integration/security tests and 84 mocked browser tests
passed**, zero failures/skips. Browser widths: 390, 768, 1440. Isolated Preview serves
`bba908a37d79dade6e4ddd3424ebe3d491536072`; all 39 manifest asset hashes match.
Production still serves `a73ff21c615dabb6a0c19c0a22685c2370958ca1`, schema 17/FK0,
with public signup/Social services off. Protected staging aggregate counts and all
Production/Preview bindings are unchanged. See `13-plus-access-results.json`.

- [Cloudflare: validate Access JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Cloudflare: identity-based and service application tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)
- [Thai PDPA text, ministry-hosted English translation, Section 20](https://www.mdes.go.th/law/detail/3577-Personal-Data-Protection-Act-B-E--2562--2019-)

Section 20 requires a capacity-sensitive analysis of minor consent; the threshold of
13 alone is not a legal compliance conclusion. A qualified Thai reviewer must review
the actual youth processing and authorization model, not merely a site age checkbox.
