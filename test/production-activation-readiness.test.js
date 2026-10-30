import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('Production activation package preserves the owner pilot and remains NO-GO', () => {
  const result = JSON.parse(execFileSync(process.execPath, ['scripts/verify-production-activation-package.mjs'], { encoding: 'utf8' }));
  assert.equal(result.result, 'PASS');
  assert.equal(result.verdict, 'NO-GO');
  assert.equal(result.productionMutations, 0);
  assert.equal(result.productionPreservationChecksVerified, 25);
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

test('Phase 5 Access handoff is exact, non-authorizing and preserves the owner pilot', () => {
  const access = readFileSync('docs/production-readiness/phase5-cloudflare-access-production-checklist.md', 'utf8');
  const accessFlat = access.replace(/\s+/gu, ' ');
  const report = readFileSync('docs/production-readiness/phase5-readiness-report.md', 'utf8');
  const results = JSON.parse(readFileSync('docs/production-readiness/phase5-cloudflare-access-security-results.json', 'utf8'));
  for (const phrase of [
    'https://tiny-violet-2021.cloudflareaccess.com',
    'chatgun.social/app/moderation*',
    'chatgun.social/api/admin/*',
    'ADMIN_ACCESS_AUDIENCE',
    'ADMIN_ACCESS_OWNER_USER_ID',
    '10 minutes',
    'Not authorized for Production execution',
  ]) assert.ok(accessFlat.includes(phrase), phrase);
  for (const phrase of ['LINE OAuth on', 'invitation-only', 'Social shell/onboarding on', 'NO-GO']) {
    assert.match(report, new RegExp(phrase, 'u'));
  }
  assert.deepEqual(results.automated, {
    ...results.automated,
    passed: 37,
    failed: 0,
    skipped: 0,
  });
  assert.equal(results.blockedLiveScenarios.count, 5);
  assert.equal(results.genuineMfaPassClaimed, false);
  assert.equal(results.productionMutations, 0);
  assert.doesNotMatch(access + report, /@[A-Za-z0-9.-]+/u);
});
