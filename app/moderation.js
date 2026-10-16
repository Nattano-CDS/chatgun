const $ = (selector, root = document) => root.querySelector(selector);

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
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  if (method !== "GET" && method !== "HEAD") headers["x-csrf-token"] = decodeURIComponent(cookie("__Host-cg_csrf"));
  const response = await fetch(path, { credentials: "same-origin", ...options, method, headers });
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

function setStatus(text, error = false) {
  const status = $("#moderation-status");
  status.textContent = text;
  status.classList.toggle("error", error);
}

function cardHeader(title, detail) {
  const header = node("header");
  header.append(node("strong", title), node("small", detail));
  return header;
}

function renderReports(reports) {
  const results = $("#moderation-results");
  results.replaceChildren();
  if (!reports.length) return results.append(node("p", "ไม่มีรายงานที่รอตรวจสอบ", "empty"));
  for (const report of reports) {
    const card = node("article", null, "moderation-card");
    card.dataset.report = report.id;
    card.append(
      cardHeader(`${report.category} · ${report.subject_name}`, new Date(Number(report.created_at) * 1000).toLocaleString("th-TH")),
      node("p", report.details),
      node("small", `ผู้รายงาน: ${report.reporter_name}`),
    );
    const actions = node("div", null, "dialog-actions");
    actions.append(button("ตรวจแล้ว", "report", "reviewed"), button("ส่งต่อ", "report", "escalated"), button("ปิดรายงาน", "report", "closed"));
    card.append(actions);
    results.append(card);
  }
}

function renderMessages(messages) {
  const results = $("#moderation-results");
  results.replaceChildren();
  if (!messages.length) return results.append(node("p", "ไม่มีข้อความในช่วงที่ตรวจสอบ", "empty"));
  for (const message of messages) {
    const card = node("article", null, "moderation-card");
    card.append(
      cardHeader(`${message.sender_name} → ${message.receiver_name}`, new Date(Number(message.created_at) * 1000).toLocaleString("th-TH")),
      node("p", message.unsent_at ? "[ผู้ส่งยกเลิกข้อความแล้ว]" : message.body || "[รูปภาพ]"),
    );
    if (message.media_id && !message.unsent_at) card.append(button("เปิดรูปที่แนบ", "message-media", message.media_id));
    results.append(card);
  }
}

function renderVerification(requests) {
  const results = $("#moderation-results");
  results.replaceChildren();
  if (!requests.length) return results.append(node("p", "ไม่มีคำขอยืนยันตัวตนที่รอตรวจสอบ", "empty"));
  for (const request of requests) {
    const card = node("article", null, "moderation-card");
    card.dataset.user = request.user_id;
    card.dataset.identity = request.id_media_id;
    card.dataset.selfie = request.selfie_media_id;
    card.append(cardHeader(request.name, new Date(Number(request.created_at) * 1000).toLocaleString("th-TH")));
    const actions = node("div", null, "dialog-actions");
    actions.append(button("เปิดหลักฐาน", "verification-evidence"), button("อนุมัติ", "verification", "approved", "primary"), button("ปฏิเสธ", "verification", "rejected"));
    card.append(actions);
    results.append(card);
  }
}

async function load(kind) {
  setStatus("กำลังโหลด…");
  const endpoints = { reports: "/api/social/moderation/reports", messages: "/api/social/moderation/messages", verification: "/api/social/moderation/verification" };
  const payload = await api(endpoints[kind]);
  if (kind === "reports") renderReports(payload.reports || []);
  if (kind === "messages") renderMessages(payload.messages || []);
  if (kind === "verification") renderVerification(payload.requests || []);
  setStatus(`โหลดข้อมูล ${kind} แล้ว`);
}

async function authenticatedImage(path) {
  const response = await fetch(path, { credentials: "same-origin", headers: { "x-moderation-purpose": encodeURIComponent(purpose()) } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "ไม่สามารถเปิดหลักฐานได้");
  }
  return URL.createObjectURL(await response.blob());
}

async function showEvidence(card) {
  const detail = $("#moderation-detail");
  detail.replaceChildren(node("h2", "หลักฐานยืนยันตัวตน"), node("p", "กำลังโหลด…"));
  $("#moderation-dialog").showModal();
  const urls = [];
  try {
    for (const id of [card.dataset.identity, card.dataset.selfie]) if (id && id !== "null") urls.push(await authenticatedImage(`/api/social/moderation/verification/media/${encodeURIComponent(id)}`));
    const grid = node("div", null, "evidence-grid");
    for (const [index, url] of urls.entries()) {
      const image = node("img");
      image.src = url;
      image.alt = index === 0 ? "เอกสารยืนยันตัวตน" : "ภาพถ่ายคู่เอกสาร";
      grid.append(image);
    }
    detail.replaceChildren(node("h2", "หลักฐานยืนยันตัวตน"), grid);
    $("#moderation-dialog").addEventListener("close", () => urls.forEach(URL.revokeObjectURL), { once: true });
  } catch (error) {
    urls.forEach(URL.revokeObjectURL);
    detail.replaceChildren(node("p", error.message, "error"));
  }
}

document.addEventListener("click", async (event) => {
  const close = event.target.closest(".dialog-close");
  if (close) return close.closest("dialog").close();
  const loader = event.target.closest("[data-load]");
  if (loader) {
    try { await load(loader.dataset.load); } catch (error) { setStatus(error.message, true); }
    return;
  }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  try {
    if (action.dataset.action === "report") {
      const note = prompt("บันทึกเหตุผลการตัดสินใจ (จำเป็น)");
      if (!note?.trim()) return;
      await api("/api/social/moderation/reports", { method: "POST", body: { id: action.closest("[data-report]").dataset.report, status: action.dataset.value, note } });
      await load("reports");
    }
    if (action.dataset.action === "message-media") {
      const url = await authenticatedImage(`/api/social/moderation/messages/media/${encodeURIComponent(action.dataset.value)}`);
      const detail = $("#moderation-detail");
      const image = node("img"); image.src = url; image.alt = "รูปที่แนบในข้อความ"; image.className = "moderation-media";
      detail.replaceChildren(node("h2", "รูปที่แนบในข้อความ"), image);
      $("#moderation-dialog").showModal();
      $("#moderation-dialog").addEventListener("close", () => URL.revokeObjectURL(url), { once: true });
    }
    if (action.dataset.action === "verification-evidence") await showEvidence(action.closest("[data-user]"));
    if (action.dataset.action === "verification") {
      const rejected = action.dataset.value === "rejected";
      const reason = rejected ? prompt("ระบุเหตุผลที่ปฏิเสธ (จำเป็น)") : "";
      if (rejected && !reason?.trim()) return;
      await api("/api/social/moderation/verification", { method: "POST", body: { user: action.closest("[data-user]").dataset.user, status: action.dataset.value, reason } });
      await load("verification");
    }
  } catch (error) { setStatus(error.message, true); }
});
