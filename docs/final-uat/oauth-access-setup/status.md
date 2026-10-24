# UAT OAuth / Access configuration execution

Application remains frozen at `4a7dee32c52bc474ee3cc50d13e293e66e771c1a`. Starting PR HEAD was `2b16100802b1fe8924ab493d64e6ffd7078033c8`; exact closing HEAD and CI are recorded in the PR closing comment. No Production deployment, migration, account change or role grant.

## Actual status — not a completion claim

| Item | Status | Verified action / blocker |
|---|---|---|
| ChatGun account, dedicated DB/R2/Workers | PASS | Account rechecked; schema21, users/identities/sessions/invitations/grants/media0, FK0; private cleanup Workers and bindings rechecked |
| Stable UAT / closed flags | PASS | Live release4a7dee3; OAuth/providers/admission/Social/media remain OFF; site key unchanged |
| Google | CONFIGURED / human OAuth NOT RUN | Created separate **ChatGun UAT** web client in project `chatgun`, with exact UAT origin/callback. New JSON downloaded once, protected0600 outside Git, moved out of Downloads. NEW ID/secret encrypted in Preview, preserved through frozen UAT redeployment and metadata read-back. External/Testing remains restricted to existing test users. OAuth/admission OFF; actual callback NOT RUN |
| Meta | CONFIGURED / human OAuth NOT RUN | Separate **ChatGun UAT**, app1546406076913004, is a test version of parent1136950635489003, not Production1732162668911193. Exact UAT callback persisted alongside inherited callbacks; UAT domain/site URL saved. Client/Web OAuth, enforced HTTPS and Strict Mode ON; embedded/device/JS SDK login OFF. Actual Advanced settings show v26.0; Require app secret/proof enabled and saved. Following owner reauthentication, only the NEW child secret was read privately and stored0600/encrypted Preview. No publication or new roles/testers. Genuine callback/token exchange NOT RUN |
| LINE | CONFIGURED / human OAuth NOT RUN | Owner completed separate channel2012186357 under ChatGun provider2005640887. ChatGun UAT, LINE Login, Thailand, Developing, Admin ownership, PROFILE/OPENID_CONNECT, email permission Unapplied. Exact UAT callback saved/read back; real UI Require two-factor switch ON. NEW channel ID/secret protected0600/encrypted Preview; old channel2012039306 untouched. No publication/tester invitations or genuine callback |
| Access API403/code1010 | API still BLOCKED; dashboard saved | Wrangler OAuth scopes have no Access Write/Edit; direct resource GET also403. Authenticated dashboard successfully saved separate UAT policy/app without API token expansion or billing changes |
| Access dashboard | CONFIGURED / genuine MFA NOT RUN | Created **ChatGun Final UAT Admin**, app c2c866d3-3d41-410b-909f-4beac2683a17; policy8fbef132-a338-4ec4-8c7e-94b29749e0d6. Exact two UAT destinations accepted and read back; session10m. Policy read-back confirms owner email AND Authentication Method `mfa` only (no PIN alternative). HttpOnly and binding-cookie hardening saved; launcher hidden because wildcard-only domains have no launch URL. Anonymous HTTP requests to both Admin paths302 to exact trusted Access team. Public auth/config remains JSON200 |
| Independent MFA | BLOCKED | Dashboard explicitly says organization MFA not turned on; app-level custom MFA unavailable. Official docs require organization-level enablement first. This is an additional organization-scope decision, not covered by silently changing UAT-only settings |
| Admin mapping/roles | NOT RUN | Verified issuer/AUD/owner-email metadata encrypted in UAT Preview and redeployed, but no owner UUID mapped, standalone/moderation OFF and no grant. Genuine UAT UUID must be privately verified and grant scope independently approved; no Production UUID/role copy or extension. Prepared UAT-only role PLAN at most8hours; no executor run |
| Turnstile | PASS configuration / NOT RUN human | Same dedicated real widget/site key/encrypted secret. Host/action checks unchanged; human challenge deferred to final campaign. No test-bypass keys |
| Live negative security | PASS |17 checks after Access setup; disabled starts, foreign origins, callbacks, invalid provider/session, two Admin edge redirects and disabled OTP; no users/flows/invitations fabricated |
| Implementation regressions | PASS | Full Node suite248 PASS,0 fail/skip. Includes new metadata-writer approval guard; affected auth/Access/invitation/LINE/middleware42 PASS before adding that guard and14 Access/boundary PASS after. Do not sum overlapping runs; mocked-provider tests are not genuine OAuth/MFA |
| Responsive closed UAT | PASS |390/768/1440 actual-host screenshots; zero JS errors/overflow |
| Genuine OAuth/MFA | NOT RUN | Final human campaign explicitly not started |

Owner replied “ทำเลย” to the consolidated confirmation. Execution was limited to UAT-only credential/Access creation; organization-wide independent MFA was explicitly excluded in the execution commentary because the owner did not select that expanded scope. No Production role, UUID mapping, invitation or account was created. Do not mistake stored credentials, an MFA policy condition or an anonymous Access redirect for genuine provider/MFA success.

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

## Single minimal owner handoff

Provider-console password/agreement steps are complete; no further provider login is requested during preparation. Remaining setup decision: independent organization MFA remains OFF. Explicitly approve enabling organization-level TOTP (potential inherited defaults for other Access apps), or approve an MFA-capable IdP design. The saved UAT owner+MFA policy stays strict, with no single-factor fallback. This decision is not silently included in the narrower UAT-only approval.

## Saved configuration evidence

- [Google encrypted metadata](google-credential-metadata.json), no credential values.
- [Meta encrypted metadata](facebook-credential-metadata.json), [LINE encrypted metadata](line-credential-metadata.json), [Access verifier metadata](access-verifier-metadata.json).
- [LINE Developing / required2FA](line-uat-developing-2fa.jpg), [exact callback](line-uat-callback.jpg).
- [Meta exact callback and preserved inherited URLs](meta-uat-callback.jpg).
- [Created Access application](access-application-created.jpg).
- [MFA-only owner policy](access-policy-mfa-only.jpg).
- Access issuer: `https://tiny-violet-2021.cloudflareaccess.com`.
- New application AUD: `8088041f16940a90a6be75ce895613fff4fcdfaf4cb076d164138867e4709dbc` (public verifier identifier, not an authorization token).
- Backend issuer/AUD/email saved encrypted; owner-UUID mapping and roles remain pending genuine UAT identity confirmation. Standalone Admin and moderation remain OFF.

Later final-campaign gates remain unchanged: owner UAT identity/least-privilege grant confirmation, distinct consenting eligible adult B, expanded Social/location/media policy/operating approval,19:00–22:00Bangkok coverage window. No invitations are issued in this configuration phase.

Sources: [Cloudflare independent MFA prerequisites](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/#prerequisites), [Google server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [LINE integration](https://developers.line.biz/en/docs/line-login/integrate-line-login/), [Cloudflare status](https://www.cloudflarestatus.com/).
