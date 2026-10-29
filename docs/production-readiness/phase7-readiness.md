# Phase 7 — Preservation candidate (Draft)

This branch updates only the proposed Production configuration and offline validation scripts. It does not deploy, migrate, publish or change live settings.

The intended configuration retains the existing LINE owner OAuth, invitation-only access, onboarding, social shell and moderation. All restricted customer features remain off. The existing 25-rule fingerprint is the baseline for review.

Before release, run npm test, the preservation verifier, both package verifiers, build, browser regression, CodeQL and the dependency audit at the exact new commit. Record results separately from Phase 6. Do not treat prior results as evidence for this head.

No Production Access, genuine MFA, RBAC, provider publication or physical-device checks were performed here. Schema 17 to 21, operational/legal gates, GitHub branch settings, backup and rollback authorization are still pending.

Decision: NO-GO until exact-head checks and separately authorized live gates are completed.
