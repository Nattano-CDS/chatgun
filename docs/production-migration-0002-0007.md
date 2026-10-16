# Production migration 0002–0007 runbook

Preparation only. No command in this document authorizes a Production mutation or deployment. An owner-approved maintenance window and separate execution approval are required.

## Scope and order

The current Production database has migration 0001. Apply the additive migrations strictly in order: 0002 privacy/safety, 0003 social, 0004 moderation audit, 0005 trust/safety, 0006 media decision concurrency, then 0007 controlled Beta invitations. Migration 0005 depends on `social_reports` from 0003; 0006 depends on `media_safety_reviews` from 0005; 0007 depends on `users` and `oauth_flows` from 0001.

Production must retain these fail-closed values throughout: public registration false, Beta invitation registration false, adult onboarding false, all social capabilities false, media upload false, media quarantine true, moderation tools false, and no R2 binding.

## Preflight and recovery point

1. Freeze application/configuration changes and record operator, UTC start time, release SHA, Wrangler version, and Cloudflare account ID `23017b53386fb67fc62a52cdd017454c`.
2. Run `npx wrangler@4.151.0 whoami`; stop unless the exact account appears.
3. Run `npx wrangler@4.151.0 d1 info chatgun-auth` and confirm database ID `9738a051-d914-42d0-8e7b-8098ef2b959d`, production storage backend, and expected region/size.
4. Capture schema-only export to an access-controlled, encrypted operator location: `npx wrangler@4.151.0 d1 export chatgun-auth --remote --env production --no-data --output <approved-path>/chatgun-auth-schema-pre.sql`. Do not attach it to GitHub.
5. Capture the current Time Travel bookmark with `npx wrangler@4.151.0 d1 time-travel info chatgun-auth --env production --json` and store it in the restricted change record. Cloudflare Time Travel is automatic; retention depends on the plan. Restore is destructive and needs separate incident approval.
6. Record aggregate row counts only for existing auth tables and run `PRAGMA foreign_key_check;`. Do not export or inspect personal rows for this change.
7. Run `npx wrangler@4.151.0 d1 migrations list chatgun-auth --remote --env production` and stop if history is unexpected or any migration other than 0002–0007 is pending.

## Apply and verify

With explicit Production migration approval only:

```sh
npx wrangler@4.151.0 d1 migrations apply chatgun-auth --remote --env production
```

Then verify migration history has 0001–0007, `PRAGMA foreign_key_check;` returns no rows, required tables/indexes exist, preflight aggregate counts for `users`, `identities`, `sessions`, and `otp_challenges` have not decreased, and no Beta invitation or enrollment rows were introduced by the schema migration. Reconfirm Pages Production binding `DB -> chatgun-auth`, no `MEDIA` binding, and all launch flags false. Do not deploy application code as part of the database change.

## Rollback and recovery

These additive migrations have no destructive down migration. The safest application rollback is to keep feature flags off and revert to the previously approved Pages deployment; the new unused tables/columns may remain. Do not manually drop tables or columns.

If integrity or existing data is actually damaged, stop writes, record the current bookmark, assess data written since the preflight bookmark, obtain incident approval, and only then use:

```sh
npx wrangler@4.151.0 d1 time-travel restore chatgun-auth --env production --bookmark <preflight-bookmark>
```

This overwrites the database in place, cancels in-flight queries, and can discard post-bookmark writes. Preserve the `previous_bookmark` returned by Cloudflare so the restore can itself be reversed. After recovery, rerun migration history, foreign-key checks, aggregate counts, auth smoke tests, and deletion/media-queue reconciliation before reopening access.

Reference: Cloudflare documents current bookmark and restore behavior at <https://developers.cloudflare.com/d1/reference/time-travel/>.
