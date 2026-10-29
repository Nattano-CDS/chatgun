// Scheduled, isolated UAT activation only. No invitations, roles, Media or Production writes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import {
  FINAL_UAT_ACCOUNT, FINAL_UAT_BUCKET, FINAL_UAT_DATABASE, FINAL_UAT_ORIGIN, FINAL_UAT_PROJECT,
  PROPOSED_POLICY, finalUatSocialVars, sanitizedCampaignSummary, validateFinalUatSocialApproval,
} from './lib/final-uat-social-campaign.mjs';
import { UAT_CAMPAIGN_AUDIT_TABLE_SQL } from '../functions/_lib/retention.js';

assert.equal(process.env.CHATGUN_FINAL_UAT_SOCIAL, 'activate-approved-always-on');
const approvalFile = resolve(process.env.CHATGUN_UAT_PRIVATE_APPROVAL_FILE || '');
assert.ok(approvalFile.startsWith('/Users/nattano/.codex/private-backups/chatgun/'));
const receipt = validateFinalUatSocialApproval(JSON.parse(readFileSync(approvalFile, 'utf8')));
const applicationSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(receipt.applicationSha, applicationSha, 'Private approval must pin the exact implementation HEAD');
for (const [file, digest] of Object.entries(PROPOSED_POLICY.files)) assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), digest, `Policy artifact changed: ${file}`);
const policyTarget = file => basename(file);
const policyVersionByTarget = {
  'beta-notice.html': PROPOSED_POLICY.versions.adultNotice,
  'terms.html': PROPOSED_POLICY.versions.terms,
  'privacy.html': PROPOSED_POLICY.versions.privacy,
  'data-deletion.html': PROPOSED_POLICY.versions.deletion,
};
const vars = finalUatSocialVars(receipt);
const state = JSON.parse(readFileSync('docs/final-uat/environment.json'));
assert.equal(state.databaseId, FINAL_UAT_DATABASE); assert.equal(state.bucket, FINAL_UAT_BUCKET); assert.equal(state.origin, FINAL_UAT_ORIGIN);

const { token } = JSON.parse(execFileSync('npx', ['wrangler@4.151.1', 'auth', 'token', '--json'], { encoding: 'utf8' }));
async function cf(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${FINAL_UAT_ACCOUNT}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const json = await response.json(); assert.ok(response.ok && json.success, `Cloudflare ${method} ${path} failed`); return json.result;
}
assert.equal((await cf('')).id, FINAL_UAT_ACCOUNT);
const project = await cf(`/pages/projects/${FINAL_UAT_PROJECT}`), preview = project.deployment_configs.preview;
assert.equal(preview.d1_databases.DB.id, FINAL_UAT_DATABASE); assert.equal(preview.r2_buckets.MEDIA.name, FINAL_UAT_BUCKET);
for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET', 'LINE_CLIENT_ID', 'LINE_CLIENT_SECRET', 'TURNSTILE_SECRET_KEY', 'ADMIN_ACCESS_ISSUER', 'ADMIN_ACCESS_AUDIENCE']) assert.equal(preview.env_vars[key]?.type, 'secret_text', `Missing encrypted UAT value: ${key}`);
assert.equal((await cf(`/r2/buckets/${FINAL_UAT_BUCKET}/domains/managed`)).enabled, false);
assert.equal((await cf(`/r2/buckets/${FINAL_UAT_BUCKET}/domains/custom`)).domains.length, 0);
const query = async (sql, params = []) => (await cf(`/d1/database/${FINAL_UAT_DATABASE}/query`, { sql, params }))[0];
await query(UAT_CAMPAIGN_AUDIT_TABLE_SQL);
for (const table of ['users', 'identities', 'sessions', 'beta_invitations', 'social_media', 'moderation_access_grants', 'uat_authorized_identities']) assert.equal((await query(`SELECT COUNT(*) n FROM ${table}`)).results[0].n, 0, `${table} must be empty before activation`);
assert.equal((await query('SELECT COUNT(*) n FROM uat_campaign_audit_evidence')).results[0].n, 0, 'A prior campaign audit record blocks activation');
assert.equal((await query('SELECT COUNT(*) n FROM pragma_foreign_key_check')).results[0].n, 0);
assert.equal((await query('SELECT COUNT(*) n FROM d1_migrations')).results[0].n, 22);
const consentedAt = Math.floor(Date.now() / 1000);
for (const identity of receipt.identities) {
  const inserted = await query('INSERT INTO uat_authorized_identities(identity_ref,provider,account_reference_sha256,consented_at) VALUES(?,?,?,?)', [identity.reference, identity.provider, identity.providerAccountReferenceSha256, consentedAt]);
  assert.equal(inserted.meta.changes, 1);
}
const liveRelease = await (await fetch(`${FINAL_UAT_ORIGIN}/release.json`, { cache: 'no-store' })).json(); assert.equal(liveRelease.commit, state.deployedSha);

