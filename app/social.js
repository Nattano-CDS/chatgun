const state = {
  config: null,
  account: null,
  profile: null,
  people: [],
  discoveryPage: 1,
  discoveryFilter: "",
  relationships: [],
  ratings: [],
  blocked: [],
  myGallery: [],
  mediaAppeals: [],
  appealableMedia: [],
  moderationNotifications: [],
  verification: null,
  activeTab: ["near","friends","chat","reviews","profile"].includes(new URLSearchParams(location.search).get('tab')) ? new URLSearchParams(location.search).get('tab') : "near",
  selectedPerson: null,
  selectedChat: null,
  locationFresh: false,
  locationWatch: null,
  lastLocationPost: 0,
  demo: false,
  demoMessages: {},
  lastUnread: 0,
  threadMessages: [],
  threadHasMore: false,
  galleryView: null,
  chosenAsset: null,
  threadPolling: false,
  locationPermission: null,
  demoGallery: [],
  demoAssets: [],
  demoReports: [],
  demoRatingsGiven: [],
  uploadQuotas: {
    timezone: "Asia/Bangkok",
    chat: { limit: 10, used: 0, reserved: 0, remaining: 10 },
    gallery: { limit: 10, used: 0, reserved: 0, remaining: 10 },
  },
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// Keep a labelled, bounded portrait when a private or demonstration image fails.
document.addEventListener('error',event=>{
  const image=event.target;
  if (!(image instanceof HTMLImageElement) || !image.closest('.portrait,.gallery-item,.avatar')) return;
  const parent=image.parentElement;
  image.hidden=true;parent.dataset.imageError='รูปภาพไม่พร้อมใช้งาน';
  parent.setAttribute('role','img');parent.setAttribute('aria-label',image.alt||'รูปภาพไม่พร้อมใช้งาน');
},true);

function cookie(name) {
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

async function api(path, options = {}) {
  if (state.demo) return demoApi(path, options);
  const headers = { accept: "application/json", ...(options.headers || {}) };
  const method = options.method || "GET";
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  if (method !== "GET" && method !== "HEAD") headers["x-csrf-token"] = decodeURIComponent(cookie("__Host-cg_csrf"));
  const response = await fetch(path, { credentials: "same-origin", ...options, method, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "ไม่สามารถดำเนินการได้");
    error.code = payload.code || "request_failed";
    error.status = response.status;
    throw error;
  }
  return payload;
}

function demoDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("chatgun-demo", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function demoRead() {
  const database = await demoDatabase();
  return new Promise((resolve) => {
    const request = database.transaction("state").objectStore("state").get("chatgun-browser-demo-v1");
    request.onsuccess = () => { database.close(); resolve(request.result || null); };
    request.onerror = () => { database.close(); resolve(null); };
  });
}

async function demoSave() {
  const database = await demoDatabase();
  const snapshot = { profile: state.profile, relationships: state.relationships, ratings: state.ratings, blocked: state.blocked, messages: state.demoMessages, gallery: state.demoGallery, assets: state.demoAssets, reports: state.demoReports, givenRatings: state.demoRatingsGiven, uploadQuotas: state.uploadQuotas };
  await new Promise((resolve, reject) => {
    const request = database.transaction("state", "readwrite").objectStore("state").put(snapshot, "chatgun-browser-demo-v1");
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
}

async function demoApi(path, options = {}) {
  const url = new URL(path, location.origin);
  const method = options.method || "GET";
  const body = options.body || {};
  if (url.pathname === "/api/auth/me") return state.account;
  if (url.pathname === "/api/social/profile") {
    if (method === "POST" && body.action === "edit") Object.assign(state.profile, { name: body.name, gender: body.gender, bio: body.bio, interests: body.interests });
    if (method === "POST" && body.action === "hide") state.profile.discovery_visible = 0;
    await demoSave();
    return { profile: state.profile };
  }
  if (url.pathname === "/api/social/discovery") return { people: state.people.filter((person) => !state.blocked.some((item) => item.user_id === person.user_id)), locationFresh: state.locationFresh };
  if (url.pathname === "/api/social/relationships") {
    if (method === "GET") return { relationships: state.relationships };
    const person = state.people.find((item) => item.user_id === body.target) || state.relationships.find((item) => item.other_user_id === body.target);
    const current = relationshipFor(body.target);
    if (body.action === "request" && person && !current) state.relationships.unshift({ ...person, other_user_id: body.target, requested_by: "demo-me", status: "pending", updated_at: Date.now() / 1000 });
    if (body.action === "accept" && current) current.status = "accepted";
    if (["reject", "cancel", "unfriend"].includes(body.action)) state.relationships = state.relationships.filter((item) => item.other_user_id !== body.target);
    await demoSave(); return { ok: true };
  }
  if (url.pathname === "/api/social/blocks") {
    if (method === "GET") return { blocked: state.blocked };
    const person = state.people.find((item) => item.user_id === body.target) || state.relationships.find((item) => item.other_user_id === body.target);
    if (body.action === "block" && person) { state.blocked.unshift({ user_id: body.target, name: person.name }); state.relationships = state.relationships.filter((item) => item.other_user_id !== body.target); }
    if (body.action === "unblock") state.blocked = state.blocked.filter((item) => item.user_id !== body.target);
    await demoSave(); return { ok: true };
  }
  if (url.pathname === "/api/social/messages") {
    const target = method === "GET" ? url.searchParams.get("target") : body.target;
    if (body.action === "unsend") {
      for (const messages of Object.values(state.demoMessages)) {
        const message = messages.find((item) => item.id === body.id && item.sender_user_id === "demo-me");
        if (message) message.unsent_at = Math.floor(Date.now() / 1000);
      }
      await demoSave(); return { ok: true };
    }
    state.demoMessages[target] ||= [];
    if (method === "GET") return { messages: [...state.demoMessages[target]].reverse(), hasMore: false };
    if (body.action === "send") state.demoMessages[target].push({ id: crypto.randomUUID(), sender_user_id: "demo-me", receiver_user_id: target, body: body.body || "", media_id: body.mediaId || null, created_at: Math.floor(Date.now() / 1000) });
    const relation = relationshipFor(target);
    if (relation && body.action === "read") { relation.unread_count = 0; renderRelationships(); }
    if (relation && body.action === "send") Object.assign(relation,{last_message_at:Math.floor(Date.now()/1000),last_message_sender_id:"demo-me",last_message_body:body.body||"",last_message_media_id:body.mediaId||null});
    await demoSave(); return { ok: true };
  }
  if (url.pathname === "/api/social/chat-assets") return { assets: state.demoAssets.map(({ id, created_at }) => ({ id, created_at })) };
  if (url.pathname === "/api/social/upload-quotas") return state.uploadQuotas;
  if (url.pathname === "/api/social/ratings") {
    if (method === "GET") return { ratings: state.ratings };
    state.demoRatingsGiven.unshift({ id: crypto.randomUUID(), target: body.target, score: body.score, comment: body.comment, created_at: Math.floor(Date.now() / 1000) });
    await demoSave(); return { ok: true };
  }
  if (url.pathname === "/api/social/gallery") {
    const owner = url.searchParams.get("user") || "demo-me";
    if (method === "GET") {
      const relation = relationshipFor(owner);
      const canReadComments = owner === "demo-me" || relation?.status === "accepted";
      const photos = state.demoGallery.filter((photo) => photo.owner === owner).map((photo) => ({
        ...photo, selected: state.profile.selected_photo_id === photo.id,
        comments: undefined,
      }));
      const selected = url.searchParams.get("photo");
      const comments = selected && canReadComments ? state.demoGallery.find((photo) => photo.id === selected)?.comments || [] : [];
      return { photos, comments, owner };
    }
    const photo = state.demoGallery.find((item) => item.id === body.id);
    if (!photo) throw new Error("ไม่พบรูปภาพ");
    if (body.action === "delete" && photo.owner === "demo-me") {
      state.demoGallery = state.demoGallery.filter((item) => item.id !== photo.id);
      if (state.profile.selected_photo_id === photo.id) state.profile.selected_photo_id = null;
    } else if (body.action === "select" && photo.owner === "demo-me") state.profile.selected_photo_id = photo.id;
    else if (body.action === "like") { photo.liked = !photo.liked; photo.like_count = Math.max(0, Number(photo.like_count || 0) + (photo.liked ? 1 : -1)); }
    else if (body.action === "comment") photo.comments.push({ id: crypto.randomUUID(), sender_name: state.profile.name, body: String(body.comment || "").trim(), created_at: Math.floor(Date.now() / 1000) });
    else if (!['delete', 'select', 'like', 'comment'].includes(body.action)) throw new Error("คำขอไม่ถูกต้อง");
    await demoSave(); return { ok: true, mediaDeletionPending: false };
  }
  if (["/api/social/reports", "/api/social/reports/media", "/api/social/media/appeals"].includes(url.pathname) && method === "POST") {
    state.demoReports.push({ id: crypto.randomUUID(), target: body.target, category: body.category, details: body.details, status: "pending", created_at: Math.floor(Date.now() / 1000) });
    await demoSave(); return { ok: true };
  }
  throw new Error("ฟีเจอร์นี้ไม่ทำงานในโหมดสาธิต");
}

async function startDemo() {
  const network = await window.chatgunDemoNetwork();
  const saved = await demoRead().catch(() => null);
  state.demo = true;
  state.config = { ...state.config, socialAppEnabled: true, publicDiscoveryEnabled: true, friendRequestsEnabled: true, messagingEnabled: true, ratingsEnabled: true, mediaUploadEnabled: true, identityVerificationEnabled: false };
  state.account = { user: { id: "demo-me", displayName: "คุณ" }, providers: [] };
  state.profile = saved?.profile || { user_id: "demo-me", name: "คุณ", gender: "ไม่ระบุ", bio: "กำลังทดลอง ChatGun", interests: "กาแฟ, เพื่อนใหม่", discovery_visible: 1 };
  state.people = network.people;
  state.relationships = saved?.relationships || network.relationships;
  state.ratings = saved?.ratings || network.ratings;
  state.blocked = saved?.blocked || [];
  state.demoMessages = saved?.messages || network.messages;
  state.demoGallery = saved?.gallery || network.gallery;
  state.demoAssets = saved?.assets || [];
  state.demoReports = saved?.reports || [];
  state.demoRatingsGiven = saved?.givenRatings || [];
  if (saved?.uploadQuotas) state.uploadQuotas = saved.uploadQuotas;
  state.myGallery = state.demoGallery.filter((photo) => photo.owner === "demo-me");
  state.locationFresh = true;
  $("#disabled-view").hidden = true;
  $("#global-status").textContent = "";
  $("#social-view").hidden = false;
  $("#demo-banner").hidden = false;
  document.body.dataset.demo = "true";
  $("#location-banner").classList.add("active");
  $("#location-banner strong").textContent = "ระยะทางและโปรไฟล์เป็นข้อมูลสมมติ";
  $("#location-banner p").textContent = "โหมดตัวอย่างไม่อ่านหรือบันทึกตำแหน่งของคุณ";
  $("#location-toggle").textContent = "ตัวอย่าง";
  $("#location-toggle").disabled = true;
  $("#moderation-notifications").innerHTML = `<div class="notification-row"><strong>ตัวอย่าง: รูปภาพของคุณผ่านการตรวจแล้ว</strong><small>การแจ้งเตือนสมมติ</small></div>`;
  fillProfile(); renderPeople(); renderRelationships(); renderRatings(); renderBlocked(); renderOwnGallery();
  switchTab(state.activeTab);
  if(location.pathname==='/app/photos')openOwnGallery(false);
  $("#app").setAttribute("aria-busy", "false");
  const route = routedProfile();
  if (route) await showPerson(route.user, { historyMode: "none", photo: route.photo });
}

function syncDemoUploadDay() {
  const day = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0,10);
  if (state.uploadQuotas.localDay !== day) {
    state.uploadQuotas.localDay = day;
    for (const name of ["chat", "gallery"]) state.uploadQuotas[name] = { limit:10,used:0,reserved:0,remaining:10 };
  }
}
function consumeDemoUpload(category) {
  syncDemoUploadDay();
  const quota = state.uploadQuotas[category];
  if (quota.remaining <= 0) throw new Error("อัปโหลดครบ 10 รูปสำหรับวันนี้แล้ว ลองใหม่หลัง 00:00 น. เวลาไทย");
  quota.used += 1; quota.remaining -= 1;
}

function populateAvatar(element, person) {
  const url = person.selected_photo_id ? galleryMediaUrl(person.selected_photo_id) : "";
  if (element && url) element.innerHTML = `<img src="${escapeHtml(url)}" alt="">`;
}

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = String(value ?? "");
  return node.innerHTML.replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function demoMedia(id, collection) {
  if (!state.demo) return null;
  return collection.find((item) => item.id === id)?.url || null;
}

function galleryMediaUrl(id) {
  return demoMedia(id, state.demoGallery) || (state.demo ? "" : `/api/social/media/${encodeURIComponent(id)}`);
}

function chatMediaUrl(id) {
  return demoMedia(id, state.demoAssets) || (state.demo ? "" : `/api/social/chat/media/${encodeURIComponent(id)}`);
}

function fileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านรูปได้"));
    reader.readAsDataURL(file);
  });
}

async function optimizeImage(file) {
  if (!(file instanceof File) || !file.type.startsWith("image/")) return file;
  if (!("createImageBitmap" in window)) return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Some browsers can display an image that their bitmap decoder cannot
    // resize. Keep the validated original instead of rejecting the upload.
    return file;
  }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 2 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d", { alpha: true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("ไม่สามารถปรับขนาดรูปได้")), "image/webp", .86));
    return new File([blob], `${file.name.replace(/\.[^.]+$/u, "") || "image"}.webp`, { type: "image/webp" });
  } finally { bitmap.close(); }
}

