import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = 'docs/production-readiness/phase7/';
const required = [
  'e2e-test-report.md', 'test-results.json', 'production-preservation-verification.md',
  'security-e2e-results.md', 'responsive-regression-results.md', 'performance-results.md',
  'defect-and-fix-register.md', 'production-fingerprint-comparison.md', 'go-no-go-report.md',
];

test('Phase 7 package is complete, counted and sanitized', () => {
  for (const file of required) assert.ok(readFileSync(root + file, 'utf8').length > 100, file);
  const report = JSON.parse(readFileSync(root + 'test-results.json', 'utf8'));
  const counts = Object.fromEntries(['PASS', 'FAIL', 'BLOCKED', 'NOT RUN'].map(status => [
    status, report.results.filter(result => result.status === status).length,
  ]));
  assert.deepEqual(counts, { PASS: 40, FAIL: 0, BLOCKED: 7, 'NOT RUN': 2 });
  assert.deepEqual(report.summary, { ...counts, total: report.results.length });
  for (const result of report.results) for (const field of [
    'scenarioId', 'description', 'environment', 'actualResult', 'expectedResult', 'status', 'evidenceReference',
  ]) assert.ok(Object.hasOwn(result, field), `${result.scenarioId} missing ${field}`);
  const combined = required.map(file => readFileSync(root + file, 'utf8')).join('\n');
  assert.match(combined, /NO-GO/u);
  assert.match(combined, /BLOCKED/u);
  assert.doesNotMatch(combined, /@[A-Za-z0-9.-]+/u);
});
