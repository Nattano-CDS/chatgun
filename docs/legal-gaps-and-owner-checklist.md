# Legal and technical gaps / owner approval checklist

This checklist is for release decision-making, not a claim of compliance.

## Confirmed and used consistently

- Platform/domain: ChatGun / `https://chatgun.social`
- Operator: individual, เทพกร ทาโน
- Contact: `natttano@outlook.com`
- Intended minimum registration age: 13
- Primary jurisdiction: Thailand
- Login providers: Google, Facebook and LINE
- Email OTP, Mobile OTP and LINE email permission: disabled

No company identity, business number or physical address was added.

## Blocking legal decisions

- [ ] Thai counsel confirms the operator/contact disclosure satisfies PDPA notice duties,
      including whether another service/contact address is required.
- [ ] Counsel approves legal bases for account service, security, Turnstile, provider data,
      logs, account linking and future content moderation.
- [ ] Counsel reviews cross-border transfer mechanisms and the current Cloudflare D1 APAC
      placement with no jurisdiction constraint.
- [ ] Counsel approves minor capacity/parental authorization under PDPA section 20 and the
      Civil and Commercial Code. “13+” alone is not approved.
- [ ] Counsel reviews consumer terms, content licensing, moderation, appeals, liability,
      dispute resolution and governing-law wording.
- [ ] Counsel approves deletion exceptions, legal holds, safety evidence and complaint
      records with specific retention periods.
- [ ] Counsel confirms whether records of processing activities, processor agreements,
      cross-border safeguards, a data-protection officer or a formal risk assessment are
      required for the actual launch scope.
- [ ] Operator documents a rights-request identity-check, response, refusal, extension and
      complaint procedure instead of relying on an email inbox alone.
- [ ] Owner sets an effective date only after final approval and deployment readiness.

## Blocking technical work

- [ ] Implement authenticated, CSRF-protected, provider-reauthenticated account deletion.
- [ ] Implement daily physical cleanup for expired OAuth flows, sessions, rate limits and
      dormant OTP records.
- [ ] Inventory D1 plan/version, Time Travel window and every manual/exported backup.
- [ ] Decide whether security logs use verified native retention or a minimized 90-day
      archive; configure lifecycle deletion before stating 90 days publicly.
- [ ] Add age gate, parental-authorization decisioning and minor-safe defaults server-side.
- [ ] Define user-content schema and deletion/anonymization behavior before social features.
- [ ] Implement reporting, blocking, moderation access controls and appeal workflow.
- [ ] Create incident-response and PDPA rights-request procedures with trained ownership.
- [ ] Test restoration so completed deletions cannot be resurrected.

## Document review

- [ ] Owner verifies name and email spelling on all three pages.
- [ ] Owner reviews every Thai section and the English summaries.
- [ ] Owner accepts that the drafts openly describe unimplemented controls and must not be
      published in their current form.
- [ ] Final retention periods are changed from proposals to actual verified controls.
- [ ] Provider privacy/data-deletion/terms URLs are updated only after approved pages are
      deployed and return the correct content.
- [ ] Legal pages pass desktop/mobile accessibility and link checks.
- [ ] No secret, OAuth client secret, token, database identifier or personal user record is
      present in the documents or repository diff.

## Release and provider approvals

- [ ] Separate legal PR receives owner and counsel approval.
- [ ] Authentication PR #3 is reconciled with the approved retention/deletion design in a
      new implementation PR; do not silently mix legal commitments into PR #3.
- [ ] Preview validates the final pages and account workflows.
- [ ] A separately authorized Production deployment makes the legal URLs live.
- [ ] Only then update/publish Google, Meta and LINE provider configurations.

## Current decision

**NO-GO for publication.** The drafts are reviewable and technically grounded, but the
retention cleanup, account deletion, minor protection, content lifecycle and operational
procedures are not implemented.