function initials(name) {
  return [...String(name || "?").trim()].slice(0, 2).join("").toUpperCase();
}

function formatDistance(metres, label = "") {
  if (label) return label;
  if (!Number.isFinite(Number(metres))) return "";
  return metres < 1000 ? `${Math.round(metres)} ม.` : `${(metres / 1000).toFixed(1)} กม.`;
}

function toast(message, error = false) {
  const box = $("#toast");
  box.textContent = message;
  box.classList.toggle("error", error);
  box.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { box.hidden = true; }, 4200);
}

function setBusy(button, busy, label = "กำลังดำเนินการ…") {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

function relationshipFor(userId) {
  return state.relationships.find((item) => item.other_user_id === userId);
}

function routedProfile() {
  const match = location.pathname.match(/^\/app\/people\/([^/]+)(?:\/gallery(?:\/([^/]+))?)?\/?$/u);
  if (!match) return null;
  try { return { user: decodeURIComponent(match[1]), photo: match[2] ? decodeURIComponent(match[2]) : null }; }
  catch { return { user: "", photo: null }; }
}

function profilePath(user, photo = null) {
  return `/app/people/${encodeURIComponent(user)}${photo ? `/gallery/${encodeURIComponent(photo)}` : ""}`;
}

function updateProfileRoute(user, photo = null, mode = "push") {
  const path = profilePath(user, photo);
  if (`${location.pathname}${location.search}` === path) return;
  history[mode === "replace" ? "replaceState" : "pushState"]({ user, photo }, "", path);
}

function portrait(person, distance = true) {
  const selectedUrl = person.selected_photo_id ? galleryMediaUrl(person.selected_photo_id) : "";
  const image = selectedUrl
    ? `<img class="profile-photo" src="${escapeHtml(selectedUrl)}" alt="รูปของ ${escapeHtml(person.name)}">`
    : escapeHtml(initials(person.name));
  return `<div class="portrait">${image}${distance && person.distance !== undefined ? `<span class="distance-pill">${escapeHtml(formatDistance(person.distance, person.distance_label))}</span>` : ""}</div>`;
}

function personCard(person, context = "near") {
  const relation = relationshipFor(person.user_id || person.other_user_id);
  const id = person.user_id || person.other_user_id;
  const discovery = context === "near";
  let action = "";
  if (context === "request") {
    action = `<div class="card-actions"><button class="primary" data-action="accept" data-user="${escapeHtml(id)}">ยอมรับ</button><button class="secondary" data-action="reject" data-user="${escapeHtml(id)}">ปฏิเสธ</button></div>`;
  } else if (context === "sent") {
    action = `<div class="card-actions"><button class="secondary" data-action="cancel" data-user="${escapeHtml(id)}">ยกเลิกคำขอ</button></div>`;
  } else if (context === "friend") {
    action = state.config.messagingEnabled ? `<div class="card-actions"><button class="primary" data-action="chat" data-user="${escapeHtml(id)}">แชท</button></div>` : "";
  } else if (!relation && state.config.friendRequestsEnabled) {
    action = discovery
      ? `<div class="card-actions"><button class="primary discovery-action" data-action="request" data-user="${escapeHtml(id)}" aria-label="ขอเป็นเพื่อนกับ ${escapeHtml(person.name)}"><span aria-hidden="true">♧+</span><span class="action-label">ขอเป็นเพื่อน</span></button></div>`
      : `<div class="card-actions"><button class="primary" data-action="request" data-user="${escapeHtml(id)}">ขอเป็นเพื่อน</button></div>`;
  } else if (relation?.status === "pending") {
    action = discovery
      ? `<div class="card-actions"><button class="secondary discovery-action" disabled aria-label="ส่งคำขอเป็นเพื่อนแล้ว"><span aria-hidden="true">✓</span><span class="action-label">ส่งคำขอแล้ว</span></button></div>`
      : `<div class="card-actions"><button class="secondary" disabled>ส่งคำขอแล้ว</button></div>`;
  }
  const request = context === "request" || context === "sent";
  return `${request ? '<div class="request-card">' : ''}<article class="person person-card photo-card context-${escapeHtml(context)}" data-person="${escapeHtml(id)}" tabindex="0" aria-label="เปิดโปรไฟล์ ${escapeHtml(person.name)}"><div class="card-photo">${portrait(person, false)}</div><div class="photo-shade"></div>${person.distance !== undefined ? `<span class="card-distance">${escapeHtml(formatDistance(person.distance, person.distance_label))}</span>` : ""}
    <div class="person-info"><div class="card-name-row"><strong class="person-name">${escapeHtml(person.name)}${person.identity_verified ? " <span title=\"ยืนยันตัวตนแล้ว\">✓</span>" : ""}</strong></div><p class="person-bio">${escapeHtml(person.bio || person.interests || "ยังไม่ได้แนะนำตัว")}</p><div class="person-meta rating-line"><span>${escapeHtml(person.gender || "ไม่ระบุ")}</span><span>${person.rating ? `☆ ${Number(person.rating).toFixed(1)} (${Number(person.rating_count || 0)})` : ""}</span></div></div>${request ? '' : action}
  </article>${request ? `<div class="request-decisions">${action}</div></div>` : ''}`;
}

function renderPeople() {
  const interestSelect=$('#interest-filter');
  const interests=[...new Set(state.people.flatMap(p=>String(p.interests||'').split(',').map(s=>s.trim()).filter(Boolean)))].sort((a,b)=>a.localeCompare(b,'th'));
  const optionKey=JSON.stringify(interests);
  if(interestSelect.dataset.options!==optionKey){const selected=interestSelect.value;interestSelect.innerHTML='<option value="">ทั้งหมด</option>'+interests.map(i=>`<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join('');interestSelect.value=interests.includes(selected)?selected:'';interestSelect.dataset.options=optionKey;}
  const query = $("#people-search").value.trim().toLocaleLowerCase("th");
  const gender = $("#gender-filter").value;
  const interest = $("#interest-filter").value.trim().toLocaleLowerCase("th");
  const relationship = $("#relationship-filter").value;
  const radius = Number($("#radius-filter").value);
  const filter = JSON.stringify([query,gender,interest,relationship,radius]);
  if (filter !== state.discoveryFilter) { state.discoveryFilter = filter; state.discoveryPage = 1; }
  const people = state.people.filter((person) => {
    const text = `${person.name} ${person.bio || ""} ${person.interests || ""}`.toLocaleLowerCase("th");
    return (!query || text.includes(query)) && (gender === "ทั้งหมด" || person.gender === gender)
      && (!interest || String(person.interests || "").toLocaleLowerCase("th").includes(interest))
      && (relationship === "all" || (relationship === "friend") === (relationshipFor(person.user_id)?.status === "accepted"))
      && Number(person.distance) <= radius;
  });
  $("#people-count").textContent = people.length;
  const pages = Math.max(1, Math.ceil(people.length / 16));
  state.discoveryPage = Math.min(state.discoveryPage, pages);
  const visible = people.slice((state.discoveryPage - 1) * 16, state.discoveryPage * 16);
  const columns = innerWidth >= 1400 ? 4 : innerWidth <= 1100 ? 2 : 3;
  const ad = '<div class="discovery-ad" aria-label="พื้นที่โฆษณา"><span>โฆษณา</span><small>พื้นที่โฆษณา · ยังไม่ได้เชื่อมผู้ให้บริการโฆษณา</small></div>';
  $("#people-grid").innerHTML = visible.length ? visible.map((person,i) => `${i === columns * 2 ? ad : ''}${personCard(person)}`).join("") + ad : `<div class="empty"><h2>${state.locationFresh ? "ยังไม่พบคนที่ตรงกับการค้นหา" : "เปิดตำแหน่งเพื่อค้นหาเพื่อน"}</h2><p>${state.demo ? "ลองล้างตัวกรองเพื่อดูโปรไฟล์สมมติทั้งหมด" : "ChatGun ไม่แสดงพิกัดจริง และรับเฉพาะตำแหน่งที่มีความแม่นยำไม่เกิน 50 เมตร"}</p><button class="primary" data-clear-filters>ล้างตัวกรอง</button></div>`;
  $("#discovery-pagination").hidden = !people.length;
  $("#discovery-pagination").innerHTML = `<button class="secondary" data-discovery-page="${state.discoveryPage - 1}" ${state.discoveryPage === 1 ? 'disabled' : ''}>ก่อนหน้า</button><span aria-live="polite">หน้า ${state.discoveryPage} / ${pages}</span><button class="secondary" data-discovery-page="${state.discoveryPage + 1}" ${state.discoveryPage === pages ? 'disabled' : ''}>ถัดไป</button>`;
}

function renderRelationships() {
  const incoming = state.relationships.filter((item) => item.status === "pending" && item.requested_by !== state.account.user.id);
  const sent = state.relationships.filter((item) => item.status === "pending" && item.requested_by === state.account.user.id);
  const friends = state.relationships.filter((item) => item.status === "accepted");
  const unread = friends.reduce((total, item) => total + Number(item.unread_count || 0), 0);
  if (unread > state.lastUnread && document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted" && localStorage.getItem("chatgun-notifications") === "enabled") {
    new Notification("ChatGun", { body: `คุณมี ${unread} ข้อความที่ยังไม่ได้อ่าน`, icon: "/favicon.svg" });
  }
  state.lastUnread = unread;
  $("#request-badge").hidden = incoming.length === 0;
  $("#message-badge").hidden = unread === 0;
  $("#requests-grid").innerHTML = [...incoming.map((item) => personCard(item, "request")), ...sent.map((item) => personCard(item, "sent"))].join("") || `<p class="subtitle">ไม่มีคำขอที่รอดำเนินการ</p>`;
  $("#friends-tab>h2:first-of-type").textContent = `คำขอเป็นเพื่อน · ${incoming.length + sent.length}`;
  $("#friends-tab>h2:last-of-type").textContent = `เพื่อน · ${friends.length}`;
  $("#friends-grid").innerHTML = friends.map((item) => personCard(item, "friend")).join("") || `<div class="empty"><h2>ยังไม่มีเพื่อน</h2><p>ส่งคำขอและรออีกฝ่ายยอมรับก่อนเริ่มแชท</p></div>`;
  renderConversations(friends);
}

function renderConversations(friends = state.relationships.filter((item) => item.status === "accepted")) {
  const list = $("#conversation-list");
  list.innerHTML = friends.length ? friends.sort((a, b) => Number(b.last_message_at || b.updated_at) - Number(a.last_message_at || a.updated_at)).map((person) => {
    const preview = !person.last_message_at ? "เริ่มบทสนทนา"
      : person.last_message_unsent_at ? "ยกเลิกส่งข้อความแล้ว"
        : `${person.last_message_sender_id === state.account.user.id ? "คุณ: " : ""}${person.last_message_media_id ? "ส่งรูปภาพ" : person.last_message_body || "ข้อความ"}`;
    const time = person.last_message_at ? new Date(Number(person.last_message_at) * 1000).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    return `<button class="conversation ${state.selectedChat === person.other_user_id ? "active" : ""}" data-chat="${escapeHtml(person.other_user_id)}"><span class="avatar">${escapeHtml(initials(person.name))}</span><span class="conversation-copy"><span><strong>${escapeHtml(person.name)}</strong><time>${escapeHtml(time)}</time></span><small>${escapeHtml(preview)}</small></span>${Number(person.unread_count || 0) ? `<b class="inbox-unread">${Number(person.unread_count)}</b>` : ""}</button>`;
  }).join("") : `<div class="empty"><p>ต้องเป็นเพื่อนกันก่อนจึงจะแชทได้</p></div>`;
  for (const person of friends) populateAvatar($(`[data-chat="${CSS.escape(person.other_user_id)}"] .avatar`, list), person);
}

function renderRatings() {
  $("#reviews-list").innerHTML = state.ratings.length ? state.ratings.map((rating) => `<article class="review"><div class="review-head"><strong>${escapeHtml(rating.sender_name)}</strong><span>${"★".repeat(Number(rating.score))}</span></div><p>${escapeHtml(rating.comment || "ไม่ได้เขียนความคิดเห็น")}</p><small>${new Date(Number(rating.created_at) * 1000).toLocaleDateString("th-TH")}</small></article>`).join("") : `<div class="empty"><h2>ยังไม่มีความคิดเห็น</h2><p>ความคิดเห็นที่ได้รับจะแสดงเฉพาะคุณ</p></div>`;
}

function fillProfile() {
  if (!state.profile) return;
  const form = $("#profile-form");
  populateAvatar($('#profile-avatar'),state.profile);
  form.elements.name.value = state.profile.name || "";
  form.elements.gender.value = state.profile.gender || "ไม่ระบุ";
  form.elements.bio.value = state.profile.bio || "";
  form.elements.interests.value = state.profile.interests || "";
}

function renderBlocked() {
  $("#blocked-list").innerHTML = state.blocked.length ? state.blocked.map((person) => `<div class="blocked-row"><span>${escapeHtml(person.name)}</span><button class="secondary" data-action="unblock" data-user="${escapeHtml(person.user_id)}">เลิกบล็อก</button></div>`).join("") : `<p>ยังไม่มีผู้ใช้ที่บล็อก</p>`;
}

function renderOwnGallery() {
  $("#gallery-count").textContent = `${state.myGallery.length} / 12`;
  $("#gallery-upload").hidden = !state.config.mediaUploadEnabled;
  $("#gallery-disabled").hidden = state.config.mediaUploadEnabled;
  renderUploadQuotas();
  $("#my-gallery").innerHTML = state.myGallery.length ? state.myGallery.map((photo) => `<article class="gallery-item ${photo.selected ? "selected" : ""}"><img src="${escapeHtml(galleryMediaUrl(photo.id))}" alt="${escapeHtml(photo.caption || "รูปในแกลเลอรี")}" loading="lazy"><div class="gallery-actions">${photo.selected ? "" : `<button data-gallery-action="select" data-photo="${escapeHtml(photo.id)}">ตั้งเป็นรูปหลัก</button>`}<button data-gallery-action="delete" data-photo="${escapeHtml(photo.id)}">ลบ</button></div></article>`).join("") : `<p class="subtitle">ยังไม่มีรูปภาพ</p>`;
}

function renderUploadQuotas() {
  if (state.demo) syncDemoUploadDay();
  const gallery = state.uploadQuotas?.gallery;
  const chat = state.uploadQuotas?.chat;
  const reset = "รีเซ็ต 00:00 น. เวลาไทย";
  if (gallery && $("#gallery-upload-quota")) {
    $("#gallery-upload-quota").textContent = `แกลเลอรี: เหลือ ${gallery.remaining}/${gallery.limit} รูปวันนี้ · ${reset}${gallery.remaining <= 0 ? " · อัปโหลดรูปแกลเลอรีครบขีดจำกัดรายวันแล้ว" : ""}`;
    const form = $("#gallery-upload");
    const reached = gallery.remaining <= 0;
    form?.querySelectorAll("input, button").forEach((control) => { control.disabled = reached; });
    form?.classList.toggle("quota-reached", reached);
  }
  const chatQuota = $("#chat-upload-quota");
  if (chat && chatQuota) {
    chatQuota.textContent = `แชท: เหลือ ${chat.remaining}/${chat.limit} รูปวันนี้ · ${reset}${chat.remaining <= 0 ? " · อัปโหลดรูปในแชทครบขีดจำกัดรายวันแล้ว แต่ยังส่งข้อความได้" : ""}`;
    const file = $("#thread input[name=file]");
    if (file) file.disabled = chat.remaining <= 0;
    file?.closest("label")?.classList.toggle("disabled", chat.remaining <= 0);
  }
}

async function loadUploadQuotas() {
  if (!state.config.mediaUploadEnabled || state.demo) return renderUploadQuotas();
  state.uploadQuotas = await api("/api/social/upload-quotas");
  renderUploadQuotas();
}

async function loadOwnGallery() {
  state.myGallery = (await api(`/api/social/gallery?user=${encodeURIComponent(state.account.user.id)}`)).photos;
  renderOwnGallery();
}

function renderMediaSafety() {
  const appealable = $("#appealable-media");
  appealable.innerHTML = state.appealableMedia.length ? state.appealableMedia.map((item) => `<article class="blocked-row"><span><strong>รูป ${escapeHtml(item.media_id)}</strong><small>${escapeHtml(item.decision_reason || "ถูกจำกัดการเข้าถึง")}</small></span><button class="secondary" data-media-appeal="${escapeHtml(item.media_id)}">ยื่นอุทธรณ์</button></article>`).join("") : `<p class="subtitle">ไม่มีรูปที่ยื่นอุทธรณ์ได้</p>`;
  const notificationLabels = { media_approved_general: "รูปได้รับอนุมัติเป็นเนื้อหาทั่วไป", media_approved_sensitive: "รูปได้รับอนุมัติเป็นเนื้อหาละเอียดอ่อน", media_rejected_prohibited: "รูปถูกปฏิเสธและจำกัดการเข้าถึง", appeal_granted: "คำอุทธรณ์ได้รับอนุมัติ", appeal_denied: "ยืนยันคำตัดสินเดิมหลังตรวจอุทธรณ์" };
  $("#moderation-notifications").innerHTML = state.moderationNotifications.length ? state.moderationNotifications.map((item) => `<p class="notification-row"><strong>${escapeHtml(notificationLabels[item.message_code] || "มีผลการดูแลสื่อ")}</strong><small>${new Date(Number(item.created_at) * 1000).toLocaleString("th-TH")}</small></p>`).join("") : `<p class="subtitle">ยังไม่มีการแจ้งผลการดูแล</p>`;
}

async function loadMediaSafety() {
  if (state.demo) return;
  const [appeals, notifications] = await Promise.all([api("/api/social/media/appeals"), api("/api/social/moderation/notifications")]);
  state.mediaAppeals = appeals.appeals || [];
  state.appealableMedia = appeals.appealable || [];
  state.moderationNotifications = notifications.notifications || [];
  renderMediaSafety();
}

async function loadVerification() {
  if (!state.config.identityVerificationEnabled) return;
  state.verification = (await api("/api/social/verification")).verification;
  $("#verification-panel").hidden = false;
  const labels = { pending: "กำลังตรวจสอบ", approved: "ยืนยันแล้ว", rejected: "ไม่ผ่านการตรวจสอบ" };
  $("#verification-status").textContent = state.verification ? labels[state.verification.status] : "ยังไม่ส่ง";
  $("#verification-form").hidden = ["pending", "approved"].includes(state.verification?.status);
}

async function loadRelationships() {
  if (!state.config.friendRequestsEnabled) return;
  state.relationships = (await api("/api/social/relationships")).relationships;
  renderRelationships();
}

async function loadPeople() {
  if (!state.config.publicDiscoveryEnabled) return;
  const result = await api("/api/social/discovery");
  state.people = result.people;
  state.locationFresh = result.locationFresh;
  $("#location-banner").classList.toggle("active", state.locationFresh);
  $("#location-toggle").textContent = state.locationFresh ? "ปิดตำแหน่ง" : "เปิดตำแหน่ง";
  renderPeople();
}

async function loadRatings() {
  if (!state.config.ratingsEnabled) return;
  state.ratings = (await api("/api/social/ratings")).ratings;
  renderRatings();
}

async function loadBlocked() {
  state.blocked = (await api("/api/social/blocks")).blocked;
  renderBlocked();
}

async function relationshipAction(action, target, button) {
  setBusy(button, true);
  try {
    await api("/api/social/relationships", { method: "POST", body: { action, target } });
    toast({ request: "ส่งคำขอแล้ว", accept: "เพิ่มเป็นเพื่อนแล้ว", reject: "ปฏิเสธคำขอแล้ว", cancel: "ยกเลิกคำขอแล้ว", unfriend: "เลิกเป็นเพื่อนแล้ว" }[action] || "บันทึกแล้ว");
    await loadRelationships();
    renderPeople();
  } catch (error) { toast(error.message, true); } finally { setBusy(button, false); }
}

async function updateLocation() {
  const button = $("#location-toggle");
  if (state.demo) {
    state.locationFresh = !state.locationFresh;
    button.textContent = state.locationFresh ? "ปิดตำแหน่ง" : "เปิดตำแหน่ง";
    $("#location-banner").classList.toggle("active", state.locationFresh);
    renderPeople();
    return;
  }
  if (state.locationFresh) {
    setBusy(button, true);
    try {
      await api("/api/social/discovery", { method: "POST", body: { action: "hide" } });
      if (state.locationWatch !== null) navigator.geolocation.clearWatch(state.locationWatch);
      state.locationWatch = null;
      state.people = [];
      state.locationFresh = false;
      renderPeople();
      button.textContent = "เปิดตำแหน่ง";
      $("#location-banner").classList.remove("active");
    } catch (error) { toast(error.message, true); } finally { button.disabled = false; delete button.dataset.label; }
    return;
  }
  if (!navigator.geolocation) return toast("อุปกรณ์นี้ไม่รองรับตำแหน่ง", true);
  setBusy(button, true, "กำลังหาตำแหน่ง…");
  const publish = async ({ coords }) => {
    if (document.visibilityState !== "visible" || Date.now() - state.lastLocationPost < 55_000) return;
    state.lastLocationPost = Date.now();
    try {
      await api("/api/social/discovery", { method: "POST", body: { action: "location", latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy } });
      state.locationFresh = true;
      await loadPeople();
      toast("เปิดการค้นหาคนใกล้คุณแล้ว");
    } catch (error) { await revokeLocationPublication({ notifyServer: state.locationFresh }); toast(error.message, true); }
    finally { button.disabled = false; delete button.dataset.label; }
  };
  const failed = async (error) => {
    await revokeLocationPublication({ notifyServer: state.locationFresh });
    button.disabled = false;
    button.textContent = "เปิดตำแหน่ง";
    delete button.dataset.label;
    toast(error.code === 1 ? "กรุณาอนุญาตตำแหน่งเพื่อค้นหาคนใกล้คุณ" : "ไม่สามารถอ่านตำแหน่งได้", true);
  };
  state.locationWatch = navigator.geolocation.watchPosition(publish, failed, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
}

async function revokeLocationPublication({ notifyServer = true } = {}) {
  if (state.locationWatch !== null && navigator.geolocation) navigator.geolocation.clearWatch(state.locationWatch);
  state.locationWatch = null;
  state.lastLocationPost = 0;
  if (notifyServer && !state.demo && state.config?.socialAppEnabled && state.profile) {
    await api("/api/social/discovery", { method: "POST", body: { action: "hide" } }).catch(() => {});
  }
  state.locationFresh = false;
  state.people = [];
  $("#location-banner")?.classList.remove("active");
  if ($("#location-toggle")) $("#location-toggle").textContent = "เปิดตำแหน่ง";
  if ($("#people-grid")) renderPeople();
}

async function monitorLocationPermission() {
  if (!navigator.permissions?.query || !navigator.geolocation) return;
  try {
    const permission = await navigator.permissions.query({ name: "geolocation" });
    state.locationPermission = permission;
    if (permission.state === "denied") await revokeLocationPublication({ notifyServer: state.locationFresh });
    permission.onchange = () => {
      if (permission.state === "denied") {
        revokeLocationPublication({ notifyServer: state.locationFresh }).then(() => toast("สิทธิ์ตำแหน่งถูกปิด จึงซ่อนคุณจากการค้นหาแล้ว", true));
      }
    };
  } catch { /* Permission status is optional; watchPosition remains authoritative. */ }
}

async function refreshOpenThread() {
  if (!state.selectedChat || state.threadPolling || state.demo || !state.config?.messagingEnabled) return;
  state.threadPolling = true;
  try {
    await loadMessagePage(state.selectedChat);
    await api("/api/social/messages", { method: "POST", body: { action: "read", target: state.selectedChat } });
  } finally { state.threadPolling = false; }
}

async function showPerson(id, { historyMode = "push", photo = null } = {}) {
  const own = id === state.account?.user?.id;
  const person = own ? state.profile : state.people.find((item) => item.user_id === id) || state.relationships.find((item) => item.other_user_id === id);
  if (!person) {
    $("#profile-dialog-content").innerHTML = `<div class="empty"><h2>ไม่พบโปรไฟล์นี้</h2><p>บัญชีอาจอยู่นอกระยะค้นหา ปิดการหาเพื่อน หรือคุณไม่มีสิทธิ์ดู</p></div>`;
    $("#profile-dialog").showModal();
    return;
  }
  if (historyMode !== "none") updateProfileRoute(id, photo, historyMode);
  state.selectedPerson = person;
  if (!$('#profile-dialog>.profile-navigation')) {
    const navigation = $('#primary-nav').cloneNode(true);
    navigation.removeAttribute('id');navigation.className='profile-navigation';
    navigation.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
    navigation.querySelectorAll('[data-tab]').forEach(e=>{e.dataset.profileTab=e.dataset.tab;e.classList.toggle('active',e.dataset.profileTab==='profile');delete e.dataset.tab;});
    $('#profile-dialog').append(navigation);
  }
  const relation = relationshipFor(id);
  const friendAction = own ? "" : !relation && state.config.friendRequestsEnabled ? `<button class="primary" data-action="request" data-user="${escapeHtml(id)}">ขอเป็นเพื่อน</button>` : relation?.status === "accepted" && state.config.messagingEnabled ? `<button class="primary" data-action="chat" data-user="${escapeHtml(id)}">แชท</button>` : relation?.status === 'pending' ? `<button class="primary" ${relation.requested_by === state.account.user.id ? 'disabled' : `data-action="accept" data-user="${escapeHtml(id)}"`}>${relation.requested_by === state.account.user.id ? 'ส่งคำขอแล้ว' : 'ยอมรับคำขอ'}</button>` : "";
  const interests = String(person.interests || "").split(",").map((item) => item.trim()).filter(Boolean);
  $("#profile-dialog-content").innerHTML = `<article class="dialog-profile member-profile-view">
    <div class="member-profile-image">${portrait(person, false)}</div><div class="member-profile-shade"></div>
    <div class="member-profile-brand"><img src="/logo.svg" alt=""><span>ChatGun</span><strong>โปรไฟล์</strong></div>
    <button class="member-profile-gallery-top" type="button" data-profile-gallery aria-expanded="false">▦ แกลเลอรี</button>
    <section class="member-profile-info"><h2>${escapeHtml(person.name)}${person.identity_verified ? " ✓" : ""}</h2><p class="member-profile-bio">${escapeHtml(person.bio || "ยังไม่ได้แนะนำตัว")}</p><p class="member-profile-facts">${escapeHtml(person.gender || "ไม่ระบุ")} ${person.distance !== undefined ? `· ${escapeHtml(formatDistance(person.distance, person.distance_label))}` : ""} ${person.rating ? `· ☆ ${Number(person.rating).toFixed(1)}` : ''}</p><div class="member-profile-interests">${interests.map((interest) => `<span>${escapeHtml(interest)}</span>`).join("")}</div><div class="dialog-actions profile-primary-actions">${friendAction}<button class="profile-gallery-button" data-profile-gallery>▦ Gallery</button>${!own && state.config.ratingsEnabled ? `<button class="secondary" data-action="rate" data-user="${escapeHtml(id)}">ให้คะแนน</button>` : ""}</div><div class="people-management">${relation?.status === 'accepted' ? `<button data-action="unfriend" data-user="${escapeHtml(id)}">เลิกเป็นเพื่อน</button>` : ''}${own ? "" : `<button data-action="block" data-user="${escapeHtml(id)}">บล็อก</button><button data-action="report" data-user="${escapeHtml(id)}">รายงาน</button>`}</div></section>
    <section class="member-profile-gallery" aria-label="แกลเลอรี" hidden><header class="gallery-header"><button class="gallery-back" type="button" data-profile-gallery aria-label="กลับโปรไฟล์">←</button><a class="gallery-brand" href="/"><img src="/logo.svg" alt=""><b>ChatGun</b></a><h3>Gallery</h3><button class="gallery-back" data-close-profile aria-label="ปิด Gallery">×</button></header><div class="gallery-summary"><div class="gallery-avatar">${portrait(person,false)}</div><div><h2>${escapeHtml(person.name)}</h2><span>${person.rating ? `☆ ${Number(person.rating).toFixed(1)}` : 'ยังไม่มีคะแนน'}</span><p>${escapeHtml(person.bio || '')}</p><div class="gallery-facts">${escapeHtml(person.gender || 'ไม่ระบุ')} · ${own ? 'โปรไฟล์ของคุณ' : relation?.status === 'accepted' ? 'เป็นเพื่อนกันแล้ว' : 'ยังไม่ได้เป็นเพื่อน'}</div><div class="gallery-interests">${interests.map(i=>`<span>${escapeHtml(i)}</span>`).join('')}</div></div></div>${state.demo ? '<p class="gallery-demo">รูปสมมติสำหรับทดลองหน้าจอ</p>' : ''}<div id="dialog-gallery" class="gallery-grid ig-grid"></div></section>
  </article>`;
  if (state.demo) {
    const label = $(".member-profile-brand strong");
    if (label) label.textContent = "โปรไฟล์ตัวอย่าง";
    const title = $(".member-profile-gallery h3");
    if (title) title.textContent = "Gallery";
  }
  $("#profile-dialog").showModal();
  try {
    const gallery = (await api(`/api/social/gallery?user=${encodeURIComponent(id)}`)).photos;
    $("#dialog-gallery").innerHTML = gallery.map((photo) => `<button class="gallery-item" data-gallery-action="view" data-user="${escapeHtml(id)}" data-photo="${escapeHtml(photo.id)}"><img src="${escapeHtml(galleryMediaUrl(photo.id))}" alt="${escapeHtml(photo.caption || "รูปในแกลเลอรี")}" loading="lazy"><span class="tile-likes">♡ ${Number(photo.like_count || 0)}</span></button>`).join("");
    if (!gallery.length) $('#dialog-gallery').innerHTML='<div class="empty"><h2>ยังไม่มีรูปใน Gallery</h2></div>';
    if (photo) await openGalleryPhoto(id, photo, { historyMode: "none" });
  } catch { /* The profile remains usable if its gallery is unavailable. */ }
}

function renderGalleryPost() {
  const { owner, photos, comments, index } = state.galleryView;
  const item = photos[index];
  if (!item) return;
  const report = owner === state.account?.user?.id ? "" : `<button class="danger" data-media-report="${escapeHtml(item.id)}">รายงานรูป</button>`;
  const person = owner === state.account.user.id ? state.profile : state.people.find(p=>p.user_id===owner) || state.relationships.find(p=>p.other_user_id===owner);
  $("#profile-dialog-content").innerHTML = `<article class="dialog-profile gallery-post gallery-post-page"><header class="gallery-header"><button class="gallery-back" data-gallery-return="${escapeHtml(owner)}" aria-label="กลับไป Gallery">←</button><strong>ChatGun · รูปภาพ</strong></header><div class="post-layout"><div class="post-owner">${person ? `<span class="post-avatar">${portrait(person,false)}</span><strong>${escapeHtml(person.name)}</strong>` : ''}</div><div class="lightbox-image"><img class="gallery-view" src="${escapeHtml(galleryMediaUrl(item.id))}" alt="${escapeHtml(item.caption || "รูปในแกลเลอรี")}"></div><div class="post-social"><button class="post-like" data-gallery-action="like" data-photo="${escapeHtml(item.id)}" aria-pressed="${!!item.liked}">${item.liked ? "♥" : "♡"} ${Number(item.like_count || 0)} Likes</button><p>${escapeHtml(item.caption || "")}</p><form id="gallery-comment" class="post-comment"><input type="hidden" name="photo" value="${escapeHtml(item.id)}"><input type="hidden" name="owner" value="${escapeHtml(owner)}"><input name="comment" aria-label="คอมเมนต์" maxlength="500" required placeholder="เขียนถึงเจ้าของโปรไฟล์…"><button class="primary">ส่ง</button></form><small>เจ้าของโปรไฟล์และเพื่อนที่ยอมรับกันแล้วอ่านความคิดเห็นได้</small><div class="comments post-comments">${comments.map((comment) => `<p><strong>${escapeHtml(comment.sender_name)}</strong> ${escapeHtml(comment.body)}</p>`).join("") || "<p>ยังไม่มีความคิดเห็นที่คุณมีสิทธิ์อ่าน</p>"}</div>${report}</div><div class="lightbox-nav"><button class="secondary" data-gallery-action="previous" ${index <= 0 ? "disabled" : ""} aria-label="รูปก่อนหน้า">←</button><span>${index+1} / ${photos.length}</span><button class="secondary" data-gallery-action="next" ${index >= photos.length - 1 ? "disabled" : ""} aria-label="รูปถัดไป">→</button></div></div></article>`;
  $("#profile-dialog-content .dialog-profile").classList.add("gallery-post");
  if (state.demo) {
    const notice = document.createElement("p");
    notice.className = "demo-post-notice";
    notice.textContent = "โหมดตัวอย่าง · ไม่มีการเผยแพร่ไปยังสมาชิกจริง";
    $(".gallery-post .post-social").prepend(notice);
  }
}

async function openGalleryPhoto(owner, photo, { historyMode = "push" } = {}) {
  const result = await api(`/api/social/gallery?user=${encodeURIComponent(owner)}&photo=${encodeURIComponent(photo)}`);
  state.galleryView = { ...result, index: Math.max(0, result.photos.findIndex((entry) => entry.id === photo)) };
  if (historyMode !== "none") updateProfileRoute(owner, photo, historyMode);
  renderGalleryPost();
}

function renderThreadMessages() {
  const messages = $("#thread .messages");
  if (!messages) return;
  const loadMore = state.threadHasMore ? `<button class="secondary load-older" type="button">โหลดข้อความก่อนหน้า</button>` : "";
  messages.innerHTML = state.threadMessages.length ? `${state.threadMessages.map((message) => {
    const media = message.media_id && !message.unsent_at ? chatMediaUrl(message.media_id) : "";
    const attachment = message.media_id && !message.unsent_at ? (media ? `<img class="chat-image" src="${escapeHtml(media)}" alt="รูปในแชท" loading="lazy">` : `<em>รูปนี้ไม่อยู่ในคลังแล้ว</em>`) : "";
    return `<div class="message ${message.sender_user_id === state.account.user.id ? "mine" : ""} ${message.unsent_at ? "unsent" : ""}">${attachment}${escapeHtml(message.unsent_at ? "ยกเลิกข้อความแล้ว" : message.body)}<time>${new Date(Number(message.created_at) * 1000).toLocaleString("th-TH")}</time>${message.sender_user_id === state.account.user.id && !message.unsent_at ? `<span class="message-tools"><button type="button" data-message-action="unsend" data-message="${escapeHtml(message.id)}">ยกเลิกข้อความ</button></span>` : ""}</div>`;
  }).join("")}${loadMore}` : `<div class="empty"><p>เริ่มบทสนทนาด้วยความสุภาพ</p></div>`;
}

async function loadMessagePage(id, before = null) {
  const query = before ? `&before=${encodeURIComponent(before.created_at)}&beforeId=${encodeURIComponent(before.id)}` : "";
  const result = await api(`/api/social/messages?target=${encodeURIComponent(id)}${query}`);
  state.threadMessages = before ? [...state.threadMessages, ...result.messages] : result.messages;
  state.threadHasMore = result.hasMore;
  renderThreadMessages();
}

async function openChat(id) {
  const person = state.relationships.find((item) => item.other_user_id === id && item.status === "accepted");
  if (!person) return;
  state.selectedChat = id;
  switchTab("chat");
  $(".chat-layout").classList.add("open");
  renderConversations();
  const thread = $("#thread");
  thread.innerHTML = `<header class="thread-head"><button class="icon-button chat-back" aria-label="กลับ">←</button><span class="avatar">${escapeHtml(initials(person.name))}</span><strong>${escapeHtml(person.name)}</strong></header><details class="chat-safety"><summary>⚠ ระวังการหลอกโอนเงินและขอข้อมูลส่วนตัว</summary><p>อย่าโอนเงินหรือส่งรหัส OTP รหัสผ่าน ข้อมูลบัญชีธนาคาร หรือรูปเอกสารยืนยันตัวตนให้คู่สนทนา</p><p>${person.identity_verified ? "บัญชีนี้ยืนยันตัวตนแล้ว แต่ตรายืนยันไม่รับรองพฤติกรรมหรือความปลอดภัยในการทำธุรกรรม" : "บัญชีนี้ยังไม่ยืนยันตัวตน โปรดระมัดระวังเป็นพิเศษ"}</p></details><div class="messages"><p>กำลังโหลด…</p></div>${state.config.mediaUploadEnabled ? `<p id="chat-upload-quota" class="upload-quota" aria-live="polite"></p>` : ""}<form class="composer">${state.config.mediaUploadEnabled ? `<label class="icon-button" title="ส่งรูป">▧<input type="file" name="file" accept="image/jpeg,image/png,image/webp" aria-label="ส่งรูป" hidden></label><button class="icon-button asset-library" type="button" title="รูปที่ส่งล่าสุด" aria-label="รูปที่ส่งล่าสุด">▦</button>` : ""}<input name="body" maxlength="2000" placeholder="พิมพ์ข้อความ…"><button class="primary">ส่ง</button></form>`;
  renderUploadQuotas();
  populateAvatar($("#thread .avatar"), person);
  const brand = document.createElement('div');
  brand.className = 'thread-brand-row';
  brand.innerHTML = '<a class="toolbar-brand" href="/"><img src="/logo.svg" alt=""><b>ChatGun</b></a><span>แชท</span>';
  thread.prepend(brand);
  const library = $('.asset-library',thread);
  if (library) $('.thread-head',thread).append(library);
  state.chosenAsset=null;
  if(state.config.mediaUploadEnabled){
    const picker=document.createElement('div');picker.className='chat-image-picker';picker.hidden=true;
    picker.innerHTML='<div class="image-picker-heading"><strong>เลือกรูปเดิม</strong><button type="button" data-picker-upload>อัปโหลดรูปใหม่</button><button type="button" data-picker-close aria-label="ปิดตัวเลือกรูป">×</button></div><div class="image-picker-carousel"></div>';
    $('.composer',thread).before(picker);
    const toggle=document.createElement('button');toggle.type='button';toggle.className='icon-button picker-toggle';toggle.setAttribute('aria-label','เลือกรูปแชท');toggle.setAttribute('aria-expanded','false');toggle.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 4h9M4 4v16h16v-9M16 3h6M19 0v6M4 16l5-5 5 5 3-3 3 3"/></svg>';
    $('.composer>label',thread).hidden=true;$('.composer',thread).prepend(toggle);
  }
  const send = $('.composer>.primary',thread);
  send.setAttribute('aria-label','ส่ง');
  send.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z M22 2 11 13"/></svg>';
  requestAnimationFrame(sizeConversation);
  try {
    await loadMessagePage(id);
    await api("/api/social/messages", { method: "POST", body: { action: "read", target: id } });
  } catch (error) { toast(error.message, true); }
}

function switchTab(tab) {
  delete document.body.dataset.ownGallery;
  state.activeTab = tab;
  document.body.dataset.activeTab = tab;
  $(".toolbar")?.classList.remove("filters-open");
  $("#filter-toggle")?.setAttribute("aria-expanded", "false");
  const labels = { near: "หาเพื่อน", friends: "เพื่อน", chat: "แชท", reviews: "ความคิดเห็น", profile: "โปรไฟล์" };
  $$("#primary-nav button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  $$(".tab-view").forEach((view) => { view.hidden = view.id !== `${tab}-tab`; });
  $("#page-title").textContent = labels[tab];
  if (tab === "chat") requestAnimationFrame(sizeConversation);
}

function sizeConversation() {
  const layout = $(".chat-layout");
  if (state.activeTab !== "chat" || !layout) return;
  const viewport = window.visualViewport?.height || innerHeight;
  const navigation = $(".sidebar").getBoundingClientRect().height;
  layout.style.setProperty("--chat-height", `${Math.max(260, viewport - layout.getBoundingClientRect().top - navigation - 8)}px`);
}
window.addEventListener("resize", sizeConversation);
window.visualViewport?.addEventListener("resize", sizeConversation);
$('#profile-dialog').addEventListener('cancel',()=>{
  if(routedProfile())history.pushState({},'', '/app/');
});
$('#profile-dialog').addEventListener('close',()=>{
  // Report, block and chat actions also close this route, not only its Back button.
  if(routedProfile())history.pushState({},'', '/app/');
});

async function initialize() {
  try {
    document.body.dataset.activeTab = state.activeTab;
    state.config = await api("/api/social/config");
    if (state.config.demoModeEnabled && (state.config.demoAutoStartEnabled || new URLSearchParams(location.search).get("demo") === "1")) {
      // Prefer a legitimate live session. Anonymous/disabled canaries use only browser fixtures.
      if (!state.config.socialAppEnabled) return await startDemo();
      try { await api("/api/auth/me"); }
      catch (error) { if (error.status === 401) return await startDemo(); throw error; }
    }
    if (!state.config.socialAppEnabled) {
      $("#global-status").textContent = "";
      $("#disabled-view").hidden = false;
      $("#demo-start").hidden = !state.config.demoModeEnabled;
      return;
    }
    try { state.account = await api("/api/auth/me"); }
    catch (error) {
      if (error.status === 401) return location.replace("/signup.html?next=%2Fapp%2F");
      throw error;
    }
    if (state.account.acceptanceRequired || state.account.nextPath === "/acceptance") {
      return location.replace("/acceptance");
    }
    if (state.account.nextPath === "/app/?onboarding=1") {
      document.body.dataset.flow = "onboarding";
      $("#global-status").textContent = "";
      $("#onboarding-view").hidden = false;
      $("#onboarding-form").elements.name.value = state.account.user.displayName || "";
      return;
    }
    try { state.profile = (await api("/api/social/profile")).profile; }
    catch (error) {
      if (error.code === "not_found" && state.config.adultOnboardingEnabled) {
        document.body.dataset.flow = "onboarding";
        $("#global-status").textContent = "";
        $("#onboarding-view").hidden = false;
        $("#onboarding-form").elements.name.value = state.account.user.displayName || "";
        return;
      }
      throw error;
    }
    $("#global-status").textContent = "";
    delete document.body.dataset.flow;
    $("#social-view").hidden = false;
    if (localStorage.getItem("chatgun-notifications") === "enabled") $("#notification-toggle").textContent = "ปิดการแจ้งเตือนข้อความในอุปกรณ์นี้";
    fillProfile();
    await Promise.all([loadPeople(), loadRelationships(), loadRatings(), loadBlocked(), loadOwnGallery(), loadUploadQuotas(), loadVerification(), loadMediaSafety()]);
    await monitorLocationPermission();
    if (location.pathname === "/app/photos") openOwnGallery(false);
    const route = routedProfile();
    if (route) await showPerson(route.user, { historyMode: "none", photo: route.photo });
  } catch (error) {
    $("#global-status").textContent = error.message || "ไม่สามารถโหลด ChatGun ได้";
    toast(error.message, true);
  } finally {
    $("#app").setAttribute("aria-busy", "false");
  }
}

$("#primary-nav").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (button) switchTab(button.dataset.tab);
});

$("#onboarding-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const data = new FormData(event.currentTarget);
  setBusy(button, true);
  try {
    const result = await api("/api/social/onboarding/member", { method: "POST", body: { name: data.get("name"), gender: data.get("gender"), bio: data.get("bio"), interests: data.get("interests") } });
    state.profile = result.profile;
    location.reload();
  } catch (error) { toast(error.message, true); } finally { setBusy(button, false); }
});

$("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  setBusy(event.submitter, true);
  try {
    state.profile = (await api("/api/social/profile", { method: "POST", body: { action: "edit", name: data.get("name"), gender: data.get("gender"), bio: data.get("bio"), interests: data.get("interests") } })).profile;
    toast("บันทึกโปรไฟล์แล้ว");
  } catch (error) { toast(error.message, true); } finally { setBusy(event.submitter, false); }
});

$("#hide-discovery").addEventListener("click", async (event) => {
  const button=event.currentTarget;
  setBusy(button, true);
  try {
    await api("/api/social/profile", { method: "POST", body: { action: "hide" } });
    state.locationFresh = false; state.people = []; renderPeople(); toast("ปิดการค้นหาและล้างตำแหน่งแล้ว");
  } catch (error) { toast(error.message, true); } finally { setBusy(button, false); }
});

$("#notification-toggle").addEventListener("click", async (event) => {
  if (!("Notification" in window)) return toast("เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน", true);
  const button = event.currentTarget;
  const enabled = localStorage.getItem("chatgun-notifications") === "enabled";
  if (enabled) {
    localStorage.removeItem("chatgun-notifications");
    button.textContent = "เปิดการแจ้งเตือนข้อความในอุปกรณ์นี้";
    return toast("ปิดการแจ้งเตือนในอุปกรณ์นี้แล้ว");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return toast("ไม่ได้รับอนุญาตให้แสดงการแจ้งเตือน", true);
  localStorage.setItem("chatgun-notifications", "enabled");
  button.textContent = "ปิดการแจ้งเตือนข้อความในอุปกรณ์นี้";
  toast("เปิดการแจ้งเตือนแล้ว");
});
$("#view-own-profile").addEventListener("click", () => showPerson(state.account.user.id));
function openOwnGallery(push=true){switchTab('profile');document.body.dataset.ownGallery='true';if(push)history.pushState({},'', '/app/photos');}
$('#manage-gallery').addEventListener('click',()=>openOwnGallery());
$('#gallery-settings-back').addEventListener('click',()=>{switchTab('profile');history.pushState({},'', '/app/');});

$("#gallery-upload").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const form = event.currentTarget;
  const data = new FormData(form);
  setBusy(button, true, "กำลังอัปโหลด…");
  try {
    const file = data.get("file");
    if (file instanceof File) data.set("file", await optimizeImage(file));
    if (state.demo) {
      if (state.demoGallery.filter((photo) => photo.owner === "demo-me").length >= 12) throw new Error("อัปโหลดได้สูงสุด 12 รูป");
      const optimized = data.get("file");
      const photo = { id: crypto.randomUUID(), owner: "demo-me", caption: String(data.get("caption") || ""), url: await fileDataUrl(optimized), like_count: 0, liked: false, comments: [], created_at: Math.floor(Date.now() / 1000) };
      consumeDemoUpload("gallery");
      state.demoGallery.unshift(photo);
      state.myGallery = state.demoGallery.filter((item) => item.owner === "demo-me");
      await demoSave(); form.reset(); renderOwnGallery(); toast("เพิ่มรูปตัวอย่างแล้ว"); return;
    }
    const headers = { "x-csrf-token": decodeURIComponent(cookie("__Host-cg_csrf")), accept: "application/json" };
    headers["idempotency-key"] = form.dataset.idempotencyKey ||= crypto.randomUUID();
    const response = await fetch("/api/social/gallery", { method: "POST", credentials: "same-origin", headers, body: data });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (payload.code === "daily_upload_limit_reached") await loadUploadQuotas();
      throw new Error(payload.message || payload.error || "อัปโหลดไม่สำเร็จ");
    }
    delete form.dataset.idempotencyKey;
    form.reset();
    await Promise.all([loadOwnGallery(), loadUploadQuotas()]);
    toast("อัปโหลดรูปแล้ว");
  } catch (error) { toast(error.message, true); } finally { setBusy(button, false); }
});

$("#verification-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = event.submitter;
  const data = new FormData(event.currentTarget);
  data.set("consent", data.get("consent") ? "accepted" : "");
  setBusy(button, true, "กำลังส่งอย่างปลอดภัย…");
  try {
    for (const field of ["identity", "selfie"]) {
      const file = data.get(field);
      if (file instanceof File) data.set(field, await optimizeImage(file));
    }
    const response = await fetch("/api/social/verification", { method: "POST", credentials: "same-origin", headers: { "x-csrf-token": decodeURIComponent(cookie("__Host-cg_csrf")), accept: "application/json" }, body: data });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "ส่งหลักฐานไม่สำเร็จ");
    form.reset();
    await loadVerification();
    toast("ส่งหลักฐานแล้ว");
  } catch (error) { toast(error.message, true); } finally { setBusy(button, false); }
});

$("#location-toggle").addEventListener("click", updateLocation);
$("#filter-toggle").addEventListener("click", () => {
  $('#discovery-filters .filter-host').append($('.filter-row'));
  $('#discovery-filters').showModal();
  $('#filter-toggle').setAttribute('aria-expanded','true');
});
$('#discovery-filters').addEventListener('close',()=>{
  $('.discovery-controls').append($('#discovery-filters .filter-row'));
  $('#filter-toggle').setAttribute('aria-expanded','false');
});
$("#demo-start").addEventListener("click", () => startDemo().catch((error) => toast(error.message, true)));
$("#refresh").addEventListener("click", async () => { try { await Promise.all([loadPeople(), loadRelationships(), loadRatings(), loadBlocked()]); toast("อัปเดตข้อมูลแล้ว"); } catch (error) { toast(error.message, true); } });
[$("#people-search"), $("#radius-filter"), $("#gender-filter"), $("#interest-filter"), $("#relationship-filter")].forEach((input) => input.addEventListener("input", renderPeople));

document.addEventListener("click", async (event) => {
  if(event.target.closest('.picker-toggle')){
    const picker=$('#thread .chat-image-picker');picker.hidden=!picker.hidden;$('#thread .picker-toggle').setAttribute('aria-expanded',String(!picker.hidden));
    if(picker.hidden){state.chosenAsset=null;$('#thread input[name=body]').disabled=false;}
    if(!picker.hidden)try{const{assets}=await api('/api/social/chat-assets');$('.image-picker-carousel',picker).innerHTML=assets.length?assets.map(a=>`<button type="button" data-picker-asset="${escapeHtml(a.id)}" aria-label="เลือกรูปนี้" aria-pressed="false"><img src="${escapeHtml(chatMediaUrl(a.id))}" alt="รูปแชทเดิม"></button>`).join(''):'<p>ยังไม่มีรูปแชทเดิม เลือกอัปโหลดรูปใหม่ได้</p>';const upload=$('[data-picker-upload]',picker);upload.disabled=Number(state.uploadQuotas.chat.remaining)<=0;}catch(error){toast(error.message,true);}return;
  }
  if(event.target.closest('[data-picker-upload]')){state.chosenAsset=null;$('#thread input[name=body]').disabled=false;$('#thread input[name=file]').click();return;}
  if(event.target.closest('[data-picker-close]')){state.chosenAsset=null;$('#thread .chat-image-picker').hidden=true;$('#thread .picker-toggle').setAttribute('aria-expanded','false');$('#thread input[name=body]').disabled=false;return;}
  const chosen=event.target.closest('[data-picker-asset]');
  if(chosen){state.chosenAsset=chosen.dataset.pickerAsset;$$('[data-picker-asset]').forEach(b=>{b.classList.toggle('selected',b===chosen);b.setAttribute('aria-pressed',String(b===chosen));});$('#thread input[name=body]').disabled=true;return;}
  if(event.target.closest('[data-apply-filters]')){$('#discovery-filters').close();return;}
  const profileTab=event.target.closest('[data-profile-tab]');
  if(profileTab){$('#profile-dialog').close();history.replaceState({},'', '/');switchTab(profileTab.dataset.profileTab);return;}
  const galleryReturn = event.target.closest('[data-gallery-return]');
  if (galleryReturn) { await showPerson(galleryReturn.dataset.galleryReturn,{historyMode:'replace'}); $('.member-profile-gallery-top').click(); return; }
  const pagination = event.target.closest('[data-discovery-page]');
  if (pagination) { state.discoveryPage = Number(pagination.dataset.discoveryPage); renderPeople(); $('#people-grid').scrollIntoView({block:'start'}); return; }
  if (event.target.closest('[data-clear-filters]')) { $('#people-search').value=''; $('#interest-filter').value=''; $('#gender-filter').value='ทั้งหมด'; $('#relationship-filter').value='all'; $('#radius-filter').value='5000'; renderPeople(); return; }
  if (event.target.closest('.demo-info')) { toast('บุคคล ระยะทาง และบทสนทนาสมมติ บันทึกเฉพาะในเบราว์เซอร์ ไม่ติดต่อสมาชิกจริง'); return; }
  const profileGallery = event.target.closest("[data-profile-gallery]");
  if (profileGallery) {
    const view = profileGallery.closest(".member-profile-view");
    const gallery = view.querySelector(".member-profile-gallery");
    const open = gallery.hidden;
    gallery.hidden = !open;
    view.classList.toggle("gallery-open", open);
    view.querySelector(".member-profile-gallery-top")?.setAttribute("aria-expanded", String(open));
    return;
  }
  const close = event.target.closest(".dialog-close, [data-close-profile]");
  if (close) {
    const dialog = close.closest("dialog");
    dialog.close();
    if (dialog.id === "profile-dialog" && routedProfile()) history.pushState({}, "", "/app/");
    return;
  }
  const mediaReport = event.target.closest("[data-media-report]");
  if (mediaReport) {
    $("#profile-dialog").close();
    $("#media-report-form").elements.mediaId.value = mediaReport.dataset.mediaReport;
    $("#media-report-dialog").showModal();
    return;
  }
  const mediaAppeal = event.target.closest("[data-media-appeal]");
  if (mediaAppeal) {
    $("#media-appeal-form").elements.mediaId.value = mediaAppeal.dataset.mediaAppeal;
    $("#media-appeal-dialog").showModal();
    return;
  }
  if (event.target.closest(".chat-back")) { $(".chat-layout").classList.remove("open"); state.selectedChat = null; return; }
  if (event.target.closest(".load-older")) {
    const oldest = state.threadMessages.at(-1);
    if (oldest) try { await loadMessagePage(state.selectedChat, oldest); } catch (error) { toast(error.message, true); }
    return;
  }
  const messageAction = event.target.closest("[data-message-action]");
  if (messageAction) {
    if (!confirm("ยกเลิกข้อความนี้หรือไม่?")) return;
    try { await api("/api/social/messages", { method: "POST", body: { action: "unsend", id: messageAction.dataset.message } }); await openChat(state.selectedChat); }
    catch (error) { toast(error.message, true); }
    return;
  }
  if (event.target.closest(".asset-library")) {
    try {
      const assets = (await api("/api/social/chat-assets")).assets;
      $("#asset-grid").innerHTML = assets.length ? assets.map((asset) => `<button data-asset="${escapeHtml(asset.id)}" aria-label="เลือกรูปเพื่อส่งต่อ"><img src="${escapeHtml(chatMediaUrl(asset.id))}" alt="รูปที่เคยส่ง"><span>➤ ส่งต่อ</span></button>`).join("") : `<p class="subtitle">ยังไม่มีรูปที่ส่งล่าสุด</p>`;
      $("#asset-dialog").showModal();
    } catch (error) { toast(error.message, true); }
    return;
  }
  const reusableAsset = event.target.closest("[data-asset]");
  if (reusableAsset) {
    $('#asset-grid').innerHTML=`<div class="forward-friends"><h2>เลือกเพื่อนที่จะส่งรูป</h2>${state.relationships.filter(p=>p.status==='accepted').map(p=>`<button data-forward-user="${escapeHtml(p.other_user_id)}" data-forward-asset="${escapeHtml(reusableAsset.dataset.asset)}"><div class="chat-friend-photo">${portrait(p,false)}</div>${escapeHtml(p.name)} <span aria-hidden="true">➤</span></button>`).join('')}</div>`;
    return;
  }
  const forward=event.target.closest('[data-forward-user]');
  if(forward){
    setBusy(forward,true);
    try { await api("/api/social/messages", { method: "POST", body: { action: "send", target: forward.dataset.forwardUser, mediaId: forward.dataset.forwardAsset, body: "" } }); $("#asset-dialog").close(); await openChat(forward.dataset.forwardUser); }
    catch (error) { toast(error.message, true);setBusy(forward,false); }
    return;
  }
  const chat = event.target.closest("[data-chat]");
  if (chat) return openChat(chat.dataset.chat);
  const galleryAction = event.target.closest("[data-gallery-action]");
  if (galleryAction) {
    event.preventDefault();
    const { galleryAction: name, photo, user } = galleryAction.dataset;
    if (name === "view") {
      try { await openGalleryPhoto(user, photo); } catch (error) { toast(error.message, true); }
      return;
    }
    if (["previous", "next"].includes(name) && state.galleryView) {
      state.galleryView.index += name === "next" ? 1 : -1;
      const current = state.galleryView.photos[state.galleryView.index];
      try { await openGalleryPhoto(state.galleryView.owner, current.id); } catch (error) { toast(error.message, true); }
      return;
    }
    if (name === "delete" && !confirm("ลบรูปนี้หรือไม่? การลบไฟล์จริงจะดำเนินการผ่านคิวอย่างปลอดภัย")) return;
    try {
      await api("/api/social/gallery", { method: "POST", body: { action: name, id: photo } });
      if (["delete", "select"].includes(name)) await loadOwnGallery();
      if (name === "like" && state.galleryView) await openGalleryPhoto(state.galleryView.owner, photo, { historyMode: "replace" });
      toast(name === "delete" ? "ซ่อนรูปและส่งเข้าคิวลบแล้ว" : name === "select" ? "ตั้งรูปหลักแล้ว" : "บันทึกแล้ว");
    } catch (error) { toast(error.message, true); }
    return;
  }
  const action = event.target.closest("[data-action]");
  if (action) {
    event.preventDefault();
    const { action: name, user } = action.dataset;
    if (["request", "accept", "reject", "cancel", "unfriend"].includes(name)) {
      $("#profile-dialog").close();
      return relationshipAction(name, user, action);
    }
    if (name === "chat") { $("#profile-dialog").close(); return openChat(user); }
    if (name === "rate") { $("#profile-dialog").close(); $("#rating-form").elements.target.value = user; return $("#rating-dialog").showModal(); }
    if (name === "block" || name === "unblock") {
      if (name === "block" && !confirm("บล็อกผู้ใช้นี้และยุติความสัมพันธ์หรือไม่?")) return;
      try { await api("/api/social/blocks", { method: "POST", body: { action: name, target: user } }); $("#profile-dialog").close(); await Promise.all([loadPeople(), loadRelationships(), loadBlocked()]); toast(name === "block" ? "บล็อกผู้ใช้แล้ว" : "เลิกบล็อกแล้ว"); } catch (error) { toast(error.message, true); }
      return;
    }
    if (name === "report") {
      $("#profile-dialog").close();
      $("#report-form").elements.target.value = user;
      return $("#report-dialog").showModal();
    }
  }
  const card = event.target.closest("[data-person]");
  if (card && !event.target.closest("button")) showPerson(card.dataset.person);
});

document.addEventListener("keydown", (event) => {
  if (event.key === 'Escape') { $('.toolbar')?.classList.remove('filters-open'); $('#filter-toggle')?.setAttribute('aria-expanded','false'); }
  if (!['Enter', ' '].includes(event.key) || event.target.closest("button, a, input, select, textarea")) return;
  const card = event.target.closest("[data-person]");
  if (card) { event.preventDefault(); showPerson(card.dataset.person); }
});

$("#profile-dialog").addEventListener("submit", async (event) => {
  if (!event.target.matches("#gallery-comment")) return;
  event.preventDefault();
  const data = new FormData(event.target);
  setBusy(event.submitter, true);
  try {
    await api("/api/social/gallery", { method: "POST", body: { action: "comment", id: data.get("photo"), comment: data.get("comment") } });
    toast("ส่งความคิดเห็นแล้ว");
    await openGalleryPhoto(data.get("owner"), data.get("photo"), { historyMode: "replace" });
  } catch (error) { toast(error.message, true); } finally { setBusy(event.submitter, false); }
});

$('#thread').addEventListener('change',event=>{
  if(event.target.matches('input[name=file]')&&event.target.files?.length)event.target.closest('form').requestSubmit();
});
$("#thread").addEventListener("submit", async (event) => {
  if (!event.target.matches(".composer")) return;
  event.preventDefault();
  const input = $("input[name=body]", event.target);
  const file = $("input[name=file]", event.target)?.files?.[0];
  const body = input.value.trim();
  if (!body && !file && !state.chosenAsset) return;
  setBusy(event.submitter, true);
  try {
    if(state.chosenAsset){await api('/api/social/messages',{method:'POST',body:{action:'send',target:state.selectedChat,mediaId:state.chosenAsset,body:''}});state.chosenAsset=null;await openChat(state.selectedChat);return;}
    if (file) {
      const optimized = await optimizeImage(file);
      if (state.demo) {
        const asset = { id: crypto.randomUUID(), url: await fileDataUrl(optimized), created_at: Math.floor(Date.now() / 1000) };
        consumeDemoUpload("chat");
        state.demoAssets.unshift(asset);
        state.demoAssets = state.demoAssets.slice(0, 5);
        await api("/api/social/messages", { method: "POST", body: { action: "send", target: state.selectedChat, mediaId: asset.id, body: "" } });
        await demoSave();
      } else {
      const data = new FormData(); data.set("target", state.selectedChat); data.set("file", optimized);
      const idempotencyKey = event.target.dataset.idempotencyKey ||= crypto.randomUUID();
      const response = await fetch("/api/social/messages", { method: "POST", credentials: "same-origin", headers: { "x-csrf-token": decodeURIComponent(cookie("__Host-cg_csrf")), "idempotency-key": idempotencyKey, accept: "application/json" }, body: data });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.code === "daily_upload_limit_reached") await loadUploadQuotas();
        throw new Error(payload.message || payload.error || "ส่งรูปไม่สำเร็จ");
      }
      delete event.target.dataset.idempotencyKey;
      await loadUploadQuotas();
      }
    } else await api("/api/social/messages", { method: "POST", body: { action: "send", target: state.selectedChat, body } });
    input.value = ""; event.target.reset(); await openChat(state.selectedChat);
  }
  catch (error) { toast(error.message, true); } finally { setBusy(event.submitter, false); }
});

$("#rating-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(event.currentTarget);
  setBusy(event.submitter, true);
  try { await api("/api/social/ratings", { method: "POST", body: { target: data.get("target"), score: Number(data.get("score")), comment: data.get("comment") } }); $("#rating-dialog").close(); form.reset(); toast("ส่งความคิดเห็นแล้ว"); }
  catch (error) { toast(error.message, true); } finally { setBusy(event.submitter, false); }
});

$("#report-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(event.currentTarget);
  setBusy(event.submitter, true);
  try {
    await api("/api/social/reports", { method: "POST", body: { target: data.get("target"), category: data.get("category"), details: data.get("details") } });
    $("#report-dialog").close(); form.reset(); toast(state.demo ? "บันทึกรายงานตัวอย่างในเบราว์เซอร์แล้ว" : "ส่งรายงานให้ผู้ดูแลแล้ว");
  } catch (error) { toast(error.message, true); } finally { setBusy(event.submitter, false); }
});

$("#media-report-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(event.currentTarget); setBusy(event.submitter, true);
  try {
    await api("/api/social/reports/media", { method: "POST", body: { mediaId: data.get("mediaId"), reason: data.get("reason"), details: data.get("details") } });
    $("#media-report-dialog").close(); form.reset(); toast(state.demo ? "บันทึกรายงานรูปตัวอย่างในเบราว์เซอร์แล้ว" : "ส่งรายงานรูปภาพให้ผู้ดูแลแล้ว");
  } catch (error) { toast(error.message, true); } finally { setBusy(event.submitter, false); }
});

$("#media-appeal-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(event.currentTarget); setBusy(event.submitter, true);
  try {
    await api("/api/social/media/appeals", { method: "POST", body: { mediaId: data.get("mediaId"), reason: data.get("reason") } });
    $("#media-appeal-dialog").close(); form.reset(); await loadMediaSafety(); toast(state.demo ? "บันทึกคำอุทธรณ์ตัวอย่างในเบราว์เซอร์แล้ว" : "ส่งคำอุทธรณ์แล้ว");
  } catch (error) { toast(error.message, true); } finally { setBusy(event.submitter, false); }
});

initialize();

window.addEventListener("offline", () => { $("#global-status").textContent = "ออฟไลน์ — การเปลี่ยนแปลงจะยังไม่ถูกส่ง"; });
window.addEventListener("online", () => { $("#global-status").textContent = ""; toast("กลับมาออนไลน์แล้ว"); refreshOpenThread().catch(() => {}); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.config?.socialAppEnabled && state.profile) {
    Promise.all([loadPeople(), loadRelationships(), refreshOpenThread()]).catch(() => {});
    if (state.locationWatch !== null && Date.now() - state.lastLocationPost > 55_000) {
      navigator.geolocation.getCurrentPosition(async ({ coords }) => {
        state.lastLocationPost = Date.now();
        try {
          await api("/api/social/discovery", { method: "POST", body: { action: "location", latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy } });
          await loadPeople();
        } catch { await revokeLocationPublication({ notifyServer: state.locationFresh }); }
      }, () => revokeLocationPublication({ notifyServer: state.locationFresh }), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    }
  }
});
setInterval(() => {
  if (document.visibilityState === "visible" && navigator.onLine && state.config?.socialAppEnabled && state.profile) {
    Promise.all([loadPeople(), loadRelationships()]).catch(() => {});
  }
}, 30_000);
setInterval(() => {
  if (document.visibilityState === "visible" && navigator.onLine) refreshOpenThread().catch(() => {});
}, 10_000);
window.addEventListener("pagehide", () => {
  if (state.locationWatch !== null && navigator.geolocation) navigator.geolocation.clearWatch(state.locationWatch);
  if (state.locationPermission) state.locationPermission.onchange = null;
});
window.addEventListener("popstate", () => {
  if(location.pathname==='/app/photos')openOwnGallery(false);
  else delete document.body.dataset.ownGallery;
  const route = routedProfile();
  if (route) showPerson(route.user, { historyMode: "none", photo: route.photo });
  else if ($("#profile-dialog").open) $("#profile-dialog").close();
});
