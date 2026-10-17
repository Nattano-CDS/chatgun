import { offerDemoRetirement } from "./retire-demo.js";
import { createOnlinePresence } from "./online-presence.js";
let onlinePresence;
const onlineSlot=(person,id)=>window.ChatgunNearComponents.online(person,id,escapeHtml);
async function startOnlinePresence() {
  onlinePresence = createOnlinePresence({ request: (path,options={})=>api(path,{signal:AbortSignal.timeout(8000),...options}), targets: () => [...document.querySelectorAll("[data-online-user]")].filter((e) => e.parentElement.getClientRects().length).map((e) => e.dataset.onlineUser), apply: (statuses) => {
    for (const slot of document.querySelectorAll("[data-online-user]")) slot.innerHTML = statuses[slot.dataset.onlineUser] === !0 ? '<span class="member-online-dot" aria-hidden="true"></span><span>ออนไลน์</span>' : "";
  }, preference: (enabled) => {
    $("#online-status-toggle").checked = enabled;
  } }), $("#online-preference").hidden = !1, await onlinePresence.start();
  new MutationObserver(records=>{
    if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches('[data-online-user]')||node.querySelector('[data-online-user]')))))void onlinePresence.refresh();
  }).observe(document.body,{childList:true,subtree:true});
}
addEventListener("pagehide", () => onlinePresence?.stop());
document.addEventListener('change',async(event)=>{
  if(event.target.id!=='online-status-toggle'||!onlinePresence)return;
  const control=event.target;control.disabled=true;
  try{await onlinePresence.setVisible(control.checked);}catch(error){control.checked=!control.checked;toast(error.message,true);}finally{control.disabled=false;}
});
const state = {
  config: null,
  account: null,
  profile: null,
  people: [],
  discoveryPage: 1,
  discoveryFilter: "",
  relationships: [],
  conversations: [],
  conversationMore: !1,
  conversationOffset: 0,
  album: null,
  ratings: [],
  blocked: [],
  myGallery: [],
  mediaAppeals: [],
  appealableMedia: [],
  moderationNotifications: [],
  verification: null,
  activeTab: ["near", "chat", "reviews", "profile"].includes(new URLSearchParams(location.search).get("tab")) ? new URLSearchParams(location.search).get("tab") : "near",
  selectedPerson: null,
  selectedChat: null,
  locationFresh: !1,
  locationWatch: null,
  lastLocationPost: 0,
  lastUnread: 0,
  threadMessages: [],
  threadHasMore: !1,
  galleryView: null,
  chosenAsset: null,
  threadPolling: !1,
  locationPermission: null,
  uploadQuotas: {
    timezone: "Asia/Bangkok",
    chat: { limit: 10, used: 0, reserved: 0, remaining: 10 },
    gallery: { limit: 10, used: 0, reserved: 0, remaining: 10 }
  }
}, $ = (selector, root = document) => root.querySelector(selector), $$ = (selector, root = document) => [...root.querySelectorAll(selector)], userPlusIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-plus" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" x2="19" y1="8" y2="14"></line><line x1="22" x2="16" y1="11" y2="11"></line></svg>', starIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path></svg>', imagesIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-images" aria-hidden="true"><path d="m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16"></path><path d="M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2"></path><circle cx="13" cy="7" r="1" fill="currentColor"></circle><rect x="8" y="2" width="14" height="14" rx="2"></rect></svg>', gridIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-grid-3x3 lucide-grid lucide-grid-3-x-3" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M3 9h18"></path><path d="M3 15h18"></path><path d="M9 3v18"></path><path d="M15 3v18"></path></svg>';
document.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.closest(".portrait,.gallery-item,.avatar,.ig-tile,.lightbox-image,.manage-photo-grid,.card-photo,.full-profile-image,.gallery-avatar")) return;
  const parent = image.parentElement;
  image.hidden = !0, parent.dataset.imageError = "รูปภาพไม่พร้อมใช้งาน", parent.setAttribute("role", "img"), parent.setAttribute("aria-label", image.alt || "รูปภาพไม่พร้อมใช้งาน");
}, !0);
function cookie(name) {
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}
async function api(path, options = {}) {
  const headers = { accept: "application/json", ...options.headers || {} }, method = options.method || "GET";
  options.body !== void 0 && (headers["content-type"] = "application/json", options.body = JSON.stringify(options.body)), method !== "GET" && method !== "HEAD" && (headers["x-csrf-token"] = decodeURIComponent(cookie("__Host-cg_csrf")));
  const response = await fetch(path, { credentials: "same-origin", ...options, method, headers }), payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "ไม่สามารถดำเนินการได้");
    throw error.code = payload.code || "request_failed", error.status = response.status, error;
  }
  return payload;
}
function currentActor() {
  return state.account?.user?.id;
}
function populateAvatar(element, person) {
  const url = person.selected_photo_id ? galleryMediaUrl(person.selected_photo_id) : "";
  element && url && (element.innerHTML = `<img src="${escapeHtml(url)}" alt="">`);
}
function escapeHtml(value) {
  const node = document.createElement("span");
  return node.textContent = String(value ?? ""), node.innerHTML.replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function galleryMediaUrl(id) {
  return `/api/social/media/${encodeURIComponent(id)}`;
}
function chatMediaUrl(id) {
  return `/api/social/chat/media/${encodeURIComponent(id)}`;
}
function fileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result)), reader.onerror = () => reject(new Error("ไม่สามารถอ่านรูปได้")), reader.readAsDataURL(file);
  });
}
async function optimizeImage(file) {
  if (!(file instanceof File) || !file.type.startsWith("image/") || !("createImageBitmap" in window)) return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 2 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)), canvas.height = Math.max(1, Math.round(bitmap.height * scale)), canvas.getContext("2d", { alpha: !0 }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("ไม่สามารถปรับขนาดรูปได้")), "image/webp", 0.86));
    return new File([blob], `${file.name.replace(/\.[^.]+$/u, "") || "image"}.webp`, { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}
function initials(name) {
  return [...String(name || "?").trim()].slice(0, 2).join("").toUpperCase();
}
function formatDistance(metres, label = "") {
  return label || (Number.isFinite(Number(metres)) ? metres < 1e3 ? `${Math.round(metres)} ม.` : `${(metres / 1e3).toFixed(1)} กม.` : "");
}
function toast(message, error = !1) {
  const box = $("#toast");
  box.textContent = message, box.classList.toggle("error", error), box.hidden = !1, clearTimeout(toast.timer), toast.timer = setTimeout(() => {
    box.hidden = !0;
  }, 4200);
}
function setBusy(button, busy, label = "กำลังดำเนินการ…") {
  button && (busy ? (button.dataset.label = button.textContent, button.textContent = label, button.disabled = !0) : (button.textContent = button.dataset.label || button.textContent, button.disabled = !1));
}
function relationshipFor(userId) {
  return state.relationships.find((item) => item.other_user_id === userId);
}
function routedProfile() {
  const upload = location.pathname.match(/^\/app\/me\/(gallery|private-gallery)\/upload\/?$/u);
  if (upload) return { user: currentActor(), photo: "upload", private: upload[1] === "private-gallery" };
  const match = location.pathname.match(/^\/app\/people\/([^/]+)(?:\/(gallery|private-gallery)(?:\/([^/]+))?)?\/?$/u);
  if (!match) return null;
  try {
    return { user: decodeURIComponent(match[1]), photo: match[3] ? decodeURIComponent(match[3]) : match[2] ? "gallery" : null, private: match[2] === "private-gallery" };
  } catch {
    return { user: "", photo: null };
  }
}
function profilePath(user, photo = null) {
  return photo === "upload" ? `/app/me/${state.privateAlbumOpen ? "private-gallery" : "gallery"}/upload` : `/app/people/${encodeURIComponent(user)}${photo ? `/${state.privateAlbumOpen ? "private-gallery" : "gallery"}${photo === "gallery" ? "" : "/" + encodeURIComponent(photo)}` : ""}`;
}
function updateProfileRoute(user, photo = null, mode = "push") {
  const path = profilePath(user, photo);
  `${location.pathname}${location.search}` !== path && history[mode === "replace" ? "replaceState" : "pushState"]({ user, photo }, "", path);
}
function portrait(person, distance = !0) {
  const selectedUrl = person.selected_photo_id ? galleryMediaUrl(person.selected_photo_id) : "";
  return `<div class="portrait">${selectedUrl ? `<img class="profile-photo" src="${escapeHtml(selectedUrl)}" alt="รูปของ ${escapeHtml(person.name)}">` : escapeHtml(initials(person.name))}${distance && person.distance !== void 0 ? `<span class="distance-pill">${escapeHtml(formatDistance(person.distance, person.distance_label))}</span>` : ""}</div>`;
}
function sourcePortrait(person) {
  const url = person.selected_photo_id ? galleryMediaUrl(person.selected_photo_id) : "";
  return url ? `<img class="profile-photo" src="${escapeHtml(url)}" alt="รูปของ ${escapeHtml(person.name)}">` : `<div class="portrait-fallback" role="img" aria-label="ยังไม่มีรูปโปรไฟล์">${escapeHtml(String(person.name || "N").slice(0, 1))}</div>`;
}
function personCard(person, context = "near") {
  const id = person.user_id || person.other_user_id, relation = relationshipFor(id), own = !!(id && id === state.account?.user?.id);
  return ChatgunNearComponents.card({
    person,
    id,
    relation,
    context,
    own,
    messagingEnabled: state.config.messagingEnabled,
    incoming: relation?.status === "pending" && relation.requested_by !== state.account.user.id,
    html: escapeHtml,
    portrait: sourcePortrait,
    distance: formatDistance(person.distance, person.distance_label),
    star: starIcon,
    userPlus: userPlusIcon,
    rateDisabled: !state.locationFresh,
    canRate: !own && state.config.ratingsEnabled && !0
  });
}
function renderPeople() {
  const interestSelect = $("#interest-filter"), interests = [...new Set(state.people.flatMap((p) => String(p.interests || "").split(",").map((s) => s.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b, "th")), optionKey = JSON.stringify(interests);
  if (interestSelect.dataset.options !== optionKey) {
    const selected = interestSelect.value;
    interestSelect.innerHTML = '<option value="">ทั้งหมด</option>' + interests.map((i) => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join(""), interestSelect.value = interests.includes(selected) ? selected : "", interestSelect.dataset.options = optionKey;
  }
  const query = $("#people-search").value.trim().toLocaleLowerCase("th"), gender = $("#gender-filter").value, interest = $("#interest-filter").value.trim().toLocaleLowerCase("th"), radius = Number($("#radius-filter").value), filter = JSON.stringify([query, gender, interest, radius]);
  filter !== state.discoveryFilter && (state.discoveryFilter = filter, state.discoveryPage = 1);
  const people = state.people.filter((person) => {
    if ((person.user_id || person.other_user_id) === state.account?.user?.id) return !1;
    const text = `${person.name} ${person.bio || ""} ${person.interests || ""}`.toLocaleLowerCase("th");
    return (!query || text.includes(query)) && (gender === "ทั้งหมด" || person.gender === gender) && (!interest || String(person.interests || "").toLocaleLowerCase("th").includes(interest)) && Number(person.distance) <= radius;
  });
  $("#people-count").textContent = people.length;
  const pages = Math.max(1, Math.ceil(people.length / 16));
  state.discoveryPage = Math.min(state.discoveryPage, pages);
  const visible = people.slice((state.discoveryPage - 1) * 16, state.discoveryPage * 16), columns = innerWidth >= 1400 ? 4 : innerWidth <= 1100 ? 2 : 3, ad = '<div class="discovery-ad" aria-label="พื้นที่โฆษณา"><span>โฆษณา</span><small>พื้นที่โฆษณา · ยังไม่ได้เชื่อมผู้ให้บริการโฆษณา</small></div>', self = state.profile && state.profile.user_id === state.account?.user?.id ? state.profile : null, cards = [...self ? [self] : [], ...visible], empty = `<div class="empty"><h2>${state.locationFresh ? "ยังไม่พบคนที่ตรงกับการค้นหา" : "เปิดตำแหน่งเพื่อค้นหาเพื่อน"}</h2><p>ChatGun ไม่แสดงพิกัดจริง และรับเฉพาะตำแหน่งที่มีความแม่นยำไม่เกิน 50 เมตร</p><button class="primary" data-clear-filters>ล้างตัวกรอง</button></div>`;
  $("#people-grid").innerHTML = cards.map((person, i) => `${i === columns * 2 ? ad : ""}${personCard(person)}`).join("") + (visible.length ? ad : empty), $("#people-count").title = "จำนวนสมาชิกอื่นที่ตรงตัวกรอง ไม่รวมทางลัดโปรไฟล์ของคุณ", $("#people-count").setAttribute("aria-label", `สมาชิกอื่น ${people.length} คน ไม่รวมโปรไฟล์ของคุณ`), $("#discovery-pagination").hidden = !people.length, $("#discovery-pagination").innerHTML = `<button class="secondary" data-discovery-page="${state.discoveryPage - 1}" ${state.discoveryPage === 1 ? "disabled" : ""}>ก่อนหน้า</button><span aria-live="polite">หน้า ${state.discoveryPage} / ${pages}</span><button class="secondary" data-discovery-page="${state.discoveryPage + 1}" ${state.discoveryPage === pages ? "disabled" : ""}>ถัดไป</button>`;
}
function renderRelationships() {
  const unread = state.conversations.filter((p) => !p.muted).reduce((n, p) => n + Number(p.unread_count || 0), 0);
  unread > state.lastUnread && document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted" && localStorage.getItem("chatgun-notifications") === "enabled" && new Notification("ChatGun", { body: "มีข้อความหรือคำขอใหม่", icon: "/favicon.svg" }), state.lastUnread = unread, $("#message-badge").hidden = !unread, $("#message-badge").textContent = String(unread), renderConversations();
}
function renderConversations(friends = state.conversations) {
  const list = $("#conversation-list");
  list.innerHTML = friends.length ? friends.sort((a, b) => Number(b.last_message_at || b.updated_at) - Number(a.last_message_at || a.updated_at)).map((person) => {
    const preview = person.last_message_at ? person.last_message_unsent_at ? "ยกเลิกส่งข้อความแล้ว" : `${person.last_message_sender_id === state.account.user.id ? "คุณ: " : ""}${person.last_message_media_id ? "ส่งรูปภาพ" : person.last_message_body || "ข้อความ"}` : "เริ่มบทสนทนา", date = person.last_message_at ? new Date(Number(person.last_message_at) * 1e3) : null, time = date ? date.toLocaleDateString("th-TH") === (/* @__PURE__ */ new Date()).toLocaleDateString("th-TH") ? date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : date.toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "";
    return `<button class="conversation ${state.selectedChat === person.other_user_id ? "active" : ""}" data-chat="${escapeHtml(person.other_user_id)}"><span class="avatar">${escapeHtml(initials(person.name))}</span><span class="conversation-copy"><span><span class="member-name-status"><strong>${escapeHtml(person.name)}</strong>${onlineSlot(person,person.other_user_id)}</span><time>${escapeHtml(time)}</time></span><small>${escapeHtml(preview)}</small></span>${Number(person.unread_count || 0) ? `<b class="inbox-unread">${Number(person.unread_count)}</b>` : ""}</button>`;
  }).join("") : '<div class="empty"><p>เลือกสมาชิกจากหน้าค้นหาเพื่อเริ่มแชท</p></div>';
  for (const person of friends) populateAvatar($(`[data-chat="${CSS.escape(person.other_user_id)}"] .avatar`, list), person);
  state.conversationMore && list.insertAdjacentHTML("beforeend", "<button data-more-conversations>โหลดบทสนทนาเพิ่มเติม</button>");
}
function renderRatings() {
  $("#reviews-list").innerHTML = state.ratings.length ? state.ratings.map((rating) => `<article class="review"><div class="review-head"><strong>${escapeHtml(rating.sender_name)}</strong><span>${"★".repeat(Number(rating.score))}</span></div><p>${escapeHtml(rating.comment || "ไม่ได้เขียนความคิดเห็น")}</p><small>${new Date(Number(rating.created_at) * 1e3).toLocaleDateString("th-TH")}</small></article>`).join("") : '<div class="empty"><h2>ยังไม่มีความคิดเห็น</h2><p>ความคิดเห็นที่ได้รับจะแสดงเฉพาะคุณ</p></div>';
}
function fillProfile() {
  if (!state.profile) return;
  const form = $("#profile-form"), avatar = $("#profile-avatar");
  avatar.textContent = String(state.profile.name || "N").slice(0, 1), avatar.style.background = ["#dcf5c3", "#e0e9ff", "#ffe1ca", "#f1ddff"][(state.profile.name?.charCodeAt(0) || 0) % 4], form.elements.name.value = state.profile.name || "", form.elements.gender.value = state.profile.gender || "ไม่ระบุ", form.elements.bio.value = state.profile.bio || "", form.elements.interests.value = state.profile.interests || "", $("#direct-contact-toggle").checked = state.profile.direct_messages_enabled !== 0, $("#profile-verification").disabled = !state.config.identityVerificationEnabled || !1, renderPeople();
}
function renderBlocked() {
  $("#blocked-list").innerHTML = "<h2>ผู้ใช้ที่คุณบล็อก</h2>" + (state.blocked.length ? state.blocked.map((person) => `<div><span>${escapeHtml(person.name)}</span><button type="button" class="secondary small" data-action="unblock" data-user="${escapeHtml(person.user_id)}">เลิกบล็อก</button></div>`).join("") : "<p>ยังไม่มีผู้ใช้ที่บล็อก</p>");
}
function renderOwnGallery() {
  $("#manage-owner").textContent = state.profile?.name || "", $("#manage-cover").innerHTML = sourcePortrait(state.profile || {}), $("#gallery-count").textContent = `${state.myGallery.length} / 12`, $("#gallery-upload").hidden = !state.config.mediaUploadEnabled, $("#gallery-disabled").hidden = state.config.mediaUploadEnabled, renderUploadQuotas(), $("#my-gallery").innerHTML = state.myGallery.length ? state.myGallery.map((photo) => `<article>${["pending", "rejected"].includes(photo.review_status) ? `<div class="pending-media-placeholder">${imagesIcon}<small>${photo.review_status === "rejected" ? "ไม่ผ่านการตรวจ" : "รอผู้ดูแลตรวจสอบ"}</small></div>` : `<img src="${escapeHtml(galleryMediaUrl(photo.id))}" alt="${escapeHtml(photo.caption || "รูป Gallery")}" loading="lazy">`}${photo.selected ? '<span class="cover-label">✓ โปรไฟล์</span>' : ""}<div><button data-gallery-action="select" data-photo="${escapeHtml(photo.id)}" ${photo.selected || ["pending", "rejected"].includes(photo.review_status) ? "disabled" : ""}>ใช้เป็นโปรไฟล์</button><button data-gallery-action="delete" data-photo="${escapeHtml(photo.id)}" aria-label="ลบรูปนี้">${ChatgunNearComponents.icon("trash", 16)}</button></div></article>`).join("") : `<div class="upload-empty">${imagesIcon}<p>เพิ่มรูปแรกของคุณได้เลย</p></div>`;
}
function renderUploadQuotas() {
  const gallery = state.uploadQuotas?.gallery, chat = state.uploadQuotas?.chat, reset = "รีเซ็ต 00:00 น. เวลาไทย";
  if (gallery && $("#gallery-upload-quota")) {
    $("#gallery-upload-quota").textContent = `แกลเลอรี: เหลือ ${gallery.remaining}/${gallery.limit} รูปวันนี้ · ${reset}${gallery.remaining <= 0 ? " · อัปโหลดรูปแกลเลอรีครบขีดจำกัดรายวันแล้ว" : ""}`;
    const form = $("#gallery-upload"), reached = gallery.remaining <= 0;
    form?.querySelectorAll("input, button").forEach((control) => {
      control.disabled = reached;
    }), form?.classList.toggle("quota-reached", reached);
    const route = $("#route-gallery-upload");
    route && ($("[data-route-gallery-quota]", route).textContent = `แกลเลอรี: เหลือ ${gallery.remaining}/${gallery.limit} รูปวันนี้ · ${reset}`, route.querySelectorAll("input,button").forEach((control) => {
      control.disabled = reached;
    }));
  }
  const chatQuota = $("#chat-upload-quota");
  if (chat && chatQuota) {
    chatQuota.textContent = `แชท: เหลือ ${chat.remaining}/${chat.limit} รูปวันนี้ · ${reset}${chat.remaining <= 0 ? " · อัปโหลดรูปในแชทครบขีดจำกัดรายวันแล้ว แต่ยังส่งข้อความได้" : ""}`;
    const file = $("#thread input[name=file]");
    file && (file.disabled = chat.remaining <= 0), file?.closest("label")?.classList.toggle("disabled", chat.remaining <= 0);
  }
}
async function loadUploadQuotas() {
  if (!state.config.mediaUploadEnabled) return renderUploadQuotas();
  state.uploadQuotas = await api("/api/social/upload-quotas", { signal: AbortSignal.timeout(1e4) }), renderUploadQuotas();
}
function galleryCapacity() {
  return state.uploadQuotas.galleryCapacity || { used: 0, limit: 12, remaining: 0 };
}
async function loadOwnGallery() {
  const galleries = await Promise.all(["public", "private"].map((album) => api(`/api/social/gallery?user=${encodeURIComponent(state.account.user.id)}&album=${album}`)));
  state.myGallery = galleries.flatMap((g) => g.photos), renderOwnGallery();
}
function renderMediaSafety() {
  const appealable = $("#appealable-media");
  appealable.innerHTML = state.appealableMedia.length ? state.appealableMedia.map((item) => `<article class="blocked-row"><span><strong>รูป ${escapeHtml(item.media_id)}</strong><small>${escapeHtml(item.decision_reason || "ถูกจำกัดการเข้าถึง")}</small></span><button class="secondary" data-media-appeal="${escapeHtml(item.media_id)}">ยื่นอุทธรณ์</button></article>`).join("") : '<p class="subtitle">ไม่มีรูปที่ยื่นอุทธรณ์ได้</p>';
  const notificationLabels = { media_approved_general: "รูปได้รับอนุมัติเป็นเนื้อหาทั่วไป", media_approved_sensitive: "รูปได้รับอนุมัติเป็นเนื้อหาละเอียดอ่อน", media_rejected_prohibited: "รูปถูกปฏิเสธและจำกัดการเข้าถึง", appeal_granted: "คำอุทธรณ์ได้รับอนุมัติ", appeal_denied: "ยืนยันคำตัดสินเดิมหลังตรวจอุทธรณ์" };
  $("#moderation-notifications").innerHTML = state.moderationNotifications.length ? state.moderationNotifications.map((item) => `<p class="notification-row"><strong>${escapeHtml(notificationLabels[item.message_code] || "มีผลการดูแลสื่อ")}</strong><small>${new Date(Number(item.created_at) * 1e3).toLocaleString("th-TH")}</small></p>`).join("") : '<p class="subtitle">ยังไม่มีการแจ้งผลการดูแล</p>';
}
async function loadMediaSafety() {
  const [appeals, notifications] = await Promise.all([api("/api/social/media/appeals"), api("/api/social/moderation/notifications")]);
  state.mediaAppeals = appeals.appeals || [], state.appealableMedia = appeals.appealable || [], state.moderationNotifications = notifications.notifications || [], renderMediaSafety();
}
async function loadVerification() {
  if (!state.config.identityVerificationEnabled) return;
  state.verification = (await api("/api/social/verification")).verification, $("#verification-panel").hidden = !1;
  const labels = { pending: "กำลังตรวจสอบ", approved: "ยืนยันแล้ว", rejected: "ไม่ผ่านการตรวจสอบ" };
  $("#verification-status").textContent = state.verification ? labels[state.verification.status] : "ยังไม่ส่ง", $("#verification-form").hidden = ["pending", "approved"].includes(state.verification?.status);
}
async function loadRelationships() {
  if (!state.config.messagingEnabled) return;
  const result = await api("/api/social/conversations");
  state.conversations = result.conversations, state.conversationMore = !!result.hasMore, state.conversationOffset = result.nextOffset || state.conversations.length, renderRelationships();
}
async function loadPeople() {
  if (!state.config.publicDiscoveryEnabled) return;
  const result = await api("/api/social/discovery");
  state.people = result.people, state.locationFresh = result.locationFresh, $("#location-banner").classList.toggle("active", state.locationFresh), $("#location-toggle").textContent = state.locationFresh ? "ปิดตำแหน่ง" : "เปิดตำแหน่ง", renderPeople();
}
async function loadRatings() {
  state.config.ratingsEnabled && (state.ratings = (await api("/api/social/ratings")).ratings, renderRatings());
}
async function loadBlocked() {
  state.blocked = (await api("/api/social/blocks")).blocked, renderBlocked();
}
async function updateLocation() {
  const button = $("#location-toggle");
  if (state.locationFresh) {
    setBusy(button, !0);
    try {
      await api("/api/social/discovery", { method: "POST", body: { action: "hide" } }), state.locationWatch !== null && navigator.geolocation.clearWatch(state.locationWatch), state.locationWatch = null, state.people = [], state.locationFresh = !1, renderPeople(), button.textContent = "เปิดตำแหน่ง", $("#location-banner").classList.remove("active");
    } catch (error) {
      toast(error.message, !0);
    } finally {
      button.disabled = !1, delete button.dataset.label;
    }
    return;
  }
  if (!navigator.geolocation) return toast("อุปกรณ์นี้ไม่รองรับตำแหน่ง", !0);
  setBusy(button, !0, "กำลังหาตำแหน่ง…");
  const publish = async ({ coords }) => {
    if (!(document.visibilityState !== "visible" || Date.now() - state.lastLocationPost < 55e3)) {
      state.lastLocationPost = Date.now();
      try {
        await api("/api/social/discovery", { method: "POST", body: { action: "location", latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy } }), state.locationFresh = !0, await loadPeople(), toast("เปิดการค้นหาคนใกล้คุณแล้ว");
      } catch (error) {
        await revokeLocationPublication({ notifyServer: state.locationFresh }), toast(error.message, !0);
      } finally {
        button.disabled = !1, delete button.dataset.label;
      }
    }
  }, failed = async (error) => {
    await revokeLocationPublication({ notifyServer: state.locationFresh }), button.disabled = !1, button.textContent = "เปิดตำแหน่ง", delete button.dataset.label, toast(error.code === 1 ? "กรุณาอนุญาตตำแหน่งเพื่อค้นหาคนใกล้คุณ" : "ไม่สามารถอ่านตำแหน่งได้", !0);
  };
  state.locationWatch = navigator.geolocation.watchPosition(publish, failed, { enableHighAccuracy: !0, timeout: 12e3, maximumAge: 3e4 });
}
async function revokeLocationPublication({ notifyServer = !0 } = {}) {
  state.locationWatch !== null && navigator.geolocation && navigator.geolocation.clearWatch(state.locationWatch), state.locationWatch = null, state.lastLocationPost = 0, notifyServer && state.config?.socialAppEnabled && state.profile && await api("/api/social/discovery", { method: "POST", body: { action: "hide" } }).catch(() => {
  }), state.locationFresh = !1, state.people = [], $("#location-banner")?.classList.remove("active"), $("#location-toggle") && ($("#location-toggle").textContent = "เปิดตำแหน่ง"), $("#people-grid") && renderPeople();
}
async function monitorLocationPermission() {
  if (!(!navigator.permissions?.query || !navigator.geolocation))
    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      state.locationPermission = permission, permission.state === "denied" && await revokeLocationPublication({ notifyServer: state.locationFresh }), permission.onchange = () => {
        permission.state === "denied" && revokeLocationPublication({ notifyServer: state.locationFresh }).then(() => toast("สิทธิ์ตำแหน่งถูกปิด จึงซ่อนคุณจากการค้นหาแล้ว", !0));
      };
    } catch {
    }
}
async function refreshOpenThread() {
  if (!(!state.selectedChat || state.threadPolling || !state.config?.messagingEnabled)) {
    state.threadPolling = !0;
    try {
      await loadMessagePage(state.selectedChat), await api("/api/social/messages", { method: "POST", body: { action: "read", target: state.selectedChat } });
    } finally {
      state.threadPolling = !1;
    }
  }
}
function profileContext(person, photos = []) {
  const id = person.user_id || person.other_user_id || state.account.user.id, relation = relationshipFor(id);
  return {
    person,
    id,
    relation,
    photos,
    own: id === currentActor(),
    album: state.album,
    albumRequests: state.albumRequests || [],
    privateAlbumOpen: !!state.privateAlbumOpen,
    albumLoading: !!state.albumLoading,
    incoming: relation?.status === "pending" && relation.requested_by !== state.account.user.id,
    config: state.config,
    html: escapeHtml,
    portrait: sourcePortrait,
    media: galleryMediaUrl,
    distance: formatDistance(person.distance, person.distance_label),
    star: starIcon,
    grid: gridIcon,
    images: imagesIcon,
    userPlus: userPlusIcon,
    rateDisabled: !state.locationFresh,
    // Live discovery deliberately returns coarse buckets (minimum 250m), not
    // exact proximity. Never derive a 100m entitlement from that public value:
    // keep the action and let the existing server enforce distance/daily limits.
    canRate: id !== state.account.user.id && state.config.ratingsEnabled && !0
  };
}
function openProfileSurface() {
  $("#profile-dialog").hidden = !1, $("#app>main").inert = !0, $(".sidebar").inert = state.personRouteView === "post", document.body.dataset.memberRoute = "true", $$("#primary-nav [data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === "profile")), requestAnimationFrame(() => (state.personRouteView === "post" ? $(".lightbox-close") : $("#profile-dialog button"))?.focus({ preventScroll: !0 }));
}
function closeProfileSurface({ navigate = !0 } = {}) {
  if ($("#profile-dialog").hidden) return;
  state.profileRequest = (state.profileRequest || 0) + 1, $("#profile-dialog").hidden = !0, $("#app>main").inert = !1, $(".sidebar").inert = !1, delete document.body.dataset.memberRoute, delete document.body.dataset.personRoute, $$("#primary-nav [data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === state.activeTab)), navigate && routedProfile() && history.pushState({}, "", state.profileReturnPath || "/");
  const id = state.selectedPerson?.user_id || state.selectedPerson?.other_user_id;
  $$(".card-open").find((b) => b.dataset.personOpen === id)?.focus({ preventScroll: !0 });
}
function renderPersonRoute(view = "profile") {
  if (view === "upload" && uploadSelection.busy && $("#approved-gallery-upload")) return;
  state.personRouteView = view, document.body.dataset.personRoute = view;
  const c = { ...profileContext(state.selectedPerson, state.personPhotos || []), galleryLoadError: state.galleryLoadError };
  $("#profile-dialog-content").innerHTML = view === "gallery" || view === "upload" ? ChatgunGallery[view]({ ...c, management: ChatgunNearComponents.privateAlbum(c), quota: state.uploadQuotas.gallery, capacity: galleryCapacity(), uploading: view === "upload" }) : ChatgunNearComponents[view](c), view === "upload" && mountGalleryUpload(), view === "gallery" && c.own && c.config.mediaUploadEnabled && renderUploadQuotas(), openProfileSurface();
}
let uploadSelection = { path: "", items: [], busy: !1 };
const unsavedUpload = () => state.personRouteView === "upload" && uploadSelection.items.some((p) => !p.done), leaveUpload = () => !uploadSelection.busy && (!unsavedUpload() || confirm("ยังมีรูปที่ไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?"));
let routeStep = Number(history.state?.cgStep || 0), restoringUpload = !1, approvedUnload = !1;
history.replaceState({ ...history.state, cgStep: routeStep }, "");
for (const method of ["pushState", "replaceState"]) {
  const original = history[method].bind(history);
  history[method] = (data, title, url) => {
    method === "pushState" && routeStep++, original({ ...data, cgStep: routeStep }, title, url);
  };
}
document.addEventListener("click", (e) => {
  const navigation = e.target.closest("a[href],[data-gallery-return],[data-profile-return],[data-close-profile],[data-tab],[data-person-open]");
  navigation && state.personRouteView === "upload" && !navigation.hasAttribute("data-upload-again") && !leaveUpload() ? (e.preventDefault(), e.stopImmediatePropagation()) : navigation?.matches("a[href]") && unsavedUpload() && (approvedUnload = !0, setTimeout(() => approvedUnload = !1, 1e3));
}, !0);
window.addEventListener("beforeunload", (e) => {
  !approvedUnload && (unsavedUpload() || uploadSelection.busy) && (e.preventDefault(), e.returnValue = "");
});
function keyboardViewport() {
  document.body.dataset.keyboardOpen = String(!!(window.visualViewport && innerHeight - window.visualViewport.height > 150));
}
window.visualViewport?.addEventListener("resize", keyboardViewport);
document.addEventListener("focusout", () => setTimeout(keyboardViewport, 100));
function mountGalleryUpload() {
  const form = $("#approved-gallery-upload");
  if (!form) return;
  const scope = state.privateAlbumOpen ? "private" : "public", actor = currentActor();
  uploadSelection.path !== location.pathname && (uploadSelection = { path: location.pathname, items: [], busy: !1 });
  const status = (message, error = !1) => {
    const el = $("#gallery-upload-status");
    el && (el.hidden = !message, el.textContent = message, el.setAttribute("role", error ? "alert" : "status"));
  }, allowance = () => Math.min(state.uploadQuotas.gallery.remaining, galleryCapacity().remaining), render = () => {
    if (!form.isConnected) return;
    const pending = uploadSelection.items.filter((p) => !p.done), saved = uploadSelection.items.filter((p) => p.done).length, complete = saved > 0 && !pending.length, capacity = galleryCapacity(), q = state.uploadQuotas.gallery;
    $("[data-selected-count]").textContent = `เลือก ${uploadSelection.items.length} รูป · บันทึกแล้ว ${saved} · ยังไม่บันทึก ${pending.length}`, $("#gallery-upload-previews").innerHTML = uploadSelection.items.map((p, i) => `<div class="thumb-small ${p.done ? "saved" : ""}"><img src="${escapeHtml(p.url)}" alt="ภาพตัวอย่าง ${i + 1}">${p.done ? "" : `<button class="remove" type="button" data-remove-upload="${i}" aria-label="นำรูปที่ ${i + 1} ออก" ${uploadSelection.busy ? "disabled" : ""}>×</button>`}<span class="upload-file-state">${escapeHtml(p.done ? "บันทึกแล้ว · รอผู้ดูแลตรวจสอบ" : p.status || "พร้อมอัปโหลด")}</span></div>`).join(""), $("[data-approved-quota]").textContent = `${q.used} / 10 รูป`, $("[data-album-capacity]").textContent = `${capacity.used} / 12 รูป`, $(".quota-fill").className = `quota-fill used-${Math.min(10, q.used)}`, $("[data-upload-allowance]").textContent = `เพิ่มได้อีก ${allowance()} รูป · เหลือ ${q.remaining} รูปวันนี้ · พื้นที่ว่าง ${capacity.remaining} รูป`;
    const replayOnly = pending.length > 0 && pending.every((p) => p.attempted), submit = $("[data-upload-submit]");
    submit.hidden = complete, submit.disabled = uploadSelection.busy || !pending.length || pending.length > allowance() && !replayOnly, submit.textContent = pending.some((p) => p.failed) ? "ลองเฉพาะรูปที่ยังไม่สำเร็จ" : uploadSelection.busy ? "กำลังบันทึก…" : "บันทึกรูป", $("[data-upload-success]").hidden = !complete, form.dataset.complete = String(complete), complete && status(""), $("[data-upload-summary]").textContent = `ยังไม่บันทึก ${pending.length} รูป · เพิ่มได้อีก ${allowance()} รูป`, $("[data-upload-again]").hidden = !complete, $("[data-upload-view]").hidden = !complete;
    for (const el of form.querySelectorAll("input,textarea")) el.disabled = uploadSelection.busy || complete;
    pending.length > allowance() && !replayOnly && status(`เลือก ${pending.length} รูป แต่เพิ่มได้อีก ${allowance()} รูป (พื้นที่ว่าง ${capacity.remaining} รูป / โควตาวันนี้ ${q.remaining} รูป) กรุณานำรูปที่ยังไม่บันทึกออกก่อน`, !0);
  }, choose = async (files) => {
    if (!uploadSelection.busy) {
      for (const file of files) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 1 || file.size > 8 * 1024 * 1024) {
          status("รองรับ JPG, PNG และ WebP ไม่เกิน 8 MB ต่อรูป", !0);
          continue;
        }
        try {
          (await createImageBitmap(file)).close(), uploadSelection.items.push({ file, url: await fileDataUrl(file), key: crypto.randomUUID(), status: "พร้อมอัปโหลด" });
        } catch {
          status("ไฟล์รูปไม่ถูกต้องหรืออ่านไม่ได้", !0);
        }
      }
      render();
    }
  };
  form.querySelector("input[type=file]").onchange = (e) => choose(e.target.files);
  const zone = $("#gallery-dropzone");
  zone.ondragover = (e) => {
    e.preventDefault(), zone.classList.add("drag");
  }, zone.ondragleave = () => zone.classList.remove("drag"), zone.ondrop = (e) => {
    e.preventDefault(), zone.classList.remove("drag"), choose(e.dataTransfer.files);
  }, form.onclick = (e) => {
    const b = e.target.closest("[data-remove-upload]");
    b && !uploadSelection.busy && !uploadSelection.items[Number(b.dataset.removeUpload)]?.done && (uploadSelection.items.splice(Number(b.dataset.removeUpload), 1), status(""), render()), e.target.closest("[data-upload-again]") && (uploadSelection.items = [], form.reset(), status(""), render(), $("#gallery-file-picker").focus());
  }, form.onsubmit = async (e) => {
    if (e.preventDefault(), uploadSelection.busy) return;
    const pending = uploadSelection.items.filter((p) => !p.done);
    if (!pending.length) {
      status("กรุณาเลือกรูปภาพก่อน", !0);
      return;
    }
    uploadSelection.busy = !0, form.querySelectorAll("button,input,textarea").forEach((el) => el.disabled = !0);
    try {
      if (await loadUploadQuotas(), pending.length > allowance() && !pending.every((p) => p.attempted)) {
        status(`เพิ่มได้อีก ${allowance()} รูปเท่านั้น กรุณาปรับจำนวนรูปก่อนบันทึก`, !0);
        return;
      }
      for (const [i, p] of pending.entries()) {
        try {
          status(`กำลังอัปโหลด ${i + 1}/${pending.length}…`), p.status = "กำลังอัปโหลด", render();
          const optimized = p.optimized ||= await optimizeImage(p.file), caption = form.elements.caption.value;
          p.attempted = !0;
          {
            const data = new FormData();
            data.set("file", optimized), data.set("caption", caption), data.set("visibility", scope);
            const response = await fetch("/api/social/gallery", { method: "POST", credentials: "same-origin", headers: { "x-csrf-token": decodeURIComponent(cookie("__Host-cg_csrf")), "idempotency-key": p.key, accept: "application/json" }, body: data, signal: AbortSignal.timeout(2e4) }), result = await response.json();
            if (!response.ok) throw Error(result.message || "อัปโหลดไม่สำเร็จ");
          }
          p.done = !0, p.failed = !1, p.status = "รอผู้ดูแลตรวจสอบ";
        } catch (error) {
          p.failed = !0, p.status = error instanceof TypeError ? "เชื่อมต่อหรืออ่านรูปไม่สำเร็จ กรุณาลองอีกครั้ง" : error.message;
        }
        render();
      }
      const failed = pending.filter((p) => !p.done).length;
      status(failed ? `บันทึกแล้ว ${pending.length - failed} รูป · ไม่สำเร็จ ${failed} รูป กดลองอีกครั้งเพื่อบันทึกเฉพาะรูปที่ยังไม่สำเร็จ` : "บันทึกรูปเรียบร้อยแล้ว · สถานะ: รอผู้ดูแลตรวจสอบ", !!failed);
    } catch (error) {
      status(error.message + " · กดปุ่มอัปโหลดเพื่อลองเฉพาะรูปที่ยังไม่สำเร็จอีกครั้ง", !0);
    } finally {
      try {
        await loadUploadQuotas();
      } catch {
        status("ตรวจสอบโควตาไม่สำเร็จ กรุณาลองใหม่", !0);
      }
      uploadSelection.busy = !1, form.querySelectorAll("button,input,textarea").forEach((el) => el.disabled = !1), render();
    }
  }, render();
}
async function showPerson(id, { historyMode = "push", photo = null } = {}) {
  historyMode === "none" && (state.privateAlbumOpen = !!routedProfile()?.private);
  let person = id === state.account?.user?.id ? state.profile : state.people.find((p) => p.user_id === id) || state.conversations.find((p) => p.other_user_id === id);
  if ($("#profile-dialog").hidden && !routedProfile() && (state.profileReturnPath = location.pathname + location.search), historyMode !== "none" && updateProfileRoute(id, photo, historyMode), !person && !0) {
    const generation2 = state.profileRequest = (state.profileRequest || 0) + 1;
    try {
      person = (await api("/api/social/profile?user=" + encodeURIComponent(id))).profile;
    } catch {
      person = null;
    }
    if (generation2 !== state.profileRequest) return;
  }
  if (!person) {
    $("#profile-dialog-content").innerHTML = '<main class="full-profile gallery-page"><div class="empty"><h2>ไม่พบโปรไฟล์นี้</h2><p>คุณอาจไม่มีสิทธิ์ดูบัญชีนี้</p><button data-close-profile>กลับ</button></div></main>', openProfileSurface();
    return;
  }
  photo || (state.privateAlbumOpen = !1), state.selectedPerson = person, state.personPhotos = [], state.album = null, state.albumRequests = [], state.galleryLoadError = !1, state.albumLoading = !0, state.profileRequest = (state.profileRequest || 0) + 1;
  const generation = state.profileRequest;
  photo === "upload" ? (state.personRouteView = "upload", document.body.dataset.personRoute = "upload", $("#profile-dialog-content").innerHTML = '<main class="gallery-experience"><p role="status">กำลังตรวจสอบโควตาและพื้นที่อัลบั้ม…</p></main>', openProfileSurface()) : renderPersonRoute(photo === "gallery" ? "gallery" : "profile");
  try {
    const result = await api("/api/social/gallery?user=" + encodeURIComponent(id) + "&album=" + (state.privateAlbumOpen ? "private" : "public")), photos = result.photos;
    if (generation !== state.profileRequest) return;
    state.personPhotos = photos, state.album = result.album, id === currentActor() && (state.albumRequests = (await api("/api/social/albums/access")).requests), photo === "upload" && await loadUploadQuotas();
  } catch {
    if (generation !== state.profileRequest) return;
    state.galleryLoadError = !0, toast("โหลด Gallery ไม่สำเร็จ โปรดลองอีกครั้ง", !0);
  }
  if (state.albumLoading = !1, !state.album?.granted && id !== currentActor() && state.privateAlbumOpen && (state.privateAlbumOpen = !1, state.personPhotos = [], state.galleryLoadError = !0, updateProfileRoute(id, null, "replace"), state.personRouteView = "profile"), state.personRouteView !== "post" && renderPersonRoute(state.personRouteView), photo && photo !== "gallery" && photo !== "upload")
    try {
      await openGalleryPhoto(id, photo, { historyMode: "none" });
    } catch {
      if (generation !== state.profileRequest) return;
      updateProfileRoute(id, "gallery", "replace"), renderPersonRoute("gallery"), toast("ไม่พบรูปภาพหรือสิทธิ์การเข้าถึงเปลี่ยนแปลงแล้ว", !0);
    }
}
async function refreshAlbumPermission() {
  if ($("#profile-dialog").hidden || !state.selectedPerson || state.albumLoading || state.albumRefreshBusy) return;
  const generation = state.profileRequest, id = profileContext(state.selectedPerson).id;
  state.albumRefreshBusy = !0;
  try {
    const result = await api("/api/social/gallery?user=" + encodeURIComponent(id) + "&album=" + (state.privateAlbumOpen ? "private" : "public"));
    if (generation !== state.profileRequest || $("#profile-dialog").hidden) return;
    const changed = JSON.stringify(result.album) !== JSON.stringify(state.album);
    if (state.album = result.album, state.personPhotos = result.photos, state.galleryLoadError = !1, state.personRouteView === "post") {
      const id2 = state.galleryView?.photos[state.galleryView.index]?.id;
      if (!result.photos.some((p) => p.id === id2 && !["pending", "rejected"].includes(p.review_status))) {
        updateProfileRoute(profileContext(state.selectedPerson).id, "gallery", "replace"), renderPersonRoute("gallery");
        return;
      }
    }
    if (!result.album?.granted && id !== currentActor() && (state.privateAlbumOpen = !1, state.personRouteView === "post")) {
      updateProfileRoute(id, "gallery", "replace"), renderPersonRoute("gallery");
      return;
    }
    if (changed && state.personRouteView !== "post") {
      const focused = document.activeElement?.hasAttribute("data-private-album");
      renderPersonRoute(state.personRouteView), focused && $("[data-private-album]")?.focus({ preventScroll: !0 });
    }
  } catch {
    if (generation !== state.profileRequest) return;
    state.album = null, state.personPhotos = [], state.privateAlbumOpen = !1, state.galleryLoadError = !0, state.personRouteView === "post" && updateProfileRoute(id, "gallery", "replace"), renderPersonRoute(state.personRouteView === "profile" ? "profile" : "gallery");
  } finally {
    state.albumRefreshBusy = !1;
  }
}
function renderGalleryPost() {
  const c = profileContext(state.selectedPerson, state.galleryView.photos);
  $("#profile-dialog-content").innerHTML = ChatgunGallery.post({ ...c, view: state.galleryView }), galleryBusy(!!state.galleryBusy), state.personRouteView = "post", document.body.dataset.personRoute = "post", openProfileSurface(), $(".gallery-experience>.topbar").inert = !0, $(".gallery-experience>.page").inert = !0, $(".lightbox-close")?.focus({ preventScroll: !0 });
  const image = $(".lightbox-art img"), art = $(".lightbox-art"), feedback = document.createElement("span");
  feedback.className = "image-load-status", feedback.setAttribute("role", "status"), art.append(feedback);
  const imageStatus = () => {
    feedback.textContent = image.complete ? image.naturalWidth ? "" : "โหลดรูปไม่สำเร็จ กรุณาเปิดรูปอีกครั้ง" : "กำลังโหลดรูป…", art.setAttribute("aria-busy", String(!image.complete));
  };
  image.addEventListener("load", imageStatus), image.addEventListener("error", imageStatus), imageStatus();
}
function postFeedback(message = "", error = !1) {
  const feedback = $("[data-post-feedback]");
  return feedback ? (feedback.hidden = !message, feedback.setAttribute("role", error ? "alert" : "status"), feedback.textContent = message, !0) : !1;
}
function galleryBusy(busy) {
  state.galleryBusy = busy;
  const like = $(".post-like"), submit = $("#gallery-comment button"), input = $("#gallery-comment input[name=comment]");
  like && (like.disabled = busy, like.setAttribute("aria-busy", String(busy))), submit && (submit.disabled = busy || !input?.value.trim(), submit.setAttribute("aria-busy", String(busy)));
}
function samePost(owner, photo) {
  return !$("#profile-dialog").hidden && location.pathname === profilePath(owner, photo);
}
async function openGalleryPhoto(owner, photo, { historyMode = "push", preserveComment = !1 } = {}) {
  const generation = state.profileRequest, draft = preserveComment && samePost(owner, photo) ? $("#gallery-comment input[name=comment]")?.value : null, result = await api("/api/social/gallery?user=" + encodeURIComponent(owner) + "&album=" + (state.privateAlbumOpen ? "private" : "public") + "&photo=" + encodeURIComponent(photo));
  if (generation !== state.profileRequest || $("#profile-dialog").hidden) return;
  const item = result.photos.find((p) => p.id === photo);
  if (!item) throw new Error("ไม่พบรูปหรือคุณไม่มีสิทธิ์ดูรูปนี้");
  state.privateAlbumOpen = item.visibility !== "public";
  const photos = result.photos.filter((p) => p.visibility !== "public" === state.privateAlbumOpen), index = photos.findIndex((p) => p.id === photo);
  state.galleryView = { ...result, photos, index }, state.personPhotos = result.photos, historyMode !== "none" && updateProfileRoute(owner, photo, historyMode), renderGalleryPost(), draft != null && ($("#gallery-comment input[name=comment]").value = draft, galleryBusy(!!state.galleryBusy));
}
function albumSystemCard(e) {
  const labels = { pending: "ขอเข้าถึงอัลบั้มส่วนตัว", approved: "อนุมัติสิทธิ์อัลบั้มส่วนตัวแล้ว", rejected: "ปฏิเสธคำขออัลบั้มส่วนตัว", cancelled: "ยกเลิกคำขออัลบั้มส่วนตัว", revoked: "เพิกถอนสิทธิ์อัลบั้มส่วนตัวแล้ว" }, current = e.revision === e.request_revision && e.request_status === e.event_type, owner = currentActor() === e.album_owner_id, button = (action, label) => `<button data-album-action="${action}" data-request="${escapeHtml(e.request_id)}" data-revision="${Number(e.request_revision)}">${label}</button>`;
  return `<article class="album-system-card" data-system-event="${escapeHtml(e.id)}"><small>ระบบ · อัลบั้มส่วนตัว</small><strong>${escapeHtml(labels[e.event_type] || "อัลบั้มส่วนตัว")}</strong><p>${current ? "สถานะปัจจุบัน" : "ประวัติรายการ · ดูการ์ดล่าสุด"}</p>${current && e.event_type === "pending" ? owner ? button("approve", "อนุมัติ") + button("reject", "ปฏิเสธ") : button("cancel", "ยกเลิกคำขอ") : ""}${current && owner && e.event_type === "approved" ? button("revoke", "เพิกถอนสิทธิ์") : ""}</article>`;
}
async function albumAction(button) {
  if (!button.disabled) {
    button.disabled = !0;
    try {
      await api("/api/social/albums/access", { method: "POST", body: { action: button.dataset.albumAction, owner: button.dataset.owner, id: button.dataset.request, revision: Number(button.dataset.revision) } }), await loadRelationships(), $("#profile-dialog").hidden || await showPerson(profileContext(state.selectedPerson).id, { photo: state.personRouteView === "gallery" ? "gallery" : null, historyMode: "replace" }), state.selectedChat && await loadMessagePage(state.selectedChat), toast("อัปเดตสิทธิ์อัลบั้มแล้ว");
    } catch (error) {
      toast(error.message, !0);
    } finally {
      button.disabled = !1;
    }
  }
}
function renderThreadMessages() {
  const messages = $("#thread .messages");
  if (!messages) return;
  const loadMore = state.threadHasMore ? '<button class="secondary load-older" type="button">โหลดข้อความก่อนหน้า</button>' : "", ordered = state.threadMessages.slice().sort((a, b) => Number(a.created_at) - Number(b.created_at) || (a.system && b.system && a.request_id === b.request_id ? a.revision - b.revision : +!!a.system - +!!b.system || a.id.localeCompare(b.id)));
  messages.innerHTML = ordered.length ? `${loadMore}${ordered.map((message) => {
    if (message.system) return albumSystemCard(message);
    const media = message.media_id && !message.unsent_at ? chatMediaUrl(message.media_id) : "", attachment = message.media_id && !message.unsent_at ? media ? `<img class="chat-image" src="${escapeHtml(media)}" alt="รูปในแชท" loading="lazy">` : "<em>รูปนี้ไม่อยู่ในคลังแล้ว</em>" : "";
    return `<div class="message ${message.sender_user_id === currentActor() ? "mine" : ""} ${message.unsent_at ? "unsent" : ""}">${attachment}${escapeHtml(message.unsent_at ? "ยกเลิกข้อความแล้ว" : message.body)}<time>${new Date(Number(message.created_at) * 1e3).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</time>${message.sender_user_id === currentActor() && !message.unsent_at ? `<span class="message-tools"><button type="button" data-message-action="unsend" data-message="${escapeHtml(message.id)}">ยกเลิกข้อความ</button></span>` : ""}</div>`;
  }).join("")}` : '<div class="empty"><p>เริ่มบทสนทนาด้วยความสุภาพ</p></div>';
}
async function loadMessagePage(id, before = null) {
  const host = $("#thread .messages"), oldHeight = host?.scrollHeight || 0, oldTop = host?.scrollTop || 0, atEnd = !host || host.scrollHeight - host.scrollTop - host.clientHeight < 80, query = before ? `&before=${encodeURIComponent(before.created_at)}&beforeId=${encodeURIComponent(before.id)}` : "", result = await api(`/api/social/messages?target=${encodeURIComponent(id)}${query}`);
  state.threadMessages = before ? [...state.threadMessages, ...result.messages] : result.messages, state.threadHasMore = result.hasMore, renderThreadMessages(), host && (before ? host.scrollTop = oldTop + host.scrollHeight - oldHeight : atEnd && (host.scrollTop = host.scrollHeight));
}
async function openChat(id) {
  const person = (id === state.profile?.user_id ? state.profile : null) || state.people.find((p) => p.user_id === id) || state.conversations.find((p) => p.other_user_id === id) || (state.selectedPerson && (state.selectedPerson.user_id || state.selectedPerson.other_user_id) === id ? state.selectedPerson : null);
  if (!person || id === currentActor()) return;
  state.selectedChat = id, switchTab("chat"), $(".chat-layout").classList.add("open"), renderConversations();
  const thread = $("#thread");
  thread.innerHTML = `<header class="thread-head"><button class="icon-button chat-back" aria-label="กลับ">←</button><span class="avatar">${escapeHtml(initials(person.name))}</span><span class="member-name-status"><strong>${escapeHtml(person.name)}</strong>${onlineSlot(person,id)}</span></header><details class="chat-safety"><summary>⚠ ระวังการหลอกโอนเงินและขอข้อมูลส่วนตัว</summary><p>อย่าโอนเงินหรือส่งรหัส OTP รหัสผ่าน ข้อมูลบัญชีธนาคาร หรือรูปเอกสารยืนยันตัวตนให้คู่สนทนา</p><p>${person.identity_verified ? "บัญชีนี้ยืนยันตัวตนแล้ว แต่ตรายืนยันไม่รับรองพฤติกรรมหรือความปลอดภัยในการทำธุรกรรม" : "บัญชีนี้ยังไม่ยืนยันตัวตน โปรดระมัดระวังเป็นพิเศษ"}</p></details><div class="messages"><p>กำลังโหลด…</p></div>${state.config.mediaUploadEnabled ? '<p id="chat-upload-quota" class="upload-quota" aria-live="polite"></p>' : ""}<form class="composer">${state.config.mediaUploadEnabled ? '<label class="icon-button" title="ส่งรูป">▧<input type="file" name="file" accept="image/jpeg,image/png,image/webp" aria-label="ส่งรูป" hidden></label><button class="icon-button asset-library" type="button" title="รูปที่ส่งล่าสุด" aria-label="รูปที่ส่งล่าสุด">▦</button>' : ""}<input name="body" maxlength="2000" placeholder="พิมพ์ข้อความ…"><button class="primary">ส่ง</button></form>`, renderUploadQuotas(), populateAvatar($("#thread .avatar"), person);
  const brand = document.createElement("div");
  brand.className = "thread-brand-row", brand.innerHTML = '<a class="toolbar-brand" href="/"><img src="/logo.svg" alt=""><b>ChatGun</b></a><span>แชท</span>', thread.prepend(brand);
  const safety = document.createElement("div");
  safety.className = "thread-contact-actions", safety.innerHTML = `<button data-chat-mute="${escapeHtml(id)}">${state.conversations.find((p) => p.other_user_id === id)?.muted ? "เปิดการแจ้งเตือน" : "ปิดการแจ้งเตือน"}</button><button data-action="report" data-user="${escapeHtml(id)}">รายงาน</button><button data-action="block" data-user="${escapeHtml(id)}">บล็อก</button>`, $(".thread-head", thread).after(safety);
  const library = $(".asset-library", thread);
  if (library && (library.innerHTML = imagesIcon, $(".thread-head", thread).append(library)), state.chosenAsset = null, state.config.mediaUploadEnabled) {
    const picker = document.createElement("div");
    picker.className = "chat-image-picker", picker.hidden = !0, picker.innerHTML = '<div class="image-picker-heading"><strong>เลือกรูปเดิม</strong><button type="button" data-picker-upload>อัปโหลดรูปใหม่</button><button type="button" data-picker-close aria-label="ปิดตัวเลือกรูป">×</button></div><div class="image-picker-carousel"></div>', $(".composer", thread).before(picker);
    const toggle = document.createElement("button");
    toggle.type = "button", toggle.className = "icon-button picker-toggle", toggle.setAttribute("aria-label", "เลือกรูปแชท"), toggle.setAttribute("aria-expanded", "false"), toggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 4h9M4 4v16h16v-9M16 3h6M19 0v6M4 16l5-5 5 5 3-3 3 3"/></svg>', $(".composer>label", thread).hidden = !0, $(".composer", thread).prepend(toggle);
  }
  const send = $(".composer>.primary", thread);
  send.setAttribute("aria-label", "ส่ง"), send.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z M22 2 11 13"/></svg>', person.direct_messages_enabled === 0 && ($(".composer input[name=body]", thread).disabled = !0, send.disabled = !0, $(".composer", thread).insertAdjacentHTML("beforebegin", '<p role="status">สมาชิกนี้ปิดรับข้อความใหม่ · คุณยังอ่านประวัติได้</p>')), requestAnimationFrame(sizeConversation);
  try {
    await loadMessagePage(id), await api("/api/social/messages", { method: "POST", body: { action: "read", target: id } }), await loadRelationships();
  } catch (error) {
    toast(error.message, !0);
  }
}
function switchTab(tab) {
  closeProfileSurface(), delete document.body.dataset.ownGallery, state.activeTab = tab, document.body.dataset.activeTab = tab;
  const controls = $(".discovery-controls"), heading = $("#page-title");
  tab === "near" ? ($(".toolbar-context").append(heading), $(".toolbar").append(controls)) : ($("#discovery-control-storage").append(controls), $(".toolbar").append(heading)), heading.classList.toggle("toolbar-page", tab !== "near"), $(".toolbar")?.classList.remove("filters-open"), $("#filter-toggle")?.setAttribute("aria-expanded", "false");
  const labels = { near: "หาเพื่อน", chat: "แชท", reviews: "ความคิดเห็น", profile: "โปรไฟล์" };
  $$("#primary-nav button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab)), $$(".tab-view").forEach((view) => {
    view.hidden = view.id !== `${tab}-tab`;
  }), $("#page-title").textContent = labels[tab], tab === "chat" && requestAnimationFrame(sizeConversation);
}
function sizeConversation() {
  const layout = $(".chat-layout");
  if (state.activeTab !== "chat" || !layout) return;
  const viewport = window.visualViewport?.height || innerHeight, navigation = $(".sidebar").getBoundingClientRect().height;
  layout.style.setProperty("--chat-height", `${Math.max(260, viewport - layout.getBoundingClientRect().top - navigation - 8)}px`);
}
window.addEventListener("resize", sizeConversation);
window.visualViewport?.addEventListener("resize", sizeConversation);
async function initialize() {
  offerDemoRetirement($("#retired-demo"));
  try {
    if (document.body.dataset.activeTab = state.activeTab, state.config = await api("/api/social/config", { signal: AbortSignal.timeout(8e3) }), !state.config.socialAppEnabled) {
      $("#global-status").textContent = "", $("#disabled-view").hidden = !1, document.body.dataset.prelaunch = "true";
      return;
    }
    try {
      state.account = await api("/api/auth/me");
    } catch (error) {
      if (error.status === 401) return location.replace("/signup.html?next=%2Fapp%2F");
      throw error;
    }
    if (state.account.acceptanceRequired || state.account.nextPath === "/acceptance")
      return location.replace("/acceptance");
    if (state.account.nextPath === "/app/?onboarding=1") {
      document.body.dataset.flow = "onboarding", $("#global-status").textContent = "", $("#onboarding-view").hidden = !1, $("#onboarding-form").elements.name.value = state.account.user.displayName || "";
      return;
    }
    try {
      state.profile = (await api("/api/social/profile")).profile;
    } catch (error) {
      if (error.code === "not_found" && state.config.adultOnboardingEnabled) {
        document.body.dataset.flow = "onboarding", $("#global-status").textContent = "", $("#onboarding-view").hidden = !1, $("#onboarding-form").elements.name.value = state.account.user.displayName || "";
        return;
      }
      throw error;
    }
    $("#global-status").textContent = "", delete document.body.dataset.flow, $("#social-view").hidden = !1, localStorage.getItem("chatgun-notifications") === "enabled" && ($("#notification-toggle").textContent = "ปิดการแจ้งเตือนข้อความในอุปกรณ์นี้"), fillProfile(), await Promise.all([loadPeople(), loadRelationships(), loadRatings(), loadBlocked(), loadOwnGallery(), loadUploadQuotas(), loadVerification(), loadMediaSafety()]), await monitorLocationPermission(), switchTab(state.activeTab), location.pathname === "/app/photos" && openOwnGallery(!1);
    const route = routedProfile();
    route && await showPerson(route.user, { historyMode: "none", photo: route.photo }), state.config.onlineStatusEnabled && await startOnlinePresence();
  } catch {
    $("#global-status").textContent = "", $("#disabled-view").hidden = !1, document.body.dataset.prelaunch = "true", $("#service-status").textContent = "ระบบสมาชิกยังไม่พร้อมให้บริการในขณะนี้ กรุณากลับมาใหม่ภายหลัง";
  } finally {
    $("#app").setAttribute("aria-busy", "false");
  }
}
$("#primary-nav").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  button && switchTab(button.dataset.tab);
});
$("#onboarding-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter, data = new FormData(event.currentTarget);
  setBusy(button, !0);
  try {
    const result = await api("/api/social/onboarding/member", { method: "POST", body: { name: data.get("name"), gender: data.get("gender"), bio: data.get("bio"), interests: data.get("interests") } });
    state.profile = result.profile, location.reload();
  } catch (error) {
    toast(error.message, !0);
  } finally {
    setBusy(button, !1);
  }
});
$("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  setBusy(event.submitter, !0);
  try {
    state.profile = (await api("/api/social/profile", { method: "POST", body: { action: "edit", name: data.get("name"), gender: data.get("gender"), bio: data.get("bio"), interests: data.get("interests") } })).profile, fillProfile(), toast("บันทึกโปรไฟล์แล้ว");
  } catch (error) {
    toast(error.message, !0);
  } finally {
    setBusy(event.submitter, !1);
  }
});
$("#hide-discovery").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  setBusy(button, !0);
  try {
    await api("/api/social/profile", { method: "POST", body: { action: "hide" } }), state.locationFresh = !1, state.people = [], renderPeople(), toast("ปิดการค้นหาและล้างตำแหน่งแล้ว");
  } catch (error) {
    toast(error.message, !0);
  } finally {
    setBusy(button, !1);
  }
});
$("#notification-toggle").addEventListener("click", async (event) => {
  if (!("Notification" in window)) return toast("เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน", !0);
  const button = event.currentTarget;
  if (localStorage.getItem("chatgun-notifications") === "enabled")
    return localStorage.removeItem("chatgun-notifications"), button.textContent = "เปิดการแจ้งเตือนข้อความในอุปกรณ์นี้", toast("ปิดการแจ้งเตือนในอุปกรณ์นี้แล้ว");
  if (await Notification.requestPermission() !== "granted") return toast("ไม่ได้รับอนุญาตให้แสดงการแจ้งเตือน", !0);
  localStorage.setItem("chatgun-notifications", "enabled"), button.textContent = "ปิดการแจ้งเตือนข้อความในอุปกรณ์นี้", toast("เปิดการแจ้งเตือนแล้ว");
});
$("#view-own-profile").addEventListener("click", () => showPerson(state.account.user.id));
function openOwnGallery(push = !0) {
  switchTab("profile"), document.body.dataset.ownGallery = "true", push && history.pushState({}, "", "/app/photos");
}
$("#manage-gallery").addEventListener("click", () => openOwnGallery());
$("#gallery-settings-back").innerHTML = ChatgunNearComponents.icon("back", 24);
$("[data-choose-profile]").innerHTML = ChatgunNearComponents.icon("camera", 17) + "เปลี่ยนรูปโปรไฟล์";
$('[data-upload-kind="profile"]').innerHTML = ChatgunNearComponents.icon("camera", 18) + "รูปโปรไฟล์";
$('[data-upload-kind="gallery"]').innerHTML = imagesIcon + "Gallery";
$("[data-upload-preview]").innerHTML = ChatgunNearComponents.icon("upload", 30);
$("#profile-verification").innerHTML = ChatgunNearComponents.icon("verification", 20) + "<span>ยืนยันตัวตน รับตรา Verify</span>";
$("#profile-verification").addEventListener("click", () => {
  state.config.identityVerificationEnabled && $("#verification-panel").scrollIntoView({ block: "start" });
});
$("#gallery-settings-back").addEventListener("click", () => {
  switchTab("profile"), history.pushState({}, "", "/app/");
});
document.addEventListener("click", (event) => {
  const kind = event.target.closest("[data-upload-kind]");
  kind && ($("#gallery-upload").elements.kind.value = kind.dataset.uploadKind, $$("[data-upload-kind]").forEach((b) => {
    b.classList.toggle("selected", b === kind), b.setAttribute("aria-pressed", String(b === kind));
  })), event.target.closest("[data-choose-profile]") && ($('[data-upload-kind="profile"]').click(), $("#gallery-upload input[type=file]").click()), event.target.closest("[data-cancel-upload]") && ($("#gallery-upload").reset(), $("#gallery-upload input[type=file]").dispatchEvent(new Event("change")));
});
$("#gallery-upload input[type=file]").addEventListener("change", async (event) => {
  const file = event.target.files?.[0], preview = $("[data-upload-preview]");
  if (preview.replaceChildren(), $(".upload-pending").hidden = !file, file || (preview.innerHTML = ChatgunNearComponents.icon("upload", 30)), file && file.size <= 8 * 1024 * 1024 && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    const src = await fileDataUrl(file);
    if (event.target.files?.[0] !== file) return;
    const image = document.createElement("img");
    image.alt = "ภาพตัวอย่างก่อนบันทึก", image.src = src, preview.append(image);
  }
});
document.addEventListener("submit", async (event) => {
  if (!event.target.matches("#gallery-upload,#route-gallery-upload")) return;
  event.preventDefault();
  const button = event.submitter, form = event.target, data = new FormData(form);
  setBusy(button, !0, "กำลังอัปโหลด…");
  try {
    const file = data.get("file");
    file instanceof File && data.set("file", await optimizeImage(file));
    const headers = { "x-csrf-token": decodeURIComponent(cookie("__Host-cg_csrf")), accept: "application/json" };
    headers["idempotency-key"] = form.dataset.idempotencyKey ||= crypto.randomUUID();
    const response = await fetch("/api/social/gallery", { method: "POST", credentials: "same-origin", headers, body: data }), payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw payload.code === "daily_upload_limit_reached" && await loadUploadQuotas(), new Error(payload.message || payload.error || "อัปโหลดไม่สำเร็จ");
    delete form.dataset.idempotencyKey, form.reset(), await Promise.all([loadOwnGallery(), loadUploadQuotas()]), $("#profile-dialog").hidden || (state.personPhotos = state.myGallery, renderPersonRoute("gallery")), toast("อัปโหลดรูปแล้ว");
  } catch (error) {
    toast(error.message, !0);
  } finally {
    setBusy(button, !1);
  }
});
$("#verification-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget, button = event.submitter, data = new FormData(event.currentTarget);
  data.set("consent", data.get("consent") ? "accepted" : ""), setBusy(button, !0, "กำลังส่งอย่างปลอดภัย…");
  try {
    for (const field of ["identity", "selfie"]) {
      const file = data.get(field);
      file instanceof File && data.set(field, await optimizeImage(file));
    }
    const response = await fetch("/api/social/verification", { method: "POST", credentials: "same-origin", headers: { "x-csrf-token": decodeURIComponent(cookie("__Host-cg_csrf")), accept: "application/json" }, body: data }), payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "ส่งหลักฐานไม่สำเร็จ");
    form.reset(), await loadVerification(), toast("ส่งหลักฐานแล้ว");
  } catch (error) {
    toast(error.message, !0);
  } finally {
    setBusy(button, !1);
  }
});
$("#location-toggle").addEventListener("click", updateLocation);
$("#filter-toggle").addEventListener("click", () => {
  $("#discovery-filters .filter-host").append($(".filter-row")), $("#discovery-filters").showModal(), $("#filter-toggle").setAttribute("aria-expanded", "true");
});
$("#discovery-filters").addEventListener("close", () => {
  $(".discovery-controls").append($("#discovery-filters .filter-row")), $("#filter-toggle").setAttribute("aria-expanded", "false");
});
$("#refresh").addEventListener("click", async () => {
  try {
    await Promise.all([loadPeople(), loadRelationships(), loadRatings(), loadBlocked()]), toast("อัปเดตข้อมูลแล้ว");
  } catch (error) {
    toast(error.message, !0);
  }
});
[$("#people-search"), $("#radius-filter"), $("#gender-filter"), $("#interest-filter")].forEach((input) => input.addEventListener("input", renderPeople));
document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-gallery-upload-route]")) {
    if (event.preventDefault(), profileContext(state.selectedPerson).id !== currentActor()) return;
    await showPerson(currentActor(), { photo: "upload" });
    return;
  }
  const more = event.target.closest("[data-more-conversations]");
  if (more) {
    more.disabled = !0;
    try {
      const result = await api("/api/social/conversations?offset=" + state.conversationOffset), ids = new Set(state.conversations.map((p) => p.other_user_id));
      state.conversations.push(...result.conversations.filter((p) => !ids.has(p.other_user_id))), state.conversationMore = !!result.hasMore, state.conversationOffset = result.nextOffset, renderConversations();
    } catch (error) {
      toast(error.message, !0), more.disabled = !1;
    }
    return;
  }
  const mute = event.target.closest("[data-chat-mute]");
  if (mute) {
    const target = mute.dataset.chatMute, muted = !state.conversations.find((p) => p.other_user_id === target)?.muted;
    try {
      await api("/api/social/chat-preferences", { method: "POST", body: { target, muted } }), await loadRelationships(), mute.textContent = muted ? "เปิดการแจ้งเตือน" : "ปิดการแจ้งเตือน";
    } catch (error) {
      toast(error.message, !0);
    }
    return;
  }
  const album = event.target.closest("[data-album-action]");
  if (album)
    return event.preventDefault(), albumAction(album);
  const privateAlbum = event.target.closest("[data-private-album]");
  if (privateAlbum) {
    if (privateAlbum.disabled || state.albumRefreshBusy) return;
    privateAlbum.disabled = !0;
    const id = profileContext(state.selectedPerson).id;
    if (await refreshAlbumPermission(), $("#profile-dialog").hidden || profileContext(state.selectedPerson).id !== id) return;
    if (state.galleryLoadError) {
      toast("ตรวจสอบสิทธิ์ไม่สำเร็จ โปรดลองอีกครั้ง", !0);
      return;
    }
    if (id === currentActor() || state.album?.granted)
      state.privateAlbumOpen = !0, await showPerson(id, { photo: "gallery" });
    else if (state.album?.request?.status !== "pending") {
      await albumAction({ disabled: !1, dataset: { albumAction: "request", owner: id } });
      const current = $("[data-private-album]");
      current && state.album?.request?.status !== "pending" && (current.disabled = !1);
    } else renderPersonRoute(state.personRouteView);
    return;
  }
  const visibility = event.target.closest("[data-photo-visibility]");
  if (visibility) {
    try {
      await api("/api/social/gallery", { method: "POST", body: { action: "visibility", id: visibility.dataset.photo, visibility: visibility.dataset.photoVisibility } }), renderPeople(), await showPerson(profileContext(state.selectedPerson).id, { photo: "gallery", historyMode: "replace" });
    } catch (error) {
      toast(error.message, !0);
    }
    return;
  }
  const profileOpen = event.target.closest("[data-person-open]");
  if (profileOpen) {
    event.preventDefault(), await showPerson(profileOpen.dataset.personOpen);
    return;
  }
  if (event.target.closest(".picker-toggle")) {
    const picker = $("#thread .chat-image-picker");
    if (picker.hidden = !picker.hidden, $("#thread .picker-toggle").setAttribute("aria-expanded", String(!picker.hidden)), picker.hidden && (state.chosenAsset = null, $("#thread input[name=body]").disabled = !1), !picker.hidden) try {
      const { assets } = await api("/api/social/chat-assets");
      $(".image-picker-carousel", picker).innerHTML = assets.length ? assets.map((a) => `<button type="button" data-picker-asset="${escapeHtml(a.id)}" aria-label="เลือกรูปนี้" aria-pressed="false"><img src="${escapeHtml(chatMediaUrl(a.id))}" alt="รูปแชทเดิม"></button>`).join("") : "<p>ยังไม่มีรูปแชทเดิม เลือกอัปโหลดรูปใหม่ได้</p>";
      const upload2 = $("[data-picker-upload]", picker);
      upload2.disabled = Number(state.uploadQuotas.chat.remaining) <= 0;
    } catch (error) {
      toast(error.message, !0);
    }
    return;
  }
  if (event.target.closest("[data-picker-upload]")) {
    state.chosenAsset = null, $("#thread input[name=body]").disabled = !1, $("#thread input[name=file]").click();
    return;
  }
  if (event.target.closest("[data-picker-close]")) {
    state.chosenAsset = null, $("#thread .chat-image-picker").hidden = !0, $("#thread .picker-toggle").setAttribute("aria-expanded", "false"), $("#thread input[name=body]").disabled = !1;
    return;
  }
  const chosen = event.target.closest("[data-picker-asset]");
  if (chosen) {
    state.chosenAsset = chosen.dataset.pickerAsset, $$("[data-picker-asset]").forEach((b) => {
      b.classList.toggle("selected", b === chosen), b.setAttribute("aria-pressed", String(b === chosen));
    }), $("#thread input[name=body]").disabled = !0;
    return;
  }
  if (event.target.closest("[data-apply-filters]")) {
    $("#discovery-filters").close();
    return;
  }
  const profileTab = event.target.closest("[data-profile-tab]");
  if (profileTab) {
    closeProfileSurface(), history.replaceState({}, "", "/"), switchTab(profileTab.dataset.profileTab);
    return;
  }
  const galleryReturn = event.target.closest("[data-gallery-return]");
  if (galleryReturn || event.target.closest("[data-profile-gallery]")) {
    galleryReturn || (state.privateAlbumOpen = !1), await showPerson(profileContext(state.selectedPerson).id, { photo: "gallery" });
    return;
  }
  if (event.target.closest("[data-profile-return]")) {
    await showPerson(profileContext(state.selectedPerson).id);
    return;
  }
  if (event.target.closest("[data-retry-gallery]")) {
    await showPerson(profileContext(state.selectedPerson).id, { photo: "gallery", historyMode: "replace" });
    return;
  }
  const personOpen = event.target.closest("[data-person-open]");
  if (personOpen) {
    await showPerson(personOpen.dataset.personOpen);
    return;
  }
  if (event.target.closest("[data-badge-info]")) {
    toast("ผ่านการตรวจหลักฐานตัวตน · ไม่ใช่การรับรองพฤติกรรมหรือการอนุญาตดูเนื้อหา Sensitive");
    return;
  }
  if (event.target.closest("[data-close-profile]")) {
    closeProfileSurface();
    return;
  }
  const pagination = event.target.closest("[data-discovery-page]");
  if (pagination) {
    state.discoveryPage = Number(pagination.dataset.discoveryPage), renderPeople(), $("#people-grid").scrollIntoView({ block: "start" });
    return;
  }
  if (event.target.closest("[data-clear-filters]")) {
    $("#people-search").value = "", $("#interest-filter").value = "", $("#gender-filter").value = "ทั้งหมด", $("#radius-filter").value = "5000", renderPeople();
    return;
  }
  const close = event.target.closest(".dialog-close, [data-close-profile]");
  if (close) {
    close.closest("dialog").close();
    return;
  }
  const mediaReport = event.target.closest("[data-media-report]");
  if (mediaReport) {
    state.personRouteView !== "post" && closeProfileSurface(), $("#media-report-form").elements.mediaId.value = mediaReport.dataset.mediaReport, $("#media-report-dialog").showModal();
    return;
  }
  const mediaAppeal = event.target.closest("[data-media-appeal]");
  if (mediaAppeal) {
    $("#media-appeal-form").elements.mediaId.value = mediaAppeal.dataset.mediaAppeal, $("#media-appeal-dialog").showModal();
    return;
  }
  if (event.target.closest(".chat-back")) {
    $(".chat-layout").classList.remove("open"), state.selectedChat = null;
    return;
  }
  if (event.target.closest(".load-older")) {
    const oldest = state.threadMessages.at(-1);
    if (oldest) try {
      await loadMessagePage(state.selectedChat, oldest);
    } catch (error) {
      toast(error.message, !0);
    }
    return;
  }
  const messageAction = event.target.closest("[data-message-action]");
  if (messageAction) {
    if (!confirm("ยกเลิกข้อความนี้หรือไม่?")) return;
    try {
      await api("/api/social/messages", { method: "POST", body: { action: "unsend", id: messageAction.dataset.message } }), await openChat(state.selectedChat);
    } catch (error) {
      toast(error.message, !0);
    }
    return;
  }
  if (event.target.closest(".asset-library")) {
    try {
      const assets = (await api("/api/social/chat-assets")).assets;
      $("#asset-grid").innerHTML = assets.length ? assets.map((asset) => `<button data-asset="${escapeHtml(asset.id)}" aria-label="เลือกรูปเพื่อส่งต่อ"><img src="${escapeHtml(chatMediaUrl(asset.id))}" alt="รูปที่เคยส่ง"><span>➤ ส่งต่อ</span></button>`).join("") : '<p class="subtitle">ยังไม่มีรูปที่ส่งล่าสุด</p>', $("#asset-dialog").showModal();
    } catch (error) {
      toast(error.message, !0);
    }
    return;
  }
  const reusableAsset = event.target.closest("[data-asset]");
  if (reusableAsset) {
    $("#asset-grid").innerHTML = `<div class="forward-friends"><h2>เลือกสมาชิกที่จะส่งรูป</h2>${state.people.filter((p) => p.user_id !== currentActor()).map((p) => `<button data-forward-user="${escapeHtml(p.user_id)}" data-forward-asset="${escapeHtml(reusableAsset.dataset.asset)}"><div class="chat-friend-photo">${portrait(p, !1)}</div>${escapeHtml(p.name)} <span aria-hidden="true">➤</span></button>`).join("")}</div>`;
    return;
  }
  const forward = event.target.closest("[data-forward-user]");
  if (forward) {
    setBusy(forward, !0);
    try {
      await api("/api/social/messages", { method: "POST", body: { action: "send", target: forward.dataset.forwardUser, mediaId: forward.dataset.forwardAsset, body: "" } }), $("#asset-dialog").close(), await openChat(forward.dataset.forwardUser);
    } catch (error) {
      toast(error.message, !0), setBusy(forward, !1);
    }
    return;
  }
  const chat = event.target.closest("[data-chat]");
  if (chat) return openChat(chat.dataset.chat);
  const galleryAction = event.target.closest("[data-gallery-action]");
  if (galleryAction) {
    event.preventDefault();
    const { galleryAction: name, photo, user } = galleryAction.dataset;
    if (name === "view") {
      try {
        await openGalleryPhoto(user, photo);
      } catch (error) {
        toast(error.message, !0);
      }
      return;
    }
    if (["previous", "next"].includes(name) && state.galleryView) {
      state.galleryView.index += name === "next" ? 1 : -1;
      const current = state.galleryView.photos[state.galleryView.index];
      try {
        await openGalleryPhoto(state.galleryView.owner, current.id);
      } catch (error) {
        toast(error.message, !0);
      }
      return;
    }
    if (name === "delete" && !confirm("ลบรูปนี้หรือไม่? การลบไฟล์จริงจะดำเนินการผ่านคิวอย่างปลอดภัย")) return;
    if (name === "like") {
      if (state.galleryBusy) return;
      galleryBusy(!0), postFeedback();
    }
    try {
      await api("/api/social/gallery", { method: "POST", body: { action: name, id: photo, ...name === "like" ? { album: state.privateAlbumOpen ? "private" : "public" } : {} } }), ["delete", "select"].includes(name) && (await loadOwnGallery(), name === "select" && (state.profile.selected_photo_id = photo), name === "delete" && state.profile.selected_photo_id === photo && (state.profile.selected_photo_id = null), fillProfile(), $("#profile-dialog").hidden || (state.personPhotos = state.myGallery, renderPersonRoute("gallery"))), name === "like" && state.galleryView && samePost(user || state.galleryView.owner, photo) && await openGalleryPhoto(state.galleryView.owner, photo, { historyMode: "replace", preserveComment: !0 }), name !== "like" && toast(name === "delete" ? "ซ่อนรูปและส่งเข้าคิวลบแล้ว" : "ตั้งรูปหลักแล้ว");
    } catch (error) {
      name !== "like" ? toast(error.message, !0) : samePost(state.galleryView?.owner, photo) && postFeedback(error.message, !0);
    } finally {
      name === "like" && galleryBusy(!1);
    }
    return;
  }
  const action = event.target.closest("[data-action]");
  if (action) {
    event.preventDefault();
    const { action: name, user } = action.dataset;
    if (name === "chat")
      return closeProfileSurface(), openChat(user);
    if (name === "rate")
      return closeProfileSurface(), $("#rating-form").elements.target.value = user, $("#rating-dialog").showModal();
    if (name === "block" || name === "unblock") {
      if (name === "block" && !confirm("บล็อกผู้ใช้นี้และเพิกถอนสิทธิ์อัลบั้มหรือไม่?")) return;
      try {
        await api("/api/social/blocks", { method: "POST", body: { action: name, target: user } }), closeProfileSurface(), await Promise.all([loadPeople(), loadRelationships(), loadBlocked()]), toast(name === "block" ? "บล็อกผู้ใช้แล้ว" : "เลิกบล็อกแล้ว");
      } catch (error) {
        toast(error.message, !0);
      }
      return;
    }
    if (name === "report")
      return closeProfileSurface(), $("#report-form").elements.target.value = user, $("#report-dialog").showModal();
  }
  const card = event.target.closest("[data-person]");
  card && !event.target.closest("button") && showPerson(card.dataset.person);
});
document.addEventListener("keydown", (event) => {
  if (event.key === " " && event.target.matches(".card-open[data-person-open]")) {
    event.preventDefault(), event.target.click();
    return;
  }
  if (event.key === "Escape" && state.personRouteView === "upload" && !$("#profile-dialog").hidden && !$("dialog[open]")) {
    event.preventDefault(), leaveUpload() && showPerson(currentActor(), { photo: "gallery" });
    return;
  }
  if (state.personRouteView === "post" && !$("#profile-dialog").hidden && !$("dialog[open]")) {
    if (event.key === "Escape") {
      event.preventDefault(), showPerson(state.galleryView.owner, { photo: "gallery" });
      return;
    }
    if (["ArrowLeft", "ArrowRight"].includes(event.key) && !event.target.matches("input,textarea")) {
      event.preventDefault(), $(`[data-gallery-action=${event.key === "ArrowLeft" ? "previous" : "next"}]`)?.click();
      return;
    }
    if (event.key === "Tab") {
      const controls = $$(".lightbox button:not(:disabled),.lightbox input:not([type=hidden])"), first = controls[0], last = controls.at(-1);
      event.shiftKey && document.activeElement === first ? (event.preventDefault(), last?.focus()) : !event.shiftKey && document.activeElement === last && (event.preventDefault(), first?.focus());
    }
  }
  if (event.key === "Escape" && !$("#profile-dialog").hidden && !$("dialog[open]")) {
    closeProfileSurface();
    return;
  }
  if (event.key === "Escape" && ($(".toolbar")?.classList.remove("filters-open"), $("#filter-toggle")?.setAttribute("aria-expanded", "false")), !["Enter", " "].includes(event.key) || event.target.closest("button, a, input, select, textarea")) return;
  const card = event.target.closest("[data-person]");
  card && (event.preventDefault(), showPerson(card.dataset.person));
});
document.addEventListener("change", async (event) => {
  if (event.target.id === "direct-contact-toggle") {
    const control = event.target;
    control.disabled = !0;
    try {
      const result = await api("/api/social/profile", { method: "POST", body: { action: "contact_privacy", enabled: control.checked } });
      state.profile = result.profile;
    } catch (error) {
      control.checked = !control.checked, toast(error.message, !0);
    } finally {
      control.disabled = !1;
    }
  }
  event.target.id;
});
$("#profile-dialog").addEventListener("submit", async (event) => {
  if (!event.target.matches("#gallery-comment") || (event.preventDefault(), state.galleryBusy)) return;
  const data = new FormData(event.target);
  galleryBusy(!0), postFeedback();
  try {
    if (await api("/api/social/gallery", { method: "POST", body: { action: "comment", id: data.get("photo"), album: state.privateAlbumOpen ? "private" : "public", comment: data.get("comment") } }), !samePost(data.get("owner"), data.get("photo"))) return;
    await openGalleryPhoto(data.get("owner"), data.get("photo"), { historyMode: "replace" }), samePost(data.get("owner"), data.get("photo")) && postFeedback("ส่งคอมเมนต์แล้ว");
  } catch (error) {
    samePost(data.get("owner"), data.get("photo")) && postFeedback(error.message, !0);
  } finally {
    galleryBusy(!1);
  }
});
$("#profile-dialog").addEventListener("input", (event) => {
  event.target.matches("#gallery-comment input[name=comment]") && ($("#gallery-comment button").disabled = !!state.galleryBusy || !event.target.value.trim());
});
$("#thread").addEventListener("change", (event) => {
  event.target.matches("input[name=file]") && event.target.files?.length && event.target.closest("form").requestSubmit();
});
$("#thread").addEventListener("submit", async (event) => {
  if (!event.target.matches(".composer")) return;
  event.preventDefault();
  const input = $("input[name=body]", event.target), file = $("input[name=file]", event.target)?.files?.[0], body = input.value.trim();
  if (!(!body && !file && !state.chosenAsset)) {
    setBusy(event.submitter, !0);
    try {
      if (state.chosenAsset) {
        await api("/api/social/messages", { method: "POST", body: { action: "send", target: state.selectedChat, mediaId: state.chosenAsset, body: "" } }), state.chosenAsset = null, await openChat(state.selectedChat);
        return;
      }
      if (file) {
        const optimized = await optimizeImage(file);
        {
          const data = new FormData();
          data.set("target", state.selectedChat), data.set("file", optimized);
          const idempotencyKey = event.target.dataset.idempotencyKey ||= crypto.randomUUID(), response = await fetch("/api/social/messages", { method: "POST", credentials: "same-origin", headers: { "x-csrf-token": decodeURIComponent(cookie("__Host-cg_csrf")), "idempotency-key": idempotencyKey, accept: "application/json" }, body: data }), payload = await response.json().catch(() => ({}));
          if (!response.ok)
            throw payload.code === "daily_upload_limit_reached" && await loadUploadQuotas(), new Error(payload.message || payload.error || "ส่งรูปไม่สำเร็จ");
          delete event.target.dataset.idempotencyKey, await loadUploadQuotas();
        }
      } else await api("/api/social/messages", { method: "POST", body: { action: "send", target: state.selectedChat, body } });
      input.value = "", event.target.reset(), await loadRelationships(), await openChat(state.selectedChat);
    } catch (error) {
      toast(error.message, !0);
    } finally {
      setBusy(event.submitter, !1);
    }
  }
});
$("#rating-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget, data = new FormData(event.currentTarget);
  setBusy(event.submitter, !0);
  try {
    await api("/api/social/ratings", { method: "POST", body: { target: data.get("target"), score: Number(data.get("score")), comment: data.get("comment") } }), $("#rating-dialog").close(), form.reset(), toast("ส่งความคิดเห็นแล้ว");
  } catch (error) {
    toast(error.message, !0);
  } finally {
    setBusy(event.submitter, !1);
  }
});
$("#report-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget, data = new FormData(event.currentTarget);
  setBusy(event.submitter, !0);
  try {
    await api("/api/social/reports", { method: "POST", body: { target: data.get("target"), category: data.get("category"), details: data.get("details") } }), $("#report-dialog").close(), form.reset(), toast("ส่งรายงานให้ผู้ดูแลแล้ว");
  } catch (error) {
    toast(error.message, !0);
  } finally {
    setBusy(event.submitter, !1);
  }
});
$("#media-report-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget, data = new FormData(event.currentTarget);
  setBusy(event.submitter, !0);
  try {
    await api("/api/social/reports/media", { method: "POST", body: { mediaId: data.get("mediaId"), reason: data.get("reason"), details: data.get("details") } }), $("#media-report-dialog").close(), form.reset(), toast("ส่งรายงานรูปภาพให้ผู้ดูแลแล้ว");
  } catch (error) {
    toast(error.message, !0);
  } finally {
    setBusy(event.submitter, !1);
  }
});
$("#media-appeal-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget, data = new FormData(event.currentTarget);
  setBusy(event.submitter, !0);
  try {
    await api("/api/social/media/appeals", { method: "POST", body: { mediaId: data.get("mediaId"), reason: data.get("reason") } }), $("#media-appeal-dialog").close(), form.reset(), await loadMediaSafety(), toast("ส่งคำอุทธรณ์แล้ว");
  } catch (error) {
    toast(error.message, !0);
  } finally {
    setBusy(event.submitter, !1);
  }
});
initialize();
window.addEventListener("offline", () => {
  $("#global-status").textContent = "ออฟไลน์ — การเปลี่ยนแปลงจะยังไม่ถูกส่ง";
});
window.addEventListener("online", () => {
  $("#global-status").textContent = "", toast("กลับมาออนไลน์แล้ว"), refreshOpenThread().catch(() => {
  });
});
document.addEventListener("visibilitychange", () => {
  document.visibilityState === "visible" && state.config?.socialAppEnabled && state.profile && (Promise.all([loadPeople(), loadRelationships(), refreshOpenThread()]).catch(() => {
  }), state.locationWatch !== null && Date.now() - state.lastLocationPost > 55e3 && navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    state.lastLocationPost = Date.now();
    try {
      await api("/api/social/discovery", { method: "POST", body: { action: "location", latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy } }), await loadPeople();
    } catch {
      await revokeLocationPublication({ notifyServer: state.locationFresh });
    }
  }, () => revokeLocationPublication({ notifyServer: state.locationFresh }), { enableHighAccuracy: !0, timeout: 12e3, maximumAge: 0 }));
});
setInterval(() => {
  document.visibilityState === "visible" && navigator.onLine && state.config?.socialAppEnabled && state.profile && Promise.all([loadPeople(), loadRelationships()]).catch(() => {
  });
}, 3e4);
setInterval(() => {
  document.visibilityState === "visible" && navigator.onLine && (refreshOpenThread().catch(() => {
  }), refreshAlbumPermission().catch(() => {
  }));
}, 1e4);
window.addEventListener("focus", () => refreshAlbumPermission().catch(() => {
}));
document.addEventListener("visibilitychange", () => {
  document.visibilityState === "visible" && refreshAlbumPermission().catch(() => {
  });
});
window.addEventListener("pagehide", () => {
  state.locationWatch !== null && navigator.geolocation && navigator.geolocation.clearWatch(state.locationWatch), state.locationPermission && (state.locationPermission.onchange = null);
});
window.addEventListener("popstate", (event) => {
  if (restoringUpload) {
    restoringUpload = !1;
    return;
  }
  const next = Number(event.state?.cgStep || 0);
  if (state.personRouteView === "upload" && !leaveUpload()) {
    restoringUpload = !0, history.go(routeStep - next);
    return;
  }
  routeStep = next, location.pathname === "/app/photos" ? openOwnGallery(!1) : delete document.body.dataset.ownGallery;
  const route = routedProfile();
  route ? showPerson(route.user, { historyMode: "none", photo: route.photo }) : $("#profile-dialog").hidden || closeProfileSurface({ navigate: !1 });
});
