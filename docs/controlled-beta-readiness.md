# Controlled Beta readiness

Status: **NO-GO for public or Production launch; conditionally ready for a supervised staging Beta after the operator gates below are completed.** This document is operational evidence, not an approved policy or legal statement.

## Technical boundary

- Public registration remains disabled (`NEW_ACCOUNT_REGISTRATION_ENABLED=false`). Preview alone may enable `BETA_INVITATION_REGISTRATION_ENABLED`; Production remains false.
- A new member needs a 256-bit, single-use invitation. Only its SHA-256 digest is stored. The OAuth flow stores the invitation record ID, not the code. Invitation claim, user/identity creation, and `pending_age` enrollment occur in one D1 transaction.
- Existing identities can sign in without a code. A new provider identity without a valid invitation still fails with `registration_closed`.
- An invited account cannot obtain a member profile until a recently authenticated session completes the server-side 18+ self-declaration. Passing this gate marks the Beta enrollment active. This is self-declared age, not independent age verification.
- Production social, discovery, messaging, media, moderation, adult onboarding, and Beta invitation flags remain false. Production has no `MEDIA` binding.
- Preview social/media flags are for authorized synthetic and invited staging tests only. Media quarantine bypass remains unacceptable for real participants; real-person uploads must stay off until scanning and staffed review are approved.

## Invitation operation

Apply migration 0007 to staging first. Issue a one-use code without printing it:

```sh
node scripts/issue-beta-invitation.mjs --output /secure/operator/path/invite.txt --days 7 --label beta-wave-01
```

The tool refuses any Cloudflare account other than `23017b53386fb67fc62a52cdd017454c`, targets only `chatgun-auth-staging`, creates the output with mode `0600`, and removes it if D1 insertion fails. Transfer the code through an approved one-to-one channel, then securely remove the local file. Labels must be non-personal cohort references.

Revoke before use with an exact invitation ID after verifying the active account and row:

```sql
UPDATE beta_invitations
SET status = 'revoked', revoked_at = unixepoch()
WHERE id = '<exact-id>' AND status = 'active' AND use_count = 0;
```

Do not share codes in tickets, chat logs, analytics, URLs, screenshots, or source control. The cleanup worker removes expired, consumed, or revoked invitation records after a seven-day operational window; linked enrollment remains without the invitation reference.

## Operator launch gates

Before inviting any real participant, the owner must name at least one trained safety reviewer and one escalation owner, define coverage hours and participant support channel, approve the Beta notice/consent wording, confirm lawful age-assurance handling with qualified Thai counsel, and rehearse report, threat, NCII, account-deletion, and lost-access cases. Disable invitations immediately if review coverage is unavailable.

Media remains synthetic-only until a scanner/vendor decision, human review path, appeal path, and deletion SLA are approved. Location discovery should initially use synthetic accounts; real participants require explicit location-risk notice and abuse monitoring. The 250 m bands reduce disclosure but do not eliminate collusion or movement-based inference.

## Beta acceptance evidence

Required per release candidate:

1. Account ID, Preview binding, and pending migration checks.
2. Invalid, expired, revoked, reused, and concurrently claimed invitation tests.
3. OAuth success and cancellation for each provider with approved test accounts.
4. Under-18 rejection and adult activation tests; record that age is self-declared.
5. Cross-user authorization, blocking, report, moderation-audit, private-media, and location-inference regression tests.
6. Account deletion with injected R2 failure followed by successful cleanup retry.
7. D1 foreign-key check, migration history, R2/D1 reconciliation, and zero synthetic residue after the run.
