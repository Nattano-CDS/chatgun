const state = {
  config: null,
  account: null,
  profile: null,
  people: [],
  relationships: [],
  ratings: [],
  blocked: [],
  activeTab: "near",
  selectedPerson: null,
  selectedChat: null,
  locationFresh: false,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function cookie(name) {
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

async function api(path, options = {}) {
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
    const error = new Error(payload.error || "ไม่สามารถดำเนินการได้");
    error.code = payload.code || "request_failed";
    error.status = response.status;
    throw error;
  }
  return payload;
}

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = String(value ?? "");
  return node.innerHTML;
}

function initials(name) {
  return [...String(name || "?").trim()].slice(0, 2).join("").toUpperCase();
}

function formatDistance(metres) {
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

function personCard(person, context = "near") {
  const relation = relationshipFor(person.user_id || person.other_user_id);
  const id = person.user_id || person.other_user_id;
  let action = "";
  if (context === "request") {
    action = `<div class="card-actions"><button class="primary" data-action="accept" data-user="${escapeHtml(id)}">ยอมรับ</button><button class="secondary" data-action="reject" data-user="${escapeHtml(id)}">ปฏิเสธ</button></div>`;
  } else if (context === "sent") {
    action = `<div class="card-actions"><button class="secondary" data-action="cancel" data-user="${escapeHtml(id)}">ยกเลิกคำขอ</button></div>`;
  } else if (context === "friend") {
    action = state.config.messagingEnabled ? `<div class="card-actions"><button class="primary" data-action="chat" data-user="${escapeHtml(id)}">แชท</button></div>` : "";
  } else if (!relation && state.config.friendRequestsEnabled) {
    action = `<div class="card-actions"><button class="primary" data-action="request" data-user="${escapeHtml(id)}">ขอเป็นเพื่อน</button></div>`;
  } else if (relation?.status === "pending") {
    action = `<div class="card-actions"><button class="secondary" disabled>ส่งคำขอแล้ว</button></div>`;
  }
  return `<article class="person-card" data-person="${escapeHtml(id)}" tabindex="0">
    <div class="portrait">${escapeHtml(initials(person.name))}${person.distance !== undefined ? `<span class="distance-pill">${escapeHtml(formatDistance(person.distance))}</span>` : ""}</div>
    <div class="person-info"><strong>${escapeHtml(person.name)}</strong><p>${escapeHtml(person.bio || person.interests || "ยังไม่ได้แนะนำตัว")}</p><div class="person-meta"><span>${escapeHtml(person.gender || "ไม่ระบุ")}</span><span>${person.rating ? `★ ${Number(person.rating).toFixed(1)} (${Number(person.rating_count || 0)})` : ""}</span></div></div>${action}
  </article>`;
}

function renderPeople() {
  const query = $("#people-search").value.trim().toLocaleLowerCase("th");
  const gender = $("#gender-filter").value;
  const interest = $("#interest-filter").value.trim().toLocaleLowerCase("th");
  const radius = Number($("#radius-filter").value);
  const people = state.people.filter((person) => {
    const text = `${person.name} ${person.bio || ""} ${person.interests || ""}`.toLocaleLowerCase("th");
    return (!query || text.includes(query)) && (gender === "ทั้งหมด" || person.gender === gender)
      && (!interest || String(person.interests || "").toLocaleLowerCase("th").includes(interest))
      && Number(person.distance) <= radius;
  });
  $("#people-count").textContent = people.length;
  $("#people-grid").innerHTML = people.length ? people.map((person) => personCard(person)).join("") : `<div class="empty"><h2>${state.locationFresh ? "ยังไม่พบคนในระยะนี้" : "เปิดตำแหน่งเพื่อค้นหาเพื่อน"}</h2><p>ChatGun ไม่แสดงพิกัดจริง และรับเฉพาะตำแหน่งที่มีความแม่นยำไม่เกิน 50 เมตร</p></div>`;
}

function renderRelationships() {
  const incoming = state.relationships.filter((item) => item.status === "pending" && item.requested_by !== state.account.user.id);
  const sent = state.relationships.filter((item) => item.status === "pending" && item.requested_by === state.account.user.id);
  const friends = state.relationships.filter((item) => item.status === "accepted");
  $("#request-badge").hidden = incoming.length === 0;
  $("#requests-grid").innerHTML = [...incoming.map((item) => personCard(item, "request")), ...sent.map((item) => personCard(item, "sent"))].join("") || `<p class="subtitle">ไม่มีคำขอที่รอดำเนินการ</p>`;
  $("#friends-grid").innerHTML = friends.map((item) => personCard(item, "friend")).join("") || `<div class="empty"><h2>ยังไม่มีเพื่อน</h2><p>ส่งคำขอและรออีกฝ่ายยอมรับก่อนเริ่มแชท</p></div>`;
  renderConversations(friends);
}

function renderConversations(friends = state.relationships.filter((item) => item.status === "accepted")) {
  const list = $("#conversation-list");
  list.innerHTML = friends.length ? friends.map((person) => `<button class="conversation ${state.selectedChat === person.other_user_id ? "active" : ""}" data-chat="${escapeHtml(person.other_user_id)}"><span class="avatar">${escapeHtml(initials(person.name))}</span><span><strong>${escapeHtml(person.name)}</strong><br><small>เปิดบทสนทนา</small></span></button>`).join("") : `<div class="empty"><p>ต้องเป็นเพื่อนกันก่อนจึงจะแชทได้</p></div>`;
}

function renderRatings() {
  $("#reviews-list").innerHTML = state.ratings.length ? state.ratings.map((rating) => `<article class="review"><div class="review-head"><strong>${escapeHtml(rating.sender_name)}</strong><span>${"★".repeat(Number(rating.score))}</span></div><p>${escapeHtml(rating.comment || "ไม่ได้เขียนความคิดเห็น")}</p><small>${new Date(Number(rating.created_at) * 1000).toLocaleDateString("th-TH")}</small></article>`).join("") : `<div class="empty"><h2>ยังไม่มีความคิดเห็น</h2><p>ความคิดเห็นที่ได้รับจะแสดงเฉพาะคุณ</p></div>`;
}

function fillProfile() {
  if (!state.profile) return;
  const form = $("#profile-form");
  form.elements.name.value = state.profile.name || "";
  form.elements.gender.value = state.profile.gender || "ไม่ระบุ";
  form.elements.bio.value = state.profile.bio || "";
  form.elements.interests.value = state.profile.interests || "";
}

function renderBlocked() {
  $("#blocked-list").innerHTML = state.blocked.length ? state.blocked.map((person) => `<div class="blocked-row"><span>${escapeHtml(person.name)}</span><button class="secondary" data-action="unblock" data-user="${escapeHtml(person.user_id)}">เลิกบล็อก</button></div>`).join("") : `<p>ยังไม่มีผู้ใช้ที่บล็อก</p>`;
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
  if (state.locationFresh) {
    setBusy(button, true);
    try {
      await api("/api/social/discovery", { method: "POST", body: { action: "hide" } });
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
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    try {
      await api("/api/social/discovery", { method: "POST", body: { action: "location", latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy } });
      await loadPeople();
      toast("เปิดการค้นหาคนใกล้คุณแล้ว");
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; delete button.dataset.label; }
  }, (error) => {
    button.disabled = false;
    button.textContent = "เปิดตำแหน่ง";
    delete button.dataset.label;
    toast(error.code === 1 ? "กรุณาอนุญาตตำแหน่งเพื่อค้นหาคนใกล้คุณ" : "ไม่สามารถอ่านตำแหน่งได้", true);
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
}

function showPerson(id) {
  const person = state.people.find((item) => item.user_id === id) || state.relationships.find((item) => item.other_user_id === id);
  if (!person) return;
  state.selectedPerson = person;
  const relation = relationshipFor(id);
  const friendAction = !relation && state.config.friendRequestsEnabled ? `<button class="primary" data-action="request" data-user="${escapeHtml(id)}">ขอเป็นเพื่อน</button>` : relation?.status === "accepted" && state.config.messagingEnabled ? `<button class="primary" data-action="chat" data-user="${escapeHtml(id)}">แชท</button><button class="secondary" data-action="unfriend" data-user="${escapeHtml(id)}">เลิกเป็นเพื่อน</button>` : "";
  $("#profile-dialog-content").innerHTML = `<div class="dialog-profile"><div class="portrait">${escapeHtml(initials(person.name))}</div><h2>${escapeHtml(person.name)}</h2><p>${escapeHtml(person.gender || "ไม่ระบุ")} ${person.distance !== undefined ? `· ${escapeHtml(formatDistance(person.distance))}` : ""}</p><p>${escapeHtml(person.bio || "ยังไม่ได้แนะนำตัว")}</p><p><small>${escapeHtml(person.interests || "")}</small></p><div class="dialog-actions">${friendAction}${state.config.ratingsEnabled && Number(person.distance) <= 100 ? `<button class="secondary" data-action="rate" data-user="${escapeHtml(id)}">ให้คะแนน</button>` : ""}<button class="danger" data-action="block" data-user="${escapeHtml(id)}">บล็อก</button><button class="secondary" data-action="report" data-user="${escapeHtml(id)}">รายงาน</button></div></div>`;
  $("#profile-dialog").showModal();
}

async function openChat(id) {
  const person = state.relationships.find((item) => item.other_user_id === id && item.status === "accepted");
  if (!person) return;
  state.selectedChat = id;
  switchTab("chat");
  $(".chat-layout").classList.add("open");
  renderConversations();
  const thread = $("#thread");
  thread.innerHTML = `<header class="thread-head"><button class="icon-button chat-back" aria-label="กลับ">←</button><span class="avatar">${escapeHtml(initials(person.name))}</span><strong>${escapeHtml(person.name)}</strong></header><div class="messages"><p>กำลังโหลด…</p></div><form class="composer"><input maxlength="2000" required placeholder="พิมพ์ข้อความ…"><button class="primary">ส่ง</button></form>`;
  try {
    const result = await api(`/api/social/messages?target=${encodeURIComponent(id)}`);
    const messages = $(".messages", thread);
    messages.innerHTML = result.messages.length ? result.messages.map((message) => `<div class="message ${message.sender_user_id === state.account.user.id ? "mine" : ""} ${message.unsent_at ? "unsent" : ""}">${escapeHtml(message.unsent_at ? "ยกเลิกข้อความแล้ว" : message.body)}<time>${new Date(Number(message.created_at) * 1000).toLocaleString("th-TH")}</time></div>`).join("") : `<div class="empty"><p>เริ่มบทสนทนาด้วยความสุภาพ</p></div>`;
    await api("/api/social/messages", { method: "POST", body: { action: "read", target: id } });
  } catch (error) { toast(error.message, true); }
}

function switchTab(tab) {
  state.activeTab = tab;
  const labels = { near: "หาเพื่อน", friends: "เพื่อน", chat: "แชท", reviews: "ความคิดเห็น", profile: "โปรไฟล์" };
  $$("#primary-nav button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  $$(".tab-view").forEach((view) => { view.hidden = view.id !== `${tab}-tab`; });
  $("#page-title").textContent = labels[tab];
}

async function initialize() {
  try {
    state.config = await api("/api/social/config");
    if (!state.config.socialAppEnabled) {
      $("#global-status").textContent = "";
      $("#disabled-view").hidden = false;
      return;
    }
    try { state.account = await api("/api/auth/me"); }
    catch (error) {
      if (error.status === 401) return location.replace("/signup.html?next=%2Fapp%2F");
      throw error;
    }
    try { state.profile = (await api("/api/social/profile")).profile; }
    catch (error) {
      if (error.code === "not_found" && state.config.adultOnboardingEnabled) {
        $("#global-status").textContent = "";
        $("#onboarding-view").hidden = false;
        $("#onboarding-form").elements.name.value = state.account.user.displayName || "";
        return;
      }
      throw error;
    }
    $("#global-status").textContent = "";
    $("#social-view").hidden = false;
    fillProfile();
    await Promise.all([loadPeople(), loadRelationships(), loadRatings(), loadBlocked()]);
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
    const result = await api("/api/social/onboarding/adult", { method: "POST", body: { name: data.get("name"), gender: data.get("gender"), bio: data.get("bio"), interests: data.get("interests"), confirmedAdult: data.get("adult") === "on", noticeVersion: state.config.adultNoticeVersion } });
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
  setBusy(event.currentTarget, true);
  try {
    await api("/api/social/profile", { method: "POST", body: { action: "hide" } });
    state.locationFresh = false; state.people = []; renderPeople(); toast("ปิดการค้นหาและล้างตำแหน่งแล้ว");
  } catch (error) { toast(error.message, true); } finally { setBusy(event.currentTarget, false); }
});

$("#location-toggle").addEventListener("click", updateLocation);
$("#refresh").addEventListener("click", async () => { try { await Promise.all([loadPeople(), loadRelationships(), loadRatings(), loadBlocked()]); toast("อัปเดตข้อมูลแล้ว"); } catch (error) { toast(error.message, true); } });
[$("#people-search"), $("#radius-filter"), $("#gender-filter"), $("#interest-filter")].forEach((input) => input.addEventListener("input", renderPeople));

document.addEventListener("click", async (event) => {
  const close = event.target.closest(".dialog-close");
  if (close) return close.closest("dialog").close();
  if (event.target.closest(".chat-back")) { $(".chat-layout").classList.remove("open"); state.selectedChat = null; return; }
  const chat = event.target.closest("[data-chat]");
  if (chat) return openChat(chat.dataset.chat);
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
      const details = prompt("โปรดอธิบายเหตุผลที่รายงาน (ข้อมูลนี้ส่งให้ผู้ดูแลเท่านั้น)");
      if (!details) return;
      try { await api("/api/social/reports", { method: "POST", body: { target: user, category: "other", details } }); $("#profile-dialog").close(); toast("ส่งรายงานแล้ว"); } catch (error) { toast(error.message, true); }
      return;
    }
  }
  const card = event.target.closest("[data-person]");
  if (card && !event.target.closest("button")) showPerson(card.dataset.person);
});

$("#thread").addEventListener("submit", async (event) => {
  if (!event.target.matches(".composer")) return;
  event.preventDefault();
  const input = $("input", event.target);
  const body = input.value.trim();
  if (!body) return;
  setBusy(event.submitter, true);
  try { await api("/api/social/messages", { method: "POST", body: { action: "send", target: state.selectedChat, body } }); input.value = ""; await openChat(state.selectedChat); }
  catch (error) { toast(error.message, true); } finally { setBusy(event.submitter, false); }
});

$("#rating-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  setBusy(event.submitter, true);
  try { await api("/api/social/ratings", { method: "POST", body: { target: data.get("target"), score: Number(data.get("score")), comment: data.get("comment") } }); $("#rating-dialog").close(); event.currentTarget.reset(); toast("ส่งความคิดเห็นแล้ว"); }
  catch (error) { toast(error.message, true); } finally { setBusy(event.submitter, false); }
});

initialize();
