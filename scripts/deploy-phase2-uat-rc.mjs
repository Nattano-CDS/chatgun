// Deploys code only to the already-isolated ChatGun UAT branch. It never
// changes Pages variables/bindings, D1/R2 data, Production, or feature flags.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { PROPOSED_POLICY } from './lib/final-uat-social-campaign.mjs';

assert.equal(process.env.CHATGUN_PHASE2_UAT_DEPLOY, 'exact-rc-code-only');
const ACCOUNT = '23017b53386fb67fc62a52cdd017454c';
const PROJECT = 'chatgun-final-uat';
const ORIGIN = 'https://uat.chatgun-final-uat.pages.dev';
const DB = 'e3cb426c-b88a-4b93-90fd-39df524f68ae';
const BUCKET = 'chatgun-final-uat-media';
const PRODUCTION_PROJECT = 'chatgun';
const PRODUCTION_SHA = 'c9327e7913ea09577c06b8a0f70f953f21d0aecb';
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.match(sha, /^[a-f0-9]{40}$/u);
assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '');

const { token } = JSON.parse(execFileSync('npx', ['--yes', 'wrangler@4.156.0', 'auth', 'token', '--json'], { encoding: 'utf8' }));
async function cf(path, body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json();
  assert.ok(response.ok && json.success, `Cloudflare read failed: ${path}`);
  return json.result;
}
const query = async sql => (await cf(`/d1/database/${DB}/query`, { sql }))[0];
function previewConfig(project) {
  const config = structuredClone(project.deployment_configs.preview);
  delete config.wrangler_config_hash;
  for (const [name, item] of Object.entries(config.env_vars || {})) {
    config.env_vars[name] = item?.type === 'secret_text' ? { type: 'secret_text' } : item;
  }
  return config;
}
async function fingerprint() {
  const counts = {};
  for (const table of ['users', 'identities', 'member_profiles', 'social_relationships', 'social_messages', 'social_reports', 'social_media', 'uat_authorized_identities']) {
    counts[table] = Number((await query(`SELECT COUNT(*) n FROM ${table}`)).results[0].n);
  }
  return {
    migrations: Number((await query('SELECT COUNT(*) n FROM d1_migrations')).results[0].n),
    foreignKeyViolations: Number((await query('SELECT COUNT(*) n FROM pragma_foreign_key_check')).results[0].n),
    counts,
  };
}
function files(root, prefix, base = root) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    assert.equal(entry.isSymbolicLink(), false);
    if (entry.isDirectory()) result.push(...files(path, prefix, base));
    else if (entry.isFile()) result.push({ path: `${prefix}/${relative(base, path)}`, file: path });
  }
  return result;
}
function inventory(stage) {
  const items = [...files(join(stage, 'dist'), 'dist'), ...files(join(stage, 'functions'), 'functions')]
    .map(item => ({ path: item.path, sha256: createHash('sha256').update(readFileSync(item.file)).digest('hex') }))
    .sort((a, b) => a.path.localeCompare(b.path, 'en'));
  return { files: items.length, sha256: createHash('sha256').update(JSON.stringify(items)).digest('hex') };
}

const account = await cf('');
assert.equal(account.id, ACCOUNT);
const beforeProject = await cf(`/pages/projects/${PROJECT}`);
assert.equal(beforeProject.name, PROJECT);
assert.equal(beforeProject.production_branch, 'reserved-no-production');
const beforeConfig = previewConfig(beforeProject);
assert.equal(beforeConfig.d1_databases.DB.id, DB);
assert.equal(beforeConfig.r2_buckets.MEDIA.name, BUCKET);
assert.equal(beforeConfig.env_vars.FRIEND_REQUESTS_ENABLED.value, 'false', 'rc5 does not authorize Friends');
assert.equal(beforeConfig.env_vars.MEDIA_UPLOAD_ENABLED.value, 'false');
assert.equal(beforeConfig.env_vars.NEW_ACCOUNT_REGISTRATION_ENABLED.value, 'false');
for (const name of ['GOOGLE_CLIENT_SECRET', 'FACEBOOK_CLIENT_SECRET', 'LINE_CLIENT_SECRET', 'TURNSTILE_SECRET_KEY']) {
  assert.equal(beforeConfig.env_vars[name].type, 'secret_text', `Missing UAT encrypted binding ${name}`);
}
const beforeData = await fingerprint();
assert.equal(beforeData.migrations, 22);
assert.equal(beforeData.foreignKeyViolations, 0);
assert.equal(beforeData.counts.users, 2);
assert.equal(beforeData.counts.identities, 2);
assert.equal(beforeData.counts.uat_authorized_identities, 2);
const productionBefore = await cf(`/pages/projects/${PRODUCTION_PROJECT}`);
assert.equal(productionBefore.canonical_deployment.deployment_trigger.metadata.commit_hash, PRODUCTION_SHA);

