# UAT OAuth / Access configuration execution

Application remains frozen at `4a7dee32c52bc474ee3cc50d13e293e66e771c1a`. Starting PR HEAD was `2b16100802b1fe8924ab493d64e6ffd7078033c8`; exact closing HEAD and CI are recorded in the PR closing comment. No Production deployment, migration, account change or role grant.

## Actual status — not a completion claim

| Item | Status | Verified action / blocker |
|---|---|---|
| ChatGun account, dedicated DB/R2/Workers | PASS | Account rechecked; schema21, users/identities/sessions/invitations/grants/media0, FK0; private cleanup Workers and bindings rechecked |
| Stable UAT / closed flags | PASS | Live release4a7dee3; OAuth/providers/admission/Social/media remain OFF; site key unchanged |
| Google | BLOCKED | Authenticated project `chatgun`; External/Testing previously verified. Separate **ChatGun UAT** Web Application form populated with exact origin and Google callback; Create enabled, **not submitted** pending action-time security confirmation. Old clients untouched; no new secret obtained |
| Meta | BLOCKED | Authenticated ChatGun parent1136950635489003 (not Production1732162668911193). **Create test app for ChatGun** dialog populated **ChatGun UAT**; Create enabled, **not submitted** pending the same confirmation. No app published, role added or secret revealed |
| LINE | BLOCKED | Existing console requires genuine LINE Business ID login. Handoff redirects to console root, NOT Production channel2012039306; no channel modified/created |
| Access API403/code1010 | BLOCKED | Wrangler is OAuth-authenticated into exact ChatGun account; its displayed scopes have no Access Write/Edit. Dashboard is authenticated and exposes UAT creation UI. Missing write scope is demonstrated; dashboard save/hostname acceptance not claimed until submitted. No evidence this requires a paid upgrade |
| Access dashboard | BLOCKED | New dedicated UAT form, exact moderation + Admin API paths, custom10m application session; unsaved owner-email Include + Authentication Method MFA Require policy. No policy/app saved pending action-time security confirmation |
| Independent MFA | BLOCKED | Dashboard explicitly says organization MFA not turned on; app-level custom MFA unavailable. Official docs require organization-level enablement first. This is an additional organization-scope decision, not covered by silently changing UAT-only settings |
| Admin mapping/roles | NOT RUN | No genuine UAT account exists. Owner UAT UUID must be privately verified and grant scope independently approved; no Production UUID/role copy or extension. Prepared parameterized UAT-only role PLAN, at most8hours, report_reviewer+safety_admin only, current eligible/onboarded member and10minute recent-auth guard; no executor run |
| Turnstile | PASS configuration / NOT RUN human | Same dedicated real widget/site key/encrypted secret. Host/action checks unchanged; human challenge deferred to final campaign. No test-bypass keys |
| Live negative security | PASS |16 checks; disabled starts, foreign origins, callbacks, invalid provider/session, disabled Admin/OTP; no users/flows/invitations fabricated |
| Implementation regressions | PASS |37 existing relevant auth/Access/invitation/LINE/middleware cases;5 new boundary/import-error/role-plan tests. Local mocked-provider tests are not genuine OAuth/MFA |
| Responsive closed UAT | PASS |390/768/1440 actual-host screenshots; zero JS errors/overflow |
| Genuine OAuth/MFA | NOT RUN | Final human campaign explicitly not started |

The browser task requires confirmation immediately before creating new credentials/security-sensitive policies, even with earlier broad authorization. One consolidated confirmation request was presented for Google/Meta/LINE UAT provisioning and owner-only Access, plus the additional organization-level MFA decision. No repeated provider-login prompts were issued. Do not mistake prepared forms or stored credentials for provider/MFA success.

## Access diagnosis and route inventory

This is not an account mix-up: Wrangler and dashboard show account23017b53386fb67fc62a52cdd017454c. Token scope listing lacks Access Write. Therefore use the authenticated dashboard rather than changing the plan or weakening Access. Dashboard also displayed an outage banner; official status at review showed the relevant recent incident resolved and live UAT APIs returned JSON200. Do not attribute the persistent scope error to an assumed outage.

Exact UAT edge destinations prepared:

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

Google JS origin: `https://uat.chatgun-final-uat.pages.dev`. Do not add a new test user or publish a provider. Preserve all current clients/channels/callbacks. New credential storage tool rejects known old client IDs, wrong UAT callback, public/published status, unprotected handoff files and overwriting existing credential keys. It patches only this project's **Preview** encrypted credentials; it never opens admission or grants roles. Positive live credential import is **NOT RUN**, since no new credentials have been created. Do not use a project-wide Wrangler secret command that may affect both environments.

## Single minimal owner handoff

1. Answer the already-presented consolidated action-time confirmation for creating the specifically named UAT credentials/owner-only Access app. Credentials go only to encrypted `chatgun-final-uat` Preview secrets; no secret should be pasted into chat/GitHub.
2. Decide whether to authorize organization-level independent MFA activation (potential inherited defaults for other Access apps), or retain strict UAT-only scope and use an independently MFA-capable approved IdP later. Current organization settings remain unchanged. Enabling global MFA to support app MFA is a distinct scope decision, not a workaround for missing API token permissions.
3. Complete genuine LINE developer login in the retained Chrome tab. No CAPTCHA/password/MFA/Terms action will be automated. Continue with a separate UAT channel under verified ChatGun ownership, never channel2012039306.

Later final-campaign gates remain unchanged: owner UAT identity/least-privilege grant confirmation, distinct consenting eligible adult B, expanded Social/location/media policy/operating approval,19:00–22:00Bangkok coverage window. No invitations are issued in this configuration phase.

Sources: [Cloudflare independent MFA prerequisites](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/#prerequisites), [Google server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [LINE integration](https://developers.line.biz/en/docs/line-login/integrate-line-login/), [Cloudflare status](https://www.cloudflarestatus.com/).
