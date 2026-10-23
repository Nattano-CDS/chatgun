# Youth safety follow-up — 24 October 2026, Asia/Bangkok

Owner requested pausing Admin/MFA setup and continuing youth protections. This is
restrictive preparation, **not a completed 13+ registration product or legal approval**.
No Production deployment, Production migration, public signup or real youth test occurred.

## Confirmed defects and fixes

1. `accountJourney` checked the acceptance feature flag before the safety hold. It
   now evaluates an existing hold even when acceptance is disabled. `/api/auth/me`
   returns only `ageSafetyReviewRequired` to the authenticated account, not its age
   band, DOB or underlying review evidence. No false adult acceptance is created.
2. Schema19 cleared visibility, coordinates and presence when installing a hold, but
   did not reject a later profile/presence write that had already passed an API check.
   Additive migration0020 installs six INSERT/UPDATE guards for profile publication,
   direct-message preference, location, presence preference and presence leases.
   No existing row is rewritten. Existing contact/album guards remain in force.
3. The account page did not explain the hold. It now shows a Thai explanation based
   on authenticated server state, correction/help contact, safe disclosure guidance,
   session controls, logout and deletion. A URL parameter cannot fabricate this status.
4. Deletion reauthentication reused Turnstile inside the hidden identity-linking
   section. It now uses a separate security section so held/pending accounts can
   reauthenticate without enabling account linking. CAPTCHA is not bypassed.

No new youth-data collection, DOB storage, guardian contact, automated release,
Sensitive Content permission, provider identity, role grant or scanning vendor added.

## State and decisions still required

| Account state | Current enforced outcome | Required before a future admission path |
| --- | --- | --- |
| Known under13 | Hold; no Social; privacy/logout/deletion retained | Counsel-approved rejection, correction and data minimization procedure |
| Known13–17 | Hold; no discovery/contact/media/presence | Approved age-assurance, capacity/parental-authority model and child-safety operations |
| Known18–19 | Hold; no false adult/20+ relabelling | Separate capacity review, not assumed equivalent to legal majority |
|20+ | An age band alone grants no permission; all existing acceptance, visibility, block and service gates apply | Existing launch and operational gates remain mandatory |

Future youth admission must be a separately versioned state machine, not a checkbox
or an edit to an adult declaration. Proposed states for owner/legal review:
`age_assessment → eligibility_hold → required_authority_review → policy_acceptance
→ restricted_onboarding → restricted_active`. A correction or withdrawal returns to
a hold and revokes contact/media grants; no automatic release based on a birthday.
This proposal is **not implemented or approved**. Age correction must not overwrite
history or rely on an unverified email/parent claim. Do not collect ID documents or
guardian information until necessity, authority verification, restricted access,
retention and unsafe-family escalation have been reviewed.

Admission requirements not yet implemented: supported youth profiles without the
legacy `adult_18_plus` assurance foreign key, separate13–15/16–17 contact audiences,
adult-to-teen unsolicited-contact denial for admitted youth, guardian authority and
withdrawal (where required), safeguarding escalation and a correction review workflow.
Current holds deny all contact rather than pretending these granular controls exist.

Children/guardians must receive an understandable notice and rights route. No public
age, school, exact location or last-seen history; no targeted advertising or contact
sync. Sensitive Content remains disabled for all. Blocking/reporting must be available
in any eventual restricted youth product, without disclosing reporters to subjects.

Operational coverage remains owner-only19:00–22:00 daily Bangkok; no backup,24/7 or
immediate-response promise. Child-safety escalation, independent appeals review,
capacity and final youth policies need explicit responsible-owner/legal decisions.
The existing approved owner-pilot policies are not approval of these youth drafts.
Do not backdate a new policy to20 October when publication occurs later.

Legal reference checked24 October: [PDPA translation hosted by MDES, Section20](https://www.mdes.go.th/law/detail/3577-Personal-Data-Protection-Act-B-E--2562--2019-).
This is an unofficial English translation on the ministry site, not legal advice or
a certification of compliance. Qualified Thai review must determine applicable rules.

## Validation boundary

Unit/security tests use in-memory SQLite and synthetic actors, including age13/18/20
boundaries, under13/13–17/18–19 holds, alternate/in-flight writes, media denial before
R2 reads, linking/acceptance denial, rights/deletion and FK integrity. Migration20
was rehearsed twice over schema19 with every table row unchanged.

Remote migration uses the existing isolated-only script with exact account/DB/R2
assertions, protected SQL backups, local restoration and all-table fingerprints.
Applied only to `chatgun-issue13-staging`, DB `275d9820-6aec-494a-8bb5-b7ed9b8b74cc`:
one migration; schema20; FK0; all53 existing application tables unchanged. Production
and original `chatgun-auth-staging` were not selected. Protected backups remain in
the private local backup directory, not GitHub. No synthetic batch cleanup.

Browser tests distinguish mocked UI contracts from real-handler local integration;
neither is real youth admission, genuine OAuth nor genuine Cloudflare MFA evidence.
Final local runs: **220 unit/integration/security PASS;93 mocked UI PASS;10 full-system
local browser journeys PASS;0 failed;0 skipped**. All browser widths390/768/1440
were exercised. Three full-system journeys use actual auth/Social handlers plus
SQLite with a corrected, held synthetic account; Social APIs deny access, account
rights are usable and deletion invalidates the session. These fixtures exist only
in the local test process, not in remote D1. The mocked UI suite separately verifies
the visible Turnstile/deletion reauthentication contract without claiming real CAPTCHA
or provider success. Screenshots: `screens/youth-held-{390,768,1440}.png` (local).
The candidate requires schema20; the schema17 Production pilot cannot receive this
build through the old release approval. Admin/MFA is paused; Free activation was
verified22 October, but no Admin app/policy was saved by this follow-up.

Public youth admission assessment: **NO-GO** until the explicit admission, policy,
safeguarding and operational decisions above are implemented and verified.
