import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const origin = 'https://localhost:8797';
const sessions = () => JSON.parse(readFileSync('/tmp/chatgun-issue16-local-sessions.json'));

async function actor(browser, kind, width) {
  const session = sessions()[`${kind}${width}`];
  const id = session.userId || `${kind}${width}`;
  const context = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true, viewport: { width, height: 900 } });
  for (const [name, value] of [['__Host-cg_session', session.token], ['__Host-cg_csrf', session.csrf]]) {
    await context.addCookies([{ name, value, url: origin, secure: true, sameSite: 'Lax' }]);
  }
  return { context, page: await context.newPage(), session, id };
}

async function post(actorContext, path, body) {
  return actorContext.context.request.post(`/api/social/${path}`, {
    headers: { origin, 'x-csrf-token': actorContext.session.csrf },
    data: body,
  });
}

for (const width of [390, 768, 1440]) {
  test(`friends-only launch journey with delivery state and revocation ${width}`, async ({ browser }) => {
    const owner = await actor(browser, 'owner', width);
    const viewer = await actor(browser, 'viewer', width);
    try {
      for (const current of [owner, viewer]) {
        expect((await post(current, 'discovery', { action: 'location', latitude: 13.75, longitude: 100.5, accuracy: 5 })).status()).toBe(200);
      }

      await viewer.page.goto(`/app/people/${owner.id}`);
      await expect(viewer.page.locator('[data-action=request]')).toBeVisible();
      await viewer.page.locator('[data-action=request]').click();
      await expect(viewer.page.locator('#toast')).toContainText('ส่งคำขอเป็นเพื่อนแล้ว');

      await owner.page.goto('/?tab=friends');
      await expect(owner.page.locator('#friends-nav')).toBeVisible();
      await expect(owner.page.locator('#request-badge')).toHaveText('1');
      await expect(owner.page.locator(`[data-action=accept][data-user="${viewer.id}"]`)).toBeVisible();
      await owner.page.locator(`[data-action=accept][data-user="${viewer.id}"]`).click();
      await expect(owner.page.locator('#friends-grid')).toContainText('ผู้ทดสอบระบบผู้ชม');

      await viewer.page.goto('/?tab=chat');
      await viewer.page.locator(`[data-chat="${owner.id}"]`).click();
      await viewer.page.locator('.composer input[name=body]').fill(`launch rc message ${width}`);
      await viewer.page.locator('.composer button[aria-label="ส่ง"]').click();
      await expect(viewer.page.locator('.message.mine')).toContainText(`launch rc message ${width}`);
      await expect(viewer.page.locator('.message.mine .message-status')).toHaveText('ส่งแล้ว');

      await owner.page.goto('/?tab=chat');
      await owner.page.locator(`[data-chat="${viewer.id}"]`).click();
      await expect(owner.page.locator('#thread .messages')).toContainText(`launch rc message ${width}`);
      await expect.poll(async () => {
        const response = await viewer.context.request.get(`/api/social/messages?target=${owner.id}`);
        const payload = await response.json();
        return payload.messages.find((message) => message.body === `launch rc message ${width}`)?.read_at || null;
      }).not.toBeNull();
      await viewer.page.reload();
      await viewer.page.locator(`[data-chat="${owner.id}"]`).click();
      await expect(viewer.page.locator('.message.mine .message-status')).toHaveText('อ่านแล้ว');

      await owner.page.goto(`/app/people/${viewer.id}`);
      owner.page.once('dialog', (dialog) => dialog.accept());
      await owner.page.locator('[data-action=unfriend]').click();
      await expect(owner.page.locator('#toast')).toContainText('เลิกเป็นเพื่อนแล้ว');
      expect((await post(owner, 'messages', { action: 'send', target: viewer.id, body: 'must be denied' })).status()).toBe(403);
      expect((await owner.context.request.get('/api/social/conversations')).status()).toBe(200);
      expect((await (await owner.context.request.get('/api/social/conversations')).json()).conversations).toHaveLength(0);

      await owner.page.goto('/?tab=friends');
      await expect(owner.page.locator('#friends-grid')).toContainText('ยังไม่มีเพื่อน');
      expect(await owner.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally {
      await owner.context.close();
      await viewer.context.close();
    }
  });
}

