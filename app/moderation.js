"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const state = { view: "overview", page: 1, hasMore: false };
const labels = {
  general: "ทั่วไป", sensitive: "ละเอียดอ่อน", prohibited: "ต้องห้าม",
  pending: "รอตรวจ", released: "อนุมัติแล้ว", rejected: "ปฏิเสธแล้ว",
  critical: "วิกฤต", high: "สูง", medium: "ปานกลาง", low: "ปกติ",
};
const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

function cookie(name) {
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

function purpose() {
  const value = $("#moderation-purpose").value.trim();
  if (value.length < 10) throw new Error("กรุณาระบุวัตถุประสงค์อย่างน้อย 10 ตัวอักษร");
  return value;
}

async function api(path, options = {}) {
  const method = options.method || "GET";
  const headers = { accept: "application/json", "x-moderation-purpose": encodeURIComponent(purpose()), ...(options.headers || {}) };
  let body;
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (method !== "GET" && method !== "HEAD") headers["x-csrf-token"] = decodeURIComponent(cookie("__Host-cg_csrf"));
  const response = await fetch(path, { credentials: "same-origin", ...options, method, headers, ...(body ? { body } : {}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "ไม่สามารถดำเนินการได้");
  return payload;
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}

function button(text, action, value, className = "secondary") {
  const element = node("button", text, className);
  element.type = "button";
  element.dataset.action = action;
  if (value !== undefined) element.dataset.value = value;
  return element;
}

function badge(value) {
  return node("span", labels[value] || value || "ยังไม่จัดหมวด", `moderation-badge ${value || "unset"}`);
}

function severityFor(reason, status = "pending") {
  if (status === "escalated" || ["threat", "ncii", "minor_safety", "child_safety"].includes(reason)) return "critical";
  if (["violence", "privacy", "sexual_content"].includes(reason)) return "high";
  if (["harassment", "impersonation"].includes(reason)) return "medium";
  return "low";
}

function ageText(createdAt) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(createdAt || 0));
  if (seconds >= 86400) return `เปิดมา ${Math.floor(seconds / 86400).toLocaleString("th-TH")} วัน`;
  if (seconds >= 3600) return `เปิดมา ${Math.floor(seconds / 3600).toLocaleString("th-TH")} ชั่วโมง`;
  return `เปิดมา ${Math.max(1, Math.floor(seconds / 60)).toLocaleString("th-TH")} นาที`;
}

function applySeverity(card, reason, status) {
  const severity = severityFor(reason, status);
  card.classList.add(severity);
  card.dataset.severity = severity;
  return severity;
}

function setStatus(text, error = false) {
  const status = $("#moderation-status");
  status.textContent = text;
  status.classList.toggle("error", error);
}

function cardHeader(title, detail, status, category) {
  const header = node("header");
  const heading = node("div");
  heading.append(node("strong", title), node("small", detail));
  const badges = node("div", null, "moderation-badges");
  if (status) badges.append(badge(status));
  if (category) badges.append(badge(category));
  header.append(heading, badges);
  return header;
}

function empty(text) {
  const results = $("#moderation-results");
  results.replaceChildren(node("p", text, "empty panel"));
}

function decisionControls(item) {
  const wrap = node("div", null, "moderation-decision");
  const label = node("label", "หมวดหมู่");
  const select = node("select");
  select.setAttribute("aria-label", `หมวดหมู่ของ ${item.media_id}`);
  for (const [value, text] of [["general", "ทั่วไป"], ["sensitive", "ละเอียดอ่อน"], ["prohibited", "ต้องห้าม"]]) {
    const option = node("option", text); option.value = value;
    if ((item.category || "general") === value) option.selected = true;
    select.append(option);
  }
  label.append(select);
  const actions = node("div", null, "dialog-actions");
  actions.append(button("อนุมัติ", "media", "released", "primary"), button("ปฏิเสธและจำกัดการเข้าถึง", "media", "rejected", "danger"));
  wrap.append(label, actions);
  return wrap;
}

function renderMedia(items) {
  const results = $("#moderation-results");
  results.replaceChildren();
  if (!items.length) return empty("ไม่มีรูปภาพในรายการนี้");
  for (const item of items) {
    const card = node("article", null, "moderation-card");
    card.dataset.media = item.media_id;
    card.dataset.revision = String(item.revision);
    const severity = item.report_count > 0 ? "high" : "low";
    card.classList.add(severity); card.dataset.severity = severity;
    card.append(
      cardHeader(`${item.media_purpose} · ${item.owner_name || "ไม่แสดงชื่อ"}`, new Date(Number(item.created_at) * 1000).toLocaleString("th-TH"), item.status, item.category),
      badge(severity),
      node("p", `ชนิด ${item.content_type} · ${Number(item.byte_size).toLocaleString("th-TH")} ไบต์ · รายงานที่เปิดอยู่ ${Number(item.report_count || 0)} · ${ageText(item.created_at)}`),
    );
    const view = button("เปิดรูปในพื้นที่ตรวจสอบ", "media-view");
    view.dataset.value = item.media_id;
    card.append(view, decisionControls(item));
    results.append(card);
  }
}

function renderStats(counts = {}) {
  const stats = $("#moderation-stats");
  stats.replaceChildren();
  for (const [key, text] of [["critical", "วิกฤต"], ["high", "สูง"], ["pending", "สื่อรอตรวจ"], ["userReports", "รายงานผู้ใช้"], ["mediaReports", "รายงานสื่อ"], ["appeals", "อุทธรณ์"]]) {
    const card = node("article", null, "moderation-stat");
    card.append(node("strong", Number(counts[key] || 0).toLocaleString("th-TH")), node("span", text));
    stats.append(card);
  }
}

function renderDaily(daily = {}, cleanup = {}) {
  const section = $("#moderation-daily");
  section.replaceChildren(node("h2", "สรุปภาระงานย้อนหลัง 24 ชั่วโมง"));
  const grid = node("div", null, "moderation-daily-grid");
  const oldest = daily.oldestOpenAt ? ageText(daily.oldestOpenAt) : "ไม่มีงานเปิด";
  for (const [value, text] of [
    [daily.newLast24Hours || 0, "รายการเข้าใหม่"],
    [daily.resolvedLast24Hours || 0, "รายการที่ดำเนินการแล้ว"],
    [oldest, "รายการเปิดที่เก่าที่สุด"],
    [cleanup.pending || 0, "สื่อรอลบจาก R2"],
  ]) {
    const item = node("div"); item.append(node("strong", value), node("span", text)); grid.append(item);
  }
  section.append(grid);
  if (Number(cleanup.exhausted || 0) > 0) section.append(node("p", `ต้องหยุดการเผยแพร่สื่อ: คิวลบล้มเหลวถาวร ${Number(cleanup.exhausted).toLocaleString("th-TH")} รายการ`, "error"));
}

function renderUserReports(reports) {
  const results = $("#moderation-results"); results.replaceChildren();
  if (!reports.length) return empty("ไม่มีรายงานผู้ใช้ที่รอดำเนินการ");
  for (const report of reports) {
    const card = node("article", null, "moderation-card"); card.dataset.userReport = report.id;
    const severity = applySeverity(card, report.reason_code || report.category, report.status);
    card.append(
      cardHeader(`${report.reason_code || report.category} · ${report.subject_name || "ไม่แสดงชื่อ"}`, new Date(Number(report.created_at) * 1000).toLocaleString("th-TH"), report.status),
      badge(severity), node("p", report.details), node("small", ageText(report.created_at)),
    );
    const actions = node("div", null, "dialog-actions");
    actions.append(button("ตรวจแล้ว", "user-report", "reviewed"), button("ยกระดับ", "user-report", "escalated", "danger"), button("ปิดรายงาน", "user-report", "closed"));
    card.append(actions); results.append(card);
  }
}

function renderMediaReports(reports) {
  const results = $("#moderation-results"); results.replaceChildren();
  if (!reports.length) return empty("ไม่มีรายงานสื่อที่รอดำเนินการ");
  for (const report of reports) {
    const card = node("article", null, "moderation-card"); card.dataset.mediaReport = report.id;
    const severity = applySeverity(card, report.reason_code, report.status);
    card.append(cardHeader(`${report.reason_code} · ${report.media_purpose}`, new Date(Number(report.created_at) * 1000).toLocaleString("th-TH"), report.status, report.category), badge(severity), node("p", report.details), node("small", ageText(report.created_at)));
    const actions = node("div", null, "dialog-actions");
    actions.append(button("ตรวจแล้ว", "media-report", "reviewed"), button("ส่งต่อ", "media-report", "escalated"), button("ปิดรายงาน", "media-report", "closed"));
    card.append(actions); results.append(card);
  }
}

function renderAppeals(appeals) {
  const results = $("#moderation-results"); results.replaceChildren();
  if (!appeals.length) return empty("ไม่มีคำอุทธรณ์ที่รอตรวจสอบ");
  for (const appeal of appeals) {
    const card = node("article", null, "moderation-card");
    card.classList.add("medium"); card.dataset.severity = "medium";
    card.dataset.appeal = appeal.id; card.dataset.revision = String(appeal.revision);
    card.append(cardHeader(`อุทธรณ์สื่อ ${appeal.media_id}`, new Date(Number(appeal.created_at) * 1000).toLocaleString("th-TH"), appeal.status, appeal.category), badge("medium"), node("p", appeal.reason), node("small", ageText(appeal.created_at)));
    const category = node("select"); category.setAttribute("aria-label", `หมวดหมู่หลังอนุมัติอุทธรณ์ ${appeal.id}`);
    for (const [value, text] of [["general", "ทั่วไป"], ["sensitive", "ละเอียดอ่อน"]]) { const option = node("option", text); option.value = value; category.append(option); }
    const actions = node("div", null, "dialog-actions"); actions.append(button("อนุมัติอุทธรณ์", "appeal", "granted", "primary"), button("ยืนยันคำตัดสินเดิม", "appeal", "denied", "danger"));
    card.append(category, actions); results.append(card);
  }
}

function renderPriority({ userReports = [], mediaReports = [], appeals = [], media = [] }) {
  const results = $("#moderation-results"); results.replaceChildren();
  const items = [
    ...userReports.map((item) => ({ kind: "รายงานผู้ใช้", reason: item.reason_code || item.category, status: item.status, created_at: item.created_at, title: item.subject_name || "ไม่แสดงชื่อ", detail: item.details })),
    ...mediaReports.map((item) => ({ kind: "รายงานสื่อ", reason: item.reason_code, status: item.status, created_at: item.created_at, title: item.media_purpose, detail: item.details })),
    ...appeals.map((item) => ({ kind: "คำอุทธรณ์", reason: "appeal", status: item.status, created_at: item.created_at, title: item.media_id, detail: item.reason, fixedSeverity: "medium" })),
    ...media.map((item) => ({ kind: "สื่อรอตรวจ", reason: item.report_count > 0 ? "privacy" : "pending", status: item.status, created_at: item.created_at, title: item.media_purpose, detail: `รายงานที่เปิดอยู่ ${Number(item.report_count || 0)}`, fixedSeverity: item.report_count > 0 ? "high" : "low" })),
  ].map((item) => ({ ...item, severity: item.fixedSeverity || severityFor(item.reason, item.status) }))
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || Number(a.created_at) - Number(b.created_at));
  if (!items.length) return empty("ไม่มีงานเปิดในคิวรวม");
  for (const item of items) {
    const card = node("article", null, `moderation-card ${item.severity}`);
    card.append(cardHeader(`${item.kind} · ${item.title}`, new Date(Number(item.created_at) * 1000).toLocaleString("th-TH")), badge(item.severity), node("p", item.detail), node("small", ageText(item.created_at)));
    results.append(card);
  }
}

