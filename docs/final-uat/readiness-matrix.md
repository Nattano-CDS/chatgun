# Final genuine-UAT readiness

Decision: **PARTIALLY READY — EXTERNAL APPROVALS REQUIRED**. Genuine human UAT has NOT started. No invitation, genuine account, owner role grant or Production activation was performed in this preparation.

Latest OAuth/Access execution: [configuration status and consolidated handoff](oauth-access-setup/status.md). All THREE providers have exact callbacks and NEW encrypted Preview credentials, retained through frozen4a UAT deployment. TOTP availability enabled after owner confirmation; global default enforcement OFF. UAT app AND exact-owner policy explicitly require TOTP every login,10m Access session. Separate owner-only App Launcher permits device enrollment, not Admin access. No ChatGun owner UUID/roles. Prior full Node248/248 plus latest affected14/14 and live negative17/17 PASS; genuine OAuth/MFA campaign NOT STARTED.

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
| Facebook UAT OAuth | CONFIGURED / genuine OAuth NOT RUN | Test app1546406076913004; exact callback/domain/site URL, HTTPS/Strict Mode, v26.0 and app-secret-proof requirement saved. NEW encrypted Preview credentials; no publication/testers added |
| LINE UAT OAuth | CONFIGURED / genuine OAuth NOT RUN | New channel2012186357, ChatGun provider Admin, Thailand/Developing, exact callback and required2FA ON, email Unapplied. NEW encrypted Preview credentials; Production channel untouched |
| Access application / MFA | CONFIGURED / enrollment handoff | Dashboard settings reloaded/read back: independent TOTP every login on app AND owner-only policy,10m session, HttpOnly+binding cookies. Global default OFF; no MFA skip/Bypass. Owner-only launcher enrollment prepared. Anonymous302 verified; no genuine MFA success claim |
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

1. Provider configuration is complete; no more provider login is requested during preparation. All three NEW credentials are encrypted in dedicated UAT Preview, callback URLs preserved, apps unpublished. Genuine callbacks and participant tester eligibility remain for the coordinated campaign.
2. Independent TOTP is configured, with global defaults OFF. Owner must complete private authenticator enrollment through the retained Cloudflare App Launcher tab; fresh MFA/auth-time verification is part of the coordinated campaign. No QR/setup-key/OTP sharing, no single-factor fallback, Production change or role grant.
3. Privately identify and authorize A and a distinct adult B: consent, current eligible age/capacity, provider tester role, test-media consent, deletion/retention scope. Do not post identities publicly.
4. Approve the specific Social/location/private-media UAT policy package, versions, notices, appeals/emergency procedures and retained test content. Existing owner-pilot approval does not satisfy this item.
5. Confirm a testing window inside **19:00–22:00 Asia/Bangkok**, daily. No backup/independent appeals reviewer/scanner/24-hour coverage exists. Keep youth/Sensitive admission closed; no response-time guarantee.
6. After prerequisites pass, confirm exact authenticated UAT owner UUID and short-lived least-privilege roles privately. Then issue one 30-minute single-use invitation per specifically approved participant and schedule ONE coordinated human campaign. Do not issue any now.

Production expansion remains a separate decision after genuine UAT, Production-specific backups, migrations18–21 rehearsal and explicit activation approval.
