// Builds and verifies a private rollback artifact for the current Production release.
// It performs no Cloudflare writes and never includes credentials or database rows.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const productionOrigin = 'https://chatgun.social';
const deployedSha = process.env.CHATGUN_PRODUCTION_DEPLOYED_SHA;
const backupRoot = process.env.CHATGUN_PRODUCTION_BACKUP_DIR;
assert.match(deployedSha || '', /^[a-f0-9]{40}$/u);
assert.ok(backupRoot?.startsWith('/Users/nattano/.codex/private-backups/chatgun/production-readiness-'));
assert.equal(statSync(backupRoot).mode & 0o777, 0o700);
const sha256 = value => createHash('sha256').update(value).digest('hex');

const build = mkdtempSync(join(tmpdir(), 'chatgun-production-rollback-'));
execFileSync('git', ['clone', '--shared', '--no-checkout', process.cwd(), build], { stdio: 'pipe' });
execFileSync('git', ['checkout', '--detach', deployedSha], { cwd: build, stdio: 'pipe' });
execFileSync('node', ['scripts/build-pages.mjs'], {
  cwd: build,
  env: { ...process.env, CHATGUN_RELEASE_MODE: 'controlled-beta', CHATGUN_CANARY_BUILD: 'false' },
  stdio: 'pipe',
});
const localRelease = JSON.parse(readFileSync(join(build, 'dist/release.json')));
assert.equal(localRelease.commit, deployedSha);
assert.equal(localRelease.releaseMode, 'controlled-beta');
const liveReleaseResponse = await fetch(`${productionOrigin}/release.json?rollback=${Date.now()}`, { cache: 'no-store' });
assert.ok(liveReleaseResponse.ok);
const liveRelease = await liveReleaseResponse.json();
assert.equal(liveRelease.commit, deployedSha);
assert.equal(liveRelease.assetsManifestSha256, localRelease.assetsManifestSha256);

const localManifestBytes = readFileSync(join(build, 'dist/release-assets.json'));
const liveManifestResponse = await fetch(`${productionOrigin}/release-assets.json?rollback=${Date.now()}`, { cache: 'no-store' });
assert.ok(liveManifestResponse.ok);
const liveManifestBytes = Buffer.from(await liveManifestResponse.arrayBuffer());
assert.equal(sha256(liveManifestBytes), sha256(localManifestBytes));
const manifest = JSON.parse(localManifestBytes);
let checkedFiles = 0;
for (const asset of manifest.files) {
  const localBytes = readFileSync(join(build, 'dist', asset.path));
  assert.equal(sha256(localBytes), asset.sha256, `Local rollback hash mismatch: ${asset.path}`);
  const response = await fetch(`${productionOrigin}/${asset.path}?rollback=${deployedSha}`, { cache: 'no-store' });
  assert.ok(response.ok, `Live rollback asset unavailable: ${asset.path}`);
  assert.equal(sha256(Buffer.from(await response.arrayBuffer())), asset.sha256, `Live asset mismatch: ${asset.path}`);
  checkedFiles += 1;
}

const artifact = join(backupRoot, `rollback-${deployedSha}`);
mkdirSync(artifact, { mode: 0o700 });
cpSync(join(build, 'dist'), join(artifact, 'dist'), { recursive: true });
function protect(directory) {
  chmodSync(directory, 0o700);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) protect(path);
    else chmodSync(path, 0o600);
  }
}
protect(artifact);
const evidence = {
  checkedAt: new Date().toISOString(),
  deployedSha,
  releaseMode: localRelease.releaseMode,
  requiredD1MigrationNumber: localRelease.requiredD1MigrationNumber,
  assetsManifestSha256: localRelease.assetsManifestSha256,
  checkedFiles,
  exactSourceRebuildMatchesLive: true,
  rollbackArtifactPermissions: 'directories 0700; files 0600',
  rollbackArtifactPrivate: true,
  productionWrites: 0,
};
writeFileSync(join(artifact, 'verification.json'), JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
mkdirSync('docs/production-readiness', { recursive: true });
writeFileSync('docs/production-readiness/rollback-artifact.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