function renderAudit(events) {
  const results = $("#moderation-results"); results.replaceChildren();
  if (!events.length) return empty("ยังไม่มีประวัติการตัดสินใจ");
  for (const event of events) {
    const card = node("article", null, "moderation-card audit-card");
    card.append(cardHeader(`${labels[event.action] || event.action} · ${labels[event.category] || event.category}`, new Date(Number(event.created_at) * 1000).toLocaleString("th-TH"), event.action, event.category), node("p", event.reason), node("small", `สื่อ ${event.media_id} · รุ่น ${event.revision}`));
    results.append(card);
  }
}

async function load(view = state.view) {
  state.view = view; setStatus("กำลังโหลด…");
  document.querySelectorAll("[data-load]").forEach((item) => item.classList.toggle("active", item.dataset.load === view));
  $("#moderation-stats").hidden = view !== "overview";
  $("#moderation-daily").hidden = view !== "overview";
  $("#moderation-filters").hidden = !["pending", "approved", "sensitive", "rejected"].includes(view);
  $("#moderation-pagination").hidden = !["pending", "approved", "sensitive", "rejected", "audit"].includes(view);
  let payload;
  if (view === "overview") { payload = await api("/api/social/moderation/overview"); renderStats(payload.counts); renderDaily(payload.daily, payload.cleanup); empty("เลือกงานด่วนหรือคิวด้านบนเพื่อเริ่มตรวจสอบ"); }
  else if (view === "priority") {
    const [userReports, mediaReports, appeals, media] = await Promise.all([
      api("/api/social/moderation/reports?status=pending"), api("/api/social/moderation/media-reports?status=pending"),
      api("/api/social/moderation/appeals?status=pending"), api("/api/social/moderation/media?status=pending&page=1"),
    ]);
    payload = {}; renderPriority({ userReports: userReports.reports || [], mediaReports: mediaReports.reports || [], appeals: appeals.appeals || [], media: media.media || [] });
  }
  else if (["pending", "approved", "sensitive", "rejected"].includes(view)) {
    const status = view === "approved" || view === "sensitive" ? "approved" : view;
    const category = view === "sensitive" ? "sensitive" : $("#moderation-category").value;
    const query = new URLSearchParams({ status, category, q: $("#moderation-search").value.trim(), page: String(state.page) });
    payload = await api(`/api/social/moderation/media?${query}`); renderMedia(payload.media || []);
  } else if (view === "user-reports") { payload = await api("/api/social/moderation/reports?status=pending"); renderUserReports(payload.reports || []); }
  else if (view === "media-reports") { payload = await api("/api/social/moderation/media-reports?status=pending"); renderMediaReports(payload.reports || []); }
  else if (view === "appeals") { payload = await api("/api/social/moderation/appeals?status=pending"); renderAppeals(payload.appeals || []); }
  else if (view === "audit") { payload = await api(`/api/social/moderation/audit?page=${state.page}`); renderAudit(payload.events || []); }
  state.hasMore = Boolean(payload?.hasMore);
  $("#moderation-page").textContent = `หน้า ${state.page.toLocaleString("th-TH")}`;
  $("[data-page='previous']").disabled = state.page <= 1;
  $("[data-page='next']").disabled = !state.hasMore;
  setStatus("โหลดข้อมูลเรียบร้อยแล้ว");
}

