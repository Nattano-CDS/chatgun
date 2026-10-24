# UAT OAuth / Access configuration execution

Application remains frozen at `4a7dee32c52bc474ee3cc50d13e293e66e771c1a`. Starting PR HEAD was `2b16100802b1fe8924ab493d64e6ffd7078033c8`; exact closing HEAD/CI are in the PR comment. No Production application deployment, migration, member-data change or role grant. The separately approved Cloudflare organization TOTP availability/enrollment-portal changes are documented below; global enforcement stays OFF.

## Actual status — not a completion claim

| Item | Status | Verified action / blocker |
|---|---|---|
| ChatGun account, dedicated DB/R2/Workers | PASS | Account rechecked; schema21, users/identities/sessions/invitations/grants/media0, FK0; private cleanup Workers and bindings rechecked |
| Stable UAT / closed flags | PASS | Live release4a7dee3; OAuth/providers/admission/Social/media remain OFF; site key unchanged |
| Google | CONFIGURED / human OAuth NOT RUN | Created separate **ChatGun UAT** web client in project `chatgun`, with exact UAT origin/callback. New JSON downloaded once, protected0600 outside Git, moved out of Downloads. NEW ID/secret encrypted in Preview, preserved through frozen UAT redeployment and metadata read-back. External/Testing remains restricted to existing test users. OAuth/admission OFF; actual callback NOT RUN |
| Meta | CONFIGURED / human OAuth NOT RUN | Separate **ChatGun UAT**, app1546406076913004, is a test version of parent1136950635489003, not Production1732162668911193. Exact UAT callback persisted alongside inherited callbacks; UAT domain/site URL saved. Client/Web OAuth, enforced HTTPS and Strict Mode ON; embedded/device/JS SDK login OFF. Actual Advanced settings show v26.0; Require app secret/proof enabled and saved. Following owner reauthentication, only the NEW child secret was read privately and stored0600/encrypted Preview. No publication or new roles/testers. Genuine callback/token exchange NOT RUN |
| LINE | CONFIGURED / human OAuth NOT RUN | Owner completed separate channel2012186357 under ChatGun provider2005640887. ChatGun UAT, LINE Login, Thailand, Developing, Admin ownership, PROFILE/OPENID_CONNECT, email permission Unapplied. Exact UAT callback saved/read back; real UI Require two-factor switch ON. NEW channel ID/secret protected0600/encrypted Preview; old channel2012039306 untouched. No publication/tester invitations or genuine callback |
| Access API403/code1010 | API still BLOCKED; dashboard saved | Wrangler OAuth scopes have no Access Write/Edit; direct resource GET also403. Authenticated dashboard successfully saved separate UAT policy/app without API token expansion or billing changes |
| Access dashboard | CONFIGURED / genuine MFA NOT RUN | **ChatGun Final UAT Admin**, app c2c866d3-3d41-410b-909f-4beac2683a17; policy8fbef132-a338-4ec4-8c7e-94b29749e0d6. Exact UAT destinations, session10m, HttpOnly/binding cookies retained. Both app and exact-owner policy now explicitly require independent TOTP every Access login. IdP-only AMR `mfa` selector replaced AFTER independent enforcement was saved/read back; no single-factor or Bypass alternative. Anonymous Admin paths302 to exact trusted team; public auth/config JSON200 |
| Independent MFA | Enrollment PASS / protected-app MFA NOT RUN | Owner completed private enrollment. Account UI matches the approved owner and lists exactly one Authenticator/TOTP device. No QR/setup key/OTP collected. TOTP availability ON; global default enforcement, IdP-MFA skip and account-wide deny remain OFF. App/policy enforcement applies only to UAT. Separate owner-only enrollment policy b3168995-89e2-4f88-ad2d-9ebf52ba7824 remains attached ONLY to App Launcher,10m policy/15m app session. Enrollment is not protected UAT app authentication or an Admin grant |
| Admin mapping/roles | NOT RUN | Verified issuer/AUD/owner-email metadata encrypted in UAT Preview and redeployed, but no owner UUID mapped, standalone/moderation OFF and no grant. Genuine UAT UUID must be privately verified and grant scope independently approved; no Production UUID/role copy or extension. Prepared UAT-only role PLAN at most8hours; no executor run |
| Turnstile | PASS configuration / NOT RUN human | Same dedicated real widget/site key/encrypted secret. Host/action checks unchanged; human challenge deferred to final campaign. No test-bypass keys |
| Live negative security | PASS |17 checks after Access setup; disabled starts, foreign origins, callbacks, invalid provider/session, two Admin edge redirects and disabled OTP; no users/flows/invitations fabricated |
| Implementation regressions | PASS | Full Node suite248 PASS,0 fail/skip. Includes new metadata-writer approval guard; affected auth/Access/invitation/LINE/middleware42 PASS before adding that guard and14 Access/boundary PASS after. Do not sum overlapping runs; mocked-provider tests are not genuine OAuth/MFA |
| Responsive closed UAT | PASS |390/768/1440 actual-host screenshots; zero JS errors/overflow |
| Genuine OAuth/MFA | NOT RUN | Final human campaign explicitly not started |

