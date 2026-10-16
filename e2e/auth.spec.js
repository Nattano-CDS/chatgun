import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const screenshotDirectory = resolve("test-results/screenshots");

test.beforeAll(() => mkdirSync(screenshotDirectory, { recursive: true }));

test("signup renders existing-account auth controls with Preview Turnstile", async ({ page }, testInfo) => {
  await page.goto("/signup.html");
  await expect(page).toHaveTitle("สมัครสมาชิก | ChatGun");
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบด้วยบัญชีเดิม" })).toBeVisible();
  await expect(page.getByText(/การสมัครบัญชีใหม่ปิดไว้/u)).toBeVisible();
  await expect(page.getByRole("button", { name: "ดำเนินการต่อด้วย Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ดำเนินการต่อด้วย Facebook" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ดำเนินการต่อด้วย LINE" })).toBeVisible();
  await expect(page.getByText(/รับชื่อ รูปโปรไฟล์ และอีเมลเท่าที่ผู้ให้บริการอนุญาต/u)).toBeVisible();
  await expect(page.getByRole("link", { name: "นโยบายความเป็นส่วนตัว" })).toHaveAttribute("href", "./privacy.html");
  await expect(page.getByRole("link", { name: "ข้อกำหนดการใช้บริการ" })).toHaveAttribute("href", "./terms.html");
  await expect(page.getByText(/OTP/u)).toHaveCount(0);
  await expect(page.locator('input[type="email"], input[inputmode="tel"]')).toHaveCount(0);
  await expect(page.locator('#turnstile input[name="cf-turnstile-response"]')).toBeAttached();
  await expect(page.getByRole("status")).toBeEmpty();
  await page.screenshot({
    path: resolve(screenshotDirectory, testInfo.project.name.includes("mobile") ? "signup-mobile.png" : "signup-desktop.png"),
    fullPage: true,
  });
});

test("privacy notice explains social identity data use", async ({ page }) => {
  await page.goto("/privacy.html");
  await expect(page).toHaveTitle("นโยบายความเป็นส่วนตัว | ChatGun");
  await expect(page.getByRole("heading", { name: "ข้อมูลที่เราเก็บ" })).toBeVisible();
  await expect(page.getByText(/Google, Facebook หรือ LINE/u)).toBeVisible();
  await expect(page.getByRole("heading", { name: "การลบข้อมูล" })).toBeVisible();
  await expect(page.getByText("Email OTP ถูกปิดใช้งาน")).toBeVisible();
});

test("legal review pages disclose unresolved owner decisions", async ({ page }) => {
  await page.goto("/terms.html");
  await expect(page).toHaveTitle("ข้อกำหนดการใช้บริการ | ChatGun");
  await expect(page.getByText("ฉบับร่างสำหรับเจ้าของบริการตรวจสอบ:")).toBeVisible();

  await page.goto("/data-deletion.html");
  await expect(page).toHaveTitle("การขอลบบัญชีและข้อมูล | ChatGun");
  await expect(page.getByRole("heading", { name: "วิธีส่งคำขอในช่วงทดสอบ" })).toBeVisible();
});

test("account page redirects unauthenticated users to signup", async ({ page }) => {
  await page.goto("/account.html");
  await expect(page).toHaveURL(/\/signup(?:\.html)?$/u);
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบด้วยบัญชีเดิม" })).toBeVisible();
});

test("Pages Functions expose secure config and reject cross-origin mutations", async ({ request, baseURL }) => {
  const configResponse = await request.get("/api/auth/config");
  expect(configResponse.status()).toBe(200);
  expect(configResponse.headers()["cache-control"]).toBe("no-store");
  expect(configResponse.headers()["x-content-type-options"]).toBe("nosniff");
  const config = await configResponse.json();
  expect(config.oauthProviders).toEqual(["google", "facebook", "line"]);
  expect(config.emailOtpEnabled).toBe(false);
  expect(config.mobileOtpEnabled).toBe(false);
  expect(config.smsEnabled).toBe(false);
  expect(config.newAccountRegistrationEnabled).toBe(false);
  expect(config.safety).toEqual({
    publicDiscoveryEnabled: false,
    unsolicitedMessagingEnabled: false,
    minorRegistrationEnabled: false,
  });
  expect(config.turnstileSiteKey).toMatch(/^0x[\w-]+$/u);

  const disabledOtpResponse = await request.post("/api/auth/otp/start", {
    headers: { origin: baseURL, "content-type": "application/json" },
    data: { channel: "email", destination: "qa@example.com", turnstileToken: "invalid-token" },
  });
  expect(disabledOtpResponse.status()).toBe(404);
  expect((await disabledOtpResponse.json()).code).toBe("otp_disabled");

  const crossOriginResponse = await request.post("/api/auth/otp/start", {
    headers: { origin: "https://evil.example", "content-type": "application/json" },
    data: { channel: "email", destination: "qa@example.com", turnstileToken: "invalid-token" },
  });
  expect(crossOriginResponse.status()).toBe(403);
  expect((await crossOriginResponse.json()).code).toBe("invalid_origin");

  const meResponse = await request.get(`${baseURL}/api/auth/me`);
  expect(meResponse.status()).toBe(401);
  expect((await meResponse.json()).code).toBe("unauthorized");
});
