# Production deployment and rollback checklist

This is an operator checklist, not deployment authorization. Stop immediately if any exact value,
approval, backup, flag or verification differs. Never copy UAT D1/R2 data or secrets to Production.

## A. Mandatory pre-authorization gates

- [ ] Draft remediation PR is reviewed, exact-head CI passes and the approved ancestry to `main` is documented.
- [ ] Owner approves one exact Production release SHA and confirms that UAT approval is not being reused.
- [ ] Production policy versions and hashes match the intended owner-only scope; UAT rc5 is not published.
- [ ] Google, Meta and LINE console status plus each exact `https://chatgun.social/api/auth/oauth/{provider}/callback` is verified.
- [ ] Cloudflare Access issuer/audience and the owner admin identity are configured and tested with admin capabilities still disabled.
- [ ] Named moderation, security, legal/emergency and appeal owners accept the operating plan.
- [ ] A change window and explicit authorization cover backup, migrations, deployment and the closed flag set.

## B. Fresh backup and invariants

- [ ] Record exact canonical Pages deployment ID/SHA and hash the live release/asset manifests.
- [ ] Capture a fresh D1 Time Travel bookmark and a mode-0600 D1 export in a mode-0700 directory.
- [ ] Restore the export locally; verify schema17, FK0 and aggregate row counts.
- [ ] Build the exact prior SHA in `controlled-beta` mode and compare every asset with Production.
- [ ] Confirm Production R2 has no public managed/custom domain and save only aggregate object/queue evidence.
- [ ] Confirm Production and Preview bindings remain distinct.

## C. Migration window — separately authorized only

- [ ] Run `wrangler d1 migrations list` using `wrangler.jsonc`, `--env production` and the `chatgun` profile.
- [ ] Confirm pending files are exactly 0018, 0019, 0020 and 0021.
- [ ] Confirm migration directory is `migrations/production` and contains no 0022 file.
- [ ] Apply the Production lane only after owner authorization; never run generic `migrations/` against Production.
- [ ] Verify schema21, FK0, unchanged existing row counts, empty new tables and absence of `uat_authorized_identities`.
- [ ] Do not grant roles, create invitations, change accounts or enable any capability during migration.

## D. Closed release deployment — separately authorized only

- [ ] Build from a clean exact SHA with no untracked inputs.
- [ ] Verify `release.json` requires schema21, Demo is false and the asset manifest hashes match the package.
- [ ] Verify all Production release variables are the approved fail-closed values before deployment.
- [ ] Deploy once; do not change provider, registration, Social, Discovery, Messaging, Presence, Media, Sensitive, OTP, Demo or admin flags.
- [ ] Verify canonical domain/TLS, release SHA, asset hashes, D1/R2 bindings and security headers.
- [ ] Verify unauthenticated, unknown-provider and uninvited flows remain closed.
- [ ] Verify the existing owner can access account/privacy/session/deletion controls without mutating their identity.

## E. Monitoring and stop conditions

- [ ] Monitor Functions errors, auth failures, D1 latency/errors, cleanup queues and unexpected R2 reads.
- [ ] Stop on schema mismatch, identity mismatch, provider callback drift, unexpected registration, data-count change, FK violation, public R2 access, admin-access bypass or elevated error rate.
- [ ] Do not enable another feature to work around a failed smoke test.

## F. Application rollback

- [ ] Disable admission/features first if safety or authorization is uncertain.
- [ ] Redeploy the verified private artifact for SHA `a73ff21c615dabb6a0c19c0a22685c2370958ca1` or use the recorded successful Pages deployment.
- [ ] Keep additive schema21 in place when rolling application code back; do not destructively down-migrate.
- [ ] Verify canonical SHA/assets, owner login, closed registration and all restricted flags after rollback.

## G. Database recovery — separate destructive authorization required

- [ ] Prefer forward repair. Use D1 Time Travel/export restoration only for demonstrated data corruption and explicit authorization.
- [ ] Preserve the failed database and audit evidence before recovery.
- [ ] Restore to an isolated database first and compare schema/counts/critical invariants.
- [ ] Reapply account/media deletion intents and revocations before any recovered environment can serve traffic.
- [ ] Rebind Production only in the approved recovery window, then verify FK0, sessions, roles, invitations and queues.
- [ ] Record the incident, recovery point, data-loss interval and owner sign-off without exposing personal data.
