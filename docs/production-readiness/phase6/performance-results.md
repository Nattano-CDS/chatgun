# Phase 6 performance and reliability

Twenty samples per metric used Playwright Chromium, real application handlers, synthetic identities, in-memory D1 and R2, and no Production traffic.

| Metric | p50 | p95 | max |
|---|---:|---:|---:|
| Discovery API | 1.50 ms | 4.39 ms | 11.64 ms |
| Authenticated application load | 532.22 ms | 537.90 ms | 588.54 ms |
| Profile API | 1.33 ms | 3.81 ms | 13.99 ms |
| Conversation list | 0.99 ms | 1.42 ms | 1.55 ms |
| Message send | 0.94 ms | 1.14 ms | 2.40 ms |
| Moderation dashboard load | 530.29 ms | 535.48 ms | 551.99 ms |
| Five concurrent profile reads | 2.40 ms | 4.87 ms | 26.52 ms |

The first benchmark design consumed the Discovery anti-inference budget while repeatedly loading the application. The harness was corrected to use a separate synthetic identity and explicitly verify 30 permitted reads followed by HTTP 429 on request 31. No product control was weakened.

These numbers characterize local code paths only. Cloudflare edge, remote D1/R2, external OAuth, physical-device/radio latency and sustained remote load remain BLOCKED pending an authorized isolated target and approved SLO/load envelope.
