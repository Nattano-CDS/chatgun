# Synthetic owner-review social dataset

Status: active in isolated ChatGun Staging as of 2026-10-17. Keep this dataset until the
owner explicitly approves cleanup.

Stable Preview: <https://codex-chatgun-release-candid.chatgun.pages.dev/app/>

## Scope and provenance

- Batch ID: `chatgun-owner-review-v1`
- Cloudflare account: `23017b53386fb67fc62a52cdd017454c`
- D1: `chatgun-auth-staging`
- private R2: `chatgun-media-staging`
- 20 fictional Thai adult member profiles
- 10 accepted friendships and 5 pending requests
- 10 conversations and 120 Thai messages
- 33 private media objects: 20 profile portraits, 10 gallery illustrations, two pending
  moderation samples, and one rejected workflow sample
- 15 private ratings, gallery reactions and comments, unread messages, one member-facing
  moderation notification, five synthetic user reports, one media report, and one appeal

The portraits are original fictional illustration fixtures generated specifically for this
ChatGun review batch with the built-in image-generation tool. The source prompt requested a
strict 5×4 sheet of 20 fictional adult Thai people, a polished editorial illustration style,
and no text, logo, watermark, famous person, child, or real-person reference. The sheet was
cropped into the version-controlled assets in `scripts/fixtures/portraits/`. Before upload,
the seed retains only structural PNG chunks (`IHDR`, `PLTE`, `IDAT`, `IEND`, and `tRNS`), so
unnecessary metadata is not stored. Gallery and moderation fixtures are deterministic
project-owned illustrations created by the seed.

No Google, Facebook, or LINE identity is attached to a synthetic user. All fixture email
addresses use the reserved `.invalid` domain. Synthetic staging sessions are generated
locally with mode `0600` and remain ignored by Git.

## Repeatable operations

Dry-run the seed:

```sh
node scripts/seed-social-staging.mjs --dry-run
```

Apply or refresh this exact batch in Staging:

```sh
node scripts/seed-social-staging.mjs
```

Verify D1 relationships, unrelated-record preservation, foreign keys, and every R2 object
hash:

```sh
node scripts/verify-social-staging.mjs
```

Preview a selective cleanup without changing data:

```sh
node scripts/cleanup-social-staging.mjs --batch chatgun-owner-review-v1
```

Cleanup is intentionally not scheduled and was not executed. A future destructive cleanup
requires both `--execute` and `--confirm chatgun-owner-review-v1`; it rejects non-synthetic
users and R2 keys outside this batch prefix.

## Privacy and quota behavior

The seed writes only batch-owned fixture records through the staging maintenance script. It
does not add a public endpoint or alter `media_upload_quota_attempts`, so normal Chat and
Gallery uploads still use independent server-side daily quotas. R2 objects remain private
and are served only through authenticated, relationship-aware application routes.

Discovery presence still expires after 120 seconds. The visual test refreshes `located_at`
only for IDs matching `cg-syn-v1-%` immediately before its read-only run. This preserves the
location-inference safeguard instead of making fixture presence permanently discoverable.
All durable profile, friendship, chat, gallery, rating, notification, and moderation data
remains available after discovery presence expires.

## Validation evidence

- Unit/integration/security: 89 passed, 0 failed, 0 skipped.
- Synthetic live API and Playwright: 6 passed across desktop Chromium and mobile Chromium.
- D1: zero foreign-key violations and zero fabricated OAuth identities.
- R2: all 33 tracked private objects matched the recorded SHA-256 and byte size.
- Unrelated records preserved: 5 users, 2 messages, 1 relationship, and 6 media objects.
- No Game route or navigation control is present.

Screenshots are in `docs/synthetic-owner-review-evidence/` for Discovery, Friends, Chat,
Profile/Gallery, and Admin Moderation on desktop and mobile.

