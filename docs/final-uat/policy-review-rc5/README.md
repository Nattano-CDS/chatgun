# ChatGun Single-Operator Dual-Account Private UAT — rc5 owner review

**DRAFT — NOT APPROVED. UAT MUST REMAIN CLOSED.**

This package corrects the human-evidence model. The proposed campaign requires one verified adult owner operating two personally controlled identities on two devices: A=LINE and B=Google. Approval and the required owner attestations are still pending. It does not claim two independent participants or independent B consent.

| Document | Exact version | SHA-256 |
|---|---|---|
| Adult/Social Notice | `adult-social-single-operator-dual-account-uat-2026-10-28-rc5` | `e4a8f77b607586b8c0ebd185d72857e0e0661e526cb6cfd0770247a7513c7de9` |
| Terms | `terms-social-single-operator-dual-account-uat-2026-10-28-rc5` | `d6d4035d772c9104bbbaaf96384a4768d6406ade93637e1fbed78f913a0f9f90` |
| Privacy | `privacy-social-single-operator-dual-account-uat-2026-10-28-rc5` | `73176011f94bfe987ae8e0c4ed3f09f862f43c38d5ee86d201afabfe9909201a` |
| Data Deletion | `deletion-social-single-operator-dual-account-uat-2026-10-28-rc5` | `aaca1f6637f293f52bb2e2c7aa332bdba2a1ee052e8beccc39c8849408985d58` |

Canonical files are in `policies/final-uat/single-operator-rc5/`. rc4 and Production documents remain byte-for-byte unchanged.

## Exact decisions required

No answer is preselected. The owner must explicitly approve or reject all four exact rc5 bytes/hashes and confirm:

1. One human operator, age 20+, controls both devices and both authorized provider accounts.
2. A is the operator-controlled authorized LINE tester identity; B is the operator-controlled authorized Google tester identity.
3. Both identities may be used for Social, approximate Location, Text Chat, Presence, Privacy, disposable UAT data, and 24/7 processing until explicit close or withdrawal.
4. Human moderation is only 19:00–22:00 Asia/Bangkok; outside-hours reports queue without guaranteed immediate response.
5. Seven-day logical cleanup from actual explicit close, 90-day minimized audit retention, and Cloudflare D1 Time Travel/backup limitations are accepted or rejected.
6. Separate YES/NO authorization to delete only the disposable **ChatGun UAT Google-linked identity/account B** after de-enrollment and session revocation. This never authorizes deletion of the external Google account, Production LINE identity, or external LINE account.

Until every field is recorded in the protected mode-0600 handoff, do not publish rc5, migrate schema22, activate services, issue invitations, create accounts, grant roles, or change Production.
