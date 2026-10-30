import { expect, test } from "@playwright/test";

const config = {
  socialAppEnabled: true,
  adultOnboardingEnabled: true,
  adultNoticeVersion: "adult-preview-v1",
  publicDiscoveryEnabled: true,
  friendRequestsEnabled: false,
  messagingEnabled: true,
  mediaUploadEnabled: false,
  ratingsEnabled: true,
  identityVerificationEnabled: false,
  demoModeEnabled: false,
  gameEnabled: false,
  emailOtpEnabled: false,
  mobileOtpEnabled: false,
};

async function mockSocialApi(page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/social/messages") {
      const body = route.request().method() === "GET" ? { messages: [
        { id: "message-1", sender_user_id: "friend-1", receiver_user_id: "me", body: "สวัสดี ยินดีที่ได้รู้จัก", media_id: null, unsent_at: null, read_at: null, created_at: 1_790_000_100 },
      ], hasMore: false } : { ok: true };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    }
    const responses = {
      "/api/social/config": config,
      "/api/auth/me": { user: { id: "me", displayName: "นัท" }, providers: ["google"], recentlyAuthenticated: true },
      "/api/social/profile": { profile: { user_id: "me", name: "นัท", gender: "ไม่ระบุ", bio: "ชอบทำความรู้จักเพื่อนใหม่", interests: "กาแฟ, เทคโนโลยี", discovery_visible: 1 } },
      "/api/social/discovery": { locationFresh: true, people: [
        { user_id: "near-1", name: "มิน", gender: "หญิง", bio: "ชอบคาเฟ่และถ่ายรูป", interests: "กาแฟ, ถ่ายรูป", distance: 82, rating: 4.8, rating_count: 12 },
        { user_id: "near-2", name: "ต้น", gender: "ชาย", bio: "วิ่งและท่องเที่ยว", interests: "วิ่ง, ท่องเที่ยว", distance: 640, rating: 4.5, rating_count: 6 },
      ] },
      "/api/social/conversations": { conversations: [
        { id: "r1", other_user_id: "friend-1", requested_by: "friend-1", status: "accepted", name: "พลอย", gender: "หญิง", bio: "เพื่อนใน ChatGun", last_message_at: 1_790_000_100, last_message_body: "เจอกันที่คาเฟ่", last_message_sender_id: "me", unread_count: 0 },
      ] },
      "/api/social/ratings": { ratings: [{ id: "v1", score: 5, comment: "สุภาพและเป็นมิตร", sender_name: "พลอย", created_at: 1_790_000_000 }] },
      "/api/social/blocks": { blocked: [] },
      "/api/social/gallery": { photos: [], comments: [], owner: "me" },
      "/api/social/media/appeals": { appeals: [], appealable: [] },
      "/api/social/moderation/notifications": { notifications: [] },
    };
    const body = responses[url.pathname];
    await route.fulfill({ status: body ? 200 : 404, contentType: "application/json", body: JSON.stringify(body || { code: "not_found", error: "ไม่พบ" }) });
  });
}

async function enableMedia(page) {
  await page.route("**/api/social/config", (route) => route.fulfill({ json: { ...config, mediaUploadEnabled: true } }));
}

test.beforeEach(async ({ page }) => {
  await mockSocialApi(page);
});

test('restricted public account reaches account privacy/deletion and appeal controls instead of a retry dead end',async({page})=>{
 await page.route('**/api/social/profile',r=>r.fulfill({status:403,json:{code:'account_access_restricted',message:'บัญชีถูกระงับสิทธิ์'}}));
 await page.route('**/api/social/config',r=>r.fulfill({json:{...config,accountModerationEnabled:true}}));
 await page.goto('/app/');await expect(page).toHaveURL(/\/account(?:\.html)?\?access=restricted$/);
 await expect(page.locator('#account-appeals-link')).toBeVisible();
 await expect(page.locator('#account-appeals-link')).toHaveAttribute('href','/app/appeals.html');
 await expect(page.locator('#deletion')).toBeVisible();await expect(page.locator('#logout')).toBeVisible();
});

test('authenticated chat deep link opens the actual inbox immediately',async({page})=>{
  await page.goto('/?tab=chat');await expect(page.locator('#chat-tab')).toBeVisible();
  await expect(page.locator('#near-tab')).not.toBeVisible();await expect(page.locator('[data-chat="friend-1"]')).toBeVisible();
});