const backup = mkdtempSync('/Users/nattano/.codex/private-backups/chatgun/final-uat-social-preactivation-'); chmodSync(backup, 0o700);
writeFileSync(join(backup, 'environment-metadata.json'), JSON.stringify({ checkedAt: new Date().toISOString(), project: FINAL_UAT_PROJECT, database: FINAL_UAT_DATABASE, bucket: FINAL_UAT_BUCKET, priorDeployment: state.deploymentId, priorSha: liveRelease.commit, rollback: 'CHATGUN_FINAL_UAT=approved node scripts/prepare-final-uat.mjs deploy', privateR2: true, preactivationCountsZero: true }, null, 2), { mode: 0o600 });

const directory = mkdtempSync(join(tmpdir(), 'chatgun-final-uat-social-')); chmodSync(directory, 0o700);
execFileSync('git', ['clone', '--shared', '--no-checkout', process.cwd(), directory], { stdio: 'pipe' });
execFileSync('git', ['checkout', '--detach', applicationSha], { cwd: directory, stdio: 'pipe' });
execFileSync('node', ['scripts/build-pages.mjs'], { cwd: directory, env: { ...process.env, CHATGUN_RELEASE_MODE: 'default', CHATGUN_CANARY_BUILD: 'false', CF_PAGES_BRANCH: 'uat' }, stdio: 'pipe' });
const release = JSON.parse(readFileSync(join(directory, 'dist/release.json'))); assert.equal(release.commit, applicationSha); assert.equal(release.fictionalDemoEnabled, false);
for (const file of Object.keys(PROPOSED_POLICY.files)) copyFileSync(resolve(file), join(directory, 'dist', policyTarget(file)));
for (const [file, digest] of Object.entries(PROPOSED_POLICY.files)) {
  const target = policyTarget(file), built = readFileSync(join(directory, 'dist', target));
  assert.equal(createHash('sha256').update(built).digest('hex'), digest, `Built policy changed: ${target}`);
  assert.match(built.toString('utf8'), new RegExp(`data-policy-version=["']${policyVersionByTarget[target]}["']`, 'u'), `Built policy version changed: ${target}`);
}
release.uatPolicyStatus = 'owner-approved-private-receipt';
release.uatPolicyVersions = PROPOSED_POLICY.versions;
release.uatPolicyFiles = Object.fromEntries(Object.entries(PROPOSED_POLICY.files).map(([file, digest]) => [policyTarget(file), digest]));
const assetsPath = join(directory, 'dist/release-assets.json');
const assets = JSON.parse(readFileSync(assetsPath));
for (const [target, digest] of Object.entries(release.uatPolicyFiles)) {
  const entry = assets.files.find(asset => asset.path === target); assert.ok(entry, `Policy missing from asset manifest: ${target}`); entry.sha256 = digest;
}
const assetsManifest = JSON.stringify(assets, null, 2) + '\n'; writeFileSync(assetsPath, assetsManifest);
release.assetsManifestSha256 = createHash('sha256').update(assetsManifest).digest('hex');
writeFileSync(join(directory, 'dist/release.json'), JSON.stringify(release, null, 2) + '\n');
const base = JSON.parse(readFileSync('wrangler.final-uat-social.proposed.jsonc'));
const config = { ...base, vars: { ...vars, TURNSTILE_SITE_KEY: state.turnstileSiteKey } };
writeFileSync(join(directory, 'wrangler.jsonc'), JSON.stringify(config, null, 2), { mode: 0o600 });
execFileSync('npx', ['wrangler@4.151.1', 'deploy', '--config=wrangler.final-uat-privacy-cleanup.jsonc'], { env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: FINAL_UAT_ACCOUNT }, stdio: 'inherit' });
execFileSync('npx', ['wrangler@4.151.1', 'pages', 'deploy', 'dist', `--project-name=${FINAL_UAT_PROJECT}`, '--branch=uat', `--commit-hash=${applicationSha}`, '--commit-dirty=true'], { cwd: directory, env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: FINAL_UAT_ACCOUNT }, stdio: 'inherit' });

