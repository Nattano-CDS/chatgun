# Material before/after comparison

The “before” documents are the preserved Production owner-pilot files at repository root. They remain byte-for-byte unchanged. The “after” documents are separate UAT drafts under `policies/final-uat/`; they do not silently replace Production content.

| Area | Before: October 20 Production owner pilot | After: proposed October 28 isolated Social UAT |
|---|---|---|
| Legal status | Effective Production owner-pilot wording | Explicit draft banner: not approved and no effect until exact versions/hashes and retention are approved |
| Audience | Owner-only pilot | Exactly two distinct, consenting adults aged 20+ |
| Provider | LINE-only | Authorized Google, Facebook or LINE account selected privately per participant |
| Admission | Single owner invitation | Two private, one-time, non-transferable invitations; public registration remains OFF |
| Authentication | LINE OAuth/MFA | Genuine selected-provider OAuth, Turnstile and applicable provider MFA |
| Profiles | Owner profile only | Real UAT member profiles with disposable/minimal test data |
| Social availability | Discovery, Chat and Presence described as later/not open | Approved scope may be used only by A/B during the controlled campaign and only while corresponding UAT gates are enabled |
| Discovery/location | Not available; only future caveat | Voluntary approximate-location Discovery; exact coordinates are not displayed, but distance/freshness can permit location or routine inference |
| Chat | Not available; only future direct-message caveat | Direct text Chat is in scope, persisted for delivery/read/report handling, not E2EE, and recipients can retain external copies |
| Presence | Not available; future conceptual caveat | Genuine heartbeat-based presence, independently opt-in and default OFF; not location/last-seen evidence and subject to block/privacy controls |
| Privacy controls | Future-stage summary | Active privacy settings, blocking and reporting behavior for the controlled UAT |
| Lifecycle | Owner login/onboarding focus | Genuine OAuth, acceptance, account/session, revocation, close and conditional deletion lifecycle |
| Media | Future-stage media/quarantine/moderation details | Upload, public/private sharing and moderation explicitly OFF; unexpected R2 objects are defects, not authorized data |
| Other disabled features | Google/Facebook, Social and multiple later features OFF | Sensitive Content, youth admission, OTP, Demo and public registration OFF; Google/Facebook allowed only as selected private UAT providers |
| Production | Production owner pilot itself | Dedicated UAT only; Production code, configuration and approved legal files remain unchanged |
| Operating coverage | Owner moderator 19:00–22:00 with no backup/24x7 | Same genuine limitation stated consistently for the Social campaign; reports outside coverage can wait |
| Safety claims | Some limitations mixed with later-stage descriptions | No independent age verification, automated scanning, emergency service, SLA or legal certification is claimed |
| Notice | Owner-only scope and future Social descriptions | Complete two-adult scope, location inference, message/privacy/presence risks, disabled features, operational limits and retention summary |
| Terms | Owner-only LINE access and future Social terms | Two-person eligibility/admission, gated feature terms, acceptable use, Social risks, account lifecycle and UAT limitations |
| Privacy | Owner-only processing and future-stage data concepts | Actual proposed OAuth/profile/location/message/presence/block/report data, purposes, processors, sharing, security limits and participant rights |
| Deletion | Production deletion remained closed pending scope approval | Proposed campaign-close procedure with A/B distinctions, D1 transaction/check/retry evidence, R2 unexpected-object handling and recovery caveat |
| Cleanup clock | No approved seven-day Social-UAT cleanup | Proposed live-data logical cleanup within seven days after campaign close, pending explicit owner acceptance |
| Participant A | Owner account within pilot | Genuine account must not be deleted automatically; campaign data/session cleanup must not cascade-delete A |
| Participant B | Did not exist in owner pilot | Account deletion requires B's separate explicit consent; Social consent or OAuth revocation is insufficient |
| D1 | General live-data deletion caveat | Specifies approved campaign record classes, provider-linked sessions/identities, counts, transactions, foreign-key checks and bounded retries without claiming unverified automation |
| R2 | Described future media deletion queue/retry | Media remains OFF; no authorized new objects. Unexpected objects require ownership/scope verification and auditable cleanup/retry |
| Minimal evidence | Unspecified security-log duration | Only necessary consent/control, security, defect/abuse, anti-reuse and deletion evidence may remain; final unenforced duration is explicitly an owner decision |
| Backup/Time Travel | Warned that row deletion may not be immediate | Clarifies logical-versus-physical deletion, provider recovery lifecycle, no seven-day physical-erasure promise, and re-cleanup of restored snapshots |
| Version binding | Production `*-2026-10-20-rc1` files | New UAT-specific `*-social-uat-2026-10-28-rc2` identifiers and SHA-256 values |
| Publication | Root files used by Production builds | Canonical UAT drafts live separately; only the guarded UAT activation build overlays exact reviewed bytes into the isolated UAT artifact |
| Mismatch handling | Production release validation | Source, built artifact, release manifest and displayed UAT document versions/hashes must all match or activation aborts |
