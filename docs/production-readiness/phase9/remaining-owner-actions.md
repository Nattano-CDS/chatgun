# Remaining owner-only action sheet

Complete these in order. Do not send credentials, MFA codes, provider subjects or private account references to GitHub.

1. **Production Access:** approve two self-hosted applications for `chatgun.social/app/moderation*` and `chatgun.social/api/admin/*`, owner-only identity, MFA every login and 10-minute sessions. Approve encrypted issuer/audience configuration and the genuine negative/expiry/revocation test. No bypass/service-token policy.
2. **Providers:** use 2-step/MFA to read back the existing LINE Production channel and run the genuine owner flow. Decide whether Google remains External/Testing. Decide Meta icon/business/review/publication scope. Authorize genuine Google or Meta tests only after deciding they belong in this release.
3. **Repository:** approve `main` protection/ruleset requiring pull requests, one approval, `local-regression`, `javascript`, `CodeQL`, all three master-matrix jobs and Cloudflare Pages; dismiss stale approvals; require conversation resolution; block force-push/deletion; enable Dependabot alerts and security updates.
4. **People:** privately name primary moderator/incident commander, backup moderator, independent appeal reviewer, privacy/deletion operator, security-alert owner and emergency/legal contact. Confirm availability, contact path and absence/shutdown authority.
5. **Cleanup:** approve the exact proposed schedules, retention scope, alert destination/thresholds and responder. Authorize deployment only after schema21; retain `RETENTION_CLEANUP_ENABLED=false` and `MEDIA_CLEANUP_ENABLED=false` until post-deploy verification passes.
6. **Physical device:** on an actual iPhone Safari, verify login, onboarding/profile, Chat scroll/composer with virtual keyboard, image viewer, safe areas, session persistence and touch targets. Record device/iOS/Safari versions and PASS/FAIL without identifiers.
7. **Migration:** approve the four exact hashes, maintenance window, primary operator, independent verifier, fresh backup and rollback authority. Migration approval is separate from deployment approval.
8. **Release:** after all prior evidence passes, approve the final exact SHA and owner-pilot scope. Keep public registration, Discovery, messaging, Media, Presence, Sensitive, OTP, Demo, ratings and identity verification disabled.

Until all items are complete, the release decision remains **NO-GO**.
