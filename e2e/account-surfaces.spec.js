import { expect,test } from "@playwright/test";
import {mkdirSync} from "node:fs";
import {resolve} from "node:path";
const config={socialAppEnabled:true,adultOnboardingEnabled:true,demoModeEnabled:false};
for(const width of [390,768,1440])test(`account and protected Admin visual fixtures at ${width}px`,async({page},info)=>{
  test.skip(info.project.name!=="desktop-chromium","explicit viewports run once");test.setTimeout(60000);
  await page.setViewportSize({width,height:width===390?844:width===768?1024:1100});
  const directory=resolve("docs/final-owner-review/after");mkdirSync(directory,{recursive:true});
  const shot=async(name)=>{await page.screenshot({path:resolve(directory,`${name}-${width}.png`),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);};
  await page.goto("/signup");await expect(page.locator(".providers button")).toHaveCount(3);await shot("login");
  for(const legal of ["privacy","terms","data-deletion"]){await page.goto(`/${legal}`);await expect(page.locator("h1")).toBeVisible();await shot(`legal-${legal}-draft`);}
  await page.route("**/api/auth/acceptance",r=>r.fulfill({json:{nextPath:"/acceptance",required:true,accepted:false,accountState:"pending_acceptance",versions:{adultNotice:"fixture-adult-v1",terms:"fixture-terms-v1",privacy:"fixture-privacy-v1"}}}));
  await page.goto("/acceptance");await expect(page.locator("#adult-confirmation")).not.toBeChecked();await expect(page.locator("#policy-confirmation")).not.toBeChecked();await shot("acceptance");
  await page.route("**/api/social/config",r=>r.fulfill({json:config}));
  await page.route("**/api/auth/me",r=>r.fulfill({json:{user:{id:"visual-owner",displayName:"สมาชิกตัวอย่าง"},providers:["google"],nextPath:"/app/?onboarding=1",recentlyAuthenticated:true}}));
  await page.goto("/app/?onboarding=1");await expect(page.locator("#onboarding-view")).toBeVisible();await shot("onboarding");
  await page.route("**/api/auth/me",r=>r.fulfill({json:{user:{id:"visual-owner",displayName:"สมาชิกตัวอย่าง"},providers:["google"],nextPath:"/app/",canLinkAccounts:true,recentlyAuthenticated:true}}));
  await page.goto("/account");await expect(page.locator("#deletion")).toBeVisible();await shot("account-deletion");
  await page.route("**/api/social/moderation/overview",r=>r.fulfill({json:{counts:{pending:2,general:8,sensitive:0,rejected:1,userReports:5,mediaReports:1,appeals:1,critical:1,high:2},coverage:{timezone:"Asia/Bangkok",start:"19:00",end:"22:00",days:"every_day",weeklyHours:21,isOpen:false,reportingAlwaysAvailable:true,immediateResponseGuaranteed:false},daily:{newLast24Hours:4,resolvedLast24Hours:2,oldestOpenAt:1790000000},cleanup:{pending:0,exhausted:0}}}));
  await page.route("**/api/social/moderation/media?*",r=>r.fulfill({json:{media:[{media_id:"fixture-review-only",status:"pending",category:null,source:"manual",reason:"",revision:0,created_at:1790000000,media_purpose:"gallery",content_type:"image/png",byte_size:1024,owner_name:"ตัวละครสมมติ",report_count:1}],page:1,hasMore:false}}));
  await page.goto("/app/moderation.html");await expect(page.locator("#moderation-stats")).toContainText("สื่อรอตรวจ");await shot("admin-overview-fixture");
  page.once("dialog",d=>d.accept("ทบทวนภาพตัวอย่างสำหรับ QA"));await page.getByRole("button",{name:"รอตรวจ",exact:true}).click();await expect(page.locator(".moderation-card")).toHaveCount(1);await shot("admin-queue-fixture");
});
