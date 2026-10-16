import {expect,test} from "@playwright/test";
import {readFileSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
const bundle=process.env.STAGING_READONLY_SESSION_FILE?JSON.parse(readFileSync(process.env.STAGING_READONLY_SESSION_FILE,"utf8")):null;
test("preserved staging batch and private media remain accessible only to authorized sessions",async({page,context,request,baseURL},info)=>{
  test.skip(!bundle||info.project.name!=="desktop-chromium","explicit read-only synthetic session required; run once");test.setTimeout(60000);
  expect(new URL(baseURL).hostname).toBe("codex-chatgun-release-candid.chatgun.pages.dev");
  expect(bundle.accountId).toBe("23017b53386fb67fc62a52cdd017454c");expect(bundle.batchId).toBe("chatgun-owner-review-v1");
  const viewer=bundle.members.find(m=>m.id==="cg-syn-v1-01");
  await context.addCookies([{name:"__Host-cg_session",value:viewer.token,domain:new URL(baseURL).hostname,path:"/",secure:true,httpOnly:true,sameSite:"Lax"},{name:"__Host-cg_csrf",value:viewer.csrf,domain:new URL(baseURL).hostname,path:"/",secure:true,sameSite:"Lax"}]);
  const get=async(path)=>{const r=await context.request.get(baseURL+path);expect(r.status()).toBe(200);return r.json();};
  const relationships=(await get("/api/social/relationships")).relationships;
  const friends=relationships.filter(p=>p.status==="accepted");expect(friends).toHaveLength(10);expect(relationships.filter(p=>p.status==="pending")).toHaveLength(5);
  let messages=0;for(const friend of friends)messages+=(await get(`/api/social/messages?target=${friend.other_user_id}`)).messages.length;expect(messages).toBe(120);
  expect((await get("/api/social/ratings")).ratings).toHaveLength(15);
  const photos=(await get("/api/social/gallery?user=cg-syn-v1-02")).photos;expect(photos.length).toBeGreaterThan(0);
  const path=`/api/social/media/${encodeURIComponent(photos[0].id)}`;
  expect((await context.request.get(baseURL+path)).status()).toBe(200);expect([401,403,404]).toContain((await request.get(baseURL+path)).status());
  const directory=resolve("docs/final-owner-review/staging-authorized");mkdirSync(directory,{recursive:true});
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:width===390?844:width===768?1024:1100});await page.goto("/app/people/cg-syn-v1-02");await expect(page.locator(".member-profile-view")).toBeVisible();await expect(page.locator(".member-profile-image img")).toBeVisible();await page.screenshot({path:resolve(directory,`member-profile-${width}.png`),fullPage:true});}
});
