# Production moderation, privacy and incident operations

Status: prepared operating procedure for owner approval. It does not deploy a Worker, create a
schedule, grant a role, authenticate an owner, change Production or promise 24/7 response.

## Required named ownership

The release record must name a primary moderator/incident commander, a backup moderator, an
appeal reviewer who did not make the original decision, a privacy/deletion operator, a security
alert owner and an emergency/legal contact. One person may hold multiple roles except that a
media appeal must not be decided by the original media reviewer. Until names, contact paths and
availability are recorded privately, moderation and public features remain closed.

The only currently established human coverage is 19:00–22:00 Asia/Bangkok. Reports can be
accepted outside that period only after activation, but no immediate response is guaranteed.
There is no verified 24/7 monitoring, emergency-service capability, backup moderator or legal
certification.

## Queue and decision procedure

1. Start with a fresh Cloudflare Access MFA session and a current, expiring D1 grant for the
   minimum role. Record a specific moderation purpose; never use member authentication alone.
2. Triage queues in this order: credible imminent threats/child-safety/NCII; account compromise
   or severe privacy exposure; harassment/sexual-content/privacy reports; ordinary abuse and
   appeals. Do not inspect unrelated messages or media.
3. For imminent physical danger, do not claim that ChatGun is an emergency service. Preserve
   the minimum necessary evidence, close or restrict the affected surface when technically
   safe, notify the named incident commander, and direct the reporting person to appropriate
   local emergency services. Disclosure to authorities requires a documented lawful basis and
   owner/legal review unless an applicable emergency rule clearly requires otherwise.
4. Record facts, scope, purpose, decision, reviewer and time in the audit path. Avoid copying
   private content into tickets, chat, GitHub or ordinary email. Escalate uncertain or unlawful
   content without inventing a verdict.
5. Apply the least broad reversible action that contains the risk. Recheck blocking, visibility,
   session revocation and protected-media access. Media stays quarantined unless an authorized
   reviewer explicitly releases it.
6. Notify the affected account using the application notification path where available. Do not
   promise a response deadline that staffing cannot meet.

## Appeals

Appeals enter the authenticated appeal queue. The original media reviewer is technically
barred from resolving their own media decision. Account appeals flag same-reviewer conflicts;
the operator must assign a different reviewer. If independent coverage is unavailable, leave
the appeal pending, keep the safest reversible state and record the staffing blocker. Revision
and nonce conflicts require a fresh queue read rather than replaying the decision.

## Access revocation and incident containment

Revoke the D1 grant first, revoke active Cloudflare admin-session tombstones, terminate the
Cloudflare Access session, and disable the affected application capability. For suspected token
or owner-account compromise, keep all public/OAuth/Social/media flags closed and rotate only
the specifically affected credential through its provider console. Do not reveal credential
values in incident records. A revoked Access identity must never imply deletion of the member
record, and a D1 role must never bypass Access.

## Privacy and cleanup operations

The prepared privacy and media Workers are deliberately absent from Production, have empty cron
lists and require the exact lowercase enable flag. Activation requires all of the following in
one owner-approved change:

- exact Worker SHA/config and Production bindings;
- approved retention/deletion policy and a time-advanced isolated rehearsal;
- an explicit cron schedule plus alert owner and failure destination;
- alerting for invocation failure, exhausted deletion retries, persistent queue age, foreign-key
  failures and unexpected record-count changes;
- daily review during staffed coverage until a stable history is established.

Recommended initial review window is within 19:00–22:00 Asia/Bangkok, not because cleanup must
run only then, but because no out-of-hours responder is confirmed. The owner must choose the
actual schedules. Cloudflare backup/Time Travel copies may outlive logical deletion; cleanup
must not promise immediate physical erasure from all recovery copies.

## Release-day evidence and stop conditions

Before opening any feature, capture sanitized receipts for: exact SHA, Access issuer/audience,
MFA login, owner UUID, expiring grants, provider callback/mode, schema and FK checks, cleanup
schedule/alerts, named responders and rollback owner. Stop and keep flags closed on any identity,
audience, callback, schema, backup, staffing, alert or hash mismatch.
