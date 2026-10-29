# One consolidated genuine-user E2E/UAT campaign

Prepared 24 October 2026. This is a plan, not a request to log in now and not permission to activate Production.

Youth admission/correction requirements and explicit non-activation boundaries are in `youth-admission-requirements.md`.

## Entry gate

1. Freeze the application commit and schema21 candidate; complete CI must be SUCCESS on the final PR HEAD. Confirm that a documentation-only evidence commit changes no application/build/Worker/migration content from the tested application SHA.
2. Record exact Preview deployment, manifest hashes, account `23017b53386fb67fc62a52cdd017454c`, isolated D1 `275d9820-6aec-494a-8bb5-b7ed9b8b74cc` and private `chatgun-issue13-media`. No Production/protected-Staging mutations.
3. Complete automated unit/security/migration, UI, real-handler and isolated Cloudflare campaigns. Synthetic sessions are not provider login evidence. Do not run fixture campaigns concurrently against the same baseline snapshot.
4. Resolve external configuration before scheduling the single human window: Cloudflare Access application/policy for the exact privately verified owner, usable MFA/fresh-auth evidence, separately scoped unexpired roles; Google/Meta authorization/publishing/tester eligibility where available; LINE genuine tester access.
5. Owner and qualified reviewer approve the actual broader social/adult pilot notice, age/capacity treatment, location residual risk, media/moderation procedure and appeal/escalation scope. Existing owner-only policy publication is not blanket public/youth permission.
6. Identify one distinct, consenting, eligible adult participant privately; the existing owner does not count as a second person. Do not issue invitations until participant and operating scope are approved. No genuine minors or parent-document collection in this campaign.
7. Confirm owner coverage19:00–22:00 Asia/Bangkok every day. No backup moderator/24×7/immediate response promise. Define escalation and independent-appeal handling or keep affected release scopes gated.

The current `issue13` environment deliberately has OAuth/new registration disabled and no configured provider/Turnstile credentials. It is an automated synthetic-test environment, not a ready-made genuine-login environment. Before the one human campaign, approve its exact genuine-UAT destination and credential scope (or a separate approved genuine staging environment), configure encrypted environment-specific provider credentials and a real Turnstile pair, allowlist the stable hostname, and register each exact `https://<approved-stable-host>/api/auth/oauth/{google|facebook|line}/callback` in its corresponding **test** application. Do not publish provider applications, copy Production secrets, bypass Turnstile, expose fixture sessions or modify the protected original Staging dataset to make that campaign appear ready. Existing genuine owner LINE evidence remains historical evidence for its actual Production pilot, not evidence for `issue13`.

## Single campaign sequence

Keep browser tabs open for the participant; never close their login/MFA/Turnstile tab. Participant enters passwords, CAPTCHA, consent and MFA personally. Use private invitation handoff only, scrub fragment from browser history, and never put invitation/session tokens or internal genuine account IDs in GitHub/screenshots. Each negative test uses separate disposable transactions; do not replay a genuine user's successful callback in public logs.

| Stage | Checks and required evidence |
|---|---|
| 1. Authentication | Genuine LINE callback/session/logout/relogin; Google/Facebook only where their real approved configurations and identities are available. Cancellation/invalid state, transaction expiry/replay, provider allowlist. Record PASS/FAIL/BLOCKED per provider, never substitute fixture tests |
| 2. Admission | Private invitation one-use binding; new pending_acceptance; unchecked confirmations; versioned evidence; onboarding persistence/activation. Existing member avoids repeated acceptance; version change requires acceptance once without repeating onboarding |
| 3. Account rights/eligibility | Use isolated synthetic held actors for under13/13–17/18–19, not real minors. Social/link/location/presence bypass rejection; correction and withdrawal; Admin uphold/defer only; same-account session rights/logout/deletion |
| 4. Profile and privacy | Name, gender, bio, interests, portrait, visibility, DM preference and online opt-in persist. Own profile first; no fake profiles/photos; blocked profiles disappear |
| 5. Discovery/location | Consent/revoke, timeout/stale coordinates, search/gender/interests/radius/pagination, coarse distance bands, no precise coordinates, repeated-query/rate-limit/blocked-viewer rejection |
| 6. Direct Chat | Both distinct participants, inbox preview, text send/retry/duplicate protection/history/unread/read/unsend, block both directions, foreground-only refresh, five-image library and approved Gallery reuse |
| 7. Presence | Default hidden; authenticated foreground heartbeat and opt-in; after-name badge on four surfaces; background/expiry/logout/multiple tabs/devices/privacy opt-out/block/hidden/held suppress badge |
| 8. Public Gallery | Separate upload page, preview/caption, signature/size/metadata, quarantine, moderator general approval, authorized full-screen/thumbnail, likes/comments/report, portrait selection, owner delete. Failed/rejected/deleted upload quota behavior; capacity12 and independent daily limits10+10 Bangkok |
| 9. Private Gallery | Exact approved lock badge, one pending Chat request, owner approve/reject, requester notification, authorized bytes/comments/metadata, owner revoke and immediate backend denial; refresh clears existing viewer; blocked/third-party access denied |
| 10. Safety | 100m server rating check/daily limits/private reviews; report categories, urgent priorities, reporter-only outcome, no reporter identity disclosure; media restriction and appeals; no Sensitive release |
| 11. Admin | Cloudflare-only authentication plus existing scoped roles, routine overview without purpose, exceptional queue/evidence purpose, 10min fresh-auth, member/deletion queues, role separation/expiry/revocation, audits and operational alerts. Do not extend owner grants automatically |
| 12. Lifecycle | Explicitly approved disposable participant deletion only; CSRF/fresh-auth/token replay rejection, session revocation, identity/profile/content handling, private R2 queue retries and reconciliation. Never delete real owner's account as a test |
| 13. Device/recovery | 390/768/1440, keyboard/focus/back/deep links, offline/slow network/error/retry/drafts, real devices if available; no fabricated data on failure |
| 14. Closeout | Consolidated defect list and one retest window, per-scenario actual result, sanitized screenshots, D1 foreign-key/identity uniqueness, scoped R2/cleanup evidence, usage review, no unrelated record changes |

