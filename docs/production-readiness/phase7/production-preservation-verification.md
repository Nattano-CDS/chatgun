# Production preservation verification

The checked-in Production candidate at `eebe565a8f23840b28c1dc1a0faa8e230f311d73` passed **25/25** deterministic preservation assertions. It retains LINE OAuth, invitation-only admission, acceptance, onboarding, the existing Social shell, moderation and the approved Production rc1 policy versions. It keeps public registration, Discovery, friends, public messaging, Media, Presence, Sensitive content, email/mobile OTP, Demo, public canary, account moderation, ratings and identity verification disabled.

Read-only Cloudflare verification at 2026-10-30 10:18 Asia/Bangkok found Production unchanged at `a73ff21c615dabb6a0c19c0a22685c2370958ca1`, schema17, FK violations 0, one user, one provider identity, seven sessions, zero messages, zero Media records and two moderation grants. The Production R2 bucket remains private. The isolated UAT has its own Pages project, D1 database and R2 bucket. Writes and Cloudflare mutations: **0**.

The offline schema17→21 rehearsal preserved counts and FK integrity, excluded UAT-only schema22, and restored schema17 in rollback. This is rehearsal evidence only; it does not authorize or claim a Production migration.
