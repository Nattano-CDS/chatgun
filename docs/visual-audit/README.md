# Visual audit evidence

This directory contains the first owner-review baseline for the NEAR v91 to ChatGun visual restoration.

## Reproduce

From the release-candidate worktree, while an unmodified disposable checkout of NEAR v91 is served locally at `http://127.0.0.1:5173`:

```sh
CHATGUN_URL=https://20ad10a1.chatgun.pages.dev \
NEAR_URL=http://127.0.0.1:5173 \
node docs/visual-audit/capture-baseline.mjs
```

The capture script uses browser request mocks only for authenticated ChatGun social and acceptance states. It does not write to D1 or R2. Public and NEAR pages are rendered normally.

To capture only the Phase 1 ChatGun result from a local Pages server:

```sh
CHATGUN_URL=http://127.0.0.1:8791 \
CHATGUN_OUTPUT=chatgun-phase1-after \
SKIP_NEAR=1 PHASE1_ONLY=1 \
node docs/visual-audit/capture-baseline.mjs
```

Expected CSS viewport widths are 390, 768, and 1440 pixels. PNG height varies because screenshots are full-page.

## Limitations

- This is a structural visual baseline, not a pixel-diff pass and not a claim of parity.
- Authenticated ChatGun mock data is synthetic and intentionally contains no personal information.
- Turnstile's embedded frame can show an environment/network error in headless screenshots. The audit does not bypass Turnstile and does not treat that frame as evidence of authentication success or failure.
- Admin and other ChatGun-only operational screens have no exact NEAR counterpart; the comparison report evaluates their token and component consistency instead.
