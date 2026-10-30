# Performance results

These are measured Playwright Chromium results from an isolated real-handler harness, not estimates or Production load results.

| Measurement | Actual |
|---|---:|
| Authenticated initial application load p50 / p95 / max | 548.91 / 560.11 / 562.25 ms |
| Moderation load p50 / p95 / max | 531.63 / 536.08 / 539.27 ms |
| Discovery API p50 / p95 / max | 1.34 / 2.51 / 13.72 ms |
| Profile API p50 / p95 / max | 1.17 / 3.07 / 15.59 ms |
| Conversation API p50 / p95 / max | 0.91 / 1.22 / 2.80 ms |
| Message send API p50 / p95 / max | 0.91 / 1.14 / 2.11 ms |
| Five concurrent profile reads p50 / p95 / max | 2.01 / 6.85 / 16.70 ms |
| Route transition p50 / p95 / max | 33.34 / 35.16 / 58.79 ms |
| 250-message render / scroll | 146.52 / 1.78 ms |

The initial page made 33 requests, 14 to APIs. Twenty route transitions grew the observed JS heap by 2,194,796 bytes. An 11-second hidden-surface observation made zero message or conversation polls. Mobile horizontal overflow was false. The first 30 discovery reads succeeded and request 31 was throttled with 429.

Excluded: Production load, external-provider latency, Cloudflare edge/remote D1/R2 latency and physical-device radio/rendering. Raw evidence is `performance-measurements.json`.
