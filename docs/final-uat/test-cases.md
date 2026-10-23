# One coordinated genuine-UAT campaign

Status: **NOT RUN — prerequisite gates BLOCKED**. Do not fabricate results from synthetic sessions. Freeze exact SHA, provider IDs, acceptance versions and flags before scheduling. Participants A and B must be distinct and specifically approved. Privileged fresh authentication remains valid at most ten minutes; coordinate necessary MFA rather than bypassing it.

Use PASS / FAIL / BLOCKED / NOT RUN per case. Record time, deployment ID, provider, internal participant reference, width and minimized evidence; never passwords, tokens, cookies, invitation fragments, precise locations or private member information.

| Cases | Action / evidence | Current genuine result |
|---|---|---|
| AUTH01–06 | LINE, Google, Facebook where individually authorized: invitation bind/consume, callback/state/nonce, session, cancellation, replay, failure message | BLOCKED: UAT credentials/tester eligibility |
| AUTH07–10 | Acceptance initially unchecked; age+Terms evidence once; interrupted recovery; onboarding activates; repeat login no duplicate; authorized distinct identity linking and cross-user rejection | NOT RUN |
| ADMIN01–07 | Genuine Access MFA; routine overview no Purpose prompt; restricted purpose; reports/members/deletions/media; least privilege/expiry/revocation; stale auth denied | BLOCKED: Access config + exact UAT role authorization |
| PROF01–05 | Name/bio/interests/profile photo, visibility/privacy, persistence/reload, own Discovery card first | NOT RUN |
| DISC01–05 | Only admitted eligible users; explicit location permission; coarse distance/no exact coordinates; filters/pagination; block/hide/revoke exclusion | NOT RUN |
| CHAT01–08 | A↔B direct chat, persistent text/read/unread/inbox; retry/unsend; notifications; block; private-media reuse denial | NOT RUN |
| PRES01–06 | Opt-in heartbeat, actual visible/hidden browser activity, multiple devices,90-second expiry, opt-out, logout/session expiry/block | NOT RUN |
| MED01–10 | Disposable public/private image upload; file validation/metadata; quarantine; manual approve/reject; quota10+10/Bangkok day; pending/rejected not visible; authorized likes/comments; private request→Chat approve/reject/revoke; raw-byte denial; deletion/retry | NOT RUN |
| SAFE01–08 | Real report/block and private review; proximity rating; appeals/notifications; reporter/evidence privacy; safety hold/correction/withdrawal remains fail-closed; CSRF/replay/cross-user denial | NOT RUN |
| DEL01–04 | Explicitly disposable B only: recent-auth+CSRF request; revoke sessions; remove identities/media; queue retries; receipt; no owner deletion | NOT RUN |
| UX01–10 |390/768/1440, keyboard/focus/back/loading/error/offline/empty/permission states, no overflow; approved NEAR styling/no Game | NOT RUN genuine; independent synthetic/closed evidence exists |
| OPS01–05 | Foreground/background request measurements, APIerrors, rate limits, D1/R2 integrity, final exact-batch backup and approved cleanup, no Production changes | NOT RUN genuine |

## Independent preparation evidence (not genuine-user substitutes)

- Existing frozen baseline:238 unit/security +93 mocked UI +10 local-handler +10 prior Cloudflare full-system +11 prior Cloudflare youth, all final runs pass, no final skips. Reused because application unchanged.
- New dedicated-target actual Cloudflare campaign: `full-system-cloud-browser.json`,10/10 pass. Synthetic sessions/grants30minutes; no OAuth identities.
- New infrastructure tests: `test/final-uat-infrastructure.test.js`,3/3 pass (binding isolation, deploy vars/sitekey regression,21 checksums).
- Stable-host JSON/anonymous denial,39 asset hashes and three responsive closed-state captures: `http-browser-verification.json`.
- One30-second synthetic foreground-inbox sample: `authenticated-request-observation.json`; not a billable-usage/capacity estimate. Actual hidden-tab campaign remains NOT RUN; prior deterministic tests verify app visibility guards.
- Cleanup exact batch only, revoke sessions/grants, delete disposable synthetic accounts after protected backup, preserve minimized audit; `cloud-cleanup.json`, `disposable-account-cleanup.json`.
- Genuine Access MFA, all three new-host OAuth callbacks and positive human Turnstile are explicitly **NOT PASS** until completed.

Do not run old issue13 hardcoded fixture/cleanup tools on this environment. New tools hardcode the dedicated UUID and validate account/bindings/manifest. Never sweep historical manifests. Do not restart the full project or rerun unchanged cases simply for appearance.
