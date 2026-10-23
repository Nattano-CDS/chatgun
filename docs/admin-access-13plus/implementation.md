# Cloudflare-only Admin and 13+ safeguards — implementation, not public activation

>24 October update: [youth safeguard follow-up](youth-followup-20261024.md) adds
>schema20 write guards and account-rights UX. Admin/MFA setup is paused at owner
>request. Zero Trust Free activation was verified22 October; the older onboarding
>status below is historical. No Access app/policy or new Admin role has been saved.

Owner approved remote Cloudflare setup, minimum age 13 and the exact Admin email
`natttano@outlook.com`. No additional real member, invitation or permanent grant is
created. No Production or original staging records are changed.

## Implemented

- Separate `/api/admin/*` namespace, backed by signed Access assertions and a private
  mapping to the previously confirmed owner UUID. No LINE/member session is needed.
- Admin sessions have their own D1 table. No member cookie, OAuth identity or social
  session is created by Access login. Maximum application session one hour, bounded
  by assertion expiry. Revoked assertion tombstones remain through assertion expiry.
- Same-origin, purpose-separated HMAC CSRF challenges for session creation and actions.
  Login never grants a D1 role. Every moderation action still requires its unexpired
  role; role revocation invalidates Admin sessions. Sensitive evidence still requires
  justification, and moderation decisions still require reasons/audit history.
- Logout revokes the application session and then navigates to Cloudflare logout.
  The same assertion cannot restart a logged-out session. Member logout is unaffected.
- Recent authentication comes only from verified authentication-time evidence, not JWT
  issuance time. Optional `ADMIN_ACCESS_IDENTITY_LOOKUP_ENABLED=true` uses the documented
  fixed-team `/cdn-cgi/access/get-identity` endpoint, binding subject, email and ChatGun
  account. Missing, stale, mismatched or unavailable evidence cannot authorize high-risk
  operations. A valid signed `auth_time` is also supported. Genuine IdP/Access testing
  is required before either proof path is considered operational.
- Dedicated Admin routes avoid accidentally Access-protecting member moderation
  notifications. Protect `/app/moderation*` and `/api/admin/*` in the same Access app;
  legacy moderation APIs are fenced at origin by signature checks. Do not put all
  `/api/social/moderation/*` behind Access: that includes member notification routes.
- Additional privacy-minimizing `member_age_safety_holds` table and backend eligibility
  checks. Under-13, 13–17 and 18–19 holds cannot be cleared by changing a client flag or
  simply setting a database status to approved. No dates of birth or parent contacts
  are stored in this table. Existing adult declarations are not relabelled as 20+.
- Held accounts are excluded from discovery, contact, photo access, comments and online
  status. Holds hide profile/location, disable messaging/presence and revoke album grants.
  D1 triggers reject alternate message/album consent writes. Account authentication,
  logout and privacy/deletion controls remain separate and reachable.
- This is **restrictive groundwork**, not a completed 13+ registration product. No
  public age-assessment write endpoint or parental-authorization process is introduced
  without the reviewed model. Existing 18+ acceptance remains unchanged until replaced
  by a versioned, reviewed journey; no false adult evidence is inserted for minors.

## Schema and deployment boundary

Migrations `0018_cloudflare_admin_sessions.sql` and `0019_member_age_safety_holds.sql`
are additive and idempotent. Source release metadata requires **schema19**, so this
candidate cannot be treated as a schema17 Production owner-UAT release.

Only isolated D1 `275d9820-6aec-494a-8bb5-b7ed9b8b74cc` was migrated after protected
export, local restore/rehearsal and complete old-table fingerprint comparison. All
51 old application tables were unchanged; the two new tables were empty; FK0.
Original `chatgun-auth-staging` and Production `chatgun-auth` were not migrated.

Repeatable, strictly isolated verifier/migrator:
`CHATGUN_AGE_ADMIN_STAGING_MIGRATIONS=approved node scripts/prepare-age-admin-isolated-schema.mjs`.
It cannot target Production or protected staging and refuses unknown migration history.

## Actual remote setup status

The authenticated Chrome dashboard is in verified ChatGun account
`23017b53386fb67fc62a52cdd017454c`. Zero Trust onboarding shows **Choose a plan**;
Free is $0/seat/month, maximum 50 seats. No plan was selected or subscribed. An
action-time confirmation is pending for **Free only**. Paid plans/card entry are not
authorized. The tab is retained for continuation; no user tab was closed.

After plan approval: inspect/create the team, IdP and dedicated Admin application;
prepare exact-email policy and request action-time confirmation before saving persistent
access permissions. Do not create an API key just to bypass Wrangler's 403.

Configure the prepared issuer/AUD/email/private owner mapping plus
`ADMIN_CLOUDFLARE_ACCESS_REQUIRED=true` and `ADMIN_ACCESS_STANDALONE_ENABLED=true`
only after genuine isolated login/denial/logout/identity-time proof succeeds. Production
requires protected schema19 rehearsal/approval, operational cleanup and fresh release
checks. Existing seven-day owner roles still expire on 27 October 2026; no renewal or
role-administration privilege is implied.

## Required decisions, not invented approvals

The [Thai youth policy draft](youth-policy-review.html) is **unpublished** and excluded
from public build assets. The owner selected 13+, but qualified review of capacity,
lawful basis, required parental authority, age assurance and child-safety operations
for the revised scope is not recorded. No scanning vendor, reviewer or staffing was
invented. Sensitive Content, public signup and real social services stay disabled on
Production. Technical safeguards do not constitute legal compliance or a staffed launch.

Sources: [Cloudflare token/identity documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)
and [origin JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

## Validated source and evidence

Application SHA: `40a56e9e182890e7d95119fadfb31f34be8ec214`.
Exact-source [CI passed](https://github.com/Nattano-CDS/chatgun/actions/runs/39407882882).
Local results: **219 unit/integration/security + 87 mocked browser + 7 full-system
local handler journeys**, zero final failures/skips. Isolated Preview serves this SHA
and schema19; all 39 public asset hashes match. Production remains the unchanged a73
release/schema17, with public registration and Social services off.

Age-held accounts are also routed to account/privacy controls instead of adult
acceptance/onboarding, cannot record false adult acceptance or link around the hold,
and can use the real CSRF/recent-auth account-deletion handlers. These cases use
synthetic in-memory accounts only. No real child or owner records were deleted.

[Owner-review report](report.html), [structured results](results.json), and
[unpublished Thai youth policy addendum](youth-policy-review.html).
