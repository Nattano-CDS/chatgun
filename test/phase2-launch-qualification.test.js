import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Phase 2 launch qualification is internally consistent and fail closed', () => {
  const result = JSON.parse(execFileSync(process.execPath, ['scripts/verify-phase2-launch-qualification.mjs'], { encoding: 'utf8' }));
  assert.deepEqual(result, { passed: 31, failed: 0, status: 'PASS', productionWrites: 0 });
});
