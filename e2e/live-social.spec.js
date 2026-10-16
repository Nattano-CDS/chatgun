import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const sessionFile = process.env.STAGING_SESSION_FILE;
test.skip(!sessionFile, "requires an explicitly generated staging session bundle");
const bundle = sessionFile ? JSON.parse(readFileSync(sessionFile, "utf8")) : null;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

function pngWithMetadata() {
  const iend = PNG.length - 12;
  const text = Buffer.from("Location\0synthetic-staging-only");
  const chunk = Buffer.alloc(12 + text.length);
  chunk.writeUInt32BE(text.length, 0);
  chunk.write("tEXt", 4, "ascii");
  text.copy(chunk, 8);
  return Buffer.concat([PNG.subarray(0, iend), chunk, PNG.subarray(iend)]);
}

function member(id) {
  return bundle.members.find((item) => item.id === id);
}

async function authenticate(context, baseURL, account) {
  const url = new URL(baseURL);
  await context.addCookies([
    { name: "__Host-cg_session", value: account.token, domain: url.hostname, path: "/", secure: true, httpOnly: true, sameSite: "Lax" },
    { name: "__Host-cg_csrf", value: account.csrf, domain: url.hostname, path: "/", secure: true, httpOnly: false, sameSite: "Lax" },
  ]);
}

async function mutate(request, baseURL, account, path, data) {
  return request.post(`${baseURL}${path}`, {
    headers: {
      cookie: `__Host-cg_session=${account.token}; __Host-cg_csrf=${account.csrf}`,
      origin: baseURL,
      "x-csrf-token": account.csrf,
      "content-type": "application/json",
    },
    data,
  });
}

async function read(request, baseURL, account, path) {
  return request.get(`${baseURL}${path}`, { headers: { cookie: `__Host-cg_session=${account.token}` } });
}

async function upload(request, baseURL, account, path, multipart) {
  return request.post(`${baseURL}${path}`, {
    headers: {
      cookie: `__Host-cg_session=${account.token}; __Host-cg_csrf=${account.csrf}`,
      origin: baseURL,
      "x-csrf-token": account.csrf,
    },
    multipart,
  });
}

test.describe.configure({ mode: "serial" });

