# ChatGun Privacy Policy — public-launch-2026-10-30-rc1-draft

**DRAFT — NOT APPROVED OR PUBLISHED. Owner approval and qualified Thai PDPA review are required.**

## Data processed

ChatGun processes OAuth provider/subject identifiers, supplied display name/photo, provider email only where supplied and appropriately verified, linked identities, profile/bio/interests, adult age-assurance event, friend relationships, blocks, reports, ratings, text messages and read state, voluntary Discovery coordinates/accuracy/timestamps, optional Presence heartbeats, sessions/security evidence, deletion requests/receipts, moderation decisions/audits, and—only if separately enabled—private media metadata and objects. The entered birth date is used transiently to calculate an age band and is not stored.

## Purposes and disclosure

Data is used to authenticate, provide requested Social features, calculate coarse nearby eligibility, deliver friend-only messages, enforce privacy and blocks, prevent abuse, review reports/appeals, secure sessions, operate deletion, and satisfy applicable obligations. Exact coordinates, reporter identity, private objects, provider references, and private message contents are not published to other members. Necessary processors include Cloudflare and the selected OAuth provider under their own notices. ChatGun does not sell personal data or use Social data for advertising in this proposed scope.

## Location and Presence

Discovery requires explicit browser permission and an in-product action. Coordinates remain server-side, must meet the accepted accuracy threshold, expire quickly, and are rendered as coarse bands up to the configured range. Turning Discovery off clears active publication. Repeated probing is rate-limited. Presence is separately opt-in, short-lived, suppressed for blocked/ineligible accounts, and withdrawn when the client backgrounds or expires.

## Retention, deletion, and recovery copies

Active account/social records remain while needed to provide the service or meet an approved safety/legal need. Confirmed account deletion revokes sessions/provider links, removes applicable live D1 rows by transaction/cascade, and queues owned R2 objects for bounded retry. Minimal random deletion receipts and narrowly justified security/audit evidence may remain for approved periods. D1 Time Travel and protected disaster-recovery backups may outlive logical deletion; a restore must replay completed deletion intents before service reopens. No statement promises physical erasure from every recovery copy within seven days.

Exact public-launch periods for messages, reports, appeals, moderation audits, rate limits, backups, and failed deletion evidence require owner/legal approval and verified scheduled cleanup before publication.

## Rights and contact

Subject to applicable law, users may request access, correction, deletion, objection/restriction, portability where applicable, or withdrawal of optional processing through the approved privacy contact. Identity may be verified proportionately. A privacy/security incident is handled under the approved incident runbook; ChatGun must not publish an unstaffed contact or response target.

ภาษาไทยโดยสรุป: ระบบประมวลผลข้อมูล OAuth โปรไฟล์ ความสัมพันธ์ ข้อความ การบล็อก/รายงาน พิกัดเมื่อผู้ใช้เปิด Discovery, Presence เมื่อเปิดเอง, เซสชัน และหลักฐานความปลอดภัย เพื่อให้บริการและป้องกันการใช้งานผิด พิกัดจริง ตัวตนผู้รายงาน ไฟล์ส่วนตัว และข้อความส่วนตัวไม่เผยแพร่ต่อสมาชิกทั่วไป การลบบัญชีลบข้อมูลที่ใช้จริงและเข้าคิวลบไฟล์ แต่สำเนากู้คืนอาจอยู่ได้นานกว่าและต้องนำคำสั่งลบกลับมาใช้หลังการกู้คืน
