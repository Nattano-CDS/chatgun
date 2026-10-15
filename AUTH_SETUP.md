# Authentication setup

See [CLOUDFLARE_AUTH.md](./CLOUDFLARE_AUTH.md) for the security model, required secrets, provider callbacks, D1 inspection/migration procedure, and the production deployment gate.

The API surface is:

- `GET /api/auth/config`
- `POST /api/auth/otp/start`
- `POST /api/auth/otp/verify`
- `POST /api/auth/oauth/{google|facebook|line}/start`
- `GET /api/auth/oauth/{google|facebook|line}/callback`
- `GET /api/auth/me`
- `POST /api/auth/logout`

All state-changing same-origin requests are origin-checked. Authenticated mutations additionally require the `X-CSRF-Token` header to match the readable `__Host-cg_csrf` cookie. Session material remains in a separate Secure, HttpOnly cookie.
