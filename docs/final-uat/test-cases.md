# Single-operator dual-device/two-account private UAT

Status: **NOT RUN — rc5 approval and truthful owner attestations BLOCKED**. Do not fabricate results from synthetic sessions or describe the two accounts as two humans. Freeze exact SHA, provider IDs, acceptance versions and flags before scheduling. The campaign requires one verified adult owner operating A=LINE and B=Google on two devices; both provider identities must be distinct, personally controlled, provider-test eligible and specifically authorized.

Use PASS / FAIL / BLOCKED / NOT RUN per case. Record time, deployment ID, provider, internal identity reference, width and minimized evidence; never passwords, tokens, cookies, invitation fragments, precise locations or private member information.

| Cases | Action / evidence | Current genuine result |
|---|---|---|
| AUTH01–06 | Owner completes genuine LINE A and Google B OAuth on separate devices: identity-specific invitation bind/consume, callback/state/nonce, Turnstile/applicable MFA, session, cancellation, replay and provider mismatch | BLOCKED: rc5 approval/owner identity attestations |
| AUTH07–10 | Acceptance initially unchecked; one operator age/Terms evidence; interrupted recovery; onboarding; repeat login no duplicate; exact LINE/Google subjects differ; third identity rejected | NOT RUN |
| ADMIN01–07 | Admin role flows | BLOCKED / OUT OF SCOPE: no Admin grants authorized |
| PROF01–05 | Name/bio/interests/profile photo, visibility/privacy, persistence/reload, own Discovery card first | NOT RUN |
| DISC01–05 | Only admitted eligible users; explicit location permission; coarse distance/no exact coordinates; filters/pagination; block/hide/revoke exclusion | NOT RUN |
| CHAT01–08 | Owner-operated A↔B functional chat across two devices: persistent text/read/unread/inbox, retry/unsend, privacy isolation, block and report | NOT RUN — never label as independent two-human experience evidence |
| PRES01–06 | Opt-in heartbeat, actual visible/hidden browser activity, multiple devices,90-second expiry, opt-out, logout/session expiry/block | NOT RUN |
| MED01–10 | Media/Gallery upload, sharing and moderation | BLOCKED / OUT OF SCOPE; flags remain OFF |
| SAFE01–08 | Real report/block and private review; proximity rating; appeals/notifications; reporter/evidence privacy; safety hold/correction/withdrawal remains fail-closed; CSRF/replay/cross-user denial | NOT RUN |
| DEL01–04 | After separate owner YES: de-enroll B, revoke sessions, delete only ChatGun UAT Google-linked identity/account, verify retries/receipt; never delete external Google, LINE or Production identity | NOT RUN |
| UX01–10 |390/768/1440, keyboard/focus/back/loading/error/offline/empty/permission states, no overflow; approved NEAR styling/no Game | NOT RUN genuine; independent synthetic/closed evidence exists |
| OPS01–05 | Foreground/background requests, midnight session continuity, rate limits, D1 integrity, explicit close, 7-day logical cleanup, 90-day minimized evidence, no Production/R2 changes | NOT RUN genuine |

Any scenario that genuinely requires two independent human decision-makers, consent judgments, reporting perspectives or appeal independence is **BLOCKED / NOT RUN** until separately consented humans exist. Passing A↔B actions proves only dual-account functionality under one operator.

## Independent preparation evidence (not genuine-user substitutes)

- Existing frozen baseline:238 unit/security +93 mocked UI +10 local-handler +10 prior Cloudflare full-system +11 prior Cloudflare youth, all final runs pass, no final skips. Reused because application unchanged.
- New dedicated-target actual Cloudflare campaign: `full-system-cloud-browser.json`,10/10 pass. Synthetic sessions/grants30minutes; no OAuth identities.
- New infrastructure tests: `test/final-uat-infrastructure.test.js`,4/4 pass (binding isolation, deploy vars/sitekey regression,21 checksums, cascade-safe account cleanup counts).
- Stable-host JSON/anonymous denial,39 asset hashes and three responsive closed-state captures: `http-browser-verification.json`.
- One30-second synthetic foreground-inbox sample: `authenticated-request-observation.json`; not a billable-usage/capacity estimate. Actual hidden-tab campaign remains NOT RUN; prior deterministic tests verify app visibility guards.
- Cleanup exact batch only, revoke sessions/grants, delete disposable synthetic accounts after protected backup, preserve minimized audit; `cloud-cleanup.json`, `disposable-account-cleanup.json`.
- Genuine Access MFA, all three new-host OAuth callbacks and positive human Turnstile are explicitly **NOT PASS** until completed.

Do not run old issue13 hardcoded fixture/cleanup tools on this environment. New tools hardcode the dedicated UUID and validate account/bindings/manifest. Never sweep historical manifests. Do not restart the full project or rerun unchanged cases simply for appearance.
