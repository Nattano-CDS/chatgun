import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const json = path => JSON.parse(read(path));
const digest = path => createHash('sha256').update(read(path)).digest('hex');

const publicManifest = json('docs/production-readiness/phase2-launch-qualification/policy-manifest.json');
assert.equal(publicManifest.status, 'DRAFT_NOT_APPROVED_NOT_PUBLISHED');
for (const [name, expected] of Object.entries(publicManifest.files)) {
  assert.equal(digest(`docs/production-readiness/phase2-launch-qualification/policies/${name}`), expected);
  assert.match(read(`docs/production-readiness/phase2-launch-qualification/policies/${name}`).toString(), /DRAFT|Draft/u);
}
const rc6 = json('docs/production-readiness/phase2-launch-qualification/uat-rc6-owner-review.json');
assert.equal(rc6.activationBlockedUntilExactOwnerApproval, true);
for (const [path, expected] of Object.entries(rc6.files)) assert.equal(digest(path), expected);
for (const path of Object.keys(rc6.files)) {
  const body = read(path).toString();
  assert.match(body, /ยังไม่อนุมัติ/u);
  assert.match(body, /social-friends-single-operator-dual-account-uat-2026-10-30-rc6/u);
}
const matrix = json('docs/production-readiness/phase2-launch-qualification/blocker-matrix.json');
assert.equal(matrix.blockers.length, 10);
assert.equal(matrix.blockers.some(item => item.status === 'PASS'), false);
assert.ok(matrix.blockers.every(item => /^BLOCKED — (OWNER ACTION REQUIRED|EXTERNAL DEPENDENCY)$/u.test(item.status)));
const deploy = read('scripts/deploy-phase2-uat-rc.mjs').toString();
assert.match(deploy, /FRIEND_REQUESTS_ENABLED\.value, 'false'/u);
assert.match(deploy, /productionWrites: 0/u);
assert.doesNotMatch(deploy, /pages project update|d1 execute|r2 object put/iu);
const workflow = read('.github/dependency-review.yml.proposed').toString();
assert.match(workflow, /actions\/dependency-review-action@[a-f0-9]{40}/u);
const ruleset = json('docs/production-readiness/phase2-launch-qualification/proposed-main-ruleset.json');
assert.equal(ruleset.enforcement, 'active');
assert.match(read('.github/CODEOWNERS').toString(), /@Nattano-CDS/u);
console.log(JSON.stringify({ passed: 31, failed: 0, status: 'PASS', productionWrites: 0 }));