const checkout = mkdtempSync(join(tmpdir(), 'chatgun-phase2-uat-build-'));
execFileSync('git', ['clone', '--shared', '--no-checkout', process.cwd(), checkout], { stdio: 'pipe' });
execFileSync('git', ['checkout', '--detach', sha], { cwd: checkout, stdio: 'pipe' });
execFileSync('node', ['scripts/build-pages.mjs'], { cwd: checkout, env: { ...process.env, CHATGUN_RELEASE_MODE: 'default', CHATGUN_CANARY_BUILD: 'false', CF_PAGES_BRANCH: 'uat' }, stdio: 'pipe' });
const releasePath = join(checkout, 'dist/release.json');
const release = JSON.parse(readFileSync(releasePath));
assert.equal(release.commit, sha);
const versionByTarget = {
  'beta-notice.html': PROPOSED_POLICY.versions.adultNotice,
  'terms.html': PROPOSED_POLICY.versions.terms,
  'privacy.html': PROPOSED_POLICY.versions.privacy,
  'data-deletion.html': PROPOSED_POLICY.versions.deletion,
};
release.uatPolicyStatus = 'owner-approved-private-receipt';
release.uatPolicyVersions = PROPOSED_POLICY.versions;
release.uatPolicyFiles = {};
for (const [source, digest] of Object.entries(PROPOSED_POLICY.files)) {
  const target = basename(source), bytes = readFileSync(join(checkout, source));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
  assert.match(bytes.toString('utf8'), new RegExp(`data-policy-version=["']${versionByTarget[target]}["']`, 'u'));
  copyFileSync(join(checkout, source), join(checkout, 'dist', target));
  release.uatPolicyFiles[target] = digest;
}
const assetsPath = join(checkout, 'dist/release-assets.json');
const assets = JSON.parse(readFileSync(assetsPath));
for (const [target, digest] of Object.entries(release.uatPolicyFiles)) {
  const existing = assets.files.find(item => item.path === target);
  if (existing) existing.sha256 = digest;
  else assets.files.push({ path: target, sha256: digest });
}
assets.files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
const assetsBytes = `${JSON.stringify(assets, null, 2)}\n`;
writeFileSync(assetsPath, assetsBytes);
release.assetsManifestSha256 = createHash('sha256').update(assetsBytes).digest('hex');
writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`);

const stage = mkdtempSync(join(tmpdir(), 'chatgun-phase2-uat-stage-'));
mkdirSync(join(stage, 'dist')); mkdirSync(join(stage, 'functions'));
cpSync(join(checkout, 'dist'), join(stage, 'dist'), { recursive: true });
cpSync(join(checkout, 'functions'), join(stage, 'functions'), { recursive: true });
for (const forbidden of ['wrangler.json', 'wrangler.jsonc', 'wrangler.toml', '.env', '.dev.vars', '.wrangler']) assert.equal(existsSync(join(stage, forbidden)), false);
assert.ok(lstatSync(join(stage, 'dist')).isDirectory() && lstatSync(join(stage, 'functions')).isDirectory());
const artifact = inventory(stage);
execFileSync('npx', ['--yes', 'wrangler@4.156.0', 'pages', 'deploy', 'dist', '--project-name', PROJECT, '--branch', 'uat', '--commit-hash', sha, '--commit-dirty=true', '--profile', 'chatgun'], { cwd: stage, env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT }, stdio: 'inherit' });

let served;
for (let attempt = 0; attempt < 45; attempt += 1) {
  try {
    served = await (await fetch(`${ORIGIN}/release.json?phase2=${Date.now()}`, { cache: 'no-store' })).json();
    if (served.commit === sha) break;
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 2000));
}
assert.equal(served?.commit, sha, 'UAT origin did not serve exact RC');
assert.deepEqual(served.uatPolicyVersions, PROPOSED_POLICY.versions);
const afterProject = await cf(`/pages/projects/${PROJECT}`);
assert.ok(isDeepStrictEqual(previewConfig(afterProject), beforeConfig), 'UAT effective configuration drifted');
const afterData = await fingerprint();
assert.deepEqual(afterData, beforeData, 'UAT D1 fingerprint changed during code-only deploy');
const productionAfter = await cf(`/pages/projects/${PRODUCTION_PROJECT}`);
assert.equal(productionAfter.canonical_deployment.deployment_trigger.metadata.commit_hash, PRODUCTION_SHA);

const evidenceDirectory = '/Users/nattano/.codex/private-backups/chatgun';
const evidencePath = join(evidenceDirectory, `phase2-uat-rc-${sha}.json`);
const evidence = {
  checkedAt: new Date().toISOString(), status: 'DEPLOYED_CODE_ONLY', applicationSha: sha,
  artifact, project: PROJECT, branch: 'uat', origin: ORIGIN, schema: 22, foreignKeyViolations: 0,
  dataFingerprintPreserved: true, effectiveConfigurationDrift: 0, friendsEnabled: false,
  friendsReason: 'rc5 approved Direct Chat; Friends requires rc6 owner consent',
  mediaEnabled: false, publicRegistrationEnabled: false, productionSha: PRODUCTION_SHA, productionWrites: 0,
};
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
chmodSync(evidencePath, 0o600);
console.log(JSON.stringify({ ...evidence, evidencePath: '<protected mode-0600 local receipt>' }, null, 2));
