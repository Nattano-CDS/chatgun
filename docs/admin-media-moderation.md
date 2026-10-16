# ChatGun Admin Media Moderation — staging implementation

Status: engineering draft for owner, Trust & Safety, privacy, and qualified Thai legal review.
This document does not authorize Production deployment or activation of Sensitive content.

## What is implemented

- All new gallery and chat-image uploads enter `pending` review. Upload ownership, MIME signature,
  size validation, metadata stripping, private R2 storage, and deletion-queue controls remain in
  force.
- Review lifecycle (`pending`, `released`, `rejected`) is stored separately from classification
  (`general`, `sensitive`, `prohibited`).
- Only `safety_admin` can view protected media, classify it, approve/reject it, reclassify released
  media, decide appeals, or inspect decision history. Report reviewers can inspect report queues and
  overview counts but cannot retrieve media objects.
- Moderator access requires an authenticated active account, completed acceptance/onboarding,
  an unexpired/unrevoked role, authentication within ten minutes, a case-specific purpose of at
  least ten characters, same-origin CSRF on writes, and immutable audit records.
- `moderation_admin` is separate from reviewer roles. It can grant/revoke time-bounded access but
  cannot inspect reports or private media unless separately assigned the least-privilege reviewer
  role. Self-grants are rejected and every access change is audited.
- The feature branch enables the moderation API only in Preview. It does not grant any staging user
  a moderation role; role provisioning requires an owner-approved named reviewer. Production keeps
  the moderation feature flag disabled.
- Optimistic revision checks prevent two reviewers from silently overwriting each other.
- A `prohibited` decision immediately changes D1 state to deny member access and schedules private
  R2 deletion. The seven-day staging appeal window does not make the object available to members.
- Media reports use per-user rate limiting and one active/lifetime report per reporter/media pair.
  The moderation API never returns reporter identity.
- Owners can appeal rejected media. A granted appeal can restore only `general` or `sensitive`
  classification; a denied appeal accelerates deletion. Both outcomes create an in-app moderation
  notification and an audited decision.

## Sensitive content gate

Sensitive delivery requires all of the following on every original-image request:

1. authenticated session for an active, fully onboarded account;
2. normal gallery or accepted-relationship authorization;
3. no block in either direction;
4. released moderation status and `sensitive` category;
5. `SENSITIVE_CONTENT_ENABLED=true`; and
6. a current `independent_age_assurances` record created by an approved `document_review` or
   `external_provider` process.

The existing acceptance and `age_assurance_events.method=self_declaration` record is explicitly
insufficient. Identity verification is not automatically treated as age verification. Preview and
Production configuration keep `SENSITIVE_CONTENT_ENABLED=false`, so no real user can retrieve
Sensitive content. ChatGun exposes no public R2 URLs, thumbnail endpoint, or blurred derivative;
unauthorized clients receive no original, preview, or metadata-bearing placeholder.

## Registration flow after invitation removal

The current Preview code does not request or enforce a Beta invitation. A new Google, Facebook, or
LINE identity creates a `pending_acceptance` account, must complete the versioned 18+ self-
declaration and Terms/Privacy acceptance, then must complete member onboarding before reaching
Social. Self-declaration does not unlock Sensitive content. Email and Mobile OTP remain disabled.

`NEW_ACCOUNT_REGISTRATION_ENABLED=true` exists only in the Preview configuration on the migration
branch. Production remains `false`; this work does not deploy or activate public Production
registration. Dormant invitation tables remain for migration compatibility but are not restored.

## Migration 0009

`0009_media_moderation.sql` is additive. It adds classification/revision columns and creates:

- `media_moderation_decisions`
- `media_reports`
- `media_appeals`
- `independent_age_assurances`
- `moderation_notifications`

Existing released records are classified `general`; existing rejected records are classified
`prohibited`; pending records remain unclassified. No user or R2 object is deleted by the migration.

Migration `0010_moderation_access_management.sql` adds time-bounded access grants and role-change
audit events, and safely imports any explicit legacy roles. It does not assign a person to a new
role. Bootstrap, grant, review, expiry and revocation procedures are documented in
`admin-access-role-management.md`.

Before any future Production migration: create a D1 Time Travel bookmark/export, record aggregate
counts, run the migration once, validate `PRAGMA foreign_key_check`, validate category/status
counts, and keep media delivery disabled until rollback and reviewer drills pass.

## Operational blockers

- No approved independent age-assurance provider or documented manual age-review procedure.
- No named moderation primary/backup, access provisioning, coverage hours, escalation contact, or
  appeals SLA.
- No content-safety scanner/vendor. Human review is the only implemented release path and must not
  be represented as automated detection.
- No approved legal/community rules mapping examples to General, Sensitive, and Prohibited.
- No approved evidence-retention period for rejected media or appeals. The seven-day deletion delay
  is a staging engineering default, not a published commitment.
- No emergency, NCII, child-safety, or law-enforcement operating owner has been confirmed.

## Release assessment

- Staging engineering and synthetic QA: **GO** after migration/integrity verification.
- Sensitive content for real users: **NO-GO**.
- Public or Production media moderation launch: **NO-GO** pending the operational, legal,
  age-assurance, scanning, and staffing decisions above.
