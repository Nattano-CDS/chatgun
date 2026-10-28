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
  const manifest = JSON.parse(readFileSync('docs/final-uat/policy-review/policy-package.json'));
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
  assert.equal(manifest.retention.ownerDecisionPending, false);
  assert.equal(manifest.retention.minimumAuditEvidenceRetentionDays, 90);
  assert.equal(manifest.retention.minimumAuditEvidenceRetentionStartsAt, 'actual-campaign-close');
});

test('all corrected documents state the controlled two-adult scope, conditional effect and exclusions', () => {
  for (const file of Object.keys(PROPOSED_POLICY.files)) {
    const html = readFileSync(file, 'utf8');
    assert.match(html, /มีผลเฉพาะเมื่อเจ้าของอนุมัติ bytes\/SHA-256 นี้/u, file);
    assert.match(html, /Participant A|ผู้เข้าร่วมสองคน/u, file);
    assert.match(html, /Participant B|สองบัญชี/u, file);
    assert.match(html, /20 ปี/u, file);
    assert.match(html, /Production/u, file);
    assert.match(html, /19:00–22:00/u, file);
    assert.match(html, /24\/7|24 ชั่วโมง/u, file);
    assert.match(html, /Media|สื่อ/u, file);
    assert.match(html, /เจ็ดวัน/u, file);
    for (const link of ['beta-notice.html', 'terms.html', 'privacy.html', 'data-deletion.html'].filter(name => name !== basename(file))) assert.match(html, new RegExp(`href=["']\\./${link}["']`, 'u'), `${file} -> ${link}`);
  }
});

test('documents cover Social risks, lifecycle and the genuine cleanup limitations without overclaiming', () => {
  const all = Object.keys(PROPOSED_POLICY.files).map(file => readFileSync(file, 'utf8')).join('\n');
  for (const phrase of ['Google, Facebook หรือ LINE', 'Turnstile', 'MFA', 'Discovery', 'Direct text Chat', 'Online presence', 'end-to-end', 'Cloudflare', 'Time Travel', 'logical cleanup', 'provider-linked sessions', 'foreign-key', 'R2', 'retry']) assert.match(all, new RegExp(phrase, 'u'), phrase);
  assert.match(all, /ปิดเป็นค่าเริ่มต้น/u);
  assert.match(all, /อนุมานพื้นที่|อนุมานบริเวณ/u);
  assert.match(all, /ห้ามลบบัญชีจริงของ Participant A อัตโนมัติ/u);
  assert.match(all, /Participant B.*ยินยอมแยก/u);
  assert.match(all, /ไม่ใช่คำมั่น.*backup|ไม่ใช่คำมั่น.*สำเนา/u);
  assert.match(all, /ไม่มีการตรวจอายุโดยอิสระ/u);
  assert.match(all, /ไม่มีการสแกน.*อัตโนมัติ/u);
  assert.match(all, /ไม่มีการรับรองทางกฎหมาย/u);
  assert.match(all, /90 วัน/u);
  assert.match(all, /เวลาปิดแคมเปญจริง/u);
  assert.match(all, /บัญชีอ้างอิงดิบ/u);
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
  const review = readFileSync('docs/final-uat/policy-review/README.md', 'utf8');
  assert.match(review, /RC3 DRAFT — EXACT OWNER REAPPROVAL REQUIRED/u);
  assert.match(review, /No answer is preselected/u);
  assert.match(review, /do not publish.*issue invitations.*enable Social/u);
  const validator = readFileSync('scripts/lib/final-uat-social-campaign.mjs', 'utf8');
  assert.match(validator, /assert\.equal\(receipt\.policyApproved, true\)/u);
  assert.match(validator, /assert\.deepEqual\(receipt\.policyVersions, PROPOSED_POLICY\.versions\)/u);
  assert.match(validator, /assert\.deepEqual\(receipt\.policyFiles, PROPOSED_POLICY\.files\)/u);
});
