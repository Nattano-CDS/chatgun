# Separately approvable schema17→21 migration package

## Exact immutable inputs

| Migration | SHA-256 |
|---|---|
| `0018_cloudflare_admin_sessions.sql` | `d7ab7d2a438ff1c5d3c3d83cdbf35b4b7837146af3898c282714d382a7e822d6` |
| `0019_member_age_safety_holds.sql` | `696683be68db9f43efd0d62973173f28b1c4e916aca0adaaf887aab859d347e6` |
| `0020_age_hold_write_guards.sql` | `ec4774ca2db46c4525b64fe5ca266040d70443b311400579e909009c767411b9` |
| `0021_eligibility_review_requests.sql` | `0e4d2bfe7a3adcd5a86dc4f9ac6ebc5b1e21c2964aea23c709d19199586968a4` |

`0022_always_on_private_uat_cohort.sql` is explicitly excluded.

## Verified rehearsal

The protected 0600 export SHA-256 is `278c1aaf85aa10c1f79e0dc1175628f367afedcf1c46f666d14e76af8322bc61` (44,831 bytes). Offline rehearsal reached schema21, preserved all existing record counts, produced FK0 and empty new tables, and restored schema17 with the same counts/FK0. Production writes: 0. The protected backup location is intentionally absent from Git.

## Required authorization record

The owner must approve: all four hashes; exact release SHA; maintenance start/end in Asia/Bangkok; primary operator; independent verifier; immediately-pre-change protected export and recovery bookmark; stop conditions; forward-repair preference; and rollback decision authority. Deployment approval does not imply migration approval.

Immediately before execution, fail closed unless account, D1 UUID, schema17 history, row counts, FK0, backup digest, recovery point, migration hashes and closed feature flags all match. Apply through the versioned migration runner only. On uncertainty, keep services closed; do not blindly replay raw ALTER statements or down-migrate live data. Destructive restore requires a new incident backup and separate owner authorization.

This package is **ready for approval but not authorized**.
