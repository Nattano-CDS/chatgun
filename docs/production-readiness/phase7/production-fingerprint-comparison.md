# Production fingerprint comparison

| Property | Captured Production | Phase 7 read-only result | Candidate expectation |
|---|---|---|---|
| Deployment SHA | `a73ff21c615dabb6a0c19c0a22685c2370958ca1` | unchanged | no deployment performed |
| D1 schema / FK violations | 17 / 0 | unchanged | 17→21 rehearsal only |
| Core counts | users 1; identities 1; sessions 7; messages 0; Media 0; moderation grants 2 | unchanged | preserve |
| Owner pilot | LINE, invitation, acceptance, onboarding, Social shell and moderation on | unchanged | preserve; 25/25 gate |
| Restricted features | all listed Phase 7 restricted features off | unchanged | remain off |
| Policy versions | approved Production adult/terms/privacy rc1 | unchanged | preserve |
| R2 | dedicated private Production bucket | no public/custom domain | preserve and never share with UAT |
| Asset manifest | controlled-beta release, 39 deployed assets | manifest hash matched | no deployment performed |
| Cleanup Workers/schedules | absent | unchanged | BLOCKED operational gate |
| Production Access app | absent | unchanged | BLOCKED Admin security gate |
| Phase 7 writes/mutations | n/a | 0 | 0 |

The dedicated `chatgun-final-uat` Pages project remains separate, with its own D1 and private R2. Its latest observed application SHA was `fb0210090745cdbfaaf0eb0ca68bfcb24fd6e576`. No UAT configuration or data was copied into Production.
