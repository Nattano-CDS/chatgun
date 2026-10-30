// Read-only Production/Preview readiness evidence. Never emits secrets or row data.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const account = '23017b53386fb67fc62a52cdd017454c';
const productionDatabase = '9738a051-d914-42d0-8e7b-8098ef2b959d';
const previewDatabase = '5bbfd55d-eb22-4324-8a7d-57bef14110ea';
const projectName = 'chatgun';
const productionOrigin = 'https://chatgun.social';
const productionBucket = 'chatgun-media-production';
const previewBucket = 'chatgun-media-staging';
const expectedMigrations = Array.from({ length: 22 }, (_, index) => `${String(index + 1).padStart(4, '0')}_`);
const { token } = JSON.parse(execFileSync('npx', ['wrangler', 'auth', 'token', '--json', '--profile', 'chatgun'], { encoding: 'utf8' }));

async function cf(path, body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json();
  assert.ok(response.ok && json.success, `Cloudflare read failed: ${path}`);
  return json.result;
}

async function query(database, sql) {
  assert.ok(/^\s*(SELECT|PRAGMA)\b/iu.test(sql), 'Only read-only D1 statements are allowed');
  const result = await cf(`/d1/database/${database}/query`, { sql });
  assert.equal(result[0].meta?.changed_db, false, 'Read-only query unexpectedly changed D1');
  return result[0].results;
}

const accountResult = await cf('');
assert.equal(accountResult.id, account);
const project = await cf(`/pages/projects/${projectName}`);
const production = project.deployment_configs.production;
const preview = project.deployment_configs.preview;
assert.equal(production.d1_databases.DB.id, productionDatabase);
assert.equal(preview.d1_databases.DB.id, previewDatabase);
assert.equal(production.r2_buckets.MEDIA.name, productionBucket);
assert.equal(preview.r2_buckets.MEDIA.name, previewBucket);

const flagNames = [
  'OAUTH_LOGIN_ENABLED', 'OAUTH_ENABLED_PROVIDERS', 'NEW_ACCOUNT_REGISTRATION_ENABLED',
  'BETA_INVITATION_REGISTRATION_ENABLED', 'BETA_ENROLLMENT_REQUIRED', 'ACCEPTANCE_FLOW_ENABLED',
  'ADULT_ONBOARDING_ENABLED', 'SOCIAL_APP_ENABLED', 'PUBLIC_DISCOVERY_ENABLED',
  'FRIEND_REQUESTS_ENABLED', 'MESSAGING_ENABLED', 'PRESENCE_ENABLED', 'RATINGS_ENABLED',
  'MEDIA_UPLOAD_ENABLED', 'MEDIA_QUARANTINE_ENABLED', 'SENSITIVE_CONTENT_ENABLED',
  'EMAIL_OTP_ENABLED', 'MOBILE_OTP_ENABLED',
  'DEMO_MODE_ENABLED', 'PUBLIC_DEMO_CANARY_ENABLED', 'ADMIN_ACCESS_STANDALONE_ENABLED',
  'ADMIN_CLOUDFLARE_ACCESS_REQUIRED',
  'ACCOUNT_MODERATION_ENABLED', 'MODERATION_TOOLS_ENABLED',
];
const productionFlags = Object.fromEntries(flagNames.map(name => [name, production.env_vars[name]?.value ?? null]));
const previewFlags = Object.fromEntries(flagNames.map(name => [name, preview.env_vars[name]?.value ?? null]));
const credentialNames = [
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET',
  'FACEBOOK_GRAPH_VERSION', 'LINE_CLIENT_ID', 'LINE_CLIENT_SECRET', 'TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY', 'RATE_LIMIT_PEPPER', 'OTP_PEPPER', 'ADMIN_ACCESS_ISSUER', 'ADMIN_ACCESS_AUDIENCE',
];
const credentialMetadata = Object.fromEntries(credentialNames.map(name => [name, {
  present: Boolean(production.env_vars[name]),
  encrypted: production.env_vars[name]?.type === 'secret_text',
}]));

const migrationRows = await query(productionDatabase, 'SELECT id,name,applied_at FROM d1_migrations ORDER BY id');
const schemaRows = await query(productionDatabase, "SELECT type,name FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type,name");
const tableNames = new Set(schemaRows.filter(row => row.type === 'table').map(row => row.name));
const countTables = ['users', 'identities', 'sessions', 'social_messages', 'social_media', 'moderation_access_grants'];
const dataCounts = {};
for (const table of countTables) dataCounts[table] = tableNames.has(table) ? (await query(productionDatabase, `SELECT COUNT(*) n FROM ${table}`))[0].n : null;
const foreignKeyViolations = (await query(productionDatabase, 'SELECT COUNT(*) n FROM pragma_foreign_key_check'))[0].n;
const pendingMigrations = expectedMigrations.filter(prefix => !migrationRows.some(row => row.name.startsWith(prefix)));

async function bucketPrivacy(bucket) {
  const managed = await cf(`/r2/buckets/${bucket}/domains/managed`);
  const custom = await cf(`/r2/buckets/${bucket}/domains/custom`);
  return { managedDomainEnabled: managed.enabled, customDomainCount: (custom.domains || []).length };
}
const r2 = {
  production: await bucketPrivacy(productionBucket),
  preview: await bucketPrivacy(previewBucket),
};
const widgets = await cf('/challenges/widgets');
const turnstile = widgets.map(widget => ({ name: widget.name, domains: widget.domains, mode: widget.mode, clearanceLevel: widget.clearance_level }));
const workerScripts = await cf('/workers/scripts');
const cleanupWorkers = {};
for (const name of ['chatgun-privacy-cleanup-production', 'chatgun-media-cleanup-production']) {
  const present = workerScripts.some(worker => worker.id === name);
  cleanupWorkers[name] = { present, schedules: present ? await cf(`/workers/scripts/${name}/schedules`) : [] };
}

const releaseResponse = await fetch(`${productionOrigin}/release.json?readiness=${Date.now()}`, { cache: 'no-store' });
assert.ok(releaseResponse.ok);
const release = await releaseResponse.json();
const authResponse = await fetch(`${productionOrigin}/api/auth/config?readiness=${Date.now()}`, { cache: 'no-store' });
const auth = await authResponse.json();
const socialResponse = await fetch(`${productionOrigin}/api/social/config?readiness=${Date.now()}`, { cache: 'no-store' });
const social = await socialResponse.json();

const report = {
  checkedAt: new Date().toISOString(),
  account,
  project: projectName,
  production: {
    origin: productionOrigin,
    canonicalDeploymentId: project.canonical_deployment.id,
    canonicalDeploymentSha: project.canonical_deployment.deployment_trigger.metadata.commit_hash,
    releaseSha: release.commit,
    database: productionDatabase,
    bucket: productionBucket,
    flags: productionFlags,
    credentialMetadata,
    migrations: migrationRows.map(row => row.name),
    pendingMigrationPrefixes: pendingMigrations,
    schemaObjectCounts: Object.fromEntries(['table', 'index', 'trigger'].map(type => [type, schemaRows.filter(row => row.type === type).length])),
    foreignKeyViolations,
    dataCounts,
    liveAuth: {
      status: authResponse.status,
      oauthLoginEnabled: auth.oauthLoginEnabled,
      oauthProviders: auth.oauthProviders,
      newAccountRegistrationEnabled: auth.newAccountRegistrationEnabled,
      invitationOnlyRegistrationEnabled: auth.invitationOnlyRegistrationEnabled,
    },
    liveSocial: {
      status: socialResponse.status,
      socialAppEnabled: social.socialAppEnabled,
      publicDiscoveryEnabled: social.publicDiscoveryEnabled,
      messagingEnabled: social.messagingEnabled,
      mediaUploadEnabled: social.mediaUploadEnabled,
      onlineStatusEnabled: social.onlineStatusEnabled,
    },
  },
  preview: {
    latestDeploymentSha: project.latest_deployment.deployment_trigger.metadata.commit_hash,
    database: previewDatabase,
    bucket: previewBucket,
    flags: previewFlags,
  },
  r2,
  turnstile,
  cleanupWorkers,
  oauthCallbacksRequired: {
    google: `${productionOrigin}/api/auth/oauth/google/callback`,
    facebook: `${productionOrigin}/api/auth/oauth/facebook/callback`,
    line: `${productionOrigin}/api/auth/oauth/line/callback`,
  },
  productionWrites: 0,
};
mkdirSync('docs/production-readiness', { recursive: true });
writeFileSync('docs/production-readiness/live-infrastructure.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  result: 'PASS',
  report: 'docs/production-readiness/live-infrastructure.json',
  productionWrites: 0,
}));