test("staging social APIs persist positive and negative non-media workflows", async ({ request, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "run staging mutations once");
  expect(bundle.accountId).toBe("23017b53386fb67fc62a52cdd017454c");
  const alice = member("cg-stage-alice");
  const bob = member("cg-stage-bob");
  const charlie = member("cg-stage-charlie");

  const config = await (await request.get(`${baseURL}/api/social/config`)).json();
  expect(config).toMatchObject({ socialAppEnabled: true, publicDiscoveryEnabled: true, friendRequestsEnabled: true, messagingEnabled: true, mediaUploadEnabled: true, ratingsEnabled: true, identityVerificationEnabled: false, gameEnabled: false, emailOtpEnabled: false, mobileOtpEnabled: false });

  for (const [account, latitude, longitude] of [[alice, 13.75630, 100.50180], [bob, 13.75655, 100.50195], [charlie, 13.76000, 100.50400]]) {
    const refreshLocation = await mutate(request, baseURL, account, "/api/social/discovery", { action: "location", latitude, longitude, accuracy: 5 });
    expect(refreshLocation.status()).toBe(200);
  }
  const discovery = await read(request, baseURL, alice, "/api/social/discovery");
  expect(discovery.status()).toBe(200);
  expect((await discovery.json()).people.map((person) => person.user_id)).toEqual(expect.arrayContaining([bob.id, charlie.id]));
  const inaccurateLocation = await mutate(request, baseURL, alice, "/api/social/discovery", { action: "location", latitude: 13.75630, longitude: 100.50180, accuracy: 51 });
  expect(inaccurateLocation.status()).toBe(400);
  expect((await inaccurateLocation.json()).code).toBe("location_inaccurate");

  const profileEdit = await mutate(request, baseURL, alice, "/api/social/profile", { action: "edit", name: "อลิซ ทดสอบอัปเดต", gender: "ไม่ระบุ", bio: "บัญชีสังเคราะห์สำหรับทดสอบ staging", interests: "ทดสอบ, ความปลอดภัย" });
  expect(profileEdit.status()).toBe(200);
  expect((await profileEdit.json()).profile.name).toBe("อลิซ ทดสอบอัปเดต");
  const invalidProfile = await mutate(request, baseURL, alice, "/api/social/profile", { action: "edit", name: "", gender: "ไม่ระบุ", bio: "", interests: "" });
  expect(invalidProfile.status()).toBe(400);

  const requestFriend = await mutate(request, baseURL, alice, "/api/social/relationships", { action: "request", target: bob.id });
  expect(requestFriend.status()).toBe(200);
  const duplicateFriend = await mutate(request, baseURL, alice, "/api/social/relationships", { action: "request", target: bob.id });
  expect(duplicateFriend.status()).toBe(409);
  expect((await duplicateFriend.json()).code).toBe("relationship_exists");
  const acceptFriend = await mutate(request, baseURL, bob, "/api/social/relationships", { action: "accept", target: alice.id });
  expect(acceptFriend.status()).toBe(200);
  const friendships = await read(request, baseURL, alice, "/api/social/relationships");
  expect((await friendships.json()).relationships.some((item) => item.other_user_id === bob.id && item.status === "accepted")).toBe(true);

  const sendMessage = await mutate(request, baseURL, alice, "/api/social/messages", { action: "send", target: bob.id, body: "ข้อความสังเคราะห์สำหรับ staging" });
  expect(sendMessage.status()).toBe(200);
  const thread = await read(request, baseURL, bob, `/api/social/messages?target=${alice.id}`);
  expect(thread.status()).toBe(200);
  expect((await thread.json()).messages.some((message) => message.body === "ข้อความสังเคราะห์สำหรับ staging")).toBe(true);
  const nonFriendMessage = await mutate(request, baseURL, alice, "/api/social/messages", { action: "send", target: charlie.id, body: "ต้องถูกปฏิเสธ" });
  expect(nonFriendMessage.status()).toBe(403);
  expect((await nonFriendMessage.json()).code).toBe("not_friends");

  const rating = await mutate(request, baseURL, alice, "/api/social/ratings", { target: bob.id, score: 5, comment: "สุภาพและเป็นมิตร" });
  expect(rating.status()).toBe(201);
  const duplicateRating = await mutate(request, baseURL, alice, "/api/social/ratings", { target: bob.id, score: 4, comment: "ซ้ำ" });
  expect(duplicateRating.status()).toBe(409);
  const ratings = await read(request, baseURL, bob, "/api/social/ratings");
  expect((await ratings.json()).ratings.some((item) => item.comment === "สุภาพและเป็นมิตร")).toBe(true);

  const report = await mutate(request, baseURL, alice, "/api/social/reports", { target: charlie.id, category: "spam", details: "รายงานสังเคราะห์เพื่อทดสอบ staging" });
  expect(report.status()).toBe(201);
  const invalidReport = await mutate(request, baseURL, alice, "/api/social/reports", { target: charlie.id, category: "not-a-category", details: "ต้องถูกปฏิเสธ" });
  expect(invalidReport.status()).toBe(400);

  const block = await mutate(request, baseURL, alice, "/api/social/blocks", { action: "block", target: bob.id });
  expect(block.status()).toBe(200);
  const blockedMessage = await mutate(request, baseURL, bob, "/api/social/messages", { action: "send", target: alice.id, body: "ต้องถูกบล็อก" });
  expect(blockedMessage.status()).toBe(403);
  const blocked = await read(request, baseURL, alice, "/api/social/blocks");
  expect((await blocked.json()).blocked.map((item) => item.user_id)).toContain(bob.id);
  const unblock = await mutate(request, baseURL, alice, "/api/social/blocks", { action: "unblock", target: bob.id });
  expect(unblock.status()).toBe(200);
  expect((await mutate(request, baseURL, alice, "/api/social/relationships", { action: "request", target: bob.id })).status()).toBe(200);
  expect((await mutate(request, baseURL, bob, "/api/social/relationships", { action: "accept", target: alice.id })).status()).toBe(200);
  expect((await mutate(request, baseURL, alice, "/api/social/profile", { action: "edit", name: "อลิซ ทดสอบ", gender: "ไม่ระบุ", bio: "บัญชีสังเคราะห์สำหรับทดสอบ staging", interests: "ทดสอบ, ความปลอดภัย" })).status()).toBe(200);

  const missingCsrf = await request.post(`${baseURL}/api/social/messages`, {
    headers: { cookie: `__Host-cg_session=${alice.token}; __Host-cg_csrf=${alice.csrf}`, origin: baseURL, "content-type": "application/json" },
    data: { action: "send", target: bob.id, body: "ต้องถูกปฏิเสธเพราะไม่มี CSRF" },
  });
  expect(missingCsrf.status()).toBe(403);
  expect((await missingCsrf.json()).code).toBe("invalid_csrf");
});

