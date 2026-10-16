import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve("docs/visual-audit/screenshots");
const viewports = [
  ["mobile", 390, 844],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1100],
];

const chatgun = process.env.CHATGUN_URL || "https://20ad10a1.chatgun.pages.dev";
const near = process.env.NEAR_URL || "http://127.0.0.1:5173";

await mkdir(resolve(root, "near"), { recursive: true });
await mkdir(resolve(root, "chatgun"), { recursive: true });

const browser = await chromium.launch({ headless: true });

async function capture(url, output, width, height, setup, after) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  if (setup) await setup(page);
  await page.goto(url, { waitUntil: "load", timeout: 30_000 });
  await page.waitForTimeout(800);
  if (after) await after(page);
  await page.screenshot({ path: resolve(root, output), fullPage: true });
  await context.close();
}

const socialConfig = {
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

const socialResponses = {
  "/api/social/config": socialConfig,
  "/api/auth/me": { user: { id: "visual-me", displayName: "นัท" }, providers: ["google"], recentlyAuthenticated: true },
  "/api/social/profile": { profile: { user_id: "visual-me", name: "นัท", gender: "ไม่ระบุ", bio: "ชอบทำความรู้จักเพื่อนใหม่", interests: "กาแฟ, เทคโนโลยี", discovery_visible: 1 } },
  "/api/social/discovery": { locationFresh: true, people: [
    { user_id: "near-1", name: "มิน", gender: "หญิง", bio: "ชอบคาเฟ่และถ่ายรูป", interests: "กาแฟ, ถ่ายรูป", distance: 82, rating: 4.8, rating_count: 12 },
    { user_id: "near-2", name: "ต้น", gender: "ชาย", bio: "วิ่งและท่องเที่ยว", interests: "วิ่ง, ท่องเที่ยว", distance: 640, rating: 4.5, rating_count: 6 },
  ] },
  "/api/social/relationships": { relationships: [
    { id: "r1", other_user_id: "friend-1", requested_by: "friend-1", status: "accepted", name: "พลอย", gender: "หญิง", bio: "เพื่อนใน ChatGun", last_message_at: 1790000100, last_message_body: "เจอกันที่คาเฟ่", last_message_sender_id: "visual-me", unread_count: 0 },
  ] },
  "/api/social/ratings": { ratings: [{ id: "v1", score: 5, comment: "สุภาพและเป็นมิตร", sender_name: "พลอย", created_at: 1790000000 }] },
  "/api/social/blocks": { blocked: [] },
  "/api/social/gallery": { photos: [], comments: [], owner: "visual-me" },
  "/api/social/media/appeals": { appeals: [], appealable: [] },
  "/api/social/moderation/notifications": { notifications: [] },
  "/api/social/media/quota": { quotas: { chat: { used: 2, limit: 10, remaining: 8 }, gallery: { used: 3, limit: 10, remaining: 7 } }, resetAt: 1790010000 },
  "/api/social/messages": { messages: [
    { id: "message-1", sender_user_id: "friend-1", receiver_user_id: "visual-me", body: "สวัสดี ยินดีที่ได้รู้จัก", media_id: null, unsent_at: null, read_at: null, created_at: 1790000100 },
  ], hasMore: false },
};

async function mockSocial(page) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = socialResponses[path];
    await route.fulfill({
      status: body ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(body || { code: "not_found", error: "ไม่พบ" }),
    });
  });
}

async function mockAcceptance(page) {
  await page.route("**/api/auth/acceptance", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      accepted: false,
      required: true,
      versions: { adultNotice: "adult-preview-v1", terms: "terms-preview-v1", privacy: "privacy-preview-v1" },
      accountState: "pending_acceptance",
      nextPath: "/acceptance",
    }),
  }));
}

async function mockOnboarding(page) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path === "/api/social/config"
      ? socialConfig
      : path === "/api/auth/me"
        ? { user: { id: "visual-new", displayName: "สมาชิกใหม่" }, providers: ["google"], recentlyAuthenticated: true, nextPath: "/app/?onboarding=1" }
        : null;
    await route.fulfill({ status: body ? 200 : 404, contentType: "application/json", body: JSON.stringify(body || { code: "not_found", error: "ไม่พบ" }) });
  });
}

for (const [name, width, height] of viewports) {
  await capture(`${near}/`, `near/home-${name}.png`, width, height);
  await capture(`${near}/login`, `near/login-${name}.png`, width, height);
  await capture(`${near}/register`, `near/register-${name}.png`, width, height);
  await capture(`${chatgun}/`, `chatgun/home-${name}.png`, width, height);
  await capture(`${chatgun}/signup.html`, `chatgun/signup-${name}.png`, width, height);
  await capture(`${chatgun}/acceptance`, `chatgun/acceptance-${name}.png`, width, height, mockAcceptance);
  await capture(`${chatgun}/app/`, `chatgun/social-${name}.png`, width, height, mockSocial);
  await capture(`${chatgun}/app/?onboarding=1`, `chatgun/onboarding-${name}.png`, width, height, mockOnboarding);
  await capture(`${chatgun}/app/people/near-1`, `chatgun/member-profile-${name}.png`, width, height, mockSocial);
  for (const tab of ["friends", "reviews", "profile"]) {
    await capture(`${chatgun}/app/`, `chatgun/${tab}-${name}.png`, width, height, mockSocial, async (page) => {
      await page.locator(`#primary-nav button[data-tab="${tab}"]`).click();
      await page.waitForTimeout(150);
    });
  }
  await capture(`${chatgun}/app/`, `chatgun/chat-${name}.png`, width, height, mockSocial, async (page) => {
    await page.locator('#primary-nav button[data-tab="chat"]').click();
    await page.getByRole("button", { name: /พลอย/u }).click();
    await page.waitForTimeout(150);
  });
}

await browser.close();
