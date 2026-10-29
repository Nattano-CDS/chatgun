import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = 'docs/production-readiness/phase6/';
const required = [
  'e2e-test-plan.md', 'e2e-test-results.json', 'e2e-test-evidence.md', 'security-test-results.md',
  'cross-device-results.md', 'performance-results.md', 'production-preservation-diff.md',
  'defect-and-fix-register.md', 'owner-actions.md', 'go-no-go-report.md',
];

test('Phase 6 package is complete, internally counted and does not overclaim live execution', () => {
  for (const file of required) assert.ok(readFileSync(root + file, 'utf8').length > 100, file);
  const report = JSON.parse(readFileSync(root + 'e2e-test-results.json', 'utf8'));
  const counts = Object.fromEntries(['PASS', 'FAIL', 'BLOCKED', 'NOT RUN'].map(status => [status, report.results.filter(result => result.status === status).length]));
  assert.deepEqual(counts, { PASS: 40, FAIL: 0, BLOCKED: 15, 'NOT RUN': 2 });
  assert.deepEqual(report.summary, { ...counts, total: report.results.length });
  for (const result of report.results) for (const field of [
    'testId', 'module', 'scenario', 'environment', 'commitSha', 'executionMethod',
    'expectedResult', 'actualResult', 'status', 'evidenceReference', 'defectReference',
  ]) assert.ok(Object.hasOwn(result, field), `${result.testId} missing ${field}`);
  const combined = required.map(file => readFileSync(root + file, 'utf8')).join('\n');
  assert.match(combined, /NO-GO/u);
  assert.match(combined, /BLOCKED/u);
  assert.doesNotMatch(combined, /@[A-Za-z0-9.-]+/u);
});
