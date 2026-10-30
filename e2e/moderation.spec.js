import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const screenshotDirectory = resolve("test-results/screenshots");
const overviewRequests = [];
test.beforeAll(() => mkdirSync(screenshotDirectory, { recursive: true }));
test.beforeEach(() => { overviewRequests.length = 0; });

test.beforeEach(async ({ page }) => {
  await page.route('**/api/social/config',route=>route.fulfill({json:{socialAppEnabled:true,moderationToolsEnabled:true,accountModerationEnabled:false,adminAccessStandaloneEnabled:false}}));
  await page.route("**/api/social/moderation/**", async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname === "/api/social/moderation/capabilities") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ canReviewReports: true, canReviewMedia: true, canReviewEligibility: false, canInspectMembers: false, canManageRoles: false, canModerateAccounts: false }) });
    }
    if (url.pathname === "/api/social/moderation/overview") {
      overviewRequests.push(request.headers());
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        counts: { pending: 1, general: 8, sensitive: 2, rejected: 3, reports: 2, userReports: 1, mediaReports: 1, appeals: 1, critical: 1, high: 1 },
        coverage: { timezone: "Asia/Bangkok", start: "19:00", end: "22:00", days: "every_day", weeklyHours: 21, isOpen: false, reportingAlwaysAvailable: true, immediateResponseGuaranteed: false },
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

test('standalone Cloudflare Admin bootstrap uses its own namespace and CSRF without member login', async ({page}, testInfo) => {
  let active=false;
  await page.route('**/api/social/config',r=>r.fulfill({json:{socialAppEnabled:true,moderationToolsEnabled:true,accountModerationEnabled:false,adminAccessStandaloneEnabled:true}}));
  await page.route('**/api/admin/**',async r=>{
    const url=new URL(r.request().url());
    if(url.pathname==='/api/admin/session'){
      if(r.request().method()==='POST'){
        expect(r.request().headers()['x-cg-admin-csrf']).toBe('local-ui-start-challenge');
        expect(r.request().postDataJSON()).toEqual({action:'start'});active=true;
      }
      return r.fulfill({json:{authentication:'cloudflare_access',authenticated:active,csrfToken:active?'local-ui-action-challenge':'local-ui-start-challenge'}});
    }
    expect(active).toBe(true);
    if(url.pathname==='/api/admin/overview')return r.fulfill({json:{counts:{pending:0,reports:0,appeals:0},daily:{newLast24Hours:0,resolvedLast24Hours:0},cleanup:{pending:0,exhausted:0},coverage:{start:'19:00',end:'22:00',timezone:'Asia/Bangkok'}}});
    if(url.pathname==='/api/admin/capabilities')return r.fulfill({json:{canReviewReports:true,canReviewMedia:true,canModerateAccounts:false}});
    return r.fulfill({status:404,json:{message:'Not a local UI fixture route'}});
  });
  await page.goto('/app/moderation.html');
  await expect(page.locator('#moderation-status')).toContainText('โหลดข้อมูลเรียบร้อยแล้ว');
  await expect(page.locator('#admin-access-logout')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:resolve(screenshotDirectory,`admin-access-standalone-${testInfo.project.name}.png`),fullPage:true});
});

test('standalone least-privilege role administrator opens role management without report or media access', async ({page}) => {
  let active=false, overviewCalls=0, rolePurpose='';
  await page.route('**/api/social/config',r=>r.fulfill({json:{socialAppEnabled:true,moderationToolsEnabled:true,accountModerationEnabled:false,adminAccessStandaloneEnabled:true}}));
  await page.route('**/api/admin/**',async r=>{
    const url=new URL(r.request().url());
    if(url.pathname==='/api/admin/session'){
      if(r.request().method()==='POST')active=true;
      return r.fulfill({json:{authentication:'cloudflare_access',authenticated:active,csrfToken:'local-role-admin-challenge'}});
    }
    expect(active).toBe(true);
    if(url.pathname==='/api/admin/capabilities')return r.fulfill({json:{canReviewReports:false,canReviewMedia:false,canReviewEligibility:false,canInspectMembers:false,canManageRoles:true,canModerateAccounts:false}});
    if(url.pathname==='/api/admin/overview'){overviewCalls+=1;return r.fulfill({status:403,json:{message:'Role administrator cannot inspect moderation overview'}});}
    if(url.pathname==='/api/admin/roles'){
      rolePurpose=decodeURIComponent(r.request().headers()['x-moderation-purpose']||'');
      return r.fulfill({json:{grants:[],events:[]}});
    }
    return r.fulfill({status:404,json:{message:'Not a local role-admin fixture route'}});
  });
  page.once('dialog',dialog=>dialog.accept('Review approved administrator role grants'));
  await page.goto('/app/moderation.html');
  await expect(page.locator('#moderation-status')).toContainText('โหลดข้อมูลเรียบร้อยแล้ว');
  await expect(page.getByRole('button',{name:'สิทธิ์ผู้ดูแล'})).toBeVisible();
  await expect(page.getByRole('button',{name:'รายงานผู้ใช้'})).toBeHidden();
  await expect(page.getByRole('button',{name:'รอตรวจ'})).toBeHidden();
  await expect(page.getByRole('button',{name:'ให้สิทธิ์ที่มีวันหมดอายุ'})).toBeVisible();
  expect(overviewCalls).toBe(0);
  expect(rolePurpose).toBe('Review approved administrator role grants');
});

test("admin dashboard opens routine overview automatically and requires justification for restricted evidence", async ({ page }, testInfo) => {
  const decisions = [];
  page.on("request", (request) => { if (request.url().endsWith("/api/social/moderation/media") && request.method() === "POST") decisions.push(request.postDataJSON()); });
  await page.goto("/app/moderation.html");
  await expect(page).toHaveTitle("ศูนย์ดูแลสื่อ · ChatGun");
  await expect(page.locator("#moderation-stats")).toContainText("รายงานผู้ใช้");
  await expect(page.getByLabel("วัตถุประสงค์เฉพาะกรณี")).toHaveCount(0);
  expect(overviewRequests).toHaveLength(1);
  expect(overviewRequests[0]["x-moderation-purpose"]).toBeUndefined();
  await expect(page.locator("#moderation-stats")).toContainText("สื่อรอตรวจ");
  await expect(page.getByText("สรุปภาระงานย้อนหลัง 24 ชั่วโมง")).toBeVisible();
  await expect(page.getByText(/ทุกวัน 19:00–22:00 น. Asia\/Bangkok/)).toBeVisible();
  await expect(page.getByText(/ระบบยังรับรายงานตลอด 24 ชั่วโมง/)).toBeVisible();
  await expect(page.getByText("รายการเข้าใหม่")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept("ตรวจสอบคิวและหลักฐานสังเคราะห์สำหรับ QA"));
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
