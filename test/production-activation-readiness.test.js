import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('Phase 3 package is exact-SHA, closed and fail-closed', () => {
  const result = JSON.parse(execFileSync(process.execPath, ['scripts/verify-production-activation-package.mjs'], { encoding: 'utf8' }));
  assert.equal(result.result, 'PASS');
  assert.equal(result.verdict, 'NO-GO');
  assert.equal(result.productionMutations, 0);
});

test('owner handoff records every privileged blocker without private identifiers', () => {
  const checklist = readFileSync('docs/production-readiness/phase3-owner-approval-checklist.md', 'utf8');
  const runbook = readFileSync('docs/production-readiness/phase3-operations-runbook.md', 'utf8');
  for (const phrase of ['Cloudflare Access', 'Google', 'Meta', 'LINE', '17→21', 'Dependabot', 'CodeQL']) {
    assert.match(checklist, new RegExp(phrase, 'u'));
  }
  for (const phrase of ['backup moderator', 'appeal reviewer', 'emergency service', '19:00–22:00', 'Time Travel']) {
    assert.match(runbook, new RegExp(phrase, 'u'));
  }
  assert.doesNotMatch(checklist + runbook, /@[A-Za-z0-9.-]+/u);
});
