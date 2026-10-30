# JWKS fix: configuration-isolated Pages deploy (NO-GO for Production)

## Root cause and affected baseline

Attempted JWKS code deployment: `ed9df39081d2b0a6e2a0ea1ef3815e720a8a5bd4`. Reported rollback Production source: `f12466ea282355084a2cacb6d165bca20beb3b4c`. Treat both as operator-reported until independently read back from the correct Cloudflare account.

The source `wrangler.jsonc` at the JWKS code commit contains `env.production.vars.ADMIN_ACCESS_STANDALONE_ENABLED="false"`. The working Production dashboard configuration was `true`. Cloudflare Pages explicitly treats a deployment Wrangler configuration as the project configuration source of truth: deploying from that repository root can overwrite dashboard-managed vars/bindings. The JWKS code patch did not edit the flag. The deploy packaging/configuration path caused the observed regression.

**Never fix this by committing `true` to the root file or adding Admin secrets to Git.** Root `vars` and Production overrides are not authoritative for the current live protected environment. Running `wrangler pages deploy` from the source repository is prohibited for this release.

## Safe deployment isolation design

1. Keep Cloudflare Pages **dashboard-managed configuration** as authoritative. Do not opt in the source `wrangler.jsonc` to override Production.
2. Build the exact approved source in a clean release worktree; verify SHA, build tests, and generated asset hashes.
3. Get two fresh **read-only** responses from Cloudflare `GET /accounts/{account_id}/pages/projects/{project_name}`, using an authorized read-only token. Each is a protected, temporary file (0600), never Git, CI logs or chat. Both must come from the correct Cloudflare account/project.
4. Run the local `pages-isolated-release.mjs --phase pre` guard against those two snapshots, using the approved 25-point fingerprint. It rejects a changing live config and checks all 25, `ADMIN_ACCESS_STANDALONE_ENABLED=true`, all observed secret names/types, the full production configuration, compatibility fields, D1/R2 and other bindings. Secret **contents cannot be read or proven unchanged** from redacted API responses; protect them by not sending Wrangler project configuration at all and by checking authorized, non-sensitive application behavior after deployment.
5. Stage only `dist/` and `functions/` in a newly created, outside-repository temporary directory. Forbid `wrangler.jsonc`, `wrangler.toml`, `.env`, `.dev.vars`, `.wrangler`, and symlinks. Compute an asset+Functions SHA-256 manifest and verify staging bytes. The helper prints the intended Wrangler command but **cannot deploy**, even if passed `--execute`.
6. Under **separate future exact-SHA Production authorization only**, invoke a reviewed/pinned Wrangler CLI with the reported isolated `cwd`, with no `--config`, no `--env`, and no repo ancestry/config redirection. Use `wrangler pages deploy dist --project-name chatgun --branch main --commit-hash <exact-authorized-SHA>`. Never invoke from the worktree root.
7. After that future deploy, fetch a new read-only Pages project snapshot; compare to the immediately-before snapshot with `--phase post`. Abort operational activation on **any** var or binding difference; no automatic rollback or D1 restore. Require actual served exact source SHA, asset manifest, real owner LINE pilot, Access-protected Admin, disabled public endpoints and functioning approved secrets. If incomplete, remain NO-GO and separately authorize a safe previous artifact redeploy.

### Preflight example (read-only + local preparation only)

```sh
# Obtain read-only project JSON snapshots privately through the approved Cloudflare account.
# Keep both snapshot files outside Git, private permissions (0600); never echo contents.
node scripts/pages-isolated-release.mjs \
  --phase pre \
  --project chatgun \
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
  --before /private/pages-immediate-predeploy.json \
  --current /private/pages-after.json \
  --fingerprint docs/production-readiness/phase6/production-owner-pilot-fingerprint.json
```

This performs a strict configuration comparison but **does not** independently inspect remote assets, secret contents or runtime behavior; these remain separately required checks.

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

## Isolated validation and authorization boundary

Unit tests use synthetic Cloudflare project objects, fake D1/R2 IDs, disposable HTML/Functions assets, and an intentionally unsafe config to verify rejection. They make **zero** Cloudflare API calls or real deployments. An actual throwaway Cloudflare Pages project rehearsal is required before any Production redeploy request; it must demonstrate a changed test variable and secret name/type survive the config-free deploy and the post-diff gate.

Production authorization is **not requested** by this package. To request it later, attach: exact new git SHA, CI and isolated Pages proof, before/after redacted config diff, verified no-secret-replacement evidence, exact rendered asset digest, current Production fingerprint and roles summary, prior deployment rollback artifact, incident operator, and separate owner approval. This package never authorizes a role change, Access change, OAuth change, D1/R2 change, or merge.

**Status: NO-GO until isolated Cloudflare Pages rehearsal and fresh authorized snapshot validation are complete.**
