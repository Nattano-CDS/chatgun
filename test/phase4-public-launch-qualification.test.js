import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = 'docs/production-readiness/phase4-public-launch-qualification/';
const json = name => JSON.parse(readFileSync(root + name, 'utf8'));
const text = name => readFileSync(root + name, 'utf8');

test('Phase 4 preserves the exact RC6a evidence and three independent decisions', () => {
  const manifest = json('release-manifest.json');
  assert.deepEqual(manifest.decisions, {
    rc6aFriendsMessagingUat: 'GO',
    phase1PublicLaunchWithoutMedia: 'NO-GO',
    fullPublicLaunch: 'NO-GO',
  });
  assert.equal(manifest.testedApplication.sha, '38804ae940203108ee08abb98f2a521559501413');
  assert.equal(manifest.testedApplication.tree, '883582e2826561ccfbc9f9ae631e42a6aa27df69');
  assert.equal(manifest.rc6aUat.artifactInventorySha256, '1b525c231034c9688e1bbfe94a4a52a29a23b8f510875797c12b9a510fe1ba85');
  assert.equal(manifest.rc6aUat.classification, 'single-operator-dual-account-functional-e2e-not-independent-two-human-uat');
  assert.equal(manifest.rc6aUat.relationshipScenarios, '11/11 PASS');
  assert.equal(manifest.rc6aUat.messages, 15);
  assert.deepEqual(manifest.rc6aUat.finalRelationshipState, { accepted: 1, pending: 0, blocks: 0 });
  assert.equal(manifest.productionBaseline.sha, 'c9327e7913ea09577c06b8a0f70f953f21d0aecb');
  assert.equal(manifest.productionBaseline.schema, 21);
  assert.equal(manifest.productionBaseline.foreignKeyViolations, 0);
  assert.equal(manifest.productionChanges, 0);
  assert.equal(manifest.deploymentAuthorized, false);
  assert.equal(manifest.mergeAuthorized, false);
});

test('Phase 4 blocker matrix keeps genuine and owner-only gates blocked', () => {
  const matrix = json('blocker-matrix.json');
  assert.equal(matrix.blockers.length, 10);
  assert.equal(matrix.blockers.find(item => item.id === 4).status, 'CLEARED — PASS');
  assert.match(matrix.blockers.find(item => item.id === 5).status, /BLOCKED/u);
  assert.match(matrix.blockers.find(item => item.id === 8).status, /DEFERRED FOR PHASE 1; BLOCKED FOR FULL LAUNCH/u);
  for (const item of matrix.blockers.filter(item => item.id !== 4)) {
    assert.ok(item.requiredAction && item.responsibleParty && item.verification);
  }
  assert.equal(matrix.productionMutations, 0);
});

test('approved rc6a policy bytes still match the recorded exact hashes', () => {
  const review = JSON.parse(readFileSync('docs/production-readiness/phase2-launch-qualification/uat-rc6a-owner-review.json', 'utf8'));
  for (const [file, expected] of Object.entries(review.files)) {
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), expected);
  }
});

test('owner checklist preserves personal-action and Production boundaries', () => {
  const checklist = text('owner-action-checklist.md');
  assert.match(checklist, /real iOS Safari/u);
  assert.match(checklist, /real Android Chrome/u);
  assert.match(checklist, /Never export client secrets/u);
  assert.match(checklist, /does not authorize merge, deployment, configuration changes or public activation/u);
});
