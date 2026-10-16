import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const sessionFile = process.env.STAGING_SESSION_FILE;
test.skip(!sessionFile, "requires the explicitly generated synthetic staging session bundle");
const bundle = sessionFile ? JSON.parse(readFileSync(sessionFile, "utf8")) : null;
const viewer = bundle?.members?.find((member) => member.id === "cg-syn-v1-01");
const evidenceDirectory = resolve("docs/synthetic-owner-review-evidence");

function cookieHeader(account) {
  return `__Host-cg_session=${account.token}; __Host-cg_csrf=${account.csrf}`;
}

async function authenticate(context, baseURL, account) {
  const url = new URL(baseURL);
  await context.addCookies([
    { name: "__Host-cg_session", value: account.token, domain: url.hostname, path: "/", secure: true, httpOnly: true, sameSite: "Lax" },
    { name: "__Host-cg_csrf", value: account.csrf, domain: url.hostname, path: "/", secure: true, httpOnly: false, sameSite: "Lax" },
  ]);
}

async function read(request, baseURL, path, { moderation = false } = {}) {
  const headers = { cookie: cookieHeader(viewer) };
  if (moderation) headers["x-moderation-purpose"] = encodeURIComponent("Synthetic owner-review read-only validation");
  return request.get(`${baseURL}${path}`, { headers });
}

test.beforeAll(() => {
  mkdirSync(evidenceDirectory, { recursive: true });
  expect(bundle.accountId).toBe("23017b53386fb67fc62a52cdd017454c");
  expect(bundle.batchId).toBe("chatgun-owner-review-v1");
  // Discovery presence intentionally expires after two minutes. Refresh only the
  // traceable synthetic batch immediately before visual validation; no real member is touched.
  const now = Math.floor(Date.now() / 1000);
  execFileSync("npx", ["wrangler@4.151.0", "d1", "execute", "chatgun-auth-staging", "--remote", "--command",
    `UPDATE member_profiles SET discovery_visible=1,located_at=${now},updated_at=${now} WHERE user_id LIKE 'cg-syn-v1-%'`],
  { stdio: "pipe" });
});

test("synthetic staging APIs expose the complete traceable owner-review network", async ({ request, baseURL }) => {
  const discovery = await read(request, baseURL, "/api/social/discovery");
  expect(discovery.status()).toBe(200);
  expect((await discovery.json()).people).toHaveLength(19);

  const relationships = await read(request, baseURL, "/api/social/relationships");
  const relationshipRows = (await relationships.json()).relationships;
  expect(relationshipRows.filter((item) => item.status === "accepted")).toHaveLength(10);
  expect(relationshipRows.filter((item) => item.status === "pending")).toHaveLength(5);
  expect(relationshipRows.reduce((total, item) => total + Number(item.unread_count || 0), 0)).toBeGreaterThan(0);

  for (const friend of relationshipRows.filter((item) => item.status === "accepted")) {
    const thread = await read(request, baseURL, `/api/social/messages?target=${encodeURIComponent(friend.other_user_id)}`);
    expect(thread.status()).toBe(200);
    expect((await thread.json()).messages).toHaveLength(12);
  }

  const gallery = await read(request, baseURL, "/api/social/gallery?user=cg-syn-v1-01");
  expect(gallery.status()).toBe(200);
  expect((await gallery.json()).photos.length).toBeGreaterThanOrEqual(2);
  const ratings = await read(request, baseURL, "/api/social/ratings");
  expect((await ratings.json()).ratings).toHaveLength(15);
  const notifications = await read(request, baseURL, "/api/social/moderation/notifications");
  expect((await notifications.json()).notifications.length).toBeGreaterThan(0);

  const overview = await read(request, baseURL, "/api/social/moderation/overview");
  expect(overview.status()).toBe(200);
  expect((await overview.json()).counts).toMatchObject({ userReports: 5, mediaReports: 1, appeals: 1, sensitive: 0 });
  const pendingMedia = await read(request, baseURL, "/api/social/moderation/media?status=pending&page=1", { moderation: true });
  expect((await pendingMedia.json()).media.length).toBeGreaterThanOrEqual(2);
  const reports = await read(request, baseURL, "/api/social/moderation/reports?status=pending", { moderation: true });
  expect((await reports.json()).reports.length).toBeGreaterThanOrEqual(4);
  const appeals = await read(request, baseURL, "/api/social/moderation/appeals?status=pending", { moderation: true });
  expect((await appeals.json()).appeals).toHaveLength(1);
});

test("NEAR-style social pages render populated synthetic data on desktop and mobile", async ({ page, context, baseURL }, testInfo) => {
  await authenticate(context, baseURL, viewer);
  await page.goto("/app/");
  await expect(page.locator("#social-view")).toBeVisible();
  await expect(page.locator("#people-grid .person-card")).toHaveCount(19);
  await expect(page.locator("#people-grid img").first()).toBeVisible();
  await expect.poll(() => page.locator("#people-grid img").evaluateAll((images) => images.filter((image) => image.complete && image.naturalWidth > 0).length)).toBe(19);
  await expect(page.locator('#primary-nav button[data-tab="game"]')).toHaveCount(0);
  await expect(page.locator('a[href*="game"]')).toHaveCount(0);
  await page.screenshot({ path: resolve(evidenceDirectory, `discovery-${testInfo.project.name}.png`), fullPage: true });

  await page.locator('#primary-nav button[data-tab="friends"]').click();
  await expect(page.locator("#friends-grid .person-card")).toHaveCount(10);
  await expect(page.locator("#requests-grid .person-card")).toHaveCount(5);
  await page.screenshot({ path: resolve(evidenceDirectory, `friends-${testInfo.project.name}.png`), fullPage: true });

  await page.locator('#primary-nav button[data-tab="chat"]').click();
  await expect(page.locator("#conversation-list .conversation")).toHaveCount(10);
  await page.locator("#conversation-list .conversation").first().click();
  await expect(page.locator("#thread .message")).toHaveCount(12);
  await page.screenshot({ path: resolve(evidenceDirectory, `chat-${testInfo.project.name}.png`), fullPage: true });

  await page.locator('#primary-nav button[data-tab="reviews"]').click();
  await expect(page.locator("#reviews-list .review")).toHaveCount(15);
  await page.locator('#primary-nav button[data-tab="profile"]').click();
  await expect(page.locator("#my-gallery img")).toHaveCount(2);
  await expect(page.locator("#moderation-notifications .notification-row")).toHaveCount(1);
  await page.screenshot({ path: resolve(evidenceDirectory, `profile-gallery-${testInfo.project.name}.png`), fullPage: true });
});

test("admin overview and urgent queues render synthetic moderation samples", async ({ page, context, baseURL }, testInfo) => {
  await authenticate(context, baseURL, viewer);
  await page.goto("/app/moderation.html");
  await expect(page.locator("#moderation-stats")).toContainText("รายงานผู้ใช้");
  await expect(page.locator("#moderation-stats")).toContainText("สื่อรอตรวจ");
  page.once("dialog", (dialog) => dialog.accept("ตรวจสอบชุดข้อมูลสังเคราะห์สำหรับ owner review"));
  await page.getByRole("button", { name: "งานด่วน" }).click();
  await expect(page.locator("#moderation-results .moderation-card")).toHaveCount(12);
  await expect(page.locator("#moderation-results")).toContainText("รายงานผู้ใช้");
  await expect(page.locator("#moderation-results")).toContainText("อุทธรณ์");
  await page.screenshot({ path: resolve(evidenceDirectory, `moderation-${testInfo.project.name}.png`), fullPage: true });
});
