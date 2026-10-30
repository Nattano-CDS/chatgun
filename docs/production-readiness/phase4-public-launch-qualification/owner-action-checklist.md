# Consolidated owner action checklist

Complete these in order. Do not include passwords, MFA codes, OAuth secrets, cookies, private account references or tokens in evidence.

## 1. Provider-console qualification — unlocks OAuth and device testing

1. Google: open <https://console.cloud.google.com/auth/overview>, select the intended ChatGun project, then verify Audience/publication, Clients and Data Access. The Production callback must be exactly `https://chatgun.social/api/auth/oauth/google/callback`; use only approved minimum scopes. Then run one genuine new-user flow, cancel/error flow, logout/returning login and session recovery on the isolated release candidate.
2. Meta: open <https://developers.facebook.com/apps/>, select the intended ChatGun app, verify Live/App Review/test-role state, Facebook Login settings, exact `https://chatgun.social/api/auth/oauth/facebook/callback`, approved domains and minimum scopes. Then run genuine new-user, cancellation/error and returning-login journeys.
3. LINE: open <https://developers.line.biz/console/>, select the intended Production Login channel, verify publication/tester state and exact `https://chatgun.social/api/auth/oauth/line/callback` with `openid profile`. Run a fresh release-candidate reauthentication and cancellation/error smoke. Existing RC6a returning-session evidence is reusable, but does not prove public publication.

Record only redacted console state, timestamps and sanitized application results. Never export client secrets.

## 2. Physical-device execution — unlocks mobile launch qualification

Use one real iOS Safari device and one real Android Chrome device. For each, record device model, OS, browser version, network and timestamp, then:

1. complete genuine approved-provider login and callback;
2. create/open profile and voluntary approximate Discovery;
3. request/accept a friend and exchange text messages;
4. verify oldest-to-newest order, newest at bottom, keyboard/safe area, near-bottom auto-scroll, older-message position and New messages indicator;
5. switch online → offline → online and confirm recovery without duplication or loss;
6. block and unblock, confirming friendship is removed and not automatically restored;
7. close/relaunch the browser and verify returning session behavior;
8. confirm Media remains unavailable.

Mark every row PASS/FAIL/BLOCKED. Desktop emulation is not a substitute.

## 3. Public policy and operations — required before accepting public users

1. Obtain qualified review and explicit exact-hash approval for the five public drafts in `../phase2-launch-qualification/policy-manifest.json`.
2. Assign named primary moderator, backup/out-of-hours escalation owner, independent appeal reviewer, privacy/deletion owner and incident commander. Approve coverage and response targets that do not imply unstaffed 24/7 service.
3. Approve privacy/media cleanup schedules, alert recipients, acknowledgement/escalation paths and absolute cost thresholds. Run one controlled alert-delivery and cleanup-retry test.
4. Keep Media disabled. A later full launch requires separate Media policy, staffing/scanning, quarantine, appeals, deletion and exact-scope activation approval.

## 4. Repository governance — required before integration

1. Review PR #25 and its dependency on PR #24; select and document the ordered integration path to `main`. Do not collapse 178 commits/3,393 changed files into an unaudited direct merge.
2. Open <https://github.com/Nattano-CDS/chatgun/settings/rules>, review `../phase2-launch-qualification/proposed-main-ruleset.json`, then apply an approved main ruleset with review, linear history and the exact required checks.
3. Open <https://github.com/Nattano-CDS/chatgun/settings/security_analysis>; enable the dependency graph, Dependabot alerts and Dependabot security updates.
4. Move `.github/dependency-review.yml.proposed` to the workflows directory only after the dependency graph is enabled, obtain a genuine green run, and make `dependency-review` required.

## 5. Final authorization boundary

After items 1–4 have verified evidence, produce a new main-targeting exact release SHA/tree/artifact manifest and rerun only affected checks. A separate exact-SHA Production deployment and phased feature-activation authorization is mandatory. This checklist does not authorize merge, deployment, configuration changes or public activation.
