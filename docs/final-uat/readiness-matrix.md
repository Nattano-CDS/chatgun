# Final genuine-UAT readiness

Decision: **PARTIALLY READY — EXTERNAL APPROVALS REQUIRED**. Genuine human UAT has NOT started. No invitation, genuine account, owner role grant or Production activation was performed in this preparation.

Latest OAuth/Access execution: [configuration status and consolidated handoff](oauth-access-setup/status.md). Separate Google UAT client created and NEW ID/secret stored encrypted in Preview only. Owner-only UAT Access app saved with MFA-only requirement and10m session; anonymous Admin paths redirect to trusted Access team. Meta creation requires password reauthentication; LINE console requires login. Independent organization MFA remains OFF pending explicit scope approval. Live negative checks17/17 and this turn's affected Access/boundary tests13/13 pass; previous37+5 implementation results remain evidence, not genuine OAuth/MFA success.

Frozen application: `4a7dee32c52bc474ee3cc50d13e293e66e771c1a`. Initial PR #17 evidence HEAD: `e7079c692e3de3c8fb18856eb7da77916246c64e`. Closing PR comment records the eventual readiness-tooling HEAD and CI result; it is not a new application release.

| Prerequisite | Status | Evidence / exact limitation |
|---|---|---|
| ChatGun account | PASS | `23017b53386fb67fc62a52cdd017454c`, verified before writes |
| Dedicated Pages Preview | PASS | [Stable UAT](https://uat.chatgun-final-uat.pages.dev), frozen SHA verified through live release manifest |
| Dedicated schema21 D1 | PASS | `environment.json`, `schema-verification.json`; 21 ordered migrations/checksums, triggers/index inventory, FK0; no Production records copied |
| Protected backup/restore | PASS | Local 0700 directory / 0600 SQL, SQLite restore rehearsal; actual remote Time Travel bookmark obtainable. Remote destructive restore NOT RUN |
| Dedicated private R2 | PASS | `chatgun-final-uat-media`; r2.dev OFF, no custom public domains; authenticated media exercised by synthetic campaign |
| Quarantine, private grants, revocation, quotas, deletion | PASS | New target `full-system-cloud-browser.json` 10/10; unchanged unit/security baseline includes concurrency/retries/quota cases |
| Cleanup workers | PASS | New UAT-only privacy/media Workers, private endpoints, daily 03:17 / 03:37 UTC schedules; manual scoped R2 cleanup tested. First actual cron firing NOT RUN |
| Frozen application CI | PASS | Run 40008332912, exact SHA 4a7dee3, completed success; source unchanged |
| Reference evidence CI | PASS | Run 40009921495, exact SHA e7079c6, rechecked completed success |
| New infrastructure regression | PASS | 4/4 Node tests including D1 cascade-inclusive cleanup counter; subsequent PR CI result recorded in closing comment |
| New target synthetic browser journey | PASS | 10/10, 0 failed/skipped; actual Pages/D1/R2; NOT genuine OAuth or MFA |
| Stable closed-host HTTP/UI | PASS | JSON configs/health, anonymous denials, 39 asset hashes, 390/768/1440 screenshots, no overflow/script error |
| Real Turnstile configuration | PASS | Newly created UAT widget; stable hostname only; matching creation pair saved encrypted; actual invalid response rejected |
| Real human Turnstile proof | NOT RUN | Wait for the one consolidated authorized campaign; hostname/action/expiry success not inferred from synthetic tests |
| Google UAT OAuth | CONFIGURED / actual OAuth NOT RUN | Separate web client created with exact UAT origin/callback, NEW ID/secret encrypted Preview-only. External/Testing and existing test users retained; admission/OAuth OFF |
| Facebook UAT OAuth | BLOCKED human reauthentication | Create test app submitted under ChatGun1136950635489003; password re-entry required before completion. No child app or secret claimed |
| LINE UAT OAuth | BLOCKED | Developer console currently at Business ID login. Separate UAT channel/credentials/callback/tester authorization require interactive owner access |
| Access application / MFA | APP CONFIGURED / genuine MFA BLOCKED | Dashboard creation succeeded despite scoped API403. Exact owner + MFA-only policy, two UAT Admin paths,10m session, HttpOnly+binding cookies saved. Anonymous302 verified. Independent organization MFA OFF; no MFA success claim |
| Exact UAT owner subject / role mapping | BLOCKED | No genuine UAT account yet. Production UUID/roles NOT copied or extended. Exact UAT identity + bounded grant require separate confirmation |
| Participant A | BLOCKED | Owner is designated; authorized UAT identity/provider eligibility and scope still need confirmation |
| Participant B | BLOCKED | No separately consenting eligible distinct adult provided. Owner cannot act as both participants |
| Expanded policy/operating approval | BLOCKED | Existing approval is LINE owner pilot only, not wider Social/location/media UAT; acceptance disabled, unapproved legal text replaced by notice |
| Genuine human E2E | NOT RUN | Mandatory gates above blocked; no repeated owner login prompts issued |
| Production / original Staging / issue13 preservation | PASS | Read-only `isolation-audit.json`; Production SHA a73ff21, schema17, users1/identities1, original fixture counts preserved |

## Evidence distinctions

Existing frozen engineering evidence is reused, not rerun needlessly: 238 unit/integration/security, 93 mocked UI, 10 local handler browser, 10 prior Cloudflare full-system and 11 prior Cloudflare youth-safety, all final runs 0 failure/skip. Those old Cloudflare runs target issue13, not this new UAT. New environment bindings/configuration justify the additional **10** remote synthetic cases and **4** infrastructure tests here. No synthetic session establishes genuine provider, MFA, consent or real-user readiness.

Synthetic engineering Preview temporarily exercised application RBAC with short-lived synthetic member sessions, not Cloudflare Access. It was never an Admin-MFA test. Genuine UAT stays closed and Access-required. Retire intermediate engineering deployments after exact-batch cleanup; verify `deployment-retirement.json` before introducing real identities.

## Fixed readiness defect

Initial direct-upload packaging omitted plain-text vars from `wrangler.jsonc`. Wrangler preserved encrypted secrets but removed the remotely configured flags/site key. No credentials or invitations existed; registration remained closed. Deployment tooling now serializes every flag/site key into the actual deployment config and asserts live auth config. New regression tests cover this. Corrected closed-host evidence supersedes initial deployment attempts; obsolete artifacts are retired. Runtime source remains frozen.

Cleanup evidence correction: D1 `meta.changes` reported180 cascade-inclusive writes, not180 accounts. Protected before/after SQLite restores confirm9 accounts removed by cleanup and6 already deleted by browser tests, all15 manifest actors only. Corrected the JSON counter and added a regression; did not repeat deletion or change infrastructure/data to repair a report.

## Remaining owner actions — one consolidated checklist

1. Authorize/complete separate **UAT** Google client and Meta test-app credential creation through the accessible consoles; restore LINE developer login and create its UAT channel. Store only the NEW credentials encrypted in this UAT project. Never send secrets through chat/GitHub or copy Production secrets. Preserve all old callbacks; do not publish apps.
2. Finish the dedicated UAT Access application using ChatGun Zero Trust (or provide API Edit scope): exact paths in participant handoff, owner email only, MFA every login, 10-minute privileged-auth guard. Do not change organization-wide/Production access or grant roles yet.
3. Privately identify and authorize A and a distinct adult B: consent, current eligible age/capacity, provider tester role, test-media consent, deletion/retention scope. Do not post identities publicly.
4. Approve the specific Social/location/private-media UAT policy package, versions, notices, appeals/emergency procedures and retained test content. Existing owner-pilot approval does not satisfy this item.
5. Confirm a testing window inside **19:00–22:00 Asia/Bangkok**, daily. No backup/independent appeals reviewer/scanner/24-hour coverage exists. Keep youth/Sensitive admission closed; no response-time guarantee.
6. After prerequisites pass, confirm exact authenticated UAT owner UUID and short-lived least-privilege roles privately. Then issue one 30-minute single-use invitation per specifically approved participant and schedule ONE coordinated human campaign. Do not issue any now.

Production expansion remains a separate decision after genuine UAT, Production-specific backups, migrations18–21 rehearsal and explicit activation approval.
