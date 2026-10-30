# Youth admission remains externally blocked

Engineering preparation only; not a published policy or a legal-compliance opinion. The age-hold implementation and successful synthetic tests do not authorize real minor registration.

## Current enforceable scope

- Under13,13–17,18–19 held accounts can authenticate only to permitted account-rights functions. Social/profile/location/presence writes and linking remain denied. Existing schema20 write guards stay mandatory even where an API check already passed.
- The new correction request is an authenticated, recent-authenticated, CSRF-protected request for review, not a new age assertion. A reviewer may uphold or defer only. Request withdrawal does not withdraw/rewrite the original age evidence, clear the hold, restore private-album grants, or re-enable contact/location.
- Neither a checkbox, display-name change, legacy `adult_18_plus` declaration nor the existing generic `independent_age_assurances` row proves age20+. That generic table has no20+ threshold field; do not use it to clear a restricted20+ pilot hold.
- No DOB, parent contact or identity documents are requested by this workflow. Free-text input has explicit minimization warnings and bounded length. Closed request/event records are removed after90days by the tested cleanup implementation; unresolved requests are retained until resolution/account deletion. This is technical behavior in isolated testing, not a newly published retention guarantee.

## Decisions and future technical contract (not activated)

| Decision requiring owner/qualified review | Technical implementation required after that decision |
|---|---|
| Which age groups/capacity cases can use which functions and lawful basis | Versioned admission policy and server-side capability matrix; no shared blanket `adult` flag; explicit effective dates |
| Proportionate assurance method and threshold | Minimal signed assertion with threshold, issuer, subject binding, method, issued/expiry/revocation times and policy version; do not retain raw DOB/document images without separate necessity review |
| When parental authority/authorization is required and how verified | Separate guardian-authority verification, account-binding, scoped authorization evidence and conflict/fraud review; no user-supplied email alone as proof |
| Consent/authorization withdrawal and capacity changes | Idempotent withdrawal journal; atomic restrict/revoke sessions/contact/discovery/presence/album grants; notify safely; do not delete unrelated records or treat guardian withdrawal as an Admin privilege |
| Correcting a mistaken hold / approving an eligible adult | Independent threshold-specific evidence, conflict separation, explicit role/purpose/recent-auth, CAS decision, audit, rollback and notice; never a broad Admin `unlock` shortcut |
| Privacy/contact/discovery model for minors | Privacy-first defaults, restricted discoverability, server contact matrix, adult↔minor unsolicited-contact denial, all alternate media/comment/forward endpoints covered, anti-inference limits |
| Operational safeguarding, disputes and emergency escalation | Named responsible people/coverage, escalation route, independent review or documented safe deferral, audit access controls and appeal receipt; no invented backup or24×7 SLA |
| Retention and backup exceptions | Measurable deletion tasks, legal-hold authority if justified, retry/monitoring, separate D1 Time Travel/R2 lifecycle disclosure; no promise beyond actual infrastructure |

Before activation, add migration/API/UI and negative/concurrency tests for the *approved* contract, simulate guardian withdrawal and threshold expiry with isolated adult-operated fixtures, complete qualified review and one consolidated genuine-adult UAT. Do not collect real child/guardian identities just to fill this design gap. This future admission model is EXTERNALLY BLOCKED; the existing protective hold and account-rights implementation can be tested independently.