## Evidence and stop conditions

Record scenario, actor class (genuine adult/isolated fixture), commit/origin/schema, expected and observed result, HTTP code, sanitized artifact, PASS/FAIL/BLOCKED/SKIP with exact reason. Do not publish raw emails, coordinates, tokens, provider subjects, passwords, private media or the genuine owner's UUID.

Stop the affected capability on any cross-user media leak, CSRF/RBAC bypass, age-hold bypass, duplicate identity, missing moderation guard, destructive unexpected migration, wrong account/binding, or unexplained data loss. Maintain accurate prelaunch state; do not switch to Demo. A provider challenge/configuration failure is BLOCKED/FAIL, not synthetic PASS.

## Release preparation — not execution

Read-only confirmed Production flag baseline (do not change as part of development):

| Setting | Preserved value |
|---|---|
| OAUTH_LOGIN_ENABLED / OAUTH_ENABLED_PROVIDERS | true / line |
| NEW_ACCOUNT_REGISTRATION_ENABLED | false |
| BETA_INVITATION_REGISTRATION_ENABLED | true; issuer stays separately owner-authorized, no new invitations issued |
| SOCIAL_APP_ENABLED / MODERATION_TOOLS_ENABLED | true / true; existing owner shell and scoped moderation only |
| ACCOUNT_MODERATION_ENABLED | false |
| PUBLIC_DISCOVERY_ENABLED / MESSAGING_ENABLED / PRESENCE_ENABLED | false / false / false |
| MEDIA_UPLOAD_ENABLED / IDENTITY_VERIFICATION_ENABLED / SENSITIVE_CONTENT_ENABLED | false / false / false |
| EMAIL_OTP_ENABLED / MOBILE_OTP_ENABLED / DEMO_MODE_ENABLED | false / false / false |
| ELIGIBILITY_REVIEW_ENABLED | unset/default false on Production; true only in isolated development configuration |

An expanded candidate needs a *new* approved exact flag manifest. Do not copy the isolated synthetic configuration into Production. Preserve the20+ owner pilot; no13+ admission or automatic hold clearing is implied by the new request queue.

- Production remains `a73ff21c615dabb6a0c19c0a22685c2370958ca1`, schema17. Isolated Preview uses schema21. Prepare additive18→19→20→21 in sequence, never reapply changed historical SQL or drop tables.
- Obtain a fresh private0700/0600 Production export and Time Travel bookmark; rehearse restore, all migrations, foreign keys/indexes, original-row fingerprints and application compatibility on a disposable clone. D1 Time Travel and R2 backups have separate lifecycles; no instant backup erasure promise.
- Approve exact release SHA, policy versions, feature flags, allowed providers, cohort and moderation roles separately. Current public registration, Discovery, Chat, Presence, uploads and Sensitive remain OFF. Never use owner-only rollout approval for the expanded candidate.
- Preserve dedicated Production DB/R2 bindings and Preview isolation; no Staging secrets in Production. Verify private buckets and deny unauthenticated bytes before any media wave.
- Roll back application to the verified healthy deployment and close capability flags first. Do not roll schema backwards destructively; keep additive schema compatible or forward-fix. Database recovery requires exact incident scope, protected backup and separate owner authorization because restoring can erase legitimate later writes.
- Post-release (only after later explicit approval): validate actual live SHA/assets, JSON config/security flags, genuine authorized session, access-denial checks, private media authorization and scoped monitoring. Never report unrestricted Production GO from development evidence alone.
