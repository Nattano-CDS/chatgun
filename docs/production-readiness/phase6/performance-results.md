# Phase 6 performance and reliability

Twenty samples per metric used Playwright Chromium, real application handlers, synthetic identities, in-memory D1 and R2, and no Production traffic.

| Metric | p50 | p95 | max |
|---|---:|---:|---:|
| Discovery API | 1.60 ms | 2.58 ms | 13.42 ms |
| Authenticated application load | 553.42 ms | 574.27 ms | 587.78 ms |
| Profile API | 1.49 ms | 2.91 ms | 11.92 ms |
| Conversation list | 0.84 ms | 1.54 ms | 3.08 ms |
| Message send | 0.86 ms | 1.45 ms | 2.15 ms |
| Moderation dashboard load | 529.36 ms | 537.35 ms | 538.79 ms |
| Five concurrent profile reads | 2.16 ms | 12.33 ms | 27.73 ms |

The first benchmark design consumed the Discovery anti-inference budget while repeatedly loading the application. The harness was corrected to use a separate synthetic identity and explicitly verify 30 permitted reads followed by HTTP 429 on request 31. No product control was weakened.

These numbers characterize local code paths only. Cloudflare edge, remote D1/R2, external OAuth, physical-device/radio latency and sustained remote load remain BLOCKED pending an authorized isolated target and approved SLO/load envelope.
