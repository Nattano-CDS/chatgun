# RC3 → RC4 material changes

| Area | RC3 | RC4 proposal |
|---|---|---|
| Member access | One October 29 19:00–22:00 campaign | Private A/B access 24/7 until explicit owner close, withdrawal, revocation, or safety kill switch |
| Moderator coverage | 19:00–22:00 and coupled to campaign | Still 19:00–22:00, explicitly not an access window; unattended reports queue |
| Invitations | Initial enrollment inside campaign window | Initial enrollment only, single-use, 30 minutes; no nightly reinvitation |
| Returning sessions | Campaign-window assumptions | Ordinary OAuth return login and up-to-30-day sessions continue across midnight while authorized |
| Cohort | Invitation + enrollment | Durable server-side two-identity allowlist bound during participant-specific enrollment |
| Close | Scheduled end | Actual explicit owner close or scoped withdrawal/incident closure; no automatic 22:00 shutdown |
| Cleanup | Within 7 days after campaign close | Within 7 days after actual explicit close; live data may remain while UAT is active |
| Audit retention | 90 days from actual close | Unchanged; clarified as 90 days from actual explicit close with backup/Time Travel caveat |
| Participant consent | Three-hour campaign | Additional separate always-on processing consent and out-of-hours moderation acknowledgement required |
| Unchanged restrictions | Media, public/youth, Sensitive, OTP, Demo, Production off | Same; no Admin grant or public OAuth publication |

RC3 files remain unchanged at `policies/final-uat/*.html`; RC4 is isolated under `policies/final-uat/always-on-rc4/` and cannot publish unless the private receipt matches the exact RC4 versions and hashes.
