import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const screenshotDirectory = resolve("test-results/screenshots");

test.beforeAll(() => mkdirSync(screenshotDirectory, { recursive: true }));

test("signup renders branded auth controls with Preview Turnstile", async ({ page }, testInfo) => {
  await page.goto("/signup.html");
  await expect(page).toHaveTitle("สมัครสมาชิก | ChatGun");
  await expect(page.getByRole("heading", { name: "สร้างบัญชีใหม่" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Facebook" })).toBeVisible();
  await expect(page.getByRole("button", { name: "LINE" })).toBeVisible();
  await expect(page.getByText(/รับชื่อ รูปโปรไฟล์ และอีเมลจากผู้ให้บริการ/u)).toBeVisible();
  await expect(page.getByRole("link", { name: "นโยบายความเป็นส่วนตัว" })).toHaveAttribute("href", "./privacy.html");
  await expect(page.getByRole("button", { name: /เบอร์มือถือ/ })).toBeDisabled();
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
});

test("account page redirects unauthenticated users to signup", async ({ page }) => {
  await page.goto("/account.html");
  await expect(page).toHaveURL(/\/signup(?:\.html)?$/u);
  await expect(page.getByRole("heading", { name: "สร้างบัญชีใหม่" })).toBeVisible();
});

test("Pages Functions expose secure config and reject cross-origin mutations", async ({ request, baseURL }) => {
  const configResponse = await request.get("/api/auth/config");
  expect(configResponse.status()).toBe(200);
  expect(configResponse.headers()["cache-control"]).toBe("no-store");
  expect(configResponse.headers()["x-content-type-options"]).toBe("nosniff");
  const config = await configResponse.json();
  expect(config.smsEnabled).toBe(false);
  expect(config.turnstileSiteKey).toMatch(/^0x[\w-]+$/u);

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
