# JWKS fix: configuration-isolated Pages deploy (NO-GO for Production)

## Root cause and affected baseline

Attempted JWKS code deployment: `ed9df39081d2b0a6e2a0ea1ef3815e720a8a5bd4`. Reported rollback Production source: `f12466ea282355084a2cacb6d165bca20beb3b4c`. Treat both as operator-reported until independently read back from the correct Cloudflare account.

The source `wrangler.jsonc` at the JWKS code commit contains `env.production.vars.ADMIN_ACCESS_STANDALONE_ENABLED="false"`. The working Production dashboard configuration was `true`. Cloudflare Pages explicitly treats a deployment Wrangler configuration as the project configuration source of truth: deploying from that repository root can overwrite dashboard-managed vars/bindings. The JWKS code patch did not edit the flag. The deploy packaging/configuration path caused the observed regression.

**Never fix this by committing `true` to the root file or adding Admin secrets to Git.** Root `vars` and Production overrides are not authoritative for the current live protected environment. Running `wrangler pages deploy` from the source repository is prohibited for this release.

## Safe deployment isolation design

1. Keep Cloudflare Pages **dashboard-managed configuration** as authoritative. Do not opt in the source `wrangler.jsonc` to override Production.
2. Build the exact approved source in a clean release worktree; verify SHA, build tests, and generated asset hashes.
3. Get two fresh **read-only** responses from Cloudflare `GET /accounts/{account_id}/pages/projects/{project_name}`, using an authorized read-only token. Each is a protected, temporary file (0600), never Git, CI logs or chat. Both must come from the correct Cloudflare account/project.
4. Run the local `pages-isolated-release.mjs --phase pre` guard against those two snapshots, using the approved 25-point fingerprint and `jwks-production-runtime-contract.json`. It rejects a changing or incomplete read and checks the exact account/project/branch, all 25 pilot controls, `ADMIN_ACCESS_STANDALONE_ENABLED=true`, `ADMIN_CLOUDFLARE_ACCESS_REQUIRED=true`, every required secret name/type, D1/R2 binding presence, compatibility fields and every other deployable production setting. The sole excluded field is Cloudflare's internal `wrangler_config_hash`, which rotates on a config-free code upload even when effective settings are byte-for-byte unchanged; the isolated live rehearsal proves this behavior. Secret **contents cannot be read or proven unchanged** from redacted API responses; protect them by not sending Wrangler project configuration at all and by checking authorized, non-sensitive application behavior after deployment.
5. Stage only `dist/` and `functions/` in a newly created, outside-repository temporary directory. Forbid `wrangler.jsonc`, `wrangler.toml`, `.env`, `.dev.vars`, `.wrangler`, and symlinks. Compute an asset+Functions SHA-256 manifest and verify staging bytes. The helper prints the intended Wrangler command but **cannot deploy**, even if passed `--execute`.
6. Under **separate future exact-SHA Production authorization only**, invoke the contract-pinned Wrangler CLI with the reported isolated `cwd`, with no `--config`, no `--env`, and no repo ancestry/config redirection. The emitted command is `npx --yes wrangler@4.156.0 pages deploy dist --project-name chatgun --branch main --commit-hash <exact-authorized-SHA> --profile chatgun`. Never invoke from the worktree root. Reconfirm the profile's exact account before the upload.
7. After that future deploy, fetch a new read-only Pages project snapshot; compare to the immediately-before snapshot with `--phase post`. Abort operational activation on **any** var or binding difference; no automatic rollback or D1 restore. Require actual served exact source SHA, asset manifest, real owner LINE pilot, Access-protected Admin, disabled public endpoints and functioning approved secrets. If incomplete, remain NO-GO and separately authorize a safe previous artifact redeploy.

### Preflight example (read-only + local preparation only)

```sh
# Obtain read-only project JSON snapshots privately through the approved Cloudflare account.
# Keep both snapshot files outside Git, private permissions (0600); never echo contents.
node scripts/pages-isolated-release.mjs \
  --phase pre \
  --project chatgun \
  --contract docs/production-readiness/jwks-production-runtime-contract.json \
  --before /private/pages-baseline.json \
  --current /private/pages-fresh.json \
  --fingerprint docs/production-readiness/phase6/production-owner-pilot-fingerprint.json \
  --dist ./dist --functions ./functions \
  --sha ed9df39081d2b0a6e2a0ea1ef3815e720a8a5bd4
```

The helper outputs a temporary isolated staging directory, manifest digest and command **without running a deploy**. The remote project must also be checked for account ID, production branch, deployed SHA and current asset version by a separate authorized read-only Cloudflare/public endpoint inspection.

### Post-deployment check template (not executed)

```sh
node scripts/pages-isolated-release.mjs \
  --phase post \
  --project chatgun \
  --contract docs/production-readiness/jwks-production-runtime-contract.json \
  --before /private/pages-immediate-predeploy.json \
  --current /private/pages-after.json \
  --fingerprint docs/production-readiness/phase6/production-owner-pilot-fingerprint.json \
  --sha ed9df39081d2b0a6e2a0ea1ef3815e720a8a5bd4
```