test("staging R2 gallery and chat media remain private and relationship-authorized", async ({ request, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "run staging mutations once");
  const alice = member("cg-stage-alice");
  const bob = member("cg-stage-bob");
  const charlie = member("cg-stage-charlie");

  const galleryUpload = await upload(request, baseURL, alice, "/api/social/gallery", {
    file: { name: "private.png", mimeType: "image/png", buffer: pngWithMetadata() },
    caption: "รูปสังเคราะห์ส่วนตัว",
  });
  expect(galleryUpload.status()).toBe(201);
  const galleryId = (await galleryUpload.json()).id;
  const anonymous = await request.get(`${baseURL}/api/social/media/${galleryId}`);
  expect(anonymous.status()).toBe(401);
  const ownerRead = await read(request, baseURL, alice, `/api/social/media/${galleryId}`);
  expect(ownerRead.status()).toBe(200);
  expect(ownerRead.headers()["cache-control"]).toContain("private, no-store");
  expect((await ownerRead.body()).includes(Buffer.from("synthetic-staging-only"))).toBe(false);
  const friendRead = await read(request, baseURL, bob, `/api/social/media/${galleryId}`);
  expect(friendRead.status()).toBe(200);
  expect((await mutate(request, baseURL, alice, "/api/social/gallery", { action: "select", id: galleryId })).status()).toBe(200);
  expect((await mutate(request, baseURL, bob, "/api/social/gallery", { action: "like", id: galleryId })).status()).toBe(200);
  expect((await mutate(request, baseURL, bob, "/api/social/gallery", { action: "comment", id: galleryId, comment: "ความคิดเห็นสังเคราะห์" })).status()).toBe(200);
  const friendGallery = await read(request, baseURL, bob, `/api/social/gallery?user=${alice.id}&photo=${galleryId}`);
  const friendGalleryData = await friendGallery.json();
  expect(friendGalleryData.photos.find((photo) => photo.id === galleryId)).toMatchObject({ selected: 1, liked: 1, like_count: 1 });
  expect(friendGalleryData.comments.map((comment) => comment.body)).toContain("ความคิดเห็นสังเคราะห์");
  const forbiddenDelete = await mutate(request, baseURL, bob, "/api/social/gallery", { action: "delete", id: galleryId });
  expect(forbiddenDelete.status()).toBe(403);

  const spoofed = await upload(request, baseURL, alice, "/api/social/gallery", {
    file: { name: "spoofed.png", mimeType: "image/png", buffer: Buffer.alloc(64) },
    caption: "ต้องถูกปฏิเสธ",
  });
  expect(spoofed.status()).toBe(400);
  expect((await spoofed.json()).code).toBe("invalid_image");

  const chatUpload = await upload(request, baseURL, alice, "/api/social/messages", {
    target: bob.id,
    file: { name: "chat.png", mimeType: "image/png", buffer: PNG },
  });
  expect(chatUpload.status()).toBe(201);
  const chatUploadResult = await chatUpload.json();
  const chatMessage = await read(request, baseURL, bob, `/api/social/messages?target=${alice.id}`);
  const uploadedMessage = (await chatMessage.json()).messages.find((message) => message.id === chatUploadResult.messageId);
  expect(uploadedMessage.media_id).toBeTruthy();
  expect((await read(request, baseURL, bob, `/api/social/chat/media/${uploadedMessage.media_id}`)).status()).toBe(200);
  expect((await read(request, baseURL, charlie, `/api/social/chat/media/${uploadedMessage.media_id}`)).status()).toBe(404);

  expect((await mutate(request, baseURL, alice, "/api/social/blocks", { action: "block", target: bob.id })).status()).toBe(200);
  expect((await read(request, baseURL, bob, `/api/social/chat/media/${uploadedMessage.media_id}`)).status()).toBe(404);
  expect((await read(request, baseURL, bob, `/api/social/media/${galleryId}`)).status()).toBe(404);
  expect((await mutate(request, baseURL, alice, "/api/social/blocks", { action: "unblock", target: bob.id })).status()).toBe(200);
  expect((await mutate(request, baseURL, alice, "/api/social/relationships", { action: "request", target: bob.id })).status()).toBe(200);
  expect((await mutate(request, baseURL, bob, "/api/social/relationships", { action: "accept", target: alice.id })).status()).toBe(200);

  const removed = await mutate(request, baseURL, alice, "/api/social/gallery", { action: "delete", id: galleryId });
  expect(removed.status()).toBe(200);
  expect((await removed.json()).mediaDeletionPending).toBe(true);
  expect((await read(request, baseURL, alice, `/api/social/media/${galleryId}`)).status()).toBe(404);
});

