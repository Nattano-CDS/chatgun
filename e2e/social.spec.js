import { expect, test } from "@playwright/test";

const config = {
  socialAppEnabled: true,
  adultOnboardingEnabled: true,
  adultNoticeVersion: "adult-preview-v1",
  publicDiscoveryEnabled: true,
  friendRequestsEnabled: true,
  messagingEnabled: true,
  mediaUploadEnabled: false,
  ratingsEnabled: true,
  identityVerificationEnabled: false,
  demoModeEnabled: false,
  gameEnabled: false,
  emailOtpEnabled: false,
  mobileOtpEnabled: false,
};

async function mockSocialApi(page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/social/messages") {
      const body = route.request().method() === "GET" ? { messages: [
        { id: "message-1", sender_user_id: "friend-1", receiver_user_id: "me", body: "สวัสดี ยินดีที่ได้รู้จัก", media_id: null, unsent_at: null, read_at: null, created_at: 1_790_000_100 },
      ], hasMore: false } : { ok: true };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    }
    const responses = {
      "/api/social/config": config,
      "/api/auth/me": { user: { id: "me", displayName: "นัท" }, providers: ["google"], recentlyAuthenticated: true },
      "/api/social/profile": { profile: { user_id: "me", name: "นัท", gender: "ไม่ระบุ", bio: "ชอบทำความรู้จักเพื่อนใหม่", interests: "กาแฟ, เทคโนโลยี", discovery_visible: 1 } },
      "/api/social/discovery": { locationFresh: true, people: [
        { user_id: "near-1", name: "มิน", gender: "หญิง", bio: "ชอบคาเฟ่และถ่ายรูป", interests: "กาแฟ, ถ่ายรูป", distance: 82, rating: 4.8, rating_count: 12 },
        { user_id: "near-2", name: "ต้น", gender: "ชาย", bio: "วิ่งและท่องเที่ยว", interests: "วิ่ง, ท่องเที่ยว", distance: 640, rating: 4.5, rating_count: 6 },
      ] },
      "/api/social/relationships": { relationships: [
        { id: "r1", other_user_id: "friend-1", requested_by: "friend-1", status: "accepted", name: "พลอย", gender: "หญิง", bio: "เพื่อนใน ChatGun", last_message_at: 1_790_000_100, last_message_body: "เจอกันที่คาเฟ่", last_message_sender_id: "me", unread_count: 0 },
      ] },
      "/api/social/ratings": { ratings: [{ id: "v1", score: 5, comment: "สุภาพและเป็นมิตร", sender_name: "พลอย", created_at: 1_790_000_000 }] },
      "/api/social/blocks": { blocked: [] },
      "/api/social/gallery": { photos: [], comments: [], owner: "me" },
      "/api/social/media/appeals": { appeals: [], appealable: [] },
      "/api/social/moderation/notifications": { notifications: [] },
    };
    const body = responses[url.pathname];
    await route.fulfill({ status: body ? 200 : 404, contentType: "application/json", body: JSON.stringify(body || { code: "not_found", error: "ไม่พบ" }) });
  });
}

test.beforeEach(async ({ page }) => {
  await mockSocialApi(page);
});

test("desktop social shell preserves discovery, friends, chat, reviews, and profile without game", async ({ page }, testInfo) => {
  await page.goto("/app/");
  await expect(page.getByRole("heading", { name: "คนใกล้คุณ" })).toBeVisible();
  await expect(page.getByText("มิน")).toBeVisible();
  await expect(page.getByText("ต้น")).toBeVisible();
  await expect(page.getByRole("button", { name: "เกม" })).toHaveCount(0);
  await page.locator('#primary-nav button[data-tab="friends"]').click();
  await expect(page.locator("#friends-grid").getByText("พลอย")).toBeVisible();
  await page.locator('#primary-nav button[data-tab="reviews"]').click();
  await expect(page.locator("#reviews-list").getByText("สุภาพและเป็นมิตร")).toBeVisible();
  await page.locator('#primary-nav button[data-tab="chat"]').click();
  await expect(page.locator("#conversation-list").getByText("คุณ: เจอกันที่คาเฟ่")).toBeVisible();
  await page.getByRole("button", { name: /พลอย/u }).click();
  await expect(page.getByText("ระวังการหลอกโอนเงินและขอข้อมูลส่วนตัว")).toBeVisible();
  await expect(page.getByText("สวัสดี ยินดีที่ได้รู้จัก")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("social-desktop.png"), fullPage: true });
});

test("mobile social shell uses bottom navigation and remains usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile-only layout check");
  await page.goto("/app/");
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator("#people-grid .person-card")).toHaveCount(2);
  await page.locator('#primary-nav button[data-tab="profile"]').click();
  await expect(page.getByRole("button", { name: "บันทึกโปรไฟล์" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("social-mobile.png"), fullPage: true });
});

