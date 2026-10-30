# Cleanup, monitoring and alert readiness

Cleanup code uses bounded retries, logical deletion, FK checks and minimized audit retention. Existing isolated tests cover cleanup failure/retry and media orphan handling. Production schedules were not changed.

Before launch, the owner must approve schedules and destinations for: Worker exceptions, D1 query/write errors, OAuth error rate, message delivery/reconnect failures, moderation backlog/oldest age, rate-limit/abuse spikes, R2 orphan/quarantine age, storage/request growth and cleanup overdue/failure. Each alert needs a named responder, severity, acknowledgement path and escalation.

Proposed starting thresholds are review inputs, not deployed promises: any security/cleanup integrity failure pages immediately; OAuth or messaging failure ratio over 5% for 10 minutes warns; oldest severe report over the staffed target pages; storage/request daily growth over 2x trailing 7-day median warns. Cost alerts require owner-selected absolute THB/USD limits and billing approval. No paid infrastructure is introduced here.