test("desktop and mobile render persisted staging profile, discovery, notifications, and reviews", async ({ page, context, baseURL }, testInfo) => {
  test.setTimeout(60_000);
  const bob = member("cg-stage-bob");
  await authenticate(context, baseURL, bob);
  await page.addInitScript(() => {
    class StagingNotification {
      static permission = "granted";
      static async requestPermission() { return "granted"; }
    }
    Object.defineProperty(window, "Notification", { value: StagingNotification, configurable: true });
  });
  await page.goto("/app/");
  await expect(page.getByRole("heading", { name: "คนใกล้คุณ" })).toBeVisible();
  await expect(page.locator("#people-grid").getByText("อลิซ ทดสอบ")).toBeVisible();
  await page.locator("#people-search").fill("อลิซ");
  await expect(page.locator("#people-grid").getByText("ชาร์ลี ทดสอบ")).toHaveCount(0);
  await page.locator("#people-search").fill("");
  await page.locator("#radius-filter").selectOption("250");
  await expect(page.locator("#people-grid").getByText("อลิซ ทดสอบ")).toBeVisible();
  await expect(page.locator("#people-grid").getByText("ชาร์ลี ทดสอบ")).toHaveCount(0);
  await page.locator("#radius-filter").selectOption("5000");
  await page.locator("#people-grid").getByText("อลิซ ทดสอบ").click();
  await expect(page.locator("#profile-dialog").getByRole("heading", { name: "อลิซ ทดสอบ" })).toBeVisible();
  await page.locator("#profile-dialog .dialog-close").click();
  await page.locator('#primary-nav button[data-tab="friends"]').click();
  await expect(page.locator("#friends-grid").getByText("อลิซ ทดสอบ")).toBeVisible();
  await page.locator('#primary-nav button[data-tab="chat"]').click();
  await expect(page.locator("#conversation-list").getByText("ส่งรูปภาพ", { exact: true })).toBeVisible();
  await page.locator('#primary-nav button[data-tab="reviews"]').click();
  await expect(page.locator("#reviews-list").getByText("สุภาพและเป็นมิตร")).toBeVisible();
  await page.locator('#primary-nav button[data-tab="profile"]').click();
  await expect(page.locator('#profile-form input[name="name"]')).toHaveValue("บ็อบ ทดสอบ");
  await page.locator('#gallery-upload input[type="file"]').setInputFiles({ name: "browser.png", mimeType: "image/png", buffer: PNG });
  await page.locator('#gallery-upload input[name="caption"]').fill("รูปจากเบราว์เซอร์ staging");
  await page.locator("#gallery-upload").getByRole("button", { name: "อัปโหลดรูป" }).click();
  await expect(page.locator("#my-gallery img")).toBeVisible();
  await page.getByRole("button", { name: "เปิดการแจ้งเตือนข้อความในอุปกรณ์นี้" }).click();
  await expect(page.getByRole("button", { name: "ปิดการแจ้งเตือนข้อความในอุปกรณ์นี้" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("chatgun-notifications"))).toBe("enabled");
  await expect(page.getByRole("button", { name: "เกม" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath(`live-social-${testInfo.project.name}.png`), fullPage: true });
});

test("synthetic account deletion queues owned R2 media and revokes access", async ({ request, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "run destructive synthetic staging check once");
  const charlie = member("cg-stage-charlie");
  const uploaded = await upload(request, baseURL, charlie, "/api/social/gallery", {
    file: { name: "delete-me.png", mimeType: "image/png", buffer: PNG },
    caption: "ลบพร้อมบัญชีสังเคราะห์",
  });
  expect(uploaded.status()).toBe(201);
  const mediaId = (await uploaded.json()).id;
  const requested = await mutate(request, baseURL, charlie, "/api/auth/account-deletion/request", { acknowledged: true });
  expect(requested.status()).toBe(200);
  const deletion = await requested.json();
  const confirmed = await mutate(request, baseURL, charlie, "/api/auth/account-deletion/confirm", {
    requestId: deletion.requestId,
    confirmationToken: deletion.confirmationToken,
    confirmText: "ลบบัญชีถาวร",
  });
  expect(confirmed.status()).toBe(200);
  const result = await confirmed.json();
  expect(result.accountAccessRevoked).toBe(true);
  expect(result.mediaDeletionPending).toBeGreaterThanOrEqual(1);
  expect((await read(request, baseURL, charlie, `/api/social/media/${mediaId}`)).status()).toBe(401);
});
