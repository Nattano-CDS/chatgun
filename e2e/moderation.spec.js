import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const screenshotDirectory = resolve("test-results/screenshots");
test.beforeAll(() => mkdirSync(screenshotDirectory, { recursive: true }));

test.beforeEach(async ({ page }) => {
  await page.route("**/api/social/moderation/**", async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname === "/api/social/moderation/overview") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        counts: { pending: 1, general: 8, sensitive: 2, rejected: 3, reports: 2, userReports: 1, mediaReports: 1, appeals: 1, critical: 1, high: 1 },
        daily: { newLast24Hours: 4, resolvedLast24Hours: 2, oldestOpenAt: 1_790_000_000 },
        cleanup: { pending: 1, exhausted: 0 },
      }) });
    }
    if (url.pathname === "/api/social/moderation/media" && request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ media: [{
        media_id: "media-1", status: "pending", category: null, source: "manual", reason: "", revision: 0,
        created_at: 1_790_000_000, media_purpose: "gallery", content_type: "image/png", byte_size: 1024,
        owner_name: "<img src=x onerror=alert(1)>", report_count: 1,
      }], page: 1, hasMore: false }) });
    }
    if (url.pathname === "/api/social/moderation/media" && request.method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, revision: 1 }) });
    }
    if (url.pathname === "/api/social/moderation/media/media-1") {
      return route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0ioAAAAASUVORK5CYII=", "base64") });
    }
    if (url.pathname === "/api/social/moderation/reports" && request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reports: [{ id: "report-1", reason_code: "threat", details: "มีข้อความข่มขู่ที่ต้องประเมิน", status: "pending", created_at: 1_790_000_020, subject_name: "สมาชิกทดสอบ" }] }) });
    }
    if (url.pathname === "/api/social/moderation/media-reports") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reports: [{ id: "media-report-1", media_id: "media-1", reason_code: "ncii", details: "สงสัยว่าเผยแพร่โดยไม่ได้รับความยินยอม", status: "pending", created_at: 1_790_000_010, media_purpose: "gallery", category: null }] }) });
    }
    if (url.pathname === "/api/social/moderation/appeals") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ appeals: [{ id: "appeal-1", media_id: "media-2", reason: "ขอให้ตรวจสอบผลการตัดสินอีกครั้ง", status: "pending", revision: 0, created_at: 1_790_000_030, category: "prohibited" }] }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "ไม่พบ" }) });
  });
});

test("admin media dashboard requires purpose, renders safely, and records a classified decision", async ({ page }, testInfo) => {
  const decisions = [];
  page.on("request", (request) => { if (request.url().endsWith("/api/social/moderation/media") && request.method() === "POST") decisions.push(request.postDataJSON()); });
  await page.goto("/app/moderation.html");
  await expect(page).toHaveTitle("ศูนย์ดูแลสื่อ · ChatGun");
  await page.getByRole("button", { name: "ภาพรวม" }).click();
  await expect(page.getByRole("status")).toContainText("อย่างน้อย 10 ตัวอักษร");
  await page.getByLabel("วัตถุประสงค์เฉพาะกรณี").fill("ตรวจสอบคิวสื่อสังเคราะห์สำหรับ QA");
  await page.getByRole("button", { name: "ภาพรวม" }).click();
  await expect(page.locator("#moderation-stats")).toContainText("รายงานผู้ใช้");
  await expect(page.locator("#moderation-stats")).toContainText("สื่อรอตรวจ");
  await expect(page.getByText("สรุปภาระงานย้อนหลัง 24 ชั่วโมง")).toBeVisible();
  await expect(page.getByText("รายการเข้าใหม่")).toBeVisible();
  await page.getByRole("button", { name: "งานด่วน" }).click();
  await expect(page.locator("#moderation-results .moderation-card").first()).toContainText("รายงานสื่อ");
  await expect(page.locator("#moderation-results").getByText("วิกฤต", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "รายงานผู้ใช้" }).click();
  await expect(page.getByText("มีข้อความข่มขู่ที่ต้องประเมิน")).toBeVisible();
  await page.getByRole("button", { name: "รอตรวจ" }).click();
  await expect(page.getByText("<img src=x onerror=alert(1)>")).toBeVisible();
  await expect(page.locator("#moderation-results img")).toHaveCount(0);
  await page.getByRole("button", { name: "เปิดรูปในพื้นที่ตรวจสอบ" }).click();
  await expect(page.getByRole("dialog").getByRole("img")).toBeVisible();
  await page.getByRole("button", { name: "ปิด", exact: true }).click();
  await page.getByLabel("หมวดหมู่ของ media-1").selectOption("sensitive");
  page.once("dialog", (dialog) => dialog.accept("จัดเป็นเนื้อหาละเอียดอ่อนสำหรับการทดสอบ"));
  await page.getByRole("button", { name: "อนุมัติ", exact: true }).click();
  await expect.poll(() => decisions.length).toBe(1);
  expect(decisions[0]).toEqual({ id: "media-1", status: "released", category: "sensitive", reason: "จัดเป็นเนื้อหาละเอียดอ่อนสำหรับการทดสอบ", revision: 0 });
  await page.screenshot({ path: resolve(screenshotDirectory, testInfo.project.name.includes("mobile") ? "moderation-mobile.png" : "moderation-desktop.png"), fullPage: true });
});
