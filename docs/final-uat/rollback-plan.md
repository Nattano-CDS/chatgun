# UAT containment, backup and rollback

Scope only: new project `chatgun-final-uat`, D1 `e3cb426c-b88a-4b93-90fd-39df524f68ae`, private bucket `chatgun-final-uat-media`. **Never** select `chatgun`, `chatgun-auth`, `chatgun-auth-staging`, `chatgun-issue13-staging`, Production R2 or original owner-review fixtures.

## Current safe checkpoint

Frozen app4a7dee3. UAT and engineering aliases closed to OAuth/admission/Social; backend Access-required and standalone Admin off. Sensitive/OTP/Demo/youth admission off. Both remaining deployments must be verified after retiring disposable engineering artifacts. No genuine invitation/account/role was issued.

Private backups are under `/Users/nattano/.codex/private-backups/chatgun/`: new `final-uat-schema-*` and exact current `development-fixtures-*` directories,0700; SQL/session files0600. Do not commit or upload them. Before-fixture row hashes, schema21 exports and after-cleanup exports permit local restore verification. SQLite restore and FK0 verified; actual remote Time Travel bookmark is available, but no remote restore has been performed. Do not promise unverified retention periods or recovery SLA.

## Before genuine campaign

1. Verify exact account, project/DB/bucket UUIDs, branch alias SHA and all flags; snapshot permitted configuration **without secret values**.
2. Capture private D1 export and current Time Travel bookmark, restore into local SQLite and check migration21/checksums/triggers/indexes/FK. For a remote restore rehearsal use another explicitly authorized disposable database, never in-place genuine data.
3. Record R2 keys and hashes for consented disposable test images privately; R2 has no assumed recoverable-trash/version backup. Take separately justified encrypted copies before any approved non-disposable deletion; no unnecessary personal-media backup. Existing automated images were disposable only.
4. Record exact participant/invitation/grant scope and expiry privately; ensure no synthetic engineering deployment remains able to bypass genuine Admin Access. `deployment-retirement.json` is required.
5. Confirm moderation19–22Bangkok, operator reachability and escalation/appeals decisions. Keep unsupported features fail-closed.

## Containment on a defect

Stop issuing invitations. Revoke only affected scoped invitations/sessions/grants; disable the affected UAT features in explicit deployment config, deploy closed checkpoint, and verify live auth/social JSON and anonymous denials. Revoking sessions is not deletion of genuine users. Do not reset browser storage, delete owner accounts, sweep R2 or restore DB blindly. Preserve minimized incident evidence with restricted access.

Use Pages rollback/redeploy only within this dedicated project and to a verified compatible schema21 candidate. A Pages rollback does not roll back D1, R2 or provider settings. Never run down-migrations/drop tables. Any destructive remote restore or genuine-account deletion requires specific reviewed recovery scope/authorization. Reconcile R2 against D1 rather than exposing missing/private objects.

## Exact synthetic cleanup already authorized

Use current private manifest only. Queue/delete its own disposable objects, revoke its sessions/grants/enrollments, export protected backup, remove only exact manifest synthetic users, retain minimized audit and migration history; FK0 and every pre-existing row preserved. No historical/owner-review batch is selectable. Restore from its protected export if needed; no Production data involved.

New scheduled Workers are UAT-only: `chatgun-final-uat-privacy-cleanup` (03:17UTC) and `chatgun-final-uat-media-cleanup` (03:37UTC), workers.dev/preview URLs off. Verify daily completions/failures and exhausted queue attempts; first scheduled firing and alert delivery are NOT yet demonstrated. Pause only these Workers via their own flags if containment requires it. Do not alter existing schedules elsewhere or buy a plan.

## Production boundary

Keep Production SHA `a73ff21c615dabb6a0c19c0a22685c2370958ca1`, schema17, owner identity/session data and expiring roles unchanged. No migrations18–21, public signup, youth admission or Social/media expansion. Genuine UAT pass leads to a separate release recommendation, backups/rehearsal and owner activation decision, not automatic deployment or merge.
