import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/social/moderation/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/social/moderation/reports" && request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reports: [{
        id: "report-1", category: "harassment", details: "<img src=x onerror=alert(1)>", status: "pending",
        created_at: 1_790_000_000, reporter_name: "ผู้รายงาน", subject_name: "ผู้ถูกรายงาน", subject_user_id: "subject-1",
      }] }) });
    }
    if (url.pathname === "/api/social/moderation/reports" && request.method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "ไม่พบ" }) });
  });
});

test("moderation queue requires purpose and safely renders report details", async ({ page }) => {
  await page.goto("/app/moderation.html");
  await page.getByRole("button", { name: "รายงาน" }).click();
  await expect(page.getByRole("status")).toContainText("อย่างน้อย 10 ตัวอักษร");
  await page.getByLabel("วัตถุประสงค์เฉพาะกรณี").fill("ตรวจสอบรายงานความปลอดภัยหมายเลข report-1");
  await page.getByRole("button", { name: "รายงาน" }).click();
  await expect(page.getByText("<img src=x onerror=alert(1)>")).toBeVisible();
  await expect(page.locator("#moderation-results img")).toHaveCount(0);
  const captured = [];
  page.on("request", (request) => { if (request.url().includes("/api/social/moderation/reports")) captured.push(request); });
  page.once("dialog", (dialog) => dialog.accept("ตรวจสอบหลักฐานตามรายงานแล้ว"));
  await page.getByRole("button", { name: "ตรวจแล้ว" }).click();
  await expect(page.getByRole("status")).toContainText("โหลดข้อมูล reports แล้ว");
  expect(captured.some((request) => decodeURIComponent(request.headers()["x-moderation-purpose"] || "").includes("report-1"))).toBeTruthy();
});
