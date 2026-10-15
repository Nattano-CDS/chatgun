# ChatGun Authentication Backend Required
The static registration page is ready. **Authentication is not live** until the following same-origin server endpoints exist.

- GET /api/auth/oauth/{line|facebook|google}/start: initiate provider login via authorization-code flow, state/nonce, PKCE where supported, validate callback server-side, and establish secure HttpOnly session.
- POST /api/auth/otp/start: {channel:"phone"|"email",destination:string} -> {challengeId:string}. Send real SMS/email through a provider; generate random short-lived OTP server-side, store only hashed OTP, rate limit requests, mask enumeration.
- POST /api/auth/otp/verify: {challengeId:string,code:string} -> {authenticated:true,redirectUrl:"/..."}. Limit attempts, expire and consume challenge atomically, create account and secure HttpOnly session cookie.

Configure LINE Developers, Meta for Developers, Google Cloud OAuth, SMS gateway and email delivery credentials on server only. Never expose secrets or OTPs in browser code. Add CSRF protection, abuse limits, privacy policy, terms and PDPA compliance before production.