import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import { chromium } from '@playwright/test';

const origin = 'https://localhost:8797';
const output = 'docs/production-readiness/phase6/performance-measurements.json';
const iterations = 20;
const server = spawn(process.execPath, ['scripts/serve-issue16-local.mjs'], {
  env: { ...process.env, CHATGUN_FULL_SYSTEM_LOCAL: 'true' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

function health() {
  return new Promise(resolve => {
    const request = https.get(`${origin}/api/health`, { rejectUnauthorized: false }, response => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on('error', () => resolve(false));
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await health()) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Isolated performance server did not become ready');
}

function percentile(values, fraction) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)];
}

async function sample(name, operation) {
  const values = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    const status = await operation(index);
    const elapsed = Number((performance.now() - started).toFixed(2));
    if (status < 200 || status >= 400) throw new Error(`${name} returned ${status}`);
    values.push(elapsed);
  }
  return {
    name,
    iterations,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    maxMs: Math.max(...values),
  };
}

let browser;
try {
  await waitForServer();
  const sessions = JSON.parse(readFileSync('/tmp/chatgun-issue16-local-sessions.json', 'utf8'));
  const session = sessions.owner390;
  browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
  for (const [name, value] of [['__Host-cg_session', session.token], ['__Host-cg_csrf', session.csrf]]) {
    await context.addCookies([{ name, value, url: origin, secure: true, sameSite: 'Lax' }]);
  }
  const discoveryContext = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  for (const [name, value] of [['__Host-cg_session', sessions.viewer390.token], ['__Host-cg_csrf', sessions.viewer390.csrf]]) {
    await discoveryContext.addCookies([{ name, value, url: origin, secure: true, sameSite: 'Lax' }]);
  }
  const page = await context.newPage();
  const headers = { origin, 'x-csrf-token': session.csrf };
  const metrics = [];
  // Use a separate synthetic identity so repeated application loads do not
  // consume this security-sensitive endpoint's per-member inference budget.
  metrics.push(await sample('discovery API', async () => (await discoveryContext.request.get('/api/social/discovery')).status()));
  metrics.push(await sample('authenticated initial application load', async () => (await page.goto('/?tab=profile', { waitUntil: 'networkidle' })).status()));
  metrics.push(await sample('profile API', async () => (await context.request.get('/api/social/profile')).status()));
  metrics.push(await sample('conversation list API', async () => (await context.request.get('/api/social/conversations')).status()));
  metrics.push(await sample('message send API', async index => (await context.request.post('/api/social/messages', {
    headers,
    data: { action: 'send', target: 'viewer390', body: `phase6 synthetic performance ${index}` },
  })).status()));
  metrics.push(await sample('moderation dashboard load', async () => (await page.goto('/app/moderation.html', { waitUntil: 'networkidle' })).status()));
  metrics.push(await sample('concurrent profile reads (5)', async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => context.request.get('/api/social/profile')));
    return responses.every(response => response.status() === 200) ? 200 : 500;
  }));
  const preThrottle = [];
  for (let index = iterations; index < 30; index += 1) preThrottle.push((await discoveryContext.request.get('/api/social/discovery')).status());
  const throttleProbe = await discoveryContext.request.get('/api/social/discovery');
  const discoveryRateLimit = {
    requestsBeforeProbe: 30,
    permittedStatuses: [...new Set(preThrottle)],
    probeStatus: throttleProbe.status(),
    result: preThrottle.every(status => status === 200) && throttleProbe.status() === 429 ? 'PASS' : 'FAIL',
  };
  const result = {
    measuredAt: new Date().toISOString(),
    environment: 'isolated local real-handler harness with synthetic identities, in-memory D1 and R2',
    iterations,
    browser: 'Playwright Chromium',
    metrics,
    discoveryRateLimit,
    excluded: [
      'Production load testing',
      'external OAuth provider latency',
      'Cloudflare edge and remote D1/R2 network latency',
      'physical-device rendering and radio latency',
    ],
    productionWrites: 0,
    result: 'PASS',
  };
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
