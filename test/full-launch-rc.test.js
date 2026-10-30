import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('full launch candidate package remains fail closed', () => {
  const result = JSON.parse(execFileSync(process.execPath, ['scripts/verify-full-launch-rc.mjs'], { encoding: 'utf8' }));
  assert.equal(result.result, 'PASS');
  assert.equal(result.decision, 'NO-GO');
  assert.equal(result.productionFlagsRemainClosed, true);
});

test('friend-only launch mode has server, UI and browser regression coverage', () => {
  const handler = readFileSync('functions/api/social/[[path]].js', 'utf8');
  const ui = readFileSync('app/social.js', 'utf8');
  const e2e = readFileSync('e2e/production-launch-rc.spec.js', 'utf8');
  assert.match(handler, /path === "\/api\/social\/relationships"/u);
  assert.match(handler, /FRIEND_REQUESTS_ENABLED/u);
  assert.match(ui, /"unfriend"/u);
  assert.match(e2e, /message-status/u);
  assert.match(e2e, /must be denied/u);
});

test('performance release gate cannot mask a failed discovery abuse-control probe', () => {
  const source = readFileSync('scripts/measure-phase6-performance.mjs', 'utf8');
  assert.match(source, /sessions\.other390/u);
  assert.match(source, /discoveryRateLimit\.result === 'PASS'/u);
  assert.match(source, /process\.exitCode = 1/u);
  assert.doesNotMatch(source, /result:\s*'PASS'/u);
});
