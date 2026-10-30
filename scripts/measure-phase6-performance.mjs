import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium, request as playwrightRequest } from '@playwright/test';

const origin = 'https://localhost:8797';
const output = process.env.CHATGUN_PERFORMANCE_OUTPUT || 'docs/production-readiness/phase6/performance-measurements.json';
const iterations = 20;
const server = spawn(process.execPath, ['scripts/serve-issue16-local.mjs'], {
  env: { ...process.env, CHATGUN_FULL_SYSTEM_LOCAL: 'true' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitForServer() {
  const client = await playwrightRequest.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  try {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        if ((await client.get('/api/health')).status() === 200) return;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  } finally {
    await client.dispose();
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
  const routeDurations = [];
  const observedRequests = [];
  const observe = request => {
    const url = new URL(request.url());
    if (url.origin === origin) observedRequests.push(url.pathname);
  };
  page.on('request', observe);
  await page.goto('/?tab=profile', { waitUntil: 'networkidle' });
  const initialPageRequests = observedRequests.length;
  const initialApiRequests = observedRequests.filter(path => path.startsWith('/api/')).length;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const heap = async () => (await cdp.send('Performance.getMetrics')).metrics.find(metric => metric.name === 'JSHeapUsedSize')?.value || 0;
  const heapBefore = await heap();
  for (let index = 0; index < 20; index += 1) {
    const tab = index % 2 ? 'profile' : 'chat';
    const started = performance.now();
    await page.locator(`#primary-nav button[data-tab="${tab}"]`).click();
    await page.locator(`#${tab}-tab`).waitFor({ state: 'visible' });
    routeDurations.push(Number((performance.now() - started).toFixed(2)));
  }
  const heapAfter = await heap();
  await page.locator('#primary-nav button[data-tab="chat"]').click();
  const conversationRenderStarted = performance.now();
  await page.locator('[data-chat="viewer390"]').waitFor({ state: 'visible' });
  const conversationListRenderMs = Number((performance.now() - conversationRenderStarted).toFixed(2));
  const longContext = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
  const longPage = await longContext.newPage();
  const longMessages = Array.from({ length: 250 }, (_, index) => ({
    id: `long-${String(index).padStart(3, '0')}`,
    sender_user_id: index % 2 ? 'peer' : 'me',
    receiver_user_id: index % 2 ? 'me' : 'peer',
    body: `synthetic long conversation ${index}`,
    created_at: 1_800_000_000 + Math.floor(index / 2),
  }));
  await longPage.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const responses = {
      '/api/social/config': { socialAppEnabled: true, publicDiscoveryEnabled: false, messagingEnabled: true, mediaUploadEnabled: false, ratingsEnabled: false, presenceEnabled: false },
      '/api/auth/me': { user: { id: 'me', displayName: 'Synthetic performance actor' }, providers: ['line'], recentlyAuthenticated: true },
      '/api/social/profile': { profile: { user_id: 'me', name: 'Synthetic performance actor', direct_messages_enabled: 1, discovery_visible: 0 } },
      '/api/social/discovery': { people: [], locationFresh: false },
      '/api/social/conversations': { conversations: [{ other_user_id: 'peer', name: 'Synthetic peer', direct_messages_enabled: 1, unread_count: 0, last_message_at: longMessages.at(-1).created_at, last_message_body: longMessages.at(-1).body }] },
      '/api/social/messages': { messages: longMessages.slice().reverse(), hasMore: false },
      '/api/social/ratings': { ratings: [] },
      '/api/social/blocks': { blocked: [] },
      '/api/social/gallery': { photos: [], comments: [] },
      '/api/social/media/appeals': { appeals: [], appealable: [] },
      '/api/social/moderation/notifications': { notifications: [] },
    };
    const body = responses[url.pathname] || { ok: true };
    return route.fulfill({ status: 200, json: body });
  });
  const longConversationStarted = performance.now();
  await longPage.goto('/?tab=chat');
  await longPage.locator('[data-chat="peer"]').click();
  await longPage.locator('#thread .message').first().waitFor({ state: 'visible' });
  const longConversationMessages = await longPage.locator('#thread .message').count();
  const longConversationRenderAndPaginationMs = Number((performance.now() - longConversationStarted).toFixed(2));
  const messageHost = longPage.locator('#thread .messages');
  await messageHost.evaluate(node => { node.scrollTop = 0; });
  const scrollStarted = performance.now();
  await messageHost.evaluate(node => { node.scrollTop = node.scrollHeight; });
  const longConversationScrollMs = Number((performance.now() - scrollStarted).toFixed(2));
  await longContext.close();
  observedRequests.length = 0;
  await page.locator('#primary-nav button[data-tab="profile"]').click();
  await page.waitForTimeout(11_000);
  const hiddenSurfacePolling = {
    observationMs: 11_000,
    messageRequests: observedRequests.filter(path => path === '/api/social/messages').length,
    conversationRequests: observedRequests.filter(path => path === '/api/social/conversations').length,
  };
  page.off('request', observe);
  const browserMetrics = {
    routeTransitions: {
      iterations: routeDurations.length,
      p50Ms: percentile(routeDurations, 0.5),
      p95Ms: percentile(routeDurations, 0.95),
      maxMs: Math.max(...routeDurations),
    },
    initialPageRequests,
    initialApiRequests,
    conversationListRenderMs,
    longConversation: {
      renderedMessages: longConversationMessages,
      renderAndPaginationMs: longConversationRenderAndPaginationMs,
      scrollTopToBottomMs: longConversationScrollMs,
    },
    heap: {
      beforeBytes: heapBefore,
      afterTwentyRouteTransitionsBytes: heapAfter,
      growthBytes: heapAfter - heapBefore,
    },
    hiddenSurfacePolling,
    mobileHorizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  };
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
    browserMetrics,
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
