import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = 'docs/production-readiness/phase9/';
const files = [
  'execution-report.md', 'closed-blocker-register.md', 'remaining-owner-actions.md',
  'oauth-access-verification.md', 'physical-device-validation.md', 'operational-readiness.md',
  'cleanup-authorization-package.json', 'production-preservation.md',
  'migration-authorization-package.md', 'release-manifest.json', 'go-no-go.md',
];

test('Phase 9 package is complete, non-authorizing and sanitized', () => {
  for (const file of files) assert.ok(readFileSync(root + file, 'utf8').length > 100, file);
  const manifest = JSON.parse(readFileSync(root + 'release-manifest.json', 'utf8'));
  const cleanup = JSON.parse(readFileSync(root + 'cleanup-authorization-package.json', 'utf8'));
  assert.equal(manifest.decision, 'NO-GO');
  assert.equal(manifest.blockersClosed, 5);
  assert.equal(manifest.blockersRemaining, 9);
  assert.ok(Object.values(manifest.authorization).every(value => value === false));
  assert.equal(cleanup.status, 'PROPOSED_NOT_AUTHORIZED');
  assert.equal(cleanup.deploymentAuthorized, false);
  assert.equal(cleanup.productionMutations, 0);
  const combined = files.map(file => readFileSync(root + file, 'utf8')).join('\n');
  assert.match(combined, /NO-GO/u);
  assert.match(combined, /BLOCKED/u);
  assert.doesNotMatch(combined, /@[A-Za-z0-9.-]+/u);
});
