# Production configuration preservation

The PR #20 release content at `25cb31d0c56ff95127180e04eb588d9ce4783175` passes all **25/25** deterministic requirements. It preserves LINE OAuth, invitation-only admission, acceptance, adult onboarding, the Social shell, moderation interface and approved Production policy versions.

Public registration, public Discovery, friends, messaging, Media upload, Presence, Sensitive content, email/mobile OTP, Demo, public canary, account moderation, ratings and identity verification remain disabled. Media quarantine may remain configured while upload is disabled; this does not expose an upload path.

Read-only Production verification at 2026-10-30 11:58 Asia/Bangkok found SHA `a73ff21c615dabb6a0c19c0a22685c2370958ca1`, schema17, FK0, one user, one identity, seven sessions, zero messages, zero Media rows and two existing moderation grants. Production R2 has neither managed nor custom public domains. Production Access and cleanup Workers remain absent. Production writes/mutations: **0**.

The current Preview at the assessed PR SHA remains separate from Production. Preview/UAT flags, databases, buckets, accounts and policy artifacts must never be copied into Production.