This performs a strict configuration comparison and requires Cloudflare's canonical Production deployment commit SHA to exactly match the requested SHA, but **does not** independently inspect remote assets, secret contents or runtime behavior; these remain separately required checks.

## Role grants: read-only and identity-free query

The known table is `moderation_access_grants`, with `granted_at`, `expires_at` and nullable `revoked_at`. From an authorized Production D1 **read-only** session on the correct account (not the current unverified Wrangler profile), execute exactly:

```sql
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN revoked_at IS NULL AND granted_at <= unixepoch() AND expires_at > unixepoch() THEN 1 ELSE 0 END) AS active,
  SUM(CASE WHEN revoked_at IS NULL AND expires_at <= unixepoch() THEN 1 ELSE 0 END) AS expired,
  SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END) AS revoked,
  SUM(CASE WHEN revoked_at IS NULL AND granted_at > unixepoch() AND expires_at > unixepoch() THEN 1 ELSE 0 END) AS pending
FROM moderation_access_grants;
```

No `user_id`, `grant_reason`, email or token fields are selected. The two reported grants may be active, expired or revoked; **no real count is asserted here** until this read-only query is performed with the correct account. If not available, mark `BLOCKED` rather than infer status. No role grant or revocation is permitted.

## Executed isolated Cloudflare rehearsal (2026-10-30)

A disposable Pages project, D1 database, R2 bucket and synthetic secret were created in the correct ChatGun Cloudflare account. No Production project or resource was targeted.

1. The initial configured deploy exposed a synthetic marker and confirmed the synthetic secret, D1 and R2 bindings at runtime.
2. A v2 code-only artifact was staged outside the repository and deployed with pinned Wrangler 4.156.0 and no Wrangler or environment file. The marker, secret, D1 and R2 bindings all remained available; the new v2 code was served.
3. The before/after project snapshots had zero effective configuration differences and the canonical deployment source matched the requested commit. Cloudflare's internal `wrangler_config_hash` rotated, which motivated the narrowly scoped metadata exclusion described above.
4. The same config-free mechanism restored the v1 artifact. Runtime bindings remained available and the before/rollback snapshots again had zero effective configuration differences.
5. The disposable Pages project, D1 database and R2 bucket were deleted and their absence verified. No test credentials, database identifiers or secret values were recorded in Git.

Focused automated coverage now includes: active Admin `true` to `false` rejection; plaintext, secret-name/type, D1, R2 and compatibility drift; identically incomplete read rejection; internal-hash-only rotation; config-free staging; forbidden config/environment files and symlinks; exact postflight SHA; and a hard prohibition on deployment execution from the preparation helper.

## Fresh Production read-only verification (2026-10-30)

- Correct account/project snapshots agree with zero effective configuration differences. All 25 owner-pilot preservation checks pass, plus `ADMIN_ACCESS_STANDALONE_ENABLED=true`, Access-required `true`, 15 required secret bindings, D1 `DB` and R2 `MEDIA` presence.
- Canonical Production remains `f12466ea282355084a2cacb6d165bca20beb3b4c`; the failed JWKS deployment is not live. Schema is 21, foreign-key violations are zero and aggregate records remain users 1, identities 1, sessions 8, invitations 1, role grants 2, Admin sessions 0.
- Read-only role classification: one `report_reviewer` and one `safety_admin`; both expired, with zero active, revoked or pending grants. No identity field was selected.
- `/api/admin`, `/api/admin/session`, `/api/admin/roles` and `/app/moderation` all remain Access redirects. Live auth configuration remains LINE-only, invitation-only and public registration closed. Live Social configuration keeps Discovery, Messaging, Media, Presence, OTP, Demo, Sensitive Content and account moderation disabled.
- The private rollback artifact for the live SHA is present with directory 0700/file 0600, 40 immutable files matched, schema 21 required and Production writes zero.

## Isolated validation and authorization boundary

Unit tests use synthetic Cloudflare project objects, fake D1/R2 IDs, disposable HTML/Functions assets, and an intentionally unsafe config to verify rejection. A missing account marker, required secret, D1 binding or R2 binding blocks even when both snapshots are identically incomplete. The executed throwaway Cloudflare rehearsal above supplies the separate real-runtime evidence.

Production authorization is **not inherited** from any earlier approval. After the final commit and exact-head CI pass, a new request must attach: exact new git SHA and tree, CI and isolated Pages proof, before/after redacted config diff, verified no-secret-replacement evidence, exact rendered asset digest, current Production fingerprint and roles summary, prior deployment rollback artifact, incident operator, and separate owner approval. This package never authorizes a role change, Access change, OAuth change, D1/R2 change, or merge.

**Status: engineering gates complete; Production remains unchanged and NO-GO until exact-head CI is green and a fresh, narrowly scoped exact-SHA deployment authorization is provided.**
