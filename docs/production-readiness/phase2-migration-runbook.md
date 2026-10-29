# Production D1 schema 17 to 21 runbook (prepared, not authorized)

No command in this runbook was executed against Production. The isolated rehearsal uses a
mode-0600 SQL export and an in-memory SQLite candidate. Production authorization must name the
exact application SHA, the four migration hashes below, the backup receipt and the maintenance
window.

| Order | Migration | SHA-256 |
|---:|---|---|
| 18 | `0018_cloudflare_admin_sessions.sql` | `d7ab7d2a438ff1c5d3c3d83cdbf35b4b7837146af3898c282714d382a7e822d6` |
| 19 | `0019_member_age_safety_holds.sql` | `696683be68db9f43efd0d62973173f28b1c4e916aca0adaaf887aab859d347e6` |
| 20 | `0020_age_hold_write_guards.sql` | `ec4774ca2db46c4525b64fe5ca266040d70443b311400579e909009c767411b9` |
| 21 | `0021_eligibility_review_requests.sql` | `0e4d2bfe7a3adcd5a86dc4f9ac6ebc5b1e21c2964aea23c709d19199586968a4` |

## Preflight and rehearsal

1. Reconfirm account `23017b53386fb67fc62a52cdd017454c`, database
   `9738a051-d914-42d0-8e7b-8098ef2b959d`, current migration count 17 and FK0 using read-only
   queries. Stop on any mismatch.
2. Create a fresh protected D1 export, store it outside Git with directory mode 0700 and file
   mode 0600, hash it and verify it restores. Do not rely on Time Travel alone.
3. Run `CHATGUN_PRODUCTION_EXPORT=<protected-path> node scripts/rehearse-production-migrations.mjs`.
   The script applies only 18–21 in memory, checks every step for FK violations, asserts existing
   row counts are unchanged, asserts new tables are empty and rejects UAT schema 22.
4. Restore the same export into a second in-memory database and verify schema17, row counts and
   FK0. This is the rollback rehearsal, not a claim that live D1 has been rolled back.

## Authorized execution and rollback

Keep all public, OAuth, Social, messaging, media and moderation flags closed. After separate
authorization, take a second immediately pre-change backup, compare the schema and hashes, apply
18–21 once, then re-run FK, migration-count and row-count checks. Stop without enabling services
if any check fails. Rollback means restoring the verified pre-change export to a separately
named recovery database, validating it, then performing an explicitly authorized binding switch
or Cloudflare recovery operation. Do not attempt down-migration SQL against live data.

Cloudflare backups and Time Travel are recovery mechanisms with their own retention; they are
not proof that a logical deletion is physically erased from all copies immediately.