async function authenticatedImage(path) {
  const response = await fetch(path, { credentials: "same-origin", headers: { "x-moderation-purpose": encodeURIComponent(purpose()) } });
  if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || "ไม่สามารถเปิดรูปภาพได้"); }
  return URL.createObjectURL(await response.blob());
}

async function showMedia(id) {
  const detail = $("#moderation-detail");
  detail.replaceChildren(node("h2", "ตรวจรูปภาพ"), node("p", "กำลังโหลด…"));
  $("#moderation-dialog").showModal();
  const url = await authenticatedImage(`/api/social/moderation/media/${encodeURIComponent(id)}`);
  const image = node("img"); image.src = url; image.alt = "รูปภาพในพื้นที่ตรวจสอบที่มีการควบคุม"; image.className = "moderation-media";
  detail.replaceChildren(node("h2", "ตรวจรูปภาพ"), image, node("p", "ห้ามบันทึกหรือเผยแพร่หลักฐานนอกกระบวนการดูแล", "moderation-warning"));
  $("#moderation-dialog").addEventListener("close", () => URL.revokeObjectURL(url), { once: true });
}

document.addEventListener("click", async (event) => {
  const close = event.target.closest(".dialog-close");
  if (close) return close.closest("dialog").close();
  const loader = event.target.closest("[data-load]");
  if (loader) { state.page = 1; try { await load(loader.dataset.load); } catch (error) { setStatus(error.message, true); } return; }
  const pager = event.target.closest("[data-page]");
  if (pager) { state.page += pager.dataset.page === "next" ? 1 : -1; try { await load(); } catch (error) { setStatus(error.message, true); } return; }
  if (event.target.closest("#apply-filters")) { state.page = 1; try { await load(); } catch (error) { setStatus(error.message, true); } return; }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  try {
    if (action.dataset.action === "media-view") await showMedia(action.dataset.value);
    if (action.dataset.action === "media") {
      const card = action.closest("[data-media]");
      const category = card.querySelector("select").value;
      if ((category === "prohibited") !== (action.dataset.value === "rejected")) throw new Error("รูปต้องห้ามต้องถูกปฏิเสธ และรูปที่อนุมัติต้องเลือกทั่วไปหรือละเอียดอ่อน");
      const reason = prompt("บันทึกเหตุผลการตัดสินใจ (จำเป็น)");
      if (!reason?.trim()) return;
      if (action.dataset.value === "rejected" && !confirm("ยืนยันการจำกัดการเข้าถึงและนำรูปเข้าสู่คิวลบหรือไม่")) return;
      await api("/api/social/moderation/media", { method: "POST", body: { id: card.dataset.media, status: action.dataset.value, category, reason, revision: Number(card.dataset.revision) } });
      await load();
    }
    if (action.dataset.action === "media-report") {
      const note = prompt("บันทึกเหตุผลการดำเนินการกับรายงาน (จำเป็น)"); if (!note?.trim()) return;
      await api("/api/social/moderation/media-reports", { method: "POST", body: { id: action.closest("[data-media-report]").dataset.mediaReport, status: action.dataset.value, note } }); await load();
    }
    if (action.dataset.action === "user-report") {
      const note = prompt("บันทึกเหตุผลการดำเนินการกับรายงานผู้ใช้ (จำเป็น)"); if (!note?.trim()) return;
      await api("/api/social/moderation/reports", { method: "POST", body: { id: action.closest("[data-user-report]").dataset.userReport, status: action.dataset.value, note } }); await load();
    }
    if (action.dataset.action === "appeal") {
      const card = action.closest("[data-appeal]"); const reason = prompt("บันทึกเหตุผลผลอุทธรณ์ (จำเป็น)"); if (!reason?.trim()) return;
      await api("/api/social/moderation/appeals", { method: "POST", body: { id: card.dataset.appeal, decision: action.dataset.value, category: card.querySelector("select").value, reason, revision: Number(card.dataset.revision) } }); await load();
    }
  } catch (error) { setStatus(error.message, true); }
});