const after = await cf(`/pages/projects/${FINAL_UAT_PROJECT}`), afterVars = after.deployment_configs.preview.env_vars;
for (const [key, value] of Object.entries(vars)) assert.equal(afterVars[key]?.value, value, `Flag read-back failed: ${key}`);
for (const key of ['GOOGLE_CLIENT_SECRET', 'FACEBOOK_CLIENT_SECRET', 'LINE_CLIENT_SECRET', 'TURNSTILE_SECRET_KEY']) assert.equal(afterVars[key]?.type, 'secret_text', `Encrypted value lost: ${key}`);
const auth = await (await fetch(`${FINAL_UAT_ORIGIN}/api/auth/config`, { cache: 'no-store' })).json();
assert.equal(auth.oauthLoginEnabled, true); assert.deepEqual([...auth.oauthProviders].sort(), vars.OAUTH_ENABLED_PROVIDERS.split(',')); assert.equal(auth.newAccountRegistrationEnabled, false); assert.equal(auth.invitationOnlyRegistrationEnabled, true);
const social = await (await fetch(`${FINAL_UAT_ORIGIN}/api/social/config`, { cache: 'no-store' })).json();
assert.equal(social.socialAppEnabled, true); assert.equal(social.publicDiscoveryEnabled, true); assert.equal(social.messagingEnabled, true); assert.equal(social.mediaUploadEnabled, false); assert.equal(social.onlineStatusEnabled, true);
const deployedRelease = await (await fetch(`${FINAL_UAT_ORIGIN}/release.json?uat-policy=${Date.now()}`, { cache: 'no-store' })).json();
assert.equal(deployedRelease.commit, applicationSha); assert.deepEqual(deployedRelease.uatPolicyVersions, PROPOSED_POLICY.versions); assert.deepEqual(deployedRelease.uatPolicyFiles, release.uatPolicyFiles);
for (const [file, digest] of Object.entries(PROPOSED_POLICY.files)) {
  const target = policyTarget(file), response = await fetch(`${FINAL_UAT_ORIGIN}/${target}?uat-policy=${Date.now()}`, { cache: 'no-store' });
  assert.ok(response.ok, `Displayed policy unavailable: ${target}`);
  const displayed = Buffer.from(await response.arrayBuffer());
  assert.equal(createHash('sha256').update(displayed).digest('hex'), digest, `Displayed policy changed: ${target}`);
  assert.match(displayed.toString('utf8'), new RegExp(`data-policy-version=["']${policyVersionByTarget[target]}["']`, 'u'), `Displayed policy version changed: ${target}`);
}
writeFileSync('docs/final-uat/social-campaign-activation.json', JSON.stringify({ checkedAt: new Date().toISOString(), applicationSha, summary: sanitizedCampaignSummary(receipt), flags: vars, d1Schema: 22, foreignKeyViolations: 0, preactivationCountsZero: true, authorizedCohortCount: 2, privateR2: true, invitationCount: 0, roleGrants: 0, productionWrites: 0, rollbackPrepared: true }, null, 2) + '\n');
console.log(JSON.stringify({ status: 'ACTIVATED_ALWAYS_ON_PRIVATE_UNTIL_EXPLICIT_CLOSE', applicationSha, invitationsIssued: 0, roleGrants: 0, mediaEnabled: false, productionWrites: 0 }));
