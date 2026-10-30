# Mobile and desktop regression results

Playwright Chromium executed 34 scenarios at each required width: 360, 390, 430, 768, 1024 and 1440 pixels. Result: **204/204 PASS**, no skipped, unexpected or flaky tests.

Coverage included authentication, owner-pilot admission, Social navigation, profile, moderation, loading/error states, Thai/English content, modal/bottom-sheet layout, chat chronological order, message append, near-bottom receive, history position, “ข้อความใหม่”, pagination and refresh behavior. No horizontal overflow was observed. The ChatGun/NEAR visual language was not redesigned.

Physical Safari, its OS keyboard/safe areas and device-radio behavior remain **BLOCKED** because browser emulation cannot establish those genuine device properties. Raw Playwright evidence is `responsive-playwright.json`.
