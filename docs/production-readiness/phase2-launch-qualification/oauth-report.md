# OAuth qualification report

## Technical result

Implementation coverage is PASS for state/nonce, PKCE where applicable, exact callback binding, signed ID-token claims, provider subject uniqueness, replay resistance, account linking conflicts, secure sessions, closed-registration behavior and generic errors. Genuine provider-console status and human flows are **BLOCKED — OWNER ACTION REQUIRED**.

| Provider | Production callback | UAT callback | Minimum implementation scope | Genuine status |
|---|---|---|---|---|
| Google | `https://chatgun.social/api/auth/oauth/google/callback` | `https://uat.chatgun-final-uat.pages.dev/api/auth/oauth/google/callback` | OIDC identity/profile/email as configured | NOT RUN; console publication and genuine new/returning login required |
| Facebook | `https://chatgun.social/api/auth/oauth/facebook/callback` | `https://uat.chatgun-final-uat.pages.dev/api/auth/oauth/facebook/callback` | public profile; email is not trusted as verified | NOT RUN; Meta mode/App Review/test identity required |
| LINE | `https://chatgun.social/api/auth/oauth/line/callback` | `https://uat.chatgun-final-uat.pages.dev/api/auth/oauth/line/callback` | `openid profile`, PKCE, signed ID token | Existing UAT evidence retained; exact-RC genuine revalidation required |

Do not copy UAT credentials to Production. Console screenshots must redact app secrets and member identifiers. A successful simulated callback is not a genuine OAuth PASS.
