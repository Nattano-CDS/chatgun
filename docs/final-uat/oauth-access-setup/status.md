# UAT OAuth / Access configuration execution

Application remains frozen at `4a7dee32c52bc474ee3cc50d13e293e66e771c1a`. Starting PR HEAD was `2b16100802b1fe8924ab493d64e6ffd7078033c8`; exact closing HEAD and CI are recorded in the PR closing comment. No Production deployment, migration, account change or role grant.

## Actual status — not a completion claim

| Item | Status | Verified action / blocker |
|---|---|---|
| ChatGun account, dedicated DB/R2/Workers | PASS | Account rechecked; schema21, users/identities/sessions/invitations/grants/media0, FK0; private cleanup Workers and bindings rechecked |
| Stable UAT / closed flags | PASS | Live release4a7dee3; OAuth/providers/admission/Social/media remain OFF; site key unchanged |
| Google | CONFIGURED / human OAuth NOT RUN | Created separate **ChatGun UAT** web client in project `chatgun`, with exact UAT origin/callback. New JSON downloaded once, protected0600 outside Git, moved out of Downloads. New client ID/secret saved as encrypted **Preview-only** bindings; metadata read-back PASS. External/Testing remains restricted to existing test users. OAuth/admission flags remain OFF; no claim of actual callback success or new deployment binding activation |
| Meta | APP/CALLBACK CONFIGURED; secret BLOCKED | Owner completed creation of separate **ChatGun UAT**, app1546406076913004; UI confirms test version of parent1136950635489003, not Production1732162668911193. Exact UAT callback added and persisted alongside inherited callbacks. Client/Web OAuth, enforced HTTPS and Strict Mode ON; embedded/device/JS SDK login OFF. Dedicated UAT app domain and Site URL saved. Viewing the NEW child App Secret requires separate password reauthentication; no secret obtained/stored, no app published or role added |
| LINE | LOGGED IN; creation BLOCKED on owner agreement | Authenticated ChatGun provider2005640887 with Admin role. Separate LINE Login creation form prepared: ChatGun UAT, Thailand service/owner region, Web app only. No old channel modified. LINE Developers Agreement and LY Privacy acknowledgement remain unchecked; owner must review and complete this binding step before channel creation. New channel ID/secret/callback NOT YET available |
| Access API403/code1010 | API still BLOCKED; dashboard saved | Wrangler OAuth scopes have no Access Write/Edit; direct resource GET also403. Authenticated dashboard successfully saved separate UAT policy/app without API token expansion or billing changes |
| Access dashboard | CONFIGURED / genuine MFA NOT RUN | Created **ChatGun Final UAT Admin**, app c2c866d3-3d41-410b-909f-4beac2683a17; policy8fbef132-a338-4ec4-8c7e-94b29749e0d6. Exact two UAT destinations accepted and read back; session10m. Policy read-back confirms owner email AND Authentication Method `mfa` only (no PIN alternative). HttpOnly and binding-cookie hardening saved; launcher hidden because wildcard-only domains have no launch URL. Anonymous HTTP requests to both Admin paths302 to exact trusted Access team. Public auth/config remains JSON200 |
| Independent MFA | BLOCKED | Dashboard explicitly says organization MFA not turned on; app-level custom MFA unavailable. Official docs require organization-level enablement first. This is an additional organization-scope decision, not covered by silently changing UAT-only settings |
| Admin mapping/roles | NOT RUN | No genuine UAT account exists. Owner UAT UUID must be privately verified and grant scope independently approved; no Production UUID/role copy or extension. Prepared parameterized UAT-only role PLAN, at most8hours, report_reviewer+safety_admin only, current eligible/onboarded member and10minute recent-auth guard; no executor run |
| Turnstile | PASS configuration / NOT RUN human | Same dedicated real widget/site key/encrypted secret. Host/action checks unchanged; human challenge deferred to final campaign. No test-bypass keys |
| Live negative security | PASS |17 checks after Access setup; disabled starts, foreign origins, callbacks, invalid provider/session, two Admin edge redirects and disabled OTP; no users/flows/invitations fabricated |
| Implementation regressions | PASS |37 existing relevant auth/Access/invitation/LINE/middleware cases;5 new boundary/import-error/role-plan tests. Local mocked-provider tests are not genuine OAuth/MFA |
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

Google JS origin: `https://uat.chatgun-final-uat.pages.dev`. Do not add a new test user or publish a provider. Preserve all current clients/channels/callbacks. New credential storage tool rejects known old client IDs, wrong UAT callback, public/published status, unprotected handoff files and overwriting existing credential keys. It patches only this project's **Preview** encrypted credentials; it never opens admission or grants roles. Google positive encrypted import and read-back **PASS**; Meta/LINE imports NOT RUN. Do not use a project-wide Wrangler secret command that may affect both environments.

## Single minimal owner handoff

1. In retained Chrome **Meta ChatGun UAT** tab (app1546406076913004), complete the displayed password reauthentication yourself. App and callback are saved; this separate challenge gates viewing its NEW App Secret. Do not paste a password or client secret into chat/GitHub.
2. In retained **LINE Developers** creation tab under ChatGun provider2005640887, review the prepared form/contact address and the linked LINE Developers Agreement / LY Privacy Policy. If accepted, complete those confirmations and Create yourself. Do not publish the new channel. The agent will then configure its exact UAT callback and encrypted credentials. Existing channel2012039306 remains untouched. No CAPTCHA/password/MFA/Terms action will be automated.
3. Independent organization MFA remains OFF. If enabling it is intended, explicitly approve that organization-level change (potential inherited defaults for other Access apps). Otherwise retain the strict UAT owner+MFA requirement and provision an approved MFA-capable IdP before genuine Admin UAT. No weak single-factor fallback will be enabled.

## Saved configuration evidence

- [Google encrypted metadata](google-credential-metadata.json), no credential values.
- [Created Access application](access-application-created.jpg).
- [MFA-only owner policy](access-policy-mfa-only.jpg).
- Access issuer: `https://tiny-violet-2021.cloudflareaccess.com`.
- New application AUD: `8088041f16940a90a6be75ce895613fff4fcdfaf4cb076d164138867e4709dbc` (public verifier identifier, not an authorization token).
- Backend issuer/AUD/owner-UUID mapping and role activation remain pending genuine UAT owner identity confirmation. Standalone Admin and moderation service flags remain OFF.

Later final-campaign gates remain unchanged: owner UAT identity/least-privilege grant confirmation, distinct consenting eligible adult B, expanded Social/location/media policy/operating approval,19:00–22:00Bangkok coverage window. No invitations are issued in this configuration phase.

Sources: [Cloudflare independent MFA prerequisites](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/#prerequisites), [Google server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [LINE integration](https://developers.line.biz/en/docs/line-login/integrate-line-login/), [Cloudflare status](https://www.cloudflarestatus.com/).