test('chat timeline stays chronological and preserves intentional reading position', async ({ page }) => {
  await page.clock.install();
  const makeMessage = (id, createdAt, body, sender = 'friend-1') => ({ id, sender_user_id: sender, receiver_user_id: sender === 'me' ? 'friend-1' : 'me', body, media_id: null, unsent_at: null, read_at: null, created_at: createdAt });
  const recent = Array.from({ length: 22 }, (_, index) => makeMessage(`recent-${String(index).padStart(2, '0')}`, 200 + index, `recent ${index}`));
  recent.push(makeMessage('same-b', 222, 'same timestamp B'), makeMessage('same-a', 222, 'same timestamp A'));
  const older = Array.from({ length: 8 }, (_, index) => makeMessage(`older-${String(index).padStart(2, '0')}`, 100 + index, `older ${index}`));
  await page.route('**/api/social/messages*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === 'GET') return route.fulfill({ json: { messages: url.searchParams.has('before') ? older.slice().reverse() : recent.slice().reverse(), hasMore: !url.searchParams.has('before') } });
    const body = request.postDataJSON();
    if (body.action === 'send') recent.push(makeMessage(`sent-${recent.length}`, 300 + recent.length, body.body, 'me'));
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/app/?tab=chat');
  await page.locator('[data-chat="friend-1"]').click();
  const host = page.locator('#thread .messages'), timeline = host.locator('[data-timeline-key]');
  await expect(timeline).toHaveCount(24);
  expect(await timeline.evaluateAll(nodes => nodes.map(node => node.dataset.timelineKey))).toEqual([
    ...Array.from({ length: 22 }, (_, index) => `message:recent-${String(index).padStart(2, '0')}`),
    'message:same-a', 'message:same-b',
  ]);
  await expect.poll(() => host.evaluate(node => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeLessThanOrEqual(3);
  expect(await host.evaluate(node => getComputedStyle(node).flexDirection)).toBe('column');

  await page.locator('#thread input[name=body]').fill('outgoing at bottom');
  await page.locator('#thread .composer').getByRole('button', { name: 'ส่ง' }).click();
  await expect(host.locator('.message').last()).toContainText('outgoing at bottom');
  await expect.poll(() => host.evaluate(node => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeLessThanOrEqual(3);

  recent.push(makeMessage('incoming-near-bottom', 400, 'incoming near bottom'));
  await page.clock.fastForward(10_100);
  await expect(host.locator('.message').last()).toContainText('incoming near bottom');
  await expect.poll(() => host.evaluate(node => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeLessThanOrEqual(3);

  await page.clock.fastForward(32);
  await host.evaluate(node => { node.scrollTop = 0; });
  expect(await host.evaluate(node => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeGreaterThan(80);
  const readingTop = await host.evaluate(node => node.scrollTop);
  recent.push(makeMessage('incoming-while-reading', 401, 'incoming while reading'));
  await page.clock.fastForward(10_100);
  await expect(page.locator('#thread .new-messages-indicator')).toBeVisible();
  expect(await host.evaluate(node => node.scrollTop)).toBe(readingTop);
  await page.locator('#thread .new-messages-indicator').click();
  await expect(page.locator('#thread .new-messages-indicator')).toBeHidden();
  await expect.poll(() => host.evaluate(node => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeLessThanOrEqual(3);

  await page.clock.fastForward(32);
  await host.evaluate(node => { node.scrollTop = 0; });
  const anchor = host.locator('[data-timeline-key]').first();
  const anchorKey = await anchor.getAttribute('data-timeline-key'), anchorTop = await anchor.evaluate(node => node.getBoundingClientRect().top);
  await page.locator('#thread .load-older').click();
  await expect(timeline).toHaveCount(35);
  const anchored = host.locator(`[data-timeline-key="${anchorKey}"]`);
  await expect(anchored).toBeVisible();
  expect(Math.abs(await anchored.evaluate(node => node.getBoundingClientRect().top) - anchorTop)).toBeLessThanOrEqual(2);
  expect((await timeline.evaluateAll(nodes => nodes.map(node => node.dataset.timelineKey))).slice(0, 8)).toEqual(
    Array.from({ length: 8 }, (_, index) => `message:older-${String(index).padStart(2, '0')}`),
  );

  await page.reload();
  await page.locator('[data-chat="friend-1"]').click();
  await expect(page.locator('#thread .message').last()).toContainText('incoming while reading');
  await expect.poll(() => page.locator('#thread .messages').evaluate(node => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeLessThanOrEqual(3);
});

test('real-time chat appends from account B to account A', async ({ page, context }) => {
  await page.clock.install();
  const pageB = await context.newPage();
  await pageB.clock.install();
  await mockSocialApi(pageB);
  const messages = [];
  const installAccount = async (targetPage, actor, peer, actorName, peerName) => {
    await targetPage.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: actor, displayName: actorName }, providers: ['google'], recentlyAuthenticated: true } }));
    await targetPage.route('**/api/social/profile', route => route.fulfill({ json: { profile: { user_id: actor, name: actorName, direct_messages_enabled: 1, discovery_visible: 0 } } }));
    await targetPage.route('**/api/social/conversations*', route => route.fulfill({ json: { conversations: [{ other_user_id: peer, name: peerName, direct_messages_enabled: 1, unread_count: 0, last_message_at: messages.at(-1)?.created_at || 1, last_message_body: messages.at(-1)?.body || '' }] } }));
    await targetPage.route('**/api/social/messages*', async route => {
      const request = route.request();
      if (request.method() === 'GET') return route.fulfill({ json: { messages: messages.slice().reverse(), hasMore: false } });
      const body = request.postDataJSON();
      if (body.action === 'send') messages.push({ id: `dual-${messages.length}`, sender_user_id: actor, receiver_user_id: peer, body: body.body, created_at: 500 + messages.length });
      await route.fulfill({ json: { ok: true } });
    });
  };
  await installAccount(page, 'me', 'friend-1', 'Account A', 'Account B');
  await installAccount(pageB, 'friend-1', 'me', 'Account B', 'Account A');
  await Promise.all([page.goto('/app/?tab=chat'), pageB.goto('/app/?tab=chat')]);
  await page.locator('[data-chat="friend-1"]').click();
  await pageB.locator('[data-chat="me"]').click();
  await pageB.locator('#thread input[name=body]').fill('B to A real-time');
  await pageB.locator('#thread .composer').getByRole('button', { name: 'ส่ง' }).click();
  await expect(pageB.locator('#thread .message').last()).toContainText('B to A real-time');
  await page.clock.fastForward(10_100);
  await expect(page.locator('#thread .message').last()).toContainText('B to A real-time');
  await expect.poll(() => page.locator('#thread .messages').evaluate(node => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeLessThanOrEqual(3);
});

test("root is the authenticated discovery entry while welcome retains marketing", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole("heading", { name: "คนใกล้คุณ" })).toBeVisible();
  await expect(page.locator("#people-grid .person-card")).toHaveCount(3);
  await page.goto("/welcome");
  await expect(page.getByRole("heading", { name: /เรื่องดี ๆ เริ่มต้นจาก/u })).toBeVisible();
});

test('authenticated shortcut is session-owned, deduplicated and independent of discovery visibility',async({page})=>{
 await page.route('**/api/social/profile',r=>r.fulfill({json:{profile:{user_id:'me',name:'นัท',bio:'โปรไฟล์ส่วนตัว',discovery_visible:0}}}));
 await page.route('**/api/social/discovery?*',r=>r.fulfill({json:{locationFresh:true,people:[{user_id:'me',name:'stale API copy',distance:1},{user_id:'other',name:'สมาชิกอื่น',distance:250}]}}));
 await page.goto('/');
 const first=page.locator('#people-grid .person-card').first();
 await expect(first).toHaveAttribute('data-person','me');await expect(first.locator('.person-name')).toHaveText('นัท');
 await expect(page.locator('#people-grid [data-person=me]')).toHaveCount(1);
 await expect(first.locator('.card-distance,[data-action],.verify-badge')).toHaveCount(0);
 await expect(page.locator('#people-count')).toHaveText('1');
 await page.locator('#people-search').fill('ไม่ตรงกับชื่อของคุณ');await expect(page.locator('#people-grid .person-card')).toHaveCount(1);
 await first.locator('.card-open').click();await expect(page).toHaveURL(/people\/me$/);await expect(page.locator('.full-name-row')).toContainText('นัท');
});

test('gallery failed comment keeps its draft and inline reason; likes are disabled while pending',async({page})=>{
 await enableMedia(page);
 let likes=0;
 const waitForGalleryPost=action=>page.waitForResponse(response=>{
  if(response.request().method()!=='POST'||new URL(response.url()).pathname!=='/api/social/gallery')return false;
  try{return response.request().postDataJSON()?.action===action;}catch{return false;}
 });
 await page.route('**/api/social/gallery?*',r=>r.fulfill({json:{owner:'near-1',photos:[{id:'fixture-photo',visibility:'public',owner:'near-1',caption:'ภาพสมมติ',like_count:0}],comments:[]}}));
 await page.route('**/api/social/gallery',async r=>{
  const body=r.request().postDataJSON();
  if(body.action==='comment')return r.fulfill({status:403,json:{error:'ไม่มีสิทธิ์ส่งความคิดเห็น'}});
  likes++;await new Promise(resolve=>setTimeout(resolve,300));await r.fulfill(likes===1?{status:503,json:{error:'บันทึก Like ไม่สำเร็จ กรุณาลองอีกครั้ง'}}:{json:{ok:true}});
 });
 const galleryLoaded=page.waitForResponse(response=>response.request().method()==='GET'&&new URL(response.url()).pathname==='/api/social/gallery'&&new URL(response.url()).searchParams.get('photo')==='fixture-photo');
 await page.goto('/app/people/near-1/gallery/fixture-photo');await galleryLoaded;await expect(page.locator('.lightbox-shell')).toBeVisible();
 await page.locator('#gallery-comment input[name=comment]').fill('ความคิดเห็นสมมติที่ยังส่งไม่สำเร็จ');await expect(page.locator('#gallery-comment button')).toBeEnabled();
 const commentResponse=waitForGalleryPost('comment');await page.locator('#gallery-comment button').click();await commentResponse;
 await expect(page.locator('[data-post-feedback]')).toHaveAttribute('role','alert');await expect(page.locator('[data-post-feedback]')).toHaveText('ไม่มีสิทธิ์ส่งความคิดเห็น');
 await expect(page.locator('#gallery-comment input[name=comment]')).toHaveValue('ความคิดเห็นสมมติที่ยังส่งไม่สำเร็จ');
  const firstLikeResponse=waitForGalleryPost('like');await page.locator('.post-like').click();await expect(page.locator('.post-like')).toBeDisabled();await firstLikeResponse;await expect(page.locator('.post-like')).toBeEnabled();expect(likes).toBe(1);
  await expect(page.locator('.post-like svg')).toHaveCount(1);await expect(page.locator('[data-post-feedback]')).toHaveText('บันทึก Like ไม่สำเร็จ กรุณาลองอีกครั้ง');
  const secondLikeResponse=waitForGalleryPost('like');await page.locator('.post-like').click();await expect(page.locator('.post-like')).toBeDisabled();
  await page.locator('#gallery-comment input[name=comment]').fill('ร่างที่แก้ระหว่างกด Like');await expect(page.locator('#gallery-comment button')).toBeDisabled();
  await secondLikeResponse;await expect(page.locator('.post-like')).toBeEnabled();await expect(page.locator('#gallery-comment input[name=comment]')).toHaveValue('ร่างที่แก้ระหว่างกด Like');
  await expect(page.locator('[data-post-feedback]')).toBeHidden();
  const response=waitForGalleryPost('like');
  await page.locator('.post-like').click();await page.keyboard.press('Escape');await response;
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page.locator('.lightbox-shell')).toHaveCount(0);await expect(page).toHaveURL(/\/people\/near-1\/gallery$/);
  await page.keyboard.press('Escape');await expect(page.locator('#profile-dialog')).toBeHidden();
});

test('public photo stays open without a private grant and foreground updates preserve comment draft',async({page})=>{
 await enableMedia(page);
 await page.clock.install();let updated=false;
 await page.route('**/api/social/gallery?*',r=>r.fulfill({json:{owner:'near-1',album:{granted:false,request:null},photos:[{id:'public-refresh',visibility:'public',caption:'รูปสาธารณะ',like_count:updated?2:0}],comments:updated?[{id:'new',sender_name:'ผู้แสดงความคิดเห็นทดสอบ',body:'ความคิดเห็นใหม่'}]:[]}}));
 await page.goto('/app/people/near-1/gallery/public-refresh');await expect(page.locator('.lightbox-shell')).toBeVisible();await page.locator('#gallery-comment input[name=comment]').fill('ร่างที่ต้องรักษาไว้');updated=true;await page.clock.fastForward(11000);
 await expect(page.locator('.lightbox-shell')).toBeVisible();await expect(page.locator('.post-comments')).toContainText('ความคิดเห็นใหม่');await expect(page.locator('#gallery-comment input[name=comment]')).toHaveValue('ร่างที่ต้องรักษาไว้');
});
test('core configuration outage exposes a working recovery action without fake members',async({page})=>{
 let failed=true;await page.route('**/api/social/config',r=>failed?r.fulfill({status:503,json:{message:'Temporary failure'}}):r.fulfill({json:config}));await page.goto('/');await expect(page.locator('#disabled-view')).toBeVisible();await expect(page.locator('#people-grid .person-card')).toHaveCount(0);failed=false;await page.locator('#service-retry').click();await expect(page.locator('#social-view')).toBeVisible();await expect(page.locator('#disabled-view')).toBeHidden();
});
test('unread badges refresh across screens and opt-in foreground notifications do not require hidden polling',async({page})=>{
 await page.clock.install();await page.addInitScript(()=>{window.notificationSamples=[];window.Notification=class{static permission='granted';constructor(title,options){window.notificationSamples.push({title,body:options.body});}};});let unread=0;
 await page.route('**/api/social/conversations',r=>r.fulfill({json:{conversations:[{other_user_id:'friend-1',name:'ผู้ทดสอบ',unread_count:unread,last_message_at:1}]}}));
 await page.goto('/');await expect(page.locator('#social-view')).toBeVisible();unread=1;await page.clock.fastForward(31000);await expect(page.locator('#message-badge')).toHaveText('1');expect(await page.evaluate(()=>window.notificationSamples.length)).toBe(0);
 await page.evaluate(()=>localStorage.setItem('chatgun-notifications','enabled'));unread=2;await page.clock.fastForward(31000);await expect.poll(()=>page.evaluate(()=>window.notificationSamples.length)).toBe(1);expect(await page.evaluate(()=>window.notificationSamples[0].body)).toBe('มีข้อความหรือคำขอใหม่');
});

test('moderation withdrawal clears an already-open photo on permission refresh',async({page})=>{
  await enableMedia(page);
  let released=true;
  await page.route('**/api/social/gallery?*',r=>r.fulfill({json:{owner:'near-1',album:{granted:false,request:null},photos:released?[{id:'withdrawn',visibility:'public',review_status:'released',caption:'รูปสมมติ'}]:[],comments:[]}}));
  await page.goto('/app/people/near-1/gallery/withdrawn');await expect(page.locator('.lightbox-shell')).toBeVisible();
  released=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.lightbox-shell')).toHaveCount(0);await expect(page).toHaveURL(/near-1\/gallery$/);await expect(page.locator('.gallery-grid .tile')).toHaveCount(0);
});

test("chat messages flow oldest-to-newest with latest at bottom and older-page scroll preserved", async ({ page }) => {
  const makeMessage = (n) => ({
    id: `chat-order-${n}`,
    sender_user_id: n % 2 ? "friend-1" : "me",
    receiver_user_id: n % 2 ? "me" : "friend-1",
    body: `chronology-${String(n).padStart(2, "0")}`,
    media_id: null, unsent_at: null, read_at: null, created_at: 1_790_002_000 + n,
  });
  const latest = Array.from({ length: 32 }, (_, i) => makeMessage(i + 12));
  const older = Array.from({ length: 12 }, (_, i) => makeMessage(i));
  await page.route("**/api/social/messages?*", (route) => {
    const olderRequest = new URL(route.request().url()).searchParams.has("before");
    return route.fulfill({ json: { messages: (olderRequest ? older : latest).slice().reverse(), hasMore: !olderRequest } });
  });
  await page.goto("/app/");
  await page.locator('#primary-nav button[data-tab="chat"]').click();
  await page.locator('#conversation-list [data-chat="friend-1"]').click();

  const history = page.locator("#thread .messages");
  const bubbles = history.locator(".message");
  await expect(bubbles).toHaveCount(32);
  await expect(bubbles.first()).toContainText("chronology-12");
  await expect(bubbles.last()).toContainText("chronology-43");
  const positions = await bubbles.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
  expect(positions[0]).toBeLessThan(positions.at(-1));
  await expect.poll(() => history.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100);
  await expect.poll(() => history.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(4);

  await history.evaluate((el) => { el.scrollTop = 0; });
  const anchor = bubbles.filter({ hasText: "chronology-12" });
  const before = await anchor.evaluate((el) => el.getBoundingClientRect().top);
  await history.locator(".load-older").click();
  await expect(bubbles).toHaveCount(44);
  await expect(bubbles.first()).toContainText("chronology-00");
  const after = await anchor.evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(after - before)).toBeLessThan(8);
});

test("desktop social shell preserves discovery, direct chat, reviews, and profile without game", async ({ page }, testInfo) => {
  await page.goto("/app/");
  await expect(page.getByRole("heading", { name: "คนใกล้คุณ" })).toBeVisible();
  await expect(page.getByText("มิน")).toBeVisible();
  await expect(page.getByText("ต้น", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "เกม" })).toHaveCount(0);
  await page.locator('#primary-nav button[data-tab="reviews"]').click();
  await expect(page.locator("#reviews-list").getByText("สุภาพและเป็นมิตร")).toBeVisible();
  await page.locator('#primary-nav button[data-tab="chat"]').click();
  await expect(page.locator("#conversation-list").getByText("คุณ: เจอกันที่คาเฟ่")).toBeVisible();
  await page.getByRole("button", { name: /พลอย/u }).click();
  await expect(page.getByText("ระวังการหลอกโอนเงินและขอข้อมูลส่วนตัว")).toBeVisible();
  await expect(page.getByText("สวัสดี ยินดีที่ได้รู้จัก")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("social-desktop.png"), fullPage: true });
});

test("mobile social shell uses bottom navigation and remains usable", async ({ page }, testInfo) => {
  await page.goto("/app/");
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator("#people-grid .person-card")).toHaveCount(3);
  await page.locator('#primary-nav button[data-tab="profile"]').click();
  await expect(page.getByRole("button", { name: "บันทึกโปรไฟล์" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("social-mobile.png"), fullPage: true });
});

test("disabled social environment reveals no member features", async ({ page }) => {
  await page.unroute("**/api/**");
  await page.route("**/api/social/config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...config, socialAppEnabled: false }) }));
  await page.goto("/app/");
  await expect(page.getByRole("heading", { name: "ChatGun กำลังเตรียมเปิดให้บริการ" })).toBeVisible();
  await expect(page.locator("#social-view")).toBeHidden();
});

test("member profile routes are deep-linkable and preserve browser history", async ({ page }) => {
  await page.goto("/app/people/near-1");
  await expect(page).toHaveURL(/\/app\/people\/near-1$/u);
  await expect(page.locator("#profile-dialog")).toBeVisible();
  await expect(page.locator("#profile-dialog").getByRole("heading", { name: "มิน",exact:true })).toBeVisible();
  await page.locator("#profile-dialog [data-close-profile]").click();
  await expect(page).toHaveURL(/\/$/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/people\/near-1$/u);
  await expect(page.locator("#profile-dialog")).toBeVisible();
});

test('coarse live distance does not silently remove the server-authorized rating workflow',async({page})=>{
  // The live API never sends the exact 100m location threshold or can_rate.
  await page.goto('/app/people/near-2');
  await expect(page.locator('.full-profile-actions [data-action=rate]')).toBeEnabled();
  await page.locator('.full-profile-actions [data-action=rate]').click();
  await expect(page.locator('#rating-dialog')).toBeVisible();
  await expect(page.locator('#rating-form input[name=target]')).toHaveValue('near-2');
});

test('source header switches out discovery controls; gallery distinguishes loading failure from empty and retries',async({page})=>{
  await enableMedia(page);
  await page.goto('/app/');await page.locator('#primary-nav [data-tab=chat]').click();
  await expect(page.locator('.toolbar .discovery-controls')).toHaveCount(0);
  await expect(page.locator('.toolbar>.toolbar-page')).toHaveText('แชท');
  await page.locator('#primary-nav [data-tab=profile]').click();
  await expect(page.locator('.toolbar .discovery-controls')).toHaveCount(0);
  await page.locator('#primary-nav [data-tab=near]').click();
  await expect(page.locator('.toolbar .discovery-controls')).toBeVisible();
  let fail=true;
  await page.route('**/api/social/gallery?**',r=>r.fulfill(fail?{status:503,json:{message:'temporarily unavailable'}}:{json:{photos:[],comments:[],owner:'near-2'}}));
  await page.locator('#people-grid [data-person="near-2"] .card-open').click();
  await expect(page.locator('#toast')).toContainText('โหลด Gallery ไม่สำเร็จ');
  await page.locator('.profile-gallery-button').click();await expect(page.locator('.gallery-experience [role=alert]')).toBeVisible();
  await expect(page.locator('.gallery-experience .viewer-hint')).toHaveCount(0);
  fail=false;await page.locator('[data-retry-gallery]').click();
  await expect(page.locator('.gallery-experience [role=alert]')).toHaveCount(0);
  await expect(page.locator('.gallery-experience .viewer-hint')).toContainText('ยังไม่มีรูป');
});

test("retired demo cannot be re-enabled by a stale configuration flag", async ({ page }) => {
  await page.unroute("**/api/**");
  await page.route("**/api/social/config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...config, socialAppEnabled: false, demoModeEnabled: true }) }));
  await page.goto("/app/");
  await expect(page.getByRole('heading',{name:'ChatGun กำลังเตรียมเปิดให้บริการ'})).toBeVisible();
  await expect(page.getByRole("button", { name: "ลองโหมดสาธิตแบบไม่บันทึกลงเซิร์ฟเวอร์" })).toHaveCount(0);
  await expect(page.locator("#demo-banner")).toHaveCount(0);
  await expect(page.locator("#people-grid .person-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "เกม" })).toHaveCount(0);
});

test("profile names cannot break out of text or media attributes", async ({ page }) => {
  const payload='x" onerror="alert(1)';
  await page.route('**/api/social/profile**',route=>route.fulfill({json:{profile:{user_id:new URL(route.request().url()).searchParams.get('user')||'me',name:payload,gender:'ไม่ระบุ',bio:'Local-only escaping test',interests:''}}}));
  await page.goto('/app/people/injection-fixture');
  await expect(page.locator(".full-name-row h1")).toHaveText(payload);
  await expect(page.locator("#profile-dialog img[onerror]")).toHaveCount(0);
  await expect(page.locator("#profile-dialog [onmouseover],#profile-dialog [onfocus]")).toHaveCount(0);
});

test("real-data shell never substitutes demo photos when uploads are disabled", async ({ page }) => {
  await page.goto("/app/");
  await page.locator('#primary-nav button[data-tab="profile"]').click();
  await expect(page.locator('#manage-gallery')).toBeHidden();
  await expect(page.locator('#view-own-profile')).toBeHidden();
  await expect(page.locator('#gallery-upload')).toBeHidden();
  await expect(page.locator('#my-gallery img')).toHaveCount(0);
  await expect(page.locator('script[src*="demo-"]')).toHaveCount(0);
});

test("social shell reports offline state and recovers when connectivity returns", async ({ page, context }) => {
  await page.goto("/app/");
  await expect(page.locator("#app")).toHaveAttribute("aria-busy", "false");
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.locator("#global-status")).toContainText("ออฟไลน์");
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator("#toast")).toHaveText("กลับมาออนไลน์แล้ว");
});

test("daily image quota disables only the exhausted category while chat text remains available", async ({ page }) => {
  await page.route("**/api/social/config", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ...config, mediaUploadEnabled: true }),
  }));
  await page.route("**/api/social/upload-quotas", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      timezone: "Asia/Bangkok",
      localDay: "2026-10-16",
      resetsAt: 1_797_353_200,
      chat: { limit: 10, used: 10, reserved: 0, remaining: 0 },
      gallery: { limit: 10, used: 10, reserved: 0, remaining: 0 },
    }),
  }));
  await page.goto("/app/");
  await page.locator('#primary-nav button[data-tab="profile"]').click();
  await expect(page.locator("#gallery-upload-quota")).toContainText("อัปโหลดรูปแกลเลอรีครบขีดจำกัดรายวันแล้ว");
  await expect(page.locator('#gallery-upload input[type="file"]')).toBeDisabled();
  await page.locator('#primary-nav button[data-tab="chat"]').click();
  await page.getByRole("button", { name: /พลอย/u }).click();
  await expect(page.locator("#chat-upload-quota")).toContainText("ยังส่งข้อความได้");
  await expect(page.locator('#thread input[name="file"]')).toBeDisabled();
  await expect(page.locator('#thread input[name="body"]')).toBeEnabled();
  await expect(page.locator("#thread .composer").getByRole("button", { name: "ส่ง", exact: true })).toBeEnabled();
});
