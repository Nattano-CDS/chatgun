# NEAR Version 91 design system baseline

Status: owner-review draft. This document records the canonical visual language at NEAR commit `98bb83e44bf88eddb9822d7875f18cd4fe833ee2`. It is not approval to publish, merge, or deploy changes.

## Scope and provenance

- Canonical source: `/Users/nattano/.codex/worktrees/near-source-audit`
- Canonical commit: `98bb83e44bf88eddb9822d7875f18cd4fe833ee2`
- Primary source files: `app/globals.css`, `app/near.tsx`, `app/chat.tsx`, `app/discovery-grid.tsx`, `app/bottom-nav.tsx`, `app/profile-view.tsx`, `app/login/page.tsx`, and `app/register/register-form.tsx`
- Reference captures: `docs/visual-audit/screenshots/near/`
- Required viewports: 390 × 844, 768 × 1024, and 1440 × 1100 CSS pixels. Full-page captures extend vertically.
- Game-specific components, Mali display typography, routes, and assets are excluded from this baseline.

## Visual foundations

### Color

| Role | Canonical value | Usage |
| --- | --- | --- |
| Page background | `#f7f7fb` | Social and authentication canvas |
| Surface | `#ffffff` | Cards, navigation, inputs, dialogs |
| Primary text | `#21212a` / `#292431` | Headings and card names |
| Primary violet | `#6d42e5` | Main actions, active state, links |
| Primary hover | `#5931c5` | Hovered main actions |
| Active lavender | `#eee8ff` / `#f0eaff` | Active navigation and selected filters |
| Border | `#e9e7ef` / `#e5e1ec` | Controls and cards |
| Muted text | `#786684`, `#7d7489`, `#8d809b` | Supporting copy and metadata |
| Lime action | `#d0f17b` | High-contrast contextual action on dark/photo surfaces |
| Dark banner | `#272335` | Location/privacy notice |
| Danger | Muted red family | Destructive or safety actions only |

Violet is the interaction color; lime is a limited accent. Blue-to-pink marketing gradients are not part of NEAR v91's core social-product language.

### Typography

- Body stack: Arial, `Noto Sans Thai`, Tahoma, sans-serif.
- The source includes local Noto Sans Thai weights 400–900.
- Thai copy uses compact, readable line heights and strong weight contrast rather than decorative display type.
- Mali is game-specific and must not be introduced into the non-game ChatGun experience.
- Minimum body/control size is normally 14–16 px; mobile navigation labels are smaller but paired with icons.

### Shape, elevation, and spacing

- Primary social cards: 22 px radius and low-opacity violet shadow.
- Authentication panel: approximately 440 px maximum width with a 22 px radius.
- Buttons and inputs: 10–14 px radius; filter chips use a fully rounded pill.
- Interactive targets: minimum 44 × 44 CSS pixels.
- Spacing follows an approximately 4/8 px rhythm, with common gaps of 8, 12, 16, 20, 24, and 32 px.
- Shadows are restrained (`rgba(43, 33, 74, .08)` family); hierarchy comes primarily from spacing, borders, imagery, and surface contrast.

## Component language

### Discovery

- Discovery is the product home, not a marketing landing page.
- Member cards are portrait-led, full-bleed images with a bottom dark gradient.
- Distance appears in a translucent pill over the image.
- Name, verification, bio, rating, and actions are overlaid or anchored inside the card.
- Cards form two columns at 390 px and three columns on desktop in the canonical capture.
- Search and filters are immediately visible; mobile collapses filters behind a compact control.

### Navigation

- The canonical capture uses a fixed, centered six-item navigation bar with icons for discovery, friends, chat, reviews, game, and profile.
- ChatGun must omit Game while preserving the remaining order, proportions, active treatment, and reachable 44 px targets.
- The desktop top row combines the brand, discovery context, search, and filters. It is not a conventional marketing navbar.
- Safe-area insets and fixed-navigation content padding are required on mobile.

### Authentication

- Pale lavender canvas, compact top brand/action row, and one centered white panel.
- A small lavender icon tile introduces the action.
- One dominant violet call-to-action; supporting instructions remain secondary.
- ChatGun must preserve Google, Facebook, and LINE provider semantics and Turnstile behavior while adopting this composition.
- ChatGun branding replaces `near.`; NEAR names and ChatGPT-specific login wording must not be copied.

### Profile, gallery, chat, reviews, and notifications

- Profile detail is portrait/image-led and uses layered information rather than a generic settings form.
- Gallery is a compact three-column image grid on mobile with full-screen lightbox behavior.
- Chat uses a simple conversation list and readable bubbles with violet active/mine states.
- Review/rating affordances use violet for interaction and a muted gold star accent.
- Empty, loading, error, unread, and disabled states must be visually distinct without changing navigation geometry.

### New ChatGun-only flows

Acceptance, account deletion, quota feedback, and Admin Moderation have no direct NEAR v91 equivalent. They should inherit the same canvas, surface, typography, control sizing, border, focus, and navigation rules. Security-critical copy, confirmations, reasons, recent-authentication checks, and audit evidence must remain intact.

## Responsive behavior

| Width | Canonical behavior |
| --- | --- |
| 390 px | Two-column portrait discovery grid, compact top search/filter row, fixed bottom navigation, safe-area padding |
| 768 px | Tablet density increases while retaining touch-sized controls and fixed navigation |
| 1440 px | Three-column portrait grid, expanded search/filter toolbar, centered content and navigation |

Primary source breakpoints include 1400, 1100, 700, 600, 480, 420, 380, and 360 px. The principal mobile transition is 700 px.

## Accessibility and motion

- Keyboard focus is visible and high contrast.
- Labels and icon buttons require accessible names.
- Controls stay at least 44 px where practical.
- `prefers-reduced-motion: reduce` disables transitions and animation.
- Image overlays must preserve readable text contrast independent of the uploaded image.
- Responsive changes must not hide safety, report, block, logout, privacy, or deletion actions.

## ChatGun brand adaptation constraints

- Preserve the ChatGun name and existing logo asset.
- Replace `near.` wording and ChatGPT-auth wording with approved ChatGun copy.
- Do not introduce a new logo, color system, navigation model, or content hierarchy.
- Do not restore Game.
- Do not change feature flags, access control, moderation, authentication, data handling, or account state behavior as part of visual restoration.

