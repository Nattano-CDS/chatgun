import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const sessionFile = process.env.STAGING_SESSION_FILE;
test.skip(!sessionFile, "requires an explicitly generated staging session bundle");
const bundle = sessionFile ? JSON.parse(readFileSync(sessionFile, "utf8")) : null;

function member(id) {
  return bundle.members.find((item) => item.id === id);
}

async function authenticate(context, baseURL, account) {
  const url = new URL(baseURL);
  await context.addCookies([
    { name: "__Host-cg_session", value: account.token, domain: url.hostname, path: "/", secure: true, httpOnly: true, sameSite: "Lax" },
    { name: "__Host-cg_csrf", value: account.csrf, domain: url.hostname, path: "/", secure: true, httpOnly: false, sameSite: "Lax" },
  ]);
}

async function mutate(request, baseURL, account, path, data) {
  return request.post(`${baseURL}${path}`, {
    headers: {
      cookie: `__Host-cg_session=${account.token}; __Host-cg_csrf=${account.csrf}`,
      origin: baseURL,
      "x-csrf-token": account.csrf,
      "content-type": "application/json",
    },
    data,
  });
}

async function read(request, baseURL, account, path) {
  return request.get(`${baseURL}${path}`, { headers: { cookie: `__Host-cg_session=${account.token}` } });
}

test.describe.configure({ mode: "serial" });

test("staging social APIs persist positive and negative non-media workflows", async ({ request, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "run staging mutations once");
  expect(bundle.accountId).toBe("23017b53386fb67fc62a52cdd017454c");
  const alice = member("cg-stage-alice");
  const bob = member("cg-stage-bob");
  const charlie = member("cg-stage-charlie");

  const config = await (await request.get(`${baseURL}/api/social/config`)).json();
  expect(config).toMatchObject({ socialAppEnabled: true, publicDiscoveryEnabled: true, friendRequestsEnabled: true, messagingEnabled: true, mediaUploadEnabled: false, ratingsEnabled: true, identityVerificationEnabled: false, gameEnabled: false, emailOtpEnabled: false, mobileOtpEnabled: false });

  const discovery = await read(request, baseURL, alice, "/api/social/discovery");
  expect(discovery.status()).toBe(200);
  expect((await discovery.json()).people.map((person) => person.user_id)).toEqual(expect.arrayContaining([bob.id, charlie.id]));

  const profileEdit = await mutate(request, baseURL, alice, "/api/social/profile", { action: "edit", name: "อลิซ ทดสอบอัปเดต", gender: "ไม่ระบุ", bio: "บัญชีสังเคราะห์สำหรับทดสอบ staging", interests: "ทดสอบ, ความปลอดภัย" });
  expect(profileEdit.status()).toBe(200);
  expect((await profileEdit.json()).profile.name).toBe("อลิซ ทดสอบอัปเดต");
  const invalidProfile = await mutate(request, baseURL, alice, "/api/social/profile", { action: "edit", name: "", gender: "ไม่ระบุ", bio: "", interests: "" });
  expect(invalidProfile.status()).toBe(400);

  const requestFriend = await mutate(request, baseURL, alice, "/api/social/relationships", { action: "request", target: bob.id });
  expect(requestFriend.status()).toBe(200);
  const duplicateFriend = await mutate(request, baseURL, alice, "/api/social/relationships", { action: "request", target: bob.id });
  expect(duplicateFriend.status()).toBe(409);
  expect((await duplicateFriend.json()).code).toBe("relationship_exists");
  const acceptFriend = await mutate(request, baseURL, bob, "/api/social/relationships", { action: "accept", target: alice.id });
  expect(acceptFriend.status()).toBe(200);
  const friendships = await read(request, baseURL, alice, "/api/social/relationships");
  expect((await friendships.json()).relationships.some((item) => item.other_user_id === bob.id && item.status === "accepted")).toBe(true);

  const sendMessage = await mutate(request, baseURL, alice, "/api/social/messages", { action: "send", target: bob.id, body: "ข้อความสังเคราะห์สำหรับ staging" });
  expect(sendMessage.status()).toBe(200);
  const thread = await read(request, baseURL, bob, `/api/social/messages?target=${alice.id}`);
  expect(thread.status()).toBe(200);
  expect((await thread.json()).messages.some((message) => message.body === "ข้อความสังเคราะห์สำหรับ staging")).toBe(true);
  const nonFriendMessage = await mutate(request, baseURL, alice, "/api/social/messages", { action: "send", target: charlie.id, body: "ต้องถูกปฏิเสธ" });
  expect(nonFriendMessage.status()).toBe(403);
  expect((await nonFriendMessage.json()).code).toBe("not_friends");

  const rating = await mutate(request, baseURL, alice, "/api/social/ratings", { target: bob.id, score: 5, comment: "สุภาพและเป็นมิตร" });
  expect(rating.status()).toBe(201);
  const duplicateRating = await mutate(request, baseURL, alice, "/api/social/ratings", { target: bob.id, score: 4, comment: "ซ้ำ" });
  expect(duplicateRating.status()).toBe(409);
  const ratings = await read(request, baseURL, bob, "/api/social/ratings");
  expect((await ratings.json()).ratings.some((item) => item.comment === "สุภาพและเป็นมิตร")).toBe(true);

  const report = await mutate(request, baseURL, alice, "/api/social/reports", { target: charlie.id, category: "spam", details: "รายงานสังเคราะห์เพื่อทดสอบ staging" });
  expect(report.status()).toBe(201);
  const invalidReport = await mutate(request, baseURL, alice, "/api/social/reports", { target: charlie.id, category: "not-a-category", details: "ต้องถูกปฏิเสธ" });
  expect(invalidReport.status()).toBe(400);

  const block = await mutate(request, baseURL, alice, "/api/social/blocks", { action: "block", target: bob.id });
  expect(block.status()).toBe(200);
  const blockedMessage = await mutate(request, baseURL, bob, "/api/social/messages", { action: "send", target: alice.id, body: "ต้องถูกบล็อก" });
  expect(blockedMessage.status()).toBe(403);
  const blocked = await read(request, baseURL, alice, "/api/social/blocks");
  expect((await blocked.json()).blocked.map((item) => item.user_id)).toContain(bob.id);
  const unblock = await mutate(request, baseURL, alice, "/api/social/blocks", { action: "unblock", target: bob.id });
  expect(unblock.status()).toBe(200);
  expect((await mutate(request, baseURL, alice, "/api/social/relationships", { action: "request", target: bob.id })).status()).toBe(200);
  expect((await mutate(request, baseURL, bob, "/api/social/relationships", { action: "accept", target: alice.id })).status()).toBe(200);
  expect((await mutate(request, baseURL, alice, "/api/social/profile", { action: "edit", name: "อลิซ ทดสอบ", gender: "ไม่ระบุ", bio: "บัญชีสังเคราะห์สำหรับทดสอบ staging", interests: "ทดสอบ, ความปลอดภัย" })).status()).toBe(200);

  const missingCsrf = await request.post(`${baseURL}/api/social/messages`, {
    headers: { cookie: `__Host-cg_session=${alice.token}; __Host-cg_csrf=${alice.csrf}`, origin: baseURL, "content-type": "application/json" },
    data: { action: "send", target: bob.id, body: "ต้องถูกปฏิเสธเพราะไม่มี CSRF" },
  });
  expect(missingCsrf.status()).toBe(403);
  expect((await missingCsrf.json()).code).toBe("invalid_csrf");
});

