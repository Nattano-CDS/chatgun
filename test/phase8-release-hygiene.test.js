import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const json = path => JSON.parse(readFileSync(path, 'utf8'));

test('curated release contains portable evidence references, not private local paths', () => {
  const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage', 'test-results', 'playwright-report']);
  const textExtensions = new Set(['.js', '.mjs', '.json', '.jsonc', '.md', '.html', '.css', '.yml', '.yaml', '.sql']);
  const paths = [];
  const visit = directory => {
    for (const name of readdirSync(directory)) {
      if (ignored.has(name)) continue;
      const path = join(directory, name);
      const status = statSync(path);
      if (status.isDirectory()) visit(path);
      else if ([...textExtensions].some(extension => name.endsWith(extension))) paths.push(path);
    }
  };
  visit('.');
  for (const path of paths) assert.doesNotMatch(readFileSync(path, 'utf8'), /\/Users\/[A-Za-z0-9._-]+\//u, path);
  const evidence = json('docs/production-readiness/phase8/evidence-manifest.json');
  assert.equal(evidence.historicalEvidence.pullRequest27.head, '22e7cb5a5a67e860f0edb2ecfc0089d1f3fe6569');
  assert.equal(evidence.retention.copiedToCuratedTree, false);
  assert.equal(evidence.retention.historicalGitObjectsRemoved, false);
});

test('source profile and config-free deployment preserve the verified Production Admin and closed feature state', () => {
  const production = json('wrangler.jsonc').env.production;
  const contract = json('docs/production-readiness/phase8/production-config-contract.json');
  for (const [name, expected] of Object.entries(contract.plainVariables)) assert.equal(production.vars[name], expected, name);
  assert.equal(production.d1_databases[0].migrations_dir, 'migrations/production');
  assert.equal(readdirSync('migrations/production').includes('0022_always_on_private_uat_cohort.sql'), false);
  const isolated = readFileSync('scripts/pages-isolated-release.mjs', 'utf8');
  assert.match(isolated, /prohibited = new Set\(\['wrangler\.json'/u);
  assert.match(isolated, /wrangler@\$\{wranglerVersion\}/u);
  assert.match(isolated, /Production execution is forbidden/u);
  assert.equal(contract.deployment.zeroEffectiveConfigurationDriftRequired, true);
  assert.equal(contract.deployment.automaticProductionDeploymentsMustBeDisabledBeforeMainIntegration, true);
});

test('generated and private evidence contamination is ignored', () => {
  const ignore = readFileSync('.gitignore', 'utf8');
  for (const pattern of ['playwright-report/', 'test-results/', '.phase8-evidence/', 'artifacts/', 'blob-report/', 'client_secret_*.json', 'docs/generated-evidence/']) {
    assert.match(ignore, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), pattern);
  }
});
