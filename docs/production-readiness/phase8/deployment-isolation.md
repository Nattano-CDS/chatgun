# Production deployment isolation proposal

Status: **PROPOSED — NOT AUTHORIZED OR APPLIED**.

The `chatgun` Cloudflare Pages project is Git-connected and uses `main` as its Production branch. Merging to `main` can therefore be a deployment event. Repository integration must remain blocked until this boundary is changed and independently verified.

## Proposed supported change

In Cloudflare Pages, open **Settings → Builds → Branch control** and turn off **Enable automatic production branch deployments** for the existing `chatgun` project. Do not disconnect Git, change the Production branch, alter Preview controls, or change build/runtime configuration. The equivalent API field is `source.config.production_deployments_enabled=false`; use the dashboard unless a separately reviewed API change is authorized.

## Expected behavior and verification

1. Capture two sanitized, read-only project snapshots immediately before the change.
2. Verify the account, project name, Production branch, current live deployment, variables and binding names/types.
3. Apply only the Production automatic-deployment toggle after explicit owner approval.
4. Capture two new sanitized snapshots and verify that the toggle is false with zero other effective configuration drift.
5. Create or update a non-Production branch and verify Preview behavior remains as configured.
6. Do not merge to `main` merely to test the boundary. The first main integration still requires a monitored change window and rollback readiness.

## Manual release path

After isolation, Production releases use `scripts/pages-isolated-release.mjs`: build locally, stage only `dist/` and `functions/`, reject Wrangler/environment files, use pinned Wrangler `4.156.0`, compare sanitized Production configuration before and after, and require all preservation checks. The source `wrangler.jsonc` is not uploaded by this path.

## Risk and rollback

The operational risk is that approved Production fixes no longer deploy automatically. Record this in the release runbook and require an explicit manual deployment authorization. Rollback of the isolation setting is to re-enable automatic Production deployments only after confirming the intended Git release process and taking fresh configuration snapshots. Re-enabling it is a separate Production configuration change.

No Cloudflare setting was changed during Phase 8.
