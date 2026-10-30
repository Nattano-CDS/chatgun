# Security E2E results

## PASS

- OAuth state, PKCE, nonce, signature/audience checks, provider binding, invitations and duplicate/cross-account denials passed in isolated signed-fixture tests.
- Cloudflare Access rejects missing, expired, wrong-algorithm, invalid-signature, wrong-issuer, wrong-audience and service-token assertions. JWKS/configuration failures fail closed.
- Application RBAC, grant expiry/revocation, CSRF, replay prevention, session expiry/revocation and unauthorized Admin requests passed.
- Restricted APIs fail closed, private R2 authorization passed, live R2 buckets have no public domain, and discovery request 31 returned HTTP 429 after 30 permitted reads.
- Installed dependencies reported zero vulnerabilities.

## BLOCKED

- Genuine Production Access/MFA cannot pass because no Production Access application or exact audience exists.
- Live RBAC expiry and independent Access/D1 revocation require separately authorized Access setup and schema21 release.
- Genuine Production LINE owner authentication was not performed; fixture coverage is not a substitute.

No MFA, Turnstile, OAuth, Access or authorization control was bypassed. No secret, account identifier, token or private object reference is included in this package.
