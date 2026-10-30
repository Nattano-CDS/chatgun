## Consolidated owner review — viewer-first NEAR restoration

Owner requirement: [Issue #10 comment 6231305643](https://github.com/Nattano-CDS/chatgun/issues/10#issuecomment-6231305643).

Production: **https://chatgun.social**. Runtime commit: **`12e55fde423832152d7317c3e85bfd42f53eaf01`**. This is a guarded fictional frontend release, not activation of real-user services.

### Completed

- Current viewer's own profile is first on every Discovery page/filter state, labelled “คุณ”; anonymous visitors use only browser-local `demo-me`, visibly identified as fiction. No self-distance, fabricated rating/verification or self-social actions. Current portrait/name/bio refresh immediately after editing or primary-photo selection/deletion. API self duplicates are excluded.
- All 20 other fictional members remain: self + 16 others on page 1 and self + four others on page 2. Other-member counts/filters exclude the shortcut. No discovery/location publication occurs.
- Canonical NEAR `98bb83e` component structures, full-screen Profile, three-column Gallery and photo interactions are retained. Corrected the header separator/heading offsets, Gallery score star, newest-first private comments, inline feedback, pending-mutation/draft/exit behavior and desktop failed-image overlay interference.
- The public fictional fixture remains byte-identical: 20 portraits, 10 friends, five requests, 10 conversations/120 messages, galleries, 15 reviews and notifications. No staging batch reset/reseed/cleanup, Production D1 mutation or R2 copy/upload occurs.

### Verified evidence

| Check | Pass | Fail | Skip |
| --- | ---: | ---: | ---: |
| Unit/integration/security | 101 | 0 | 0 |
| Full stable Preview browser suite | 67 | 0 | 35 |
| Actual Production own/member journeys, 390/768/1440px | 6 | 0 | 0 |
| Additional actual Production control/media journeys | 3 | 0 | 0 |

The 35 skips are 16 deliberately unrun protected-session/live D1/R2 scenarios, 18 duplicate explicit-viewports and one desktop-inapplicable mobile case. Mocked authenticated/RBAC tests are not represented as real owner logins. No fresh OAuth callback success is claimed.

Actual canonical NEAR vs previous immutable Production vs final custom-domain Production: **36 comparisons, 30 measured components, zero dimension/vertical-position discrepancy**. This is not pixel identity: ChatGun branding, no Game, safety/fiction notices, coarse location labels and the approved self shortcut are intentional differences.

- [Complete report, limitations and rollout/rollback evidence](https://github.com/Nattano-CDS/chatgun/blob/codex/issue-10-source-components/docs/issue-10-own-first/README.md)
- [Side-by-side comparison artifact](https://github.com/Nattano-CDS/chatgun/blob/codex/issue-10-source-components/docs/issue-10-own-first/comparison.html)
- [Machine-checked final evidence](https://github.com/Nattano-CDS/chatgun/blob/codex/issue-10-source-components/docs/issue-10-own-first/test-evidence.json)
- [Own card after local profile/photo updates — mobile](https://github.com/Nattano-CDS/chatgun/blob/codex/issue-10-source-components/docs/issue-10-own-first/production-self/self-first-390.png)
- [Production Discovery — mobile](https://github.com/Nattano-CDS/chatgun/blob/codex/issue-10-source-components/docs/issue-10-own-first/production/discovery-390.png), [tablet](https://github.com/Nattano-CDS/chatgun/blob/codex/issue-10-source-components/docs/issue-10-own-first/production/discovery-768.png), [desktop](https://github.com/Nattano-CDS/chatgun/blob/codex/issue-10-source-components/docs/issue-10-own-first/production/discovery-1440.png)

Cloudflare account `23017b53386fb67fc62a52cdd017454c` verified; Production/Preview D1 remain isolated, Production R2 is unbound, no pending migrations and zero aggregate foreign-key violations. Canonical deployment metadata, custom-domain release SHA and all four changed asset hashes independently match the runtime commit.

Public registration, live OAuth/social/media/moderation, Sensitive Content and OTP remain disabled. No PR merge, PiggyPrice/original NEAR modification or legal-policy publication. Intermediate deployment history, real test failures and the interrupted network run are retained transparently in the report; only the final verified runtime is claimed here.

**GO: guarded fictional frontend. NO-GO: real-user/public Beta**, pending legal/adult-assurance/location-risk decisions and moderation/scanning/appeals/emergency/backup operations. Owner coverage remains daily 19:00–22:00 Asia/Bangkok, not 24/7. Issue #10 remains open for final owner review; no intermediate approval is requested.
