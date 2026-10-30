import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const manifestPath = 'docs/production-readiness/master-release-manifest.json';
const reportPath = 'docs/production-readiness/master-production-release-gate.md';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

assert.equal(manifest.decision, 'NO-GO');
assert.equal(manifest.productionMutationCount, 0);
assert.equal(manifest.exactCandidateSha.mustEqualPrHead, true);
assert.equal(manifest.exactCandidateSha.mustEqualDeploymentArtifact, true);
assert.equal(manifest.observedProduction.schema, 17);
assert.equal(manifest.targetSchema, 21);
assert.equal(manifest.excludedMigration, '0022_always_on_private_uat_cohort.sql');
for (const migration of manifest.migrations) {
  assert.equal(sha256(`migrations/${migration.file}`), migration.sha256, migration.file);
}

const candidateSha = git('rev-parse', 'HEAD');
const candidateTreeSha = git('rev-parse', 'HEAD^{tree}');
const status = git('status', '--porcelain');

console.log(JSON.stringify({
  result: status ? 'BLOCKED_DIRTY_WORKTREE' : 'PASS',
  decision: manifest.decision,
  candidateSha,
  candidateTreeSha,
  prHeadMustEqual: candidateSha,
  deploymentArtifactMustEqual: candidateSha,
  manifestSha256: sha256(manifestPath),
  reportSha256: sha256(reportPath),
  migrationHashesVerified: manifest.migrations.length,
  excludedMigration: manifest.excludedMigration,
  productionPreservationChecks: manifest.evidence.productionPreservation.passed,
  productionMutationCount: manifest.productionMutationCount,
  worktreeClean: !status,
}, null, 2));

if (status) process.exitCode = 2;

