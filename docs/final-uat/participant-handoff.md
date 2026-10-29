# Private participant and provider handoff

Do not start genuine testing yet. Read `readiness-matrix.md` first. The new stable hostname really exists: `https://uat.chatgun-final-uat.pages.dev`. Never use issue13 or an immutable/random hostname for genuine OAuth.

## Provider preparation

Use separate UAT credentials; encrypted Pages **Preview** secrets in project `chatgun-final-uat`, never Production credentials. Do not publish any provider app.

| Provider | Exact callback | Required private configuration |
|---|---|---|
| Google | `https://uat.chatgun-final-uat.pages.dev/api/auth/oauth/google/callback` | New web UAT client; authorized origin `https://uat.chatgun-final-uat.pages.dev`; External/Testing; individually approved test users; `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Facebook | `https://uat.chatgun-final-uat.pages.dev/api/auth/oauth/facebook/callback` | Separate test app; Client/Web OAuth and strict HTTPS redirects; exact app-domain/platform settings; eligible real testers/admins; `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, supported `FACEBOOK_GRAPH_VERSION`; email permission remains off |
| LINE | `https://uat.chatgun-final-uat.pages.dev/api/auth/oauth/line/callback` | New web Login UAT channel, registered callback, individual Admin/Tester eligibility; `LINE_CLIENT_ID`, `LINE_EXPECTED_CLIENT_ID` equal that channel, `LINE_CLIENT_SECRET`; email permission remains off |

Google project `chatgun` and Meta ChatGun app are accessible. Their new credential creation is a security-sensitive console step requiring action-time approval/private credential handling; no creation was silently submitted. LINE console requires genuine interactive login. Do not read or rotate old secrets. Keep all current Production/Preview callbacks intact. Verify saved UAT IDs against provider metadata before enabling each provider. Do not infer login success from configured IDs.

Official sources: [Google web server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [LINE integration](https://developers.line.biz/en/docs/line-login/integrate-line-login/), [Meta Login](https://developers.facebook.com/docs/facebook-login/).

## Admin front door

ChatGun account `23017b53386fb67fc62a52cdd017454c`; confirmed team `tiny-violet-2021.cloudflareaccess.com`. New app name: **ChatGun Final UAT Admin**. API create returned403/code1010; no app/policy was saved by that request.

Protect only these exact UAT host/path destinations:

- `uat.chatgun-final-uat.pages.dev/app/moderation*`
- `uat.chatgun-final-uat.pages.dev/api/admin/*`

Allow the explicitly approved owner email `natttano@outlook.com` only; require MFA every login, bound application session, no broad Everyone/Bypass/Service-token policy. Do not protect ordinary member `/api/social/moderation/notifications` with Admin Access. Configure MFA at UAT-app level rather than changing all account apps. Verify enrollment, signed auth-time or trusted Access identity proof; token issuance is not fresh authentication. Keep the backend ten-minute check.

Only after genuine UAT identity confirmation: privately record `ADMIN_ACCESS_OWNER_USER_ID`, exact Access subject/email, issuer and app audience. Enable standalone Admin only with a specifically authorized bounded D1 grant. No role derives from email or successful Access login. Do not copy/extend Production roles or test synthetic grants. `ADMIN_ACCESS_IDENTITY_LOOKUP_ENABLED` remains off unless the real team identity response is verified.

## Participants and invitations

A = existing owner, **new authorized UAT identity**, not copied Production records. B = a separate consenting eligible adult; currently absent. Until an approved replacement capacity policy exists, use the existing adult pilot eligibility gate, never an unapproved minor. Do not collect/store DOB, identity documents or parental contact as a shortcut.

Privately record participant reference A/B, consent, eligibility basis, provider-role eligibility, approved scope, disposable-content and account-deletion permission. No invitations, genuine accounts or roles have been created by this preparation.

Once technical + policy gates are PASS, use the existing invitation hashing/transaction-binding implementation against ONLY the new D1 UUID in `environment.json`: 32-byte random token, SHA256 storage only, `max_uses=1`, expiry creation+1800s, unique participant label. No public issuer endpoint. Private0600 manifest prevents accidental duplicate issuance. Deliver directly to local Chrome in URL fragment; never logs/GitHub/screenshots/chat. Scrub fragment using the existing signup logic. Never reuse Production issuer script: it deliberately targets Production and must not be repointed casually.

During the single campaign, participant performs Turnstile, provider selection/password/MFA/consent personally. Keep their tab open. A new authentication may be required by the provider or ten-minute Admin policy; never bypass it. Do not repeatedly ask to log in during preparation. Expired/consumed invitations must be checked before any separately approved replacement.

## Policy and operating boundary

Approve UAT-specific location consent, direct messaging, private media, manual quarantine/review, reporting/blocking, appeals, account deletion, retention and emergency procedures. Current published owner-pilot policy is not automatically broader approval. Set exact approved acceptance versions only after this gate, then enable acceptance/onboarding and invitation-only OAuth in a new verified deployment.

Coverage: daily19:00–22:00 Asia/Bangkok. Reports can queue outside hours; no immediate-response SLA, backup moderator, independent appeal reviewer or scanning vendor is claimed. Keep Sensitive, youth admission, OTP, Demo and public registration off. No Production expansion is authorized by UAT completion.