test("desktop and mobile render persisted staging profile, discovery, notifications, and reviews", async ({ page, context, baseURL }, testInfo) => {
  const bob = member("cg-stage-bob");
  await authenticate(context, baseURL, bob);
  await context.grantPermissions(["notifications"], { origin: baseURL });
  await page.goto("/app/");
  await expect(page.getByRole("heading", { name: "คนใกล้คุณ" })).toBeVisible();
  await expect(page.locator("#people-grid").getByText("อลิซ ทดสอบ")).toBeVisible();
  await page.locator('#primary-nav button[data-tab="friends"]').click();
  await expect(page.locator("#friends-grid").getByText("อลิซ ทดสอบ")).toBeVisible();
  await page.locator('#primary-nav button[data-tab="chat"]').click();
  await expect(page.locator("#conversation-list").getByText("ข้อความสังเคราะห์สำหรับ staging")).toBeVisible();
  await page.locator('#primary-nav button[data-tab="reviews"]').click();
  await expect(page.locator("#reviews-list").getByText("สุภาพและเป็นมิตร")).toBeVisible();
  await page.locator('#primary-nav button[data-tab="profile"]').click();
  await expect(page.locator('#profile-form input[name="name"]')).toHaveValue("บ็อบ ทดสอบ");
  await page.getByRole("button", { name: "เปิดการแจ้งเตือนข้อความในอุปกรณ์นี้" }).click();
  await expect(page.getByRole("button", { name: "ปิดการแจ้งเตือนข้อความในอุปกรณ์นี้" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("chatgun-notifications"))).toBe("enabled");
  await expect(page.getByRole("button", { name: "เกม" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath(`live-social-${testInfo.project.name}.png`), fullPage: true });
});
