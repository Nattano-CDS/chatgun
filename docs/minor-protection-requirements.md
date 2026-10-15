# Protection requirements for users aged 13–19

Status: product/security/legal design draft. It does not establish that ChatGun complies
with Thai law and does not authorize registration by minors.

## Legal interpretation requiring counsel

ChatGun's product minimum of 13 is not a complete consent or contractual-capacity rule.
Section 20 of Thailand's Personal Data Protection Act addresses consent involving minors:

- if an act is not one a minor may perform alone under Civil and Commercial Code sections
  22, 23 or 24, consent of the person exercising parental power is also required;
- if the minor is not over ten, consent must be obtained from the person exercising
  parental power;
- related notices, rights requests, complaints and withdrawal are also affected.

The Civil and Commercial Code generally treats a person as reaching majority at age 20,
with rules concerning marriage/emancipation and acts a minor may perform independently.
Whether accepting social-network terms and each processing purpose falls within an
exception is fact-specific. Qualified Thai counsel must determine:

1. whether the service contract can be accepted by each age group without parental
   authorization;
2. which processing relies on contract/legitimate interests versus consent;
3. when and how parental authority must be verified;
4. how a minor or parent exercises access, objection, deletion and complaint rights;
5. whether age assurance itself is proportionate and lawful.

Until this review and the controls below are complete, the owner should not treat a “13+”
checkbox as sufficient.

## Registration and age assurance

- Use a neutral age gate before OAuth begins. Prefer asking date of birth once only if the
  owner approves the necessity; otherwise use age-band selection with documented risk.
- Do not infer age from profile photos, names or provider data.
- Block registration below 13 without storing a full birth date unless needed to enforce a
  short retry-prevention period. Use a short-lived, minimized age-band result.
- For ages 13–19, route to the legally approved parental-authorization decision. Do not use
  a child-entered parent email as proof by itself.
- Record consent/authorization evidence as a versioned event with purpose, age band,
  method, timestamps and revocation status; minimize parent and child identifiers.
- Provide a correction/escalation path for wrong age and avoid exposing age publicly.

## Privacy by default

For accounts known or reasonably believed to belong to minors:

- profile not searchable by default outside approved contacts/communities;
- precise location, school, phone, email, birth date and activity status never public by
  default;
- disable public indexing and contact syncing unless separately justified and consented;
- default posts to the narrowest audience and explain every audience in age-appropriate
  Thai;
- disable targeted advertising/profiling until a separate legal and child-rights review;
- avoid streaks, dark patterns and prompts that pressure disclosure or continuous use.

## Discovery and messaging controls

- Adults must not discover minors through age, school or location filters.
- Prevent unsolicited adult-to-minor direct messages by default. Consider requiring a
  pre-existing approved relationship or shared moderated context.
- Detect and rate-limit bulk friend/message requests, repeated contact after rejection,
  link/handle requests, sexual language and attempts to move conversations off-platform.
- Allow minors to control who can mention, follow, add to groups and see activity status.
- Separate teen age bands where appropriate so the youngest users are not broadly exposed
  to older teens/adults.
- Never reveal the reporter's identity to the reported user.

## Reporting, blocking and response

- One-action block must immediately stop messages, profile visibility and new requests.
- Reporting must be accessible from profiles, messages and content, with categories for
  grooming, sexual content, threats, impersonation, self-harm and privacy exposure.
- Preserve only the evidence needed for triage under a defined, legally reviewed retention
  rule; restrict staff access and log reviewer actions.
- Establish severity levels, response ownership, escalation to emergency/child-protection
  channels, user notification and appeal. Do not publish an SLA until it is staffed and
  tested.
- Provide age-appropriate safety guidance without asking minors to investigate or confront
  suspected abusers.

## Parent/guardian experience

- Explain what authorization covers in plain Thai and separate optional processing.
- Verify parental authority proportionately; avoid collecting government ID unless counsel
  determines it is necessary and a secure deletion process exists.
- Allow withdrawal where legally applicable and explain effects on the child's account.
- Avoid giving a parent blanket access to private communications without a child-rights,
  safety and legal analysis; unsafe-family scenarios must be considered.

## Launch gates and owner decisions

- [ ] Thai counsel approves age bands, contractual capacity and consent model.
- [ ] Owner decides whether to exclude all under-20 users for initial launch or fund a
      parental-authorization and minor-safety program.
- [ ] Age gate and bypass-resistance tests pass without excessive data collection.
- [ ] Minor profile defaults, adult-minor discovery restrictions and messaging controls are
      implemented server-side, not only hidden in the UI.
- [ ] Reporting/blocking/moderation tooling is staffed and tested.
- [ ] Safety evidence retention and emergency escalation are documented.
- [ ] Privacy notices and terms have a child-readable summary.
- [ ] A child-safety risk assessment and abuse-case test plan are owner-approved.
