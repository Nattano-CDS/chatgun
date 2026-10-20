import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const screenshotDirectory = resolve("test-results/screenshots");

test.beforeAll(() => mkdirSync(screenshotDirectory, { recursive: true }));

// Deterministic UI contract only. Never evidence of real CAPTCHA/OAuth success.
async function mockProviderConfiguration(page){
  await page.route('**/api/auth/config',r=>r.fulfill({json:{oauthLoginEnabled:true,oauthProviders:['google','facebook','line'],turnstileSiteKey:'0xMockedUiOnly',newAccountRegistrationEnabled:false,invitationOnlyRegistrationEnabled:false,emailOtpEnabled:false,mobileOtpEnabled:false}}));
}

test("signup explains a Turnstile connection failure in Thai and retries before OAuth", async ({ page }) => {
  await mockProviderConfiguration(page);
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        (() => {
          let renders = 0;
          let token = "";
          window.turnstile = {
            render(target, options) {
              renders += 1;
              const container = document.querySelector(target);
              container.replaceChildren();
              const input = document.createElement("input");
              input.name = "cf-turnstile-response";
              input.type = "hidden";
              container.appendChild(input);
              if (renders === 1) {
                setTimeout(() => options["error-callback"]("200500"), 0);
              } else {
                token = "synthetic-ui-token";
                input.value = token;
                setTimeout(() => options.callback(token), 0);
              }
              return "synthetic-widget";
            },
            getResponse() { return token; },
            remove() { token = ""; },
            reset() { token = ""; },
          };
        })();
      `,
    });
  });
  await page.route("**/api/auth/oauth/google/start", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?client_id=preview" }),
  }));
  await page.route("https://accounts.google.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<h1>Google authorization</h1>",
  }));

  await page.goto("/signup.html");
  await expect(page.getByRole("status")).toContainText("ไม่สามารถเชื่อมต่อระบบยืนยันความปลอดภัยได้");
  const retry = page.getByRole("button", { name: "ลองโหลดระบบยืนยันอีกครั้ง" });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(retry).toBeHidden();
  await expect(page.getByRole("status")).toBeEmpty();
  await page.getByRole("button", { name: "ดำเนินการต่อด้วย Google" }).click();
  await expect(page).toHaveURL(/accounts\.google\.com\/o\/oauth2\/v2\/auth/u);
});

test("signup permits existing social login while public registration remains closed", async ({ page }, testInfo) => {
  await mockProviderConfiguration(page);
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',r=>r.fulfill({contentType:'application/javascript',body:`window.turnstile={render(target){const input=document.createElement('input');input.type='hidden';input.name='cf-turnstile-response';document.querySelector(target).append(input);return 'mock-ui';},getResponse(){return '';}};`}));
  const cspErrors = [];
  page.on("console", (entry) => {
    if (/Content Security Policy directive/iu.test(entry.text())) cspErrors.push(entry.text());
  });
  await page.goto("/signup.html");
  await expect(page).toHaveTitle("สมัครสมาชิก | ChatGun");
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบด้วยบัญชีเดิม" })).toBeVisible();
  await expect(page.getByText("การสมัครบัญชีใหม่ยังไม่เปิดเป็นสาธารณะ")).toBeVisible();
  await expect(page.locator("#invitation-code")).toHaveCount(0);
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
  expect(cspErrors).toEqual([]);
  await page.screenshot({
    path: resolve(screenshotDirectory, testInfo.project.name.includes("mobile") ? "signup-mobile.png" : "signup-desktop.png"),
    fullPage: true,
  });
});

test("post-OAuth acceptance is responsive, starts unchecked, and continues only after both confirmations", async ({ page, context }, testInfo) => {
  await context.addCookies([
    { name: "__Host-cg_csrf", value: "synthetic-csrf", url: testInfo.project.use.baseURL || "https://chatgun.pages.dev", secure: true },
  ]).catch(() => {});
  let submitted = null;
  await page.route("**/api/auth/acceptance", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        accepted: false,
        required: true,
        versions: { adultNotice: "adult-preview-v1", terms: "terms-preview-v1", privacy: "privacy-preview-v1" },
        accountState: "pending_acceptance",
        nextPath: "/acceptance",
      }) });
    }
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ accepted: true, nextPath: "/app/?onboarding=1" }) });
  });
  await page.route("**/app/?onboarding=1", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Member Onboarding</h1>" }));

  await page.goto("/acceptance");
  await expect(page.getByRole("heading", { name: "ยืนยันก่อนเริ่มใช้งาน" })).toBeVisible();
  const adult = page.getByLabel("ข้าพเจ้าขอยืนยันว่ามีอายุ 18 ปีบริบูรณ์ขึ้นไป");
  const policy = page.getByLabel(/ข้าพเจ้ายอมรับ/u);
  await expect(adult).not.toBeChecked();
  await expect(policy).not.toBeChecked();
  await expect(page.getByRole("link", { name: "ข้อกำหนดการใช้บริการ" })).toHaveAttribute("href", "/terms.html");
  await expect(page.getByRole("link", { name: "นโยบายความเป็นส่วนตัว" })).toHaveAttribute("href", "/privacy.html");
  await page.screenshot({
    path: resolve(screenshotDirectory, testInfo.project.name.includes("mobile") ? "acceptance-mobile.png" : "acceptance-desktop.png"),
    fullPage: true,
  });
  await adult.check();
  await policy.check();
  await page.getByRole("button", { name: "ยอมรับและดำเนินการต่อ" }).click();
  await expect(page.getByRole("heading", { name: "Member Onboarding" })).toBeVisible();
  expect(submitted).toEqual({
    confirmedAdult: true,
    acceptedTerms: true,
    acknowledgedPrivacy: true,
    adultNoticeVersion: "adult-preview-v1",
    termsVersion: "terms-preview-v1",
    privacyVersion: "privacy-preview-v1",
  });
});

test("privacy notice explains social identity data use", async ({ page }) => {
  await page.goto("/privacy.html");
  await expect(page).toHaveTitle("นโยบายความเป็นส่วนตัว | ChatGun");
  await expect(page.getByRole("heading", { name: "ข้อมูลที่เราเก็บ" })).toBeVisible();
  await expect(page.getByText(/Google, Facebook หรือ LINE/u)).toBeVisible();
  await expect(page.getByRole("heading", { name: "การลบข้อมูล" })).toBeVisible();
  await expect(page.getByText(/OTP/).first()).toBeVisible();
});

test("approved owner-pilot legal pages retain version, scope and unresolved wider-release decisions", async ({ page }) => {
  await page.goto("/terms.html");
  await expect(page).toHaveTitle("ข้อกำหนดการใช้บริการ | ChatGun");
  await expect(page.locator('[data-policy-version]')).toContainText('20 ตุลาคม 2026');
  await expect(page.getByRole('heading',{name:'ข้อมูลที่เจ้าของต้องยืนยัน'})).toBeVisible();

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
  expect(config.oauthProviders).toEqual(config.oauthLoginEnabled ? ["google", "facebook", "line"] : []);
  expect(config.emailOtpEnabled).toBe(false);
  expect(config.mobileOtpEnabled).toBe(false);
  expect(config.smsEnabled).toBe(false);
  expect(config.newAccountRegistrationEnabled).toBe(false);
  expect(config.invitationOnlyRegistrationEnabled).toBe(false);
  expect(config.safety).toEqual({publicDiscoveryEnabled:false,unsolicitedMessagingEnabled:false,minorRegistrationEnabled:false});
  if(config.turnstileSiteKey!==null){
    if(new URL(baseURL).hostname==='localhost')expect(config.turnstileSiteKey).toBe('turnstile-site'); // Synthetic local harness only.
    else expect(config.turnstileSiteKey).toMatch(/^0x[\w-]+$/u);
  }

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