test("disabled social environment reveals no member features", async ({ page }) => {
  await page.unroute("**/api/**");
  await page.route("**/api/social/config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...config, socialAppEnabled: false }) }));
  await page.goto("/app/");
  await expect(page.getByRole("heading", { name: "ChatGun Social ยังไม่เปิดใช้งาน" })).toBeVisible();
  await expect(page.locator("#social-view")).toBeHidden();
});

test("member profile routes are deep-linkable and preserve browser history", async ({ page }) => {
  await page.goto("/app/people/near-1");
  await expect(page).toHaveURL(/\/app\/people\/near-1$/u);
  await expect(page.locator("#profile-dialog")).toBeVisible();
  await expect(page.locator("#profile-dialog").getByRole("heading", { name: "มิน" })).toBeVisible();
  await page.locator("#profile-dialog .dialog-close").click();
  await expect(page).toHaveURL(/\/app\/$/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/people\/near-1$/u);
  await expect(page.locator("#profile-dialog")).toBeVisible();
});

test("optional demo remains browser-only and contains no game", async ({ page }) => {
  await page.unroute("**/api/**");
  await page.route("**/api/social/config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...config, socialAppEnabled: false, demoModeEnabled: true }) }));
  await page.goto("/app/");
  await page.getByRole("button", { name: "ลองโหมดสาธิตแบบไม่บันทึกลงเซิร์ฟเวอร์" }).click();
  await expect(page.locator("#demo-banner")).toBeVisible();
  await expect(page.locator("#people-grid").getByText("มิน")).toBeVisible();
  await expect(page.getByRole("button", { name: "เกม" })).toHaveCount(0);
});

test("browser-only demo supports local gallery and chat image workflows", async ({ page }) => {
  await page.unroute("**/api/**");
  await page.route("**/api/social/config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...config, socialAppEnabled: false, demoModeEnabled: true }) }));
  await page.goto("/app/");
  await page.getByRole("button", { name: "ลองโหมดสาธิตแบบไม่บันทึกลงเซิร์ฟเวอร์" }).click();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0ioAAAAASUVORK5CYII=", "base64");

  await page.locator('#primary-nav button[data-tab="profile"]').click();
  await page.locator('#gallery-upload input[type="file"]').setInputFiles({ name: "demo.png", mimeType: "image/png", buffer: png });
  await page.locator('#gallery-upload input[name="caption"]').fill("รูปตัวอย่างในเครื่อง");
  await page.getByRole("button", { name: "อัปโหลดรูป" }).click();
  await expect(page.locator("#gallery-count")).toHaveText("1 / 12");
  await expect(page.locator("#my-gallery img")).toHaveAttribute("src", /^data:image\//u);

  await page.locator('#primary-nav button[data-tab="chat"]').click();
  await page.getByRole("button", { name: /พลอย/u }).click();
  await page.locator('#thread input[type="file"]').setInputFiles({ name: "chat.png", mimeType: "image/png", buffer: png });
  await page.locator("#thread .composer").getByRole("button", { name: "ส่ง", exact: true }).click();
  await expect(page.locator("#thread .chat-image")).toHaveAttribute("src", /^data:image\//u);
  await page.getByRole("button", { name: "รูปที่ส่งล่าสุด" }).click();
  await expect(page.locator("#asset-grid img")).toHaveAttribute("src", /^data:image\//u);
});

test("social shell reports offline state and recovers when connectivity returns", async ({ page, context }) => {
  await page.goto("/app/");
  await expect(page.locator("#app")).toHaveAttribute("aria-busy", "false");
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.locator("#global-status")).toContainText("ออฟไลน์");
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator("#toast")).toHaveText("กลับมาออนไลน์แล้ว");
});

test("daily image quota disables only the exhausted category while chat text remains available", async ({ page }) => {
  await page.route("**/api/social/config", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ...config, mediaUploadEnabled: true }),
  }));
  await page.route("**/api/social/upload-quotas", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      timezone: "Asia/Bangkok",
      localDay: "2026-10-16",
      resetsAt: 1_797_353_200,
      chat: { limit: 10, used: 10, reserved: 0, remaining: 0 },
      gallery: { limit: 10, used: 10, reserved: 0, remaining: 0 },
    }),
  }));
  await page.goto("/app/");
  await page.locator('#primary-nav button[data-tab="profile"]').click();
  await expect(page.locator("#gallery-upload-quota")).toContainText("อัปโหลดรูปแกลเลอรีครบขีดจำกัดรายวันแล้ว");
  await expect(page.locator('#gallery-upload input[type="file"]')).toBeDisabled();
  await page.locator('#primary-nav button[data-tab="chat"]').click();
  await page.getByRole("button", { name: /พลอย/u }).click();
  await expect(page.locator("#chat-upload-quota")).toContainText("ยังส่งข้อความได้");
  await expect(page.locator('#thread input[name="file"]')).toBeDisabled();
  await expect(page.locator('#thread input[name="body"]')).toBeEnabled();
  await expect(page.locator("#thread .composer").getByRole("button", { name: "ส่ง", exact: true })).toBeEnabled();
});
