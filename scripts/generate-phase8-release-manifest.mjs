// Generates the post-commit release manifest outside Git so its own commit SHA
// and tree can be recorded without a self-referential manifest.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { assetManifest } from './pages-isolated-release.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const lines = value => value ? value.split('\n').filter(Boolean) : [];
const head = git('rev-parse', 'HEAD');
const tree = git('rev-parse', 'HEAD^{tree}');
const base = '1873fd3c9aae5a0efc26fef47b98753d8fa31308';
assert.match(head, /^[a-f0-9]{40}$/u);
assert.match(tree, /^[a-f0-9]{40}$/u);
assert.equal(git('merge-base', head, base), base, 'Candidate must descend from the verified main baseline');

const tracked = lines(git('ls-files'));
const changed = lines(git('diff', '--name-only', `${base}...HEAD`));
const sources = tracked.filter(path => /^(app|functions|workers)\//u.test(path) || /\.(?:js|html|css)$/u.test(path));
const tests = tracked.filter(path => /^(test|e2e)\//u.test(path) || path.startsWith('playwright.'));
const migrations = readdirSync('migrations/production').filter(path => path.endsWith('.sql')).sort();
const artifact = assetManifest('dist', 'functions');
const diff = execFileSync('git', ['diff', '--binary', `${base}...HEAD`], { maxBuffer: 16 * 1024 * 1024 });
const evidence = JSON.parse(readFileSync('docs/production-readiness/phase8/evidence-manifest.json', 'utf8'));
const contract = JSON.parse(readFileSync('docs/production-readiness/phase8/production-config-contract.json', 'utf8'));

const manifest = {
  format: 'chatgun-phase8-release-manifest-v1',
  generatedAt: new Date().toISOString(),
  candidateCommit: head,
  candidateTree: tree,
  mainBase: base,
  lineage: {
    pullRequest24: evidence.historicalEvidence.pullRequest24.head,
    pullRequest25: evidence.historicalEvidence.pullRequest25.head,
    pullRequest27: evidence.historicalEvidence.pullRequest27.head,
  },
  inventory: {
    trackedFiles: tracked.length,
    changedFiles: changed.length,
    requiredSourceFiles: sources.length,
    requiredTestFiles: tests.length,
    generatedArtifactsTracked: 0,
    reviewDiffBytes: diff.length,
  },
  deployableArtifact: {
    files: artifact.files,
    sha256: artifact.digest,
    sourceGitTree: tree,
    configurationIncluded: false,
  },
  database: {
    requiredProductionSchema: 21,
    productionMigrations: migrations,
    excludedFromProduction: '0022_always_on_private_uat_cohort.sql',
  },
  featureFlags: contract.plainVariables,
  configurationPreservation: contract.deployment,
  ci: { status: process.env.CHATGUN_PHASE8_CI_STATUS || 'PENDING', exactHeadRequired: true },
  historicalEvidence: evidence.historicalEvidence,
  rollback: {
    productionBaseline: 'c9327e7913ea09577c06b8a0f70f953f21d0aecb',
    sourceBaseline: base,
    productionDeploymentAuthorized: false,
  },
};

const serialized = JSON.stringify(manifest, null, 2) + '\n';
manifest.manifestSha256 = createHash('sha256').update(serialized).digest('hex');
const output = process.env.CHATGUN_RELEASE_MANIFEST_OUTPUT || 'artifacts/phase8-release-manifest.json';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ output, candidateCommit: head, candidateTree: tree, artifactSha256: artifact.digest, manifestSha256: manifest.manifestSha256 }));
