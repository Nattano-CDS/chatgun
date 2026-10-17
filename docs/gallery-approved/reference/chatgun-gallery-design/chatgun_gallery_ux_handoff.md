# ChatGun — Public Gallery and Private Gallery UX design handoff

**Status:** Proposed design, not deployed. Interactive prototype: `chatgun_gallery_ux_prototype.html`.

## Non-negotiable product structure

Two different gallery destinations, not one screen with public/private tabs:

- `/app/people/:id/gallery` — **Public Gallery**, approved public photos only.
- `/app/people/:id/private-gallery` — **Private Gallery**, owner or specifically granted viewer only.
- `/app/me/gallery/upload` — **Public photo upload** (owner only).
- `/app/me/private-gallery/upload` — **Private photo upload** (owner only).

Maintain proper deep links/back/forward/reload; adapt final paths to existing routing without reusing one mixed content page. Each page can share implementation primitives, but must remain a separate destination and surface.

## A. Owner uploads — 2 distinct pages

Both owner-only upload pages use the same NEAR-v91-derived typography, violet buttons, pale lavender canvas, cards, photo preview, and form spacing.

**Public upload page**
1. Header: Back to Public Gallery, title **เพิ่มรูปใน Gallery**, clearly labeled `Public`.
2. One strong upload zone: drag-and-drop or file picker, image formats JPG/PNG/WebP up to 8 MB each.
3. After selection, show per-photo thumbnails with remove buttons and clear selected count.
4. Optional caption; never require one for a quick upload.
5. Compact privacy summary: visible to eligible members **only after manual moderation release**.
6. Show combined Gallery quota: 10 uploads per Bangkok day across Public+Private (separate from Chat's 10/day) and combined album capacity of 12, where current schema enforces that limit.
7. Main CTA **เพิ่มรูปใน Gallery**; after upload show `กำลังรอตรวจสอบ` for owner. Never display unreleased assets to others.

**Private upload page**
1. Header: Back to Private Gallery, title **เพิ่มรูปส่วนตัว**, clearly labeled `Private`.
2. Same simple picker/preview/caption; Private visibility is explicit and fixed for this upload destination. No hidden toggle silently publishing to Public.
3. Compact privacy summary: only owner and explicitly approved viewers, **after manual moderation release**.
4. Same combined 10/day Gallery quota and 12-photo combined capacity.
5. Main CTA **บันทึกรูปส่วนตัว**; no automatic grant or share on upload.
6. Manage approved viewers / revoke access **inside the owner's Private Gallery**, not on member Profile or inside Public Gallery.

## B. Viewer — 2 separate pages

**Public Gallery**
- Profile -> **Gallery** button opens only Public Gallery. Owner portrait/name, photo count, compact header, 3-column responsive tiles, full-screen post/photo viewer, likes/comments and Next/Previous.
- No Private Album tab, private count, thumbnail, caption, ID, URL, request button or management controls anywhere on this page.
- Viewer sees only server-authorized, manually released public photos.

**Private Gallery**
- Profile -> approved image+unlocked-padlock button opens the separate Private Gallery route. Clearly labeled page, but restrained styling; only private approved-and-released content.
- If not yet granted, a locked icon on Profile triggers one request to the owner in their Chat; do **not** navigate to a gallery listing or leak any private photo detail. Pending remains locked. Owner approves/rejects using the trusted in-chat card; requester may cancel from Chat, not an intrusive Profile panel.
- Approved viewer can enter and view private posts with the same accessible lightbox/likes/comments. After owner revokes or blocks, all list, media bytes and post endpoints deny the user; stale deep links fail closed.
- Owner always opens their own private album and sees a restrained **Access Management** area with approved viewers, pending requests, revoke/approve/decline. Keep the main Profile clean.

## C. On-Profile controls (existing owner decisions)

- Exactly one **Gallery** action, followed immediately by **one image icon with overlapping closed/open lock badge** (approved minimal Lucide-derived variant). No duplicate Gallery icon in the top-right.
- No visible buttons on Discovery/User Cards; entire card opens Profile.
- No long permission-explanation block, Pending text, Cancel Request or Demo Owner Perspective on member Profile. Those belong in Chat/dedicated owner management.
- Direct Chat remains available without Add Friend, subject to existing contact privacy, blocking and anti-spam safeguards.

## D. Essential interaction and security behavior

- Gallery upload reservation/idempotency/quota accounting and R2 quarantine unchanged.
- Public/Private visibility must be evaluated on every API route: lists, media bytes, thumbnails, comments, likes and next/previous navigation.
- Never expose private metadata in Public Gallery, cached responses or search/OG. Responses for private bytes: `private, no-store`, no external CDN caching.
- Back/reload must restore chosen album; lightbox navigation must never cross between albums.
- All uploads are sanitized, size-restricted and manually reviewed. Private grant alone does not replace moderation approval.
- Owner controls require secure authenticated/CSRF-protected server calls. Demo permission switches in the prototype are **not** production features.
- Preserve ChatGun/PiggyPrice Cloudflare isolation, existing staging fixtures, 20 fictional demo members and authentic NEAR v91 design language (no Game).

## E. Accessibility, testing and acceptance

- 390, 768, 1440 CSS-pixel responsive layouts; 44×44 interactive hit targets; keyboard navigation, focus visible, ESC and arrow-key lightbox support, reduced-motion.
- Owner upload Public and Private: file picker, multiple previews/removal, caption, invalid file/size, quota exhausted, full 12-photo capacity, upload error, pending/rejected/released statuses.
- Public viewer: only public photos, direct URL/reload/post/comment; no private metadata leaks.
- Private viewer: locked -> pending request -> owner Chat approve -> unlock -> private page; reject/revoke/block/account-deletion and stale bytes/deep link denied.
- No real Production service enablement or migration without separate validated authorization. A browser-only fictional demo release may show the new UX if separately tested, but must clearly distinguish simulations.

**Note on prototype:** The HTML has four external design-preview controls. These are **not** tabs to install in ChatGun; their purpose is to inspect four distinct page layouts. Artwork and interactions are local examples, not real customer uploads or grants.
