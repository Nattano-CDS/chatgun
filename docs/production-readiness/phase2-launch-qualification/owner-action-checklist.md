# Consolidated owner action checklist

Complete these in order; attach redacted evidence without secrets, tokens, account references or MFA material.

1. Approve or reject the exact five public-policy drafts and their SHA-256 manifest after qualified legal review. Approval must name the exact versions/hashes.
2. Approve or reject the four rc6 private-UAT Friends documents and the added mutual-friend processing/consent. This is separate from rc5 Direct Chat approval.
3. In provider consoles, verify the exact Production and UAT callbacks, publication/test-user status and minimum scopes for Google, Meta and LINE; then personally complete one genuine new-user and returning-user flow per provider.
4. Run the physical-device checklist on real iOS Safari and Android Chrome, including OAuth redirects, keyboards, scrolling and network changes.
5. Assign named primary moderator, backup/out-of-hours escalation owner, independent appeal reviewer, privacy/cleanup owner and incident commander. Approve achievable response targets; do not promise 24/7 coverage unless staffed.
6. Approve cleanup schedules, alert destinations, on-call owner and explicit storage/request cost thresholds. Production schedules remain off meanwhile.
7. Decide the Media operating model (human review/scanning, quarantine SLA, appeals, incident coverage). Media remains off until separately approved.
8. Review the 259-commit release-to-main integration path and stacked PR chain; approve and apply the proposed main ruleset. Enable Dependabot alerts/security updates and require Dependency Review.
9. Only after items 1–8 pass, issue an exact-SHA, exact-scope Production deployment/feature authorization. This package itself authorizes none.