Initial “ทำเลย” authorized UAT-only provisioning; organization settings were then left unchanged. Following the explicit organization-level TOTP scope question, owner said “ทำได้เลยตอนนี้ตามคำแนะนำ”; the execution commentary specified enabling TOTP while preserving Production and roles. TOTP method availability is now ON, but global default enforcement stays OFF. No Production role, ChatGun UUID mapping, invitation or account was created. Stored credentials/policy settings/anonymous redirects are not genuine OAuth/MFA success.

## Access diagnosis and route inventory

This is not an account mix-up: Wrangler and dashboard show account23017b53386fb67fc62a52cdd017454c. Token scope listing lacks Access Write. Therefore use the authenticated dashboard rather than changing the plan or weakening Access. Dashboard also displayed an outage banner; official status at review showed the relevant recent incident resolved and live UAT APIs returned JSON200. Do not attribute the persistent scope error to an assumed outage.

Exact UAT edge destinations saved and anonymously verified:

- `uat.chatgun-final-uat.pages.dev/app/moderation*` (including moderation.html)
- `uat.chatgun-final-uat.pages.dev/api/admin/*`

The standalone UI remaps privileged calls to `/api/admin/*`. The legacy `/api/social/moderation/` routes were also examined: access, overview, capabilities, reports, media-reports, appeals, audit, members, eligibility, accounts, roles, messages/media evidence, media review/bytes, verification/verification evidence. They remain subject to server-side Access verification plus RBAC, purpose and recent-auth checks; unconfigured Access fails closed. Ordinary `/api/social/moderation/notifications` is a member-owned route and must not be swept behind an Admin edge policy. Public OAuth/auth endpoints must remain outside this Access app.

Routine overview keeps fixed audit purpose `routine_admin_dashboard_access`; no global Purpose prompt. Restricted evidence/queues retain explicit purpose, recorded decision reasons, CSRF, role expiry and ten-minute recent-auth. Signed Access issuer/audience/owner binding are required, never plain email-header trust. JWT `iat` is not treated as fresh authentication. No setting will map the owner until a genuine UAT UUID is verified.

## Exact callback / scope package

| Provider | New UAT callback | Minimal scope |
|---|---|---|
| Google | `https://uat.chatgun-final-uat.pages.dev/api/auth/oauth/google/callback` | `openid email profile`, state/nonce/S256 PKCE |
| Facebook | `https://uat.chatgun-final-uat.pages.dev/api/auth/oauth/facebook/callback` | `public_profile`, email OFF; server-side token/app validation + app-secret proof |
| LINE | `https://uat.chatgun-final-uat.pages.dev/api/auth/oauth/line/callback` | `openid profile`, email OFF, nonce/S256 PKCE |

