# Minimum solo-operator runbook

No 24/7 human monitoring or response SLA is promised. The owner records the actual operating schedule in public-facing policies before launch.

## One daily review

1. Check critical security/availability alerts and whether a service pause is required.
2. Triage safety reports, blocks and active account restrictions; imminent harm takes priority.
3. Review the reconsideration queue. Confirm the case was originally decided by the owner, inspect only necessary evidence, and record `upheld` or `lifted` with a meaningful reason.
4. Check independent appeals separately. Never decide an appeal against the owner's own original decision; leave it pending until an eligible reviewer exists.
5. Review privacy/access/deletion requests in their separate queue and record deadlines/actions.
6. Check cleanup failures/retries, stale sessions/location/presence and deletion receipts without manually deleting evidence outside the approved retention procedure.
7. Review Cloudflare security/usage notifications and current spend indicators. Threshold alerts are warnings, not a guaranteed spending cap.
8. Record material incidents, decisions and unresolved follow-up in the protected operator log.

## Emergency service pause

For credible security compromise, uncontrolled privacy exposure, unavailable moderation safeguards or runaway cost: stop affected public feature gates through the separately approved change procedure; preserve evidence; do not destroy or restore Production data automatically; notify affected users/regulators when legally required; and resume only after validation and explicit authorization.

## Minimum owner decisions before activation

- legal controller/operator identity and official support/privacy contact;
- actual daily review schedule and realistic response wording;
- retention periods for reconsideration content and minimal audit evidence;
- threshold for service pause and Cloudflare monthly warning amount;
- external/statutory complaint routes to display;
- whether an independent appeal is offered at Phase 1 launch and, if offered, how pending cases are handled without an accepted reviewer;
- exact LINE-only public OAuth and physical iPhone qualification plan.

