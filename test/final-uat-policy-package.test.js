import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { PROPOSED_POLICY } from '../scripts/lib/final-uat-social-campaign.mjs';

const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const productionHashes = {
  'beta-notice.html': 'e01da689a1d91bbcc994f47eb734a191852fb2f162db0d19025bdab4fb4bb394',
  'terms.html': '7b381aaed9ab52f0033a7aec0d2ec4c3951317ad52ed23acc981ff0bc7717dc3',
  'privacy.html': 'be5d8578da6a3e3fd0d6180a37fdde7667565d719b35ec880ffe6105d703f48b',
  'data-deletion.html': 'b55216f2b9853d70476484042644896431e9abdbe9daecd9d641bd7e2105d4e4',
};

test('Production-approved owner-pilot documents remain byte-for-byte unchanged', () => {
  for (const [file, digest] of Object.entries(productionHashes)) assert.equal(sha256(file), digest, file);
});

test('UAT manifest, proposed validator and exact document bytes agree', () => {
  const manifest = JSON.parse(readFileSync('docs/final-uat/policy-review-rc5/policy-package.json'));
  assert.equal(manifest.status, 'DRAFT_NOT_APPROVED');
  assert.equal(manifest.productionDocumentsChanged, false);
  const keys = ['adultNotice', 'terms', 'privacy', 'deletion'];
  for (const key of keys) {
    const document = manifest.documents[key];
    assert.equal(document.version, PROPOSED_POLICY.versions[key]);
    assert.equal(document.sha256, PROPOSED_POLICY.files[document.path]);
    assert.equal(sha256(document.path), document.sha256);
    assert.match(readFileSync(document.path, 'utf8'), new RegExp(`data-policy-version=["']${document.version}["']`, 'u'));
  }
  assert.equal(manifest.activation.requiresPrivateOwnerApproval, true);
  assert.equal(manifest.retention.minimumAuditEvidenceRetentionDays, 90);
  assert.equal(manifest.retention.minimumAuditEvidenceRetentionStartsAt, 'actual-explicit-close');
});

test('all rc5 documents state the truthful one-operator/two-identity scope and conditional effect', () => {
  for (const file of Object.keys(PROPOSED_POLICY.files)) {
    const html = readFileSync(file, 'utf8');
    assert.match(html, /อนุมัติ.*bytes\/SHA-256|อนุมัติ exact bytes\/SHA-256/u, file);
    assert.match(html, /A|LINE/u, file);
    assert.match(html, /B|Google/u, file);
    assert.match(html, /Production/u, file);
    assert.match(html, /Media|สื่อ/u, file);
    assert.match(html, /เจ็ดวัน/u, file);
    assert.match(html, /explicit|ชัดแจ้ง/u, file);
    for (const link of ['beta-notice.html', 'terms.html', 'privacy.html', 'data-deletion.html'].filter(name => name !== basename(file))) assert.match(html, new RegExp(`href=["']\\./${link}["']`, 'u'), `${file} -> ${link}`);
  }
  const combined=Object.keys(PROPOSED_POLICY.files).map(file=>readFileSync(file,'utf8')).join('\n');
  assert.match(combined,/20 ปี|20\+/u);
  assert.match(combined,/หนึ่งคน|one human|single-operator/u);
  assert.match(combined,/สอง identity|two identity|identity สอง/u);
  assert.match(combined,/ไม่ใช่.*สองคน|ไม่ใช่.*two-human|not independent two-human/u);
  assert.match(combined,/19:00–22:00/u);
  assert.match(combined,/24\/7|24 ชั่วโมง/u);
  assert.doesNotMatch(combined,/Participant A.*บุคคลคนละคน|Participant B.*บุคคลคนละคน/u);
});

test('documents cover Social risks, lifecycle and the genuine cleanup limitations without overclaiming', () => {
  const all = Object.keys(PROPOSED_POLICY.files).map(file => readFileSync(file, 'utf8')).join('\n');
  for (const phrase of ['A=LINE', 'B=Google', 'Turnstile', 'MFA', 'Discovery', 'Direct text Chat', 'Online Presence', 'end-to-end', 'Cloudflare', 'Time Travel', 'logical cleanup', 'provider-linked sessions', 'foreign-key', 'R2', 'retry']) assert.match(all, new RegExp(phrase, 'u'), phrase);
  assert.match(all, /ปิดเป็นค่าเริ่มต้น|ปิดเริ่มต้น/u);
  assert.match(all, /อนุมานพื้นที่|อนุมานบริเวณ/u);
  assert.match(all, /Production LINE.*ห้ามลบ|ห้ามลบ Production LINE/u);
  assert.match(all, /ChatGun UAT Google identity.*owner authorization|การลบ.*ChatGun UAT Google identity B.*owner authorization/u);
  assert.match(all, /external Google account|external LINE\/Google account/u);
  assert.match(all, /backup.*ไม่ใช่คำมั่น|ไม่ใช่คำมั่น.*backup|physical erasure/u);
  assert.match(all, /independent age verification/u);
  assert.match(all, /ไม่มีการสแกน.*อัตโนมัติ|automated scanning/u);
  assert.match(all, /ไม่มีการรับรองทางกฎหมาย|legal certification/u);
  assert.match(all, /90 วัน/u);
  assert.match(all, /เวลาปิดแคมเปญจริง|actual close|เวลาปิดจริง/u);
  assert.match(all, /บัญชีอ้างอิงดิบ|raw account reference|raw invitation\/account reference/u);
});

test('frontend links, backend acceptance versions and guarded UAT publication all point to matching policies', () => {
  const acceptance = readFileSync('acceptance.html', 'utf8');
  for (const file of ['beta-notice.html', 'terms.html', 'privacy.html']) assert.match(acceptance, new RegExp(`href=["']/${file}["']`, 'u'));
  const config = JSON.parse(readFileSync('wrangler.final-uat-social.proposed.jsonc'));
  assert.equal(config.vars.ADULT_NOTICE_VERSION, PROPOSED_POLICY.versions.adultNotice);
  assert.equal(config.vars.TERMS_VERSION, PROPOSED_POLICY.versions.terms);
  assert.equal(config.vars.PRIVACY_VERSION, PROPOSED_POLICY.versions.privacy);
  const activate = readFileSync('scripts/activate-final-uat-social.mjs', 'utf8');
  for (const required of ['copyFileSync(resolve(file), join(directory, \'dist\', policyTarget(file)))', 'Displayed policy changed', 'Displayed policy version changed', 'Policy missing from asset manifest', 'uatPolicyVersions', 'uatPolicyFiles']) assert.match(activate, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.doesNotMatch(activate, /chatgun-auth|chatgun\.social/u);
});

test('owner review package leaves all human decisions pending and activation remains fail-closed', () => {
  const review = readFileSync('docs/final-uat/policy-review-rc5/README.md', 'utf8');
  assert.match(review, /DRAFT — NOT APPROVED/u);
  assert.match(review, /No answer is preselected/u);
  assert.match(review, /do not publish rc5.*migrate schema22.*issue invitations/u);
  const validator = readFileSync('scripts/lib/final-uat-social-campaign.mjs', 'utf8');
  assert.match(validator, /assert\.equal\(receipt\.policyApproved, true\)/u);
  assert.match(validator, /assert\.deepEqual\(receipt\.policyVersions, PROPOSED_POLICY\.versions\)/u);
  assert.match(validator, /assert\.deepEqual\(receipt\.policyFiles, PROPOSED_POLICY\.files\)/u);
});
