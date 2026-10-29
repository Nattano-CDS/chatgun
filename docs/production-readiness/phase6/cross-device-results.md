# Phase 6 cross-device results

Chromium emulation executed 34 authentication/Social/moderation scenarios at each of 360×800, 390×844, 430×932, 768×1024, 1280×900 and 1440×900: **204/204 PASS**.

The matrix covered login and acceptance, navigation and bottom navigation, profile and gallery routes, loading/empty/error recovery, Admin purpose boundaries, chat chronological ordering, near-bottom scrolling, preserved older-message position, new-message indicator, composer behavior, unread state, offline recovery, disabled-feature views, injection-safe rendering, and responsive layouts. Existing tests assert no horizontal overflow on real-handler member/Admin journeys.

Physical iOS/Android keyboard and safe-area behavior, genuine Safari, and genuine Firefox are **BLOCKED — DEVICE/OWNER ACTION REQUIRED**. Browser emulation does not prove OS keyboard resize behavior or engine-specific rendering.
