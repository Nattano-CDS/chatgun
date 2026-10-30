import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyProductionPreservation } from '../scripts/verify-production-preservation.mjs';

const fingerprint = JSON.parse(readFileSync('docs/production-readiness/phase6/production-owner-pilot-fingerprint.json', 'utf8'));
const proposal = JSON.parse(readFileSync('docs/production-readiness/phase6/owner-pilot-preservation-profile.json', 'utf8')).vars;

test('review-only owner-pilot profile preserves capabilities and restricted gates', () => {
  const result = verifyProductionPreservation(proposal, fingerprint);
  assert.equal(result.result, 'PASS');
  assert.equal(result.pilotRegressions.length, 0);
  assert.equal(result.restrictedActivations.length, 0);
});

test('preservation gate blocks disabling the existing LINE owner pilot', () => {
  const result = verifyProductionPreservation({ ...proposal, OAUTH_LOGIN_ENABLED: 'false' }, fingerprint);
  assert.equal(result.result, 'BLOCKED');
  assert.deepEqual(result.pilotRegressions.map(item => item.key), ['OAUTH_LOGIN_ENABLED']);
});

test('preservation gate blocks activating a restricted feature', () => {
  const result = verifyProductionPreservation({ ...proposal, MESSAGING_ENABLED: 'true' }, fingerprint);
  assert.equal(result.result, 'BLOCKED');
  assert.deepEqual(result.restrictedActivations.map(item => item.key), ['MESSAGING_ENABLED']);
});
