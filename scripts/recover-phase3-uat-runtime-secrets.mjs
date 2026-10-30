// Restores only isolated-UAT runtime credentials from their original protected
// local sources after a Pages metadata PATCH removed their encrypted values.
// It never reads or changes Production configuration and never emits values.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

assert.equal(process.env.CHATGUN_PHASE3_UAT_RECOVER, 'approved-isolated-uat-only');
const ACCOUNT = '23017b53386fb67fc62a52cdd017454c';
const PROJECT = 'chatgun-final-uat';
const DB = 'e3cb426c-b88a-4b93-90fd-39df524f68ae';
const BUCKET = 'chatgun-final-uat-media';
const PRODUCTION_PROJECT = 'chatgun';
const PRODUCTION_SHA = 'c9327e7913ea09577c06b8a0f70f953f21d0aecb';
const PRIVATE_ROOT = (()=>{const root=process.env.CHATGUN_PRIVATE_ROOT;if(!root)throw new Error('CHATGUN_PRIVATE_ROOT is required');return root;})()+'';
const { token } = JSON.parse(execFileSync('npx', ['--yes', 'wrangler@4.156.0', 'auth', 'token', '--json'], { encoding: 'utf8' }));

async function cf(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json();
  assert.ok(response.ok && json.success, `Cloudflare ${method} failed: ${path}`);
  return json.result;
}

const providerFile = name => JSON.parse(readFileSync(join(PRIVATE_ROOT, `uat-provider-${name}-20261024.json`), 'utf8'));
const google = providerFile('google');
const facebook = providerFile('facebook');
const line = providerFile('line');
const turnstile = JSON.parse(readFileSync(join(PRIVATE_ROOT, 'final-uat-credentials-KOLmum/turnstile.json'), 'utf8'));
for (const [provider, value] of Object.entries({ google, facebook, line })) {
  assert.equal(value.provider, provider);
  assert.equal(value.newCredentialConfirmed, true);
  assert.equal(value.callback, `https://uat.chatgun-final-uat.pages.dev/api/auth/oauth/${provider}/callback`);
  assert.ok(value.clientId && value.clientSecret);
}

assert.equal((await cf('')).id, ACCOUNT);
const before = await cf(`/pages/projects/${PROJECT}`);
const productionBefore = await cf(`/pages/projects/${PRODUCTION_PROJECT}`);
assert.equal(before.name, PROJECT);
assert.equal(before.production_branch, 'reserved-no-production');
assert.equal(before.deployment_configs.preview.d1_databases.DB.id, DB);
assert.equal(before.deployment_configs.preview.r2_buckets.MEDIA.name, BUCKET);
assert.equal(before.deployment_configs.preview.env_vars.TURNSTILE_SITE_KEY.value, turnstile.sitekey);
assert.equal(productionBefore.canonical_deployment.deployment_trigger.metadata.commit_hash, PRODUCTION_SHA);
const plainBefore = Object.fromEntries(Object.entries(before.deployment_configs.preview.env_vars).filter(([, item]) => item.type === 'plain_text'));
const secretNamesBefore = Object.entries(before.deployment_configs.preview.env_vars).filter(([, item]) => item.type === 'secret_text').map(([name]) => name).sort();

const secretPatch = {
  GOOGLE_CLIENT_ID: { type: 'secret_text', value: google.clientId },
  GOOGLE_CLIENT_SECRET: { type: 'secret_text', value: google.clientSecret },
  FACEBOOK_CLIENT_ID: { type: 'secret_text', value: facebook.clientId },
  FACEBOOK_CLIENT_SECRET: { type: 'secret_text', value: facebook.clientSecret },
  FACEBOOK_GRAPH_VERSION: { type: 'secret_text', value: facebook.graphVersion },
  LINE_CLIENT_ID: { type: 'secret_text', value: line.clientId },
  LINE_CLIENT_SECRET: { type: 'secret_text', value: line.clientSecret },
  LINE_EXPECTED_CLIENT_ID: { type: 'secret_text', value: line.clientId },
  TURNSTILE_SECRET_KEY: { type: 'secret_text', value: turnstile.secret },
  RATE_LIMIT_PEPPER: { type: 'secret_text', value: randomBytes(48).toString('base64url') },
  OTP_PEPPER: { type: 'secret_text', value: randomBytes(48).toString('base64url') },
};
assert.ok(Object.values(secretPatch).every(item => item.type === 'secret_text' && item.value.length > 0));
assert.ok(Object.keys(secretPatch).every(name => secretNamesBefore.includes(name)), 'Recovery must not add a new secret binding');
await cf(`/pages/projects/${PROJECT}`, { deployment_configs: { preview: { env_vars: secretPatch } } }, 'PATCH');

const after = await cf(`/pages/projects/${PROJECT}`);
const plainAfter = Object.fromEntries(Object.entries(after.deployment_configs.preview.env_vars).filter(([, item]) => item.type === 'plain_text'));
const secretNamesAfter = Object.entries(after.deployment_configs.preview.env_vars).filter(([, item]) => item.type === 'secret_text').map(([name]) => name).sort();
assert.deepEqual(plainAfter, plainBefore, 'Plain UAT settings changed during secret recovery');
assert.deepEqual(secretNamesAfter, secretNamesBefore, 'Encrypted UAT binding names changed during recovery');
assert.equal(after.deployment_configs.preview.d1_databases.DB.id, DB);
assert.equal(after.deployment_configs.preview.r2_buckets.MEDIA.name, BUCKET);
const productionAfter = await cf(`/pages/projects/${PRODUCTION_PROJECT}`);
assert.deepEqual(productionAfter.deployment_configs, productionBefore.deployment_configs, 'Production configuration changed');
assert.equal(productionAfter.canonical_deployment.deployment_trigger.metadata.commit_hash, PRODUCTION_SHA);

const evidenceDir = join(PRIVATE_ROOT, 'phase3-rc6a-secret-recovery');
mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
const evidencePath = join(evidenceDir, 'receipt.json');
const evidence = {
  checkedAt: new Date().toISOString(),
  project: PROJECT,
  scope: 'isolated-uat-runtime-secret-recovery-only',
  restoredBindingNames: Object.keys(secretPatch).sort(),
  sourceDigests: {
    google: createHash('sha256').update(readFileSync(join(PRIVATE_ROOT, 'uat-provider-google-20261024.json'))).digest('hex'),
    facebook: createHash('sha256').update(readFileSync(join(PRIVATE_ROOT, 'uat-provider-facebook-20261024.json'))).digest('hex'),
    line: createHash('sha256').update(readFileSync(join(PRIVATE_ROOT, 'uat-provider-line-20261024.json'))).digest('hex'),
    turnstile: createHash('sha256').update(readFileSync(join(PRIVATE_ROOT, 'final-uat-credentials-KOLmum/turnstile.json'))).digest('hex'),
  },
  generatedUatOnlyPeppers: ['OTP_PEPPER', 'RATE_LIMIT_PEPPER'],
  plaintextSettingsChanged: 0,
  d1Writes: 0,
  r2Writes: 0,
  productionWrites: 0,
};
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
chmodSync(evidencePath, 0o600);
console.log(JSON.stringify({ status: 'RECOVERED', project: PROJECT, restoredBindingNames: evidence.restoredBindingNames, secretValuesEmitted: false, productionWrites: 0 }));
