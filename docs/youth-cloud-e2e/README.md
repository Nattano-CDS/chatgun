# Repeatable isolated youth-hold E2E

See [owner report](report.html) and [sanitized results](results.json). Screenshots
are actual Cloudflare-rendered pages of synthetic accounts, not real OAuth UAT.

Only `chatgun-issue13-staging` / DB `275d9820-6aec-494a-8bb5-b7ed9b8b74cc` is
selectable. Exact Cloudflare account, config, DB/R2 bindings, schema20, expected
deployed SHA and closed Production gates are checked before fixture creation.
No existing fixtures are reset. Do not point this suite at Production or original
staging. No provider identity, media object, profile or Admin grant is created.

```sh
CHATGUN_ISOLATED_STAGING=issue13 EXPECTED_SHA=<verified-40-character-Preview-SHA> node scripts/youth-cloud-fixtures.mjs prepare
CHATGUN_ISOLATED_STAGING=issue13 npx playwright test --config=playwright.youth-cloud.config.js
CHATGUN_ISOLATED_STAGING=issue13 node scripts/youth-cloud-fixtures.mjs verify
```

Prepare creates10 new unmistakably synthetic actors:9 held-account cases and one
held session-control actor. It stores sessions/manifests and before-SQL privately
under the existing0700 backup directory, files0600, with a local pointer. Never
print/copy the manifest to GitHub/chat/public artifacts. Fixture server sessions
expire after at most30minutes. Tracing/video are disabled to avoid storing cookies.
The browser suite independently verifies each `/api/auth/me` account ID equals
the exact newly created manifest actor before any account mutation/deletion.

The nine deletion cases delete **only newly created actors** via real authenticated,
CSRF-protected UI/API. The control actor remains held and has no profile or roles.
`verify` first revokes every remaining session in this exact manifest, then checks
expected deletions, FK integrity, absence of provider identities/media and restores
the after-export locally to compare all old row hashes against the before-export.
An earlier E2E assertion failure is not permission to delete other fixture users.
Keep the manifest/backups on failure; investigate without resetting the database.
If prepare itself fails partway, the strict full-manifest verifier intentionally
refuses an incomplete scope; preserve the protected handoff for exact-scope recovery
and do not claim cleanup completed. Any issued fixture session still has its bounded
server expiry. No general-purpose deletion/cleanup command is exposed publicly.

The dedicated config must be invoked explicitly. Default Playwright excludes this
remote suite and CI never receives Cloudflare credentials or writes remote fixtures.
Seven scope tests cover valid fixtures and rejection of Production targets,
unrelated/duplicate actors, incomplete manifests and credential-header injection.
Four further tests verify fresh/stale/expired sessions and an interrupted setup.
Fixture expiry is bounded in the very first INSERT, not a later UPDATE; a process
failure cannot leave the library's ordinary30-day session or fresh-auth evidence.

Two actual batches were run on24October2026. The first exposed only test-harness URL
canonicalization/logout timing assumptions. After corrections, a new final batch
passed11/11. Both integrity checks passed; all pre-existing rows across54tables
(including migration history) were unchanged. Across both batches:20new actors,
18authenticated deletions,2new held controls retained,0active fixture sessions,
0OAuth identities/media/Admin grants,0Production/protected-staging writes.

Tested application release remains `b84f1475cba938169bdb3bfdc95f45e9f5329f57`.
This change adds test tooling/evidence only and does not deploy application changes.
Public youth admission remains **NO-GO**, genuine OAuth/Turnstile not claimed,
Admin/MFA paused and Production unchanged.