Google JS origin: `https://uat.chatgun-final-uat.pages.dev`. No new test user or provider publishing. Existing clients/channels/callbacks preserved. Importer rejects known old IDs, wrong callbacks/status, unprotected files and overwriting existing keys. All THREE positive encrypted imports/read-backs **PASS**. Access issuer/AUD/email are also encrypted Preview-only; no UUID mapping, role/admission activation or Production change. Frozen4a redeployed to dedicated UAT; immutable URL is recorded in environment.json. Do not use project-wide secret commands that may affect both environments.

## Owner enrollment verification

After the owner replied “done”, read-only Account UI verification confirmed the approved owner email and exactly one registered Authenticator/TOTP device. Enrollment **PASS**; [non-secret device-table evidence](owner-totp-enrolled.jpg) excludes the identity diagnostics and personal identifiers. No QR, setup key, OTP or recovery information was collected. Protected UAT app MFA, signed fresh-auth timestamps and ChatGun authorization remain **NOT RUN**. No UUID mapping, role grant, invitation, account creation, deployment or feature activation was performed in this verification.

Exact prior-head CI [40074988456](https://github.com/Nattano-CDS/chatgun/actions/runs/40074988456), at `d7f21d3b204cd0bc428a181945a9f580239b1be0`, succeeded:248 Node and119 browser checks. This enrollment evidence update changes documentation only; it does not turn mocked tests into genuine OAuth/MFA evidence.

## Independent MFA implementation detail

Cloudflare distinguishes **IdP-based MFA** (`Require Authentication Method=mfa`) from **independent MFA** (`mfa_config`). Keeping an IdP-only AMR selector can reject a primary login before an independent factor is evaluated. After saving/reloading mandatory independent TOTP at app AND policy levels, replaced that IdP-only rule; exact-owner Include remains and no MFA-disabled policy was added. Every-login MFA controls the next Access login; it does not replace the backend ten-minute recent-auth guard or prove a fresh signed authentication timestamp. That remains a genuine-event test.

The App Launcher exception is Cloudflare's documented authenticator bootstrap path, not an Admin bypass: its separate policy is owner-only and attached only to App Launcher; it neither maps a ChatGun UUID nor grants a D1 role. The UAT application stays hidden in the launcher, service flags/standalone Admin remain OFF. Global defaults stay OFF, so unrelated apps do not inherit new MFA enforcement.

Sources: [Independent MFA enrollment](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/#enroll-authenticators), [IdP versus independent MFA and every-login duration](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/).

## Saved configuration evidence

- [Google encrypted metadata](google-credential-metadata.json), no credential values.
- [Meta encrypted metadata](facebook-credential-metadata.json), [LINE encrypted metadata](line-credential-metadata.json), [Access verifier metadata](access-verifier-metadata.json).
- [LINE Developing / required2FA](line-uat-developing-2fa.jpg), [exact callback](line-uat-callback.jpg).
- [Meta exact callback and preserved inherited URLs](meta-uat-callback.jpg).
- [Current independent MFA read-back](mfa-configuration.json), [organization TOTP with global defaults OFF](mfa-totp-global-default-off.jpg), [owner policy every-login enforcement](mfa-owner-policy-every-login.jpg). Initial access-verifier metadata is historical at credential-save time, not current MFA status.
- [Created Access application](access-application-created.jpg).
- [MFA-only owner policy](access-policy-mfa-only.jpg).
- Access issuer: `https://tiny-violet-2021.cloudflareaccess.com`.
- New application AUD: `8088041f16940a90a6be75ce895613fff4fcdfaf4cb076d164138867e4709dbc` (public verifier identifier, not an authorization token).
- Backend issuer/AUD/email saved encrypted; owner-UUID mapping and roles remain pending genuine UAT identity confirmation. Standalone Admin and moderation remain OFF.

Later final-campaign gates remain unchanged: owner UAT identity/least-privilege grant confirmation, distinct consenting eligible adult B, expanded Social/location/media policy/operating approval,19:00–22:00Bangkok coverage window. No invitations are issued in this configuration phase.

Sources: [Cloudflare independent MFA prerequisites](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/#prerequisites), [Google server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [LINE integration](https://developers.line.biz/en/docs/line-login/integrate-line-login/), [Cloudflare status](https://www.cloudflarestatus.com/).
