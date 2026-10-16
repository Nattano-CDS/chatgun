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
    const responses = {
      "/api/social/config": config,
      "/api/auth/me": { user: { id: "me", displayName: "นัท" }, providers: ["google"], recentlyAuthenticated: true },
      "/api/social/profile": { profile: { user_id: "me", name: "นัท", gender: "ไม่ระบุ", bio: "ชอบทำความรู้จักเพื่อนใหม่", interests: "กาแฟ, เทคโนโลยี", discovery_visible: 1 } },
      "/api/social/discovery": { locationFresh: true, people: [
        { user_id: "near-1", name: "มิน", gender: "หญิง", bio: "ชอบคาเฟ่และถ่ายรูป", interests: "กาแฟ, ถ่ายรูป", distance: 82, rating: 4.8, rating_count: 12 },
        { user_id: "near-2", name: "ต้น", gender: "ชาย", bio: "วิ่งและท่องเที่ยว", interests: "วิ่ง, ท่องเที่ยว", distance: 640, rating: 4.5, rating_count: 6 },
      ] },
      "/api/social/relationships": { relationships: [
        { id: "r1", other_user_id: "friend-1", requested_by: "friend-1", status: "accepted", name: "พลอย", gender: "หญิง", bio: "เพื่อนใน ChatGun" },
      ] },
      "/api/social/ratings": { ratings: [{ id: "v1", score: 5, comment: "สุภาพและเป็นมิตร", sender_name: "พลอย", created_at: 1_790_000_000 }] },
      "/api/social/blocks": { blocked: [] },
      "/api/social/gallery": { photos: [], comments: [], owner: "me" },
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

test("optional demo remains browser-only and contains no game", async ({ page }) => {
  await page.unroute("**/api/**");
  await page.route("**/api/social/config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...config, socialAppEnabled: false, demoModeEnabled: true }) }));
  await page.goto("/app/");
  await page.getByRole("button", { name: "ลองโหมดสาธิตแบบไม่บันทึกลงเซิร์ฟเวอร์" }).click();
  await expect(page.locator("#demo-banner")).toBeVisible();
  await expect(page.locator("#people-grid").getByText("มิน")).toBeVisible();
  await expect(page.getByRole("button", { name: "เกม" })).toHaveCount(0);
});
