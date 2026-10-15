# ChatGun data retention matrix (design proposal)

Status: owner/legal/engineering review draft. These periods are **not approved public
commitments**. They must not be copied into a published policy until the enforcement
controls and provider capabilities in this document have passed verification.

Reviewed against authentication code on PR #3 at commit `59a58f7` and the read-only D1
metadata available on 16 October 2026. No Production records were queried or changed.

## Proposed matrix and enforceability

| Data category | Proposed period | Current implementation | Gap and enforceable control |
| --- | --- | --- | --- |
| Active account and profile | Account lifetime | `users` stores email, verification time, display name, avatar URL, status and timestamps. No inactivity policy. | Feasible after owner defines “account lifetime,” dormant-account handling, and deletion exceptions. Add user-facing deletion and an inactivity review before promising. |
| Provider identities | Account lifetime or until unlink/deletion | `identities` stores provider, subject, provider email/verification and login times. Cascades when `users` is deleted. | No unlink/delete endpoint. Add authenticated unlink safeguards and deletion workflow. Never allow unlinking the last usable login method without recovery. |
| OAuth state, nonce and PKCE verifier | 10 minutes | `oauth_flows.expires_at` is set to 600 seconds. A successfully consumed flow is deleted. Expired, abandoned flows remain in D1. | Logical validity is 10 minutes, but physical retention is indefinite. Daily cleanup: `DELETE FROM oauth_flows WHERE expires_at < now`. Treat nonce and PKCE verifier as security-sensitive. |
| Authentication session | Maximum 30 days | Session cookie and `sessions.expires_at` are 30 days. Logout sets `revoked_at`. Expired/revoked rows remain. | Logical access expiry is enforced; physical retention is not. Daily cleanup after a short incident-response buffer approved by the owner, never longer than the published cap. Clarify whether “30 days” means usable session or physical row retention. |
| Rate-limit identifiers | Maximum 7 days | HMAC/hashed key, scope, window and counter are stored. `expires_at` is two windows (for current scopes, typically 20 minutes or 2 hours), but rows are never purged. | A 7-day maximum is feasible and conservative if a daily job removes rows older than `MIN(expires_at, created-policy-cap)`. Current table has no `created_at`; `window_start` can be used or a migration can add it. |
| OTP challenges | Not applicable while disabled; purge test/legacy rows | Schema remains. API feature flags reject Email/Mobile OTP. If enabled, code expiry is 5 minutes but rows remain after expiry/use. | Before launch, audit counts without reading destinations, purge staging test rows, and define a cleanup rule. Do not promise “no OTP data” if historical test data exists. Production deletion requires separate authorization. |
| Security/application logs | Proposed 90 days | Application emits structured error events without intended email/name fields, but Cloudflare invocation metadata may contain request identifiers, IP/User-Agent or URL data. Native Workers Logs retains at most 3 days (Free) or 7 days (Paid), according to current docs. No 90-day archive is configured in code. | Ninety days is not currently enforceable. Owner must choose: shorten the policy to verified native retention, or configure a minimized Logpush/OpenTelemetry destination with deletion/lifecycle at 90 days, access controls, regional/transfer review and cost approval. Never add raw OAuth codes, tokens, email or provider subject to logs. |
| User-generated content | Until user deletion/account deletion, subject to justified exceptions | No posts/messages/follows/reports/block schema exists in `main` or PR #3. | Cannot approve this period yet. Define content taxonomy, ownership, conversation integrity, safety evidence, legal holds, anonymization and third-party rights before social features launch. |
| Account deletion in primary data | Target within 30 days | No endpoint, queue, state machine or deletion receipt exists. `users.status='disabled'` can immediately block access; deleting a user cascades identities/sessions. | Treat 30 days only as a service target until the workflow in `account-deletion-design.md` is implemented and tested. Immediate access disablement should be separate from final erasure. |
| Backup/history deletion | Target within 90 days, subject to actual capabilities | D1 Time Travel is always on for supported production databases and retains restore history for 7 days (Free) or 30 days (Paid). Account plan/storage version and any manual exports were not established by repository code. | Inventory plan, D1 version, manual exports, R2/third-party backups and local dumps. D1 history has no documented per-row erasure. A 90-day outer target is plausible only after every copy and lifecycle is verified. Maintain a restore runbook that reapplies deletions. |
| Deletion completion receipt | Short period approved for audit/complaints | No deletion receipt exists. | Store random request ID, timestamps, policy/code version, result and non-identifying counts. Do not retain email/provider subject. If a keyed pseudonymous suppression value is needed to prevent restoration, classify it as personal data, restrict access, and expire it with the backup window. |

## Required cleanup architecture

1. Add a dedicated maintenance Worker with a D1 binding and daily Cron Trigger. Do not
   rely on a browser request to trigger deletion.
2. Delete in bounded batches so one run cannot exceed Worker/D1 limits.
3. Make jobs idempotent and record only aggregate job metrics without raw identifiers.
4. Suggested order: expired OAuth flows; expired/revoked sessions; expired rate-limit
   windows; disabled OTP challenges; completed/cancelled deletion requests.
5. Alert on cleanup failures without logging row contents.
6. Test each policy with a fixed clock in Preview and verify both logical rejection and
   physical row removal.

## Cloudflare constraints affecting policy text

- D1 Time Travel is automatic and supports restoration within 30 days on Workers Paid or
  7 days on Workers Free. A row deleted from the live database can therefore remain in
  provider-managed recovery history until that window expires.
- Native Workers Logs documents a maximum of seven days, not 90 days. A 90-day security
  log policy needs a separately configured destination and lifecycle controls.
- The D1 database currently reports APAC placement with no jurisdiction constraint. Data
  locality and cross-border transfer wording need legal and provider-contract review.
- Any manual `wrangler d1 export`, R2 export or downloaded backup becomes a separate copy
  with its own retention and deletion responsibility. No repository control currently
  inventories such copies.

## Acceptance criteria before publishing retention periods

- Automated Preview tests demonstrate deletion after each expiry boundary.
- A read-only Production configuration check confirms the Cloudflare plan, D1 Time Travel
  duration, log settings and all export destinations.
- The operator approves cost and operational ownership for scheduled cleanup/log storage.
- Legal counsel approves the purpose, legal basis and exception period for each category.
- The privacy notice states actual periods or understandable criteria, not aspirational
  targets.
