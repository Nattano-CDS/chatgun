# ChatGun policy set — DRAFT / ร่างสำหรับตรวจสอบ

**Not published. Not legal advice. Qualified Thai legal review and owner approval required.**

Operator / ผู้ให้บริการ: เทพกร ทาโน (individual / บุคคลธรรมดา)  
Service / บริการ: ChatGun — `https://chatgun.social`  
Contact / ติดต่อ: `natttano@outlook.com`  
Proposed launch eligibility / อายุที่เสนอสำหรับการเปิดตัว: 18+ (self-declared; not independently verified)

## Privacy Policy / นโยบายความเป็นส่วนตัว

ChatGun uses Google, Facebook, or LINE identifiers, display name, profile image, and provider
email only when supplied and appropriately verified. LINE email permission, Email OTP, and
Mobile OTP are disabled. ChatGun stores linked identities, profile and social interactions,
private messages/media, reports/blocks, coarse discovery results, precise coordinates only
while nearby discovery is active, session/security records, and deletion records in
Cloudflare services (including D1, Pages/Workers, Turnstile, and private R2). OAuth providers
and Cloudflare process data under their own notices.

ChatGun uses this data to authenticate, provide requested social features, protect users,
prevent abuse, respond to reports, and operate/decommission accounts. Exact coordinates,
birth date, reporter identity, and private objects are not published to members. Birth date
is used transiently to calculate an adult age band and is not stored. Required session and
CSRF cookies are Secure/HttpOnly where applicable and are not advertising cookies.

ภาษาไทย: ChatGun ประมวลผลข้อมูลเท่าที่จำเป็นสำหรับการเข้าสู่ระบบ ฟีเจอร์สังคม ความ
ปลอดภัย การป้องกันการใช้งานผิดวัตถุประสงค์ และการลบบัญชี ระบบไม่เผยแพร่พิกัดจริง วันเกิด
ตัวตนผู้รายงาน หรือไฟล์ส่วนตัวแก่สมาชิก วันเกิดใช้คำนวณช่วงอายุชั่วคราวและไม่บันทึก

Users may request access, correction, objection/restriction where applicable, deletion, or
withdrawal of optional processing by contacting the address above. Identity may need to be
verified proportionately. Rights and exceptions depend on Thai PDPA and other applicable law.
No retention period in this draft is a guaranteed commitment until operational enforcement
and backup behavior are approved. D1 Time Travel and controlled backups may temporarily
retain deleted data; restored systems must replay completed deletions before reopening.

## Terms of Service / ข้อกำหนดการใช้บริการ

The proposed controlled public launch is for people aged 18 or over. A date entry is a
self-declaration, not independent verification. Users must provide truthful information,
protect their account, respect consent and privacy, and comply with law and the Community
Guidelines. Prohibited conduct includes harassment, threats, stalking/location inference,
impersonation, sexual exploitation, child-safety abuse, non-consensual intimate imagery,
spam, fraud, malicious files, evasion of blocks, and attempts to access other users' data.

ภาษาไทย: ผู้ใช้ต้องให้ข้อมูลตามจริง รักษาความปลอดภัยบัญชี เคารพความยินยอมและความเป็น
ส่วนตัว และห้ามคุกคาม ข่มขู่ สะกดรอย แอบอ้าง เผยแพร่ภาพส่วนตัวโดยไม่ยินยอม กระทำต่อเด็ก
ส่งสแปม หลอกลวง หรือหลบเลี่ยงการบล็อก

ChatGun may restrict or suspend features/accounts to protect users or comply with law, with
an appeal path where appropriate. Availability, moderation response time, and uninterrupted
service are not guaranteed. Final governing-law, liability, dispute, content-license, and
notice clauses require qualified Thai legal review before publication.

## Data deletion / การลบบัญชีและข้อมูล

An authenticated user initiates deletion from the account page, recently reauthenticates,
passes CSRF/replay protections, and confirms a one-time request. ChatGun immediately revokes
sessions, disables access, removes provider links, deletes applicable live D1 account/social
rows by cascade, and queues owned private media for R2 deletion with retry. A short-lived
random receipt records completion without retaining identity. Users should separately revoke
ChatGun in Google/Facebook/LINE settings because ChatGun stores no provider token suitable for
later provider-side revocation.

ภาษาไทย: ผู้ใช้ขอลบบัญชีจากหน้าบัญชี ยืนยันตัวตนล่าสุด และยืนยันคำขอแบบใช้ครั้งเดียว ระบบ
เพิกถอนเซสชัน ลบการเชื่อมโยงผู้ให้บริการ ลบข้อมูลที่เกี่ยวข้องในฐานข้อมูล และส่งไฟล์ส่วนตัว
เข้าคิวลบ ผู้ใช้ควรเพิกถอนสิทธิ์ ChatGun ที่ผู้ให้บริการเข้าสู่ระบบด้วย

Deletion may not instantly remove selective copies from D1 Time Travel, disaster-recovery
backups, legally required records, or evidence needed for a narrowly justified safety/legal
matter. Final periods and exceptions require owner/legal approval and tested infrastructure.

## Community Guidelines / แนวทางชุมชน

Be genuine, obtain consent, accept “no,” and use block/report tools. Do not harass, threaten,
stalk, infer or publish location, impersonate, exploit minors, share intimate images without
consent, promote violence, spam, scam, or upload illegal/malicious material. Severe or
repeated conduct may lead to content quarantine, contact restrictions, suspension, or
escalation. Reports are confidential; knowingly abusive reports are also prohibited. Appeals
are available through the contact address, subject to a staffed process that must exist before
launch.

## Location Privacy / ความเป็นส่วนตัวของตำแหน่ง

Location is opt-in, foreground-oriented, and used to calculate nearby discovery. ChatGun
accepts positions reporting 50 m accuracy or better, expires them after two minutes, and
shows only coarse 100 m bands up to 5 km. It never gives members raw coordinates, accuracy,
or location timestamps. Turning discovery off or revoking permission clears publication.
Repeated probing, triangulation, stalking, or attempts to defeat distance protection are
prohibited. The final minimum band may be increased after field-risk review.

## Media and content retention / สื่อและการเก็บรักษา

Allowed uploads are structurally valid JPG, PNG, or WebP images up to 8 MiB. Files are private,
metadata is minimized, and access depends on account/relationship/block rules. Public launch
requires quarantine and an approved scanner/human escalation process. Rejected or deleted
media becomes inaccessible immediately and is removed asynchronously with retry. Exact
message, report, audit, quarantine, and backup periods are intentionally not promised in this
draft pending owner, operational, and legal approval.
