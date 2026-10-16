# ChatGun

ChatGun is a responsive social-network landing and signup experience hosted on Cloudflare Pages. Phase 1 enables Google, Facebook, and LINE authentication. Email and mobile OTP are disabled by server-side feature flags; their backend implementation and D1 schema remain versioned for a future phase.

Run the local security and migration suite with `npm test`. Read [CLOUDFLARE_AUTH.md](./CLOUDFLARE_AUTH.md) before configuring or deploying Cloudflare resources.
