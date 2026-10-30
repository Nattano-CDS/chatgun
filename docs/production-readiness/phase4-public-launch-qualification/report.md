# Phase 4 public-launch qualification report

Recorded 2026-10-30 22:14 Asia/Bangkok. Production changes: **0**.

## Outcome

| Decision | Result | Basis |
|---|---|---|
| RC6a Friends/Messaging private UAT | **GO / PASS** | Exact isolated SHA, 11/11 genuine relationship scenarios, two owner-controlled identities, schema22/FK0, message preservation, CI 8/8 |
| Phase 1 public launch without Media | **NO-GO** | Public policies, provider publication/genuine public-candidate OAuth, physical devices, operations/alerts and repository governance remain blocked |
| Full public launch | **NO-GO** | All Phase 1 blockers plus unresolved Media operations and separate Media approval |

## Exact release evidence

- Tested application and current PR #25 head at inspection: `38804ae940203108ee08abb98f2a521559501413`; tree `883582e2826561ccfbc9f9ae631e42a6aa27df69`.
- PR #25 is Draft, clean and mergeable, targeting `codex/jwks-preservation-isolated-deploy` rather than `main`.
- Configuration-free public build: 57 files; inventory SHA-256 `1933d99dc954826ff2406085eb3b8767ad37e50de818490b9fd1b003b0ac9df1`; asset-manifest SHA-256 `bb655d3bc0a2214dff9086b1157d6caac55f0ccf593fbd5f49675bb50fbcf5ad`.
- Deployed RC6a UAT artifact inventory: `1b525c231034c9688e1bbfe94a4a52a29a23b8f510875797c12b9a510fe1ba85`.
- GitHub checks: 8/8 PASS. Focused tests: 19/19 PASS. Full unit/integration/security suite: 331/331 PASS. `npm audit`: 0 vulnerabilities.
- A fresh configuration-free local rollback artifact for the current Production SHA was rebuilt in protected storage: 76 files, inventory SHA-256 `52e309ae6b2427fec08b11479cb58317f13de7463b41821899ea98ba7bde09c2`, directories 0700/files 0600. It contains no Production configuration and authorizes no database restore.

## RC6a evidence closure

RC6a is recorded as a single-operator, dual-account functional UAT using the owner's allowlisted LINE A and Google B identities. It is not an independent two-human UAT. Final isolated state: one explicitly re-established accepted relationship, zero pending requests, zero blocks, 15 messages, zero media, two users/identities/allowlist entries and FK0. No account, message or media record was deleted. Production was not touched.

RC6a proves genuine LINE/Google UAT identity mapping, returning authenticated sessions and the approved Friends/Messaging behavior. It does not prove Google/Meta/LINE public publication, Facebook authentication, exact-RC new-user enrollment for every provider or physical mobile-device behavior.

## OAuth qualification

Implementation and automated security coverage remain PASS for state/nonce, callback binding, provider-subject uniqueness, session handling, replay resistance and generic errors. Remaining genuine gates are in the current blocker matrix:

- Google: public consent-screen/client/scope status and exact-RC new/cancel/return flows require owner console and human authentication.
- Facebook: stored dedicated UAT metadata is unpublished and genuine OAuth is NOT RUN.
- LINE: genuine RC6a returning access is reusable evidence; public channel state and a fresh public-candidate reauthentication/error smoke remain required.

No password, MFA code, assertion, cookie or provider secret should be copied into evidence.

## Physical devices

Physical iOS Safari and Android Chrome were unavailable to this workstream. Desktop Safari/Chrome and viewport automation are not counted. The smallest practical manual procedure is in the consolidated owner checklist. This gate remains BLOCKED.

## Operations, security and cost controls

- Public policy package: five complete drafts exist, but exact public approval and publication remain pending.
- Moderation/appeals: technical least-privilege workflows and runbooks exist; named backup, independent appeal and incident coverage are not confirmed. Known owner coverage of 19:00–22:00 Asia/Bangkok is not a public 24/7 SLA.
- Cleanup: the two isolated UAT cleanup Workers exist but currently have zero schedules. No Production schedule was changed.
- Monitoring/alerts: current Cloudflare credentials could not read account alert policies (403), and no ChatGun alert-delivery test or cost threshold is proven.
- Media: remains disabled and is not a Phase 1 dependency. It remains a mandatory full-launch blocker.

## Repository and integration

- `main` is unprotected and GitHub reports no rulesets.
- PR #25 depends on PR #24. The current branch is 178 commits ahead and 0 behind `main`; the aggregate diff spans 3,393 files.
- Dependabot configuration exists, but security updates and alerts are disabled and the dependency graph/SBOM endpoint is unavailable. Dependency Review is proposed but not active.
- CodeQL and secret scanning report zero open alerts; secret scanning and push protection are enabled.

The proposed ruleset and pinned Dependency Review workflow are prepared, but applying repository settings is an owner/admin action.

## Production preservation

Production remains at `c9327e7913ea09577c06b8a0f70f953f21d0aecb`, D1 schema21/FK0. Public registration, Discovery, Messaging, Media, Presence, OTP, Demo and Sensitive Content remain disabled. No Production deployment, D1/R2 write, secret/provider change, role grant, feature activation or PR merge occurred.

See `blocker-matrix.json` for the ten current gates and `owner-action-checklist.md` for the prioritized intervention sequence.
