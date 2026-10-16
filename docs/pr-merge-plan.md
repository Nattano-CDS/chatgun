# PR #3–#6 dependency and merge plan

Current dependency graph:

```text
main
├─ PR #3 feature/cloudflare-auth
│  └─ PR #5 codex/privacy-safety
│     └─ PR #6 codex/near-migration
└─ PR #4 codex/legal-review (independent draft from main)
```

No merge is authorized by this plan.

## Conflict-free sequence

1. Finish provider, security, and Production-readiness review on PR #3. Merge only after separate approval.
2. Rebase PR #5 onto the new `main`, rerun its privacy/deletion/retention tests, and retarget it to `main`. Review account-deletion and migration 0002 ownership carefully.
3. Rebase PR #6 onto the resulting `main`, rerun the complete suite and isolated staging migration/media checks, and retarget it to `main`. PR #6 owns migrations 0003–0007, social UI/API, R2 integration, trust/safety controls, and Beta invitation flow.
4. Do not merge PR #4 wholesale. Its legal pages are draft review material and may conflict with later technical facts. After owner and qualified legal approval, create a fresh legal-only branch from the then-current `main`, copy only approved wording, verify it against the shipped controls, and open a replacement/follow-up PR.

At each step use `git range-diff` against the prior reviewed head, resolve rather than silently accept overlapping legal/config changes, and rerun unit, integration, security, Playwright desktop/mobile, migration, and staging smoke tests. Keep Production flags fail-closed through every intermediate commit.

## High-risk overlap checklist

- `wrangler.jsonc`: Preview/Production D1 and feature isolation.
- `functions/_lib/db.js` and migrations: deletion cascades, auth identity creation, invitations.
- `functions/api/auth/[[path]].js`: OAuth, account linking, reauthentication, invitation registration.
- `privacy.html`, `terms.html`, and `data-deletion.html`: approved operator wording versus actual retention/deletion/media/location behavior.
- `_headers`, `_redirects`, and canonical origin behavior.
