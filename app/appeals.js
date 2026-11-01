// Genuine authenticated member only. No provider tokens, mock sessions or public bypass.
const status = document.querySelector("#appeal-status");
const host = document.querySelector("#account-restrictions");

function csrf() {
  return decodeURIComponent(document.cookie.split(";").map((value) => value.trim())
    .find((value) => value.startsWith("__Host-cg_csrf="))?.split("=").slice(1).join("=") || "");
}

async function api(path, body) {
  const headers = { accept: "application/json" };
  if (body) Object.assign(headers, { "content-type": "application/json", "x-csrf-token": csrf() });
  const response = await fetch(path, {
    method: body ? "POST" : "GET", credentials: "same-origin", headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw Error(payload.message || payload.error || "ไม่สามารถเปิดคำขอได้ กรุณาเข้าสู่ระบบอีกครั้ง");
  return payload;
}

function paragraph(text) {
  const element = document.createElement("p"); element.textContent = text; return element;
}

function requestForm({ label, buttonText, evidence = false, submit }) {
  const form = document.createElement("form");
  const reasonLabel = document.createElement("label");
  const reason = document.createElement("textarea");
  reasonLabel.textContent = label; reason.required = true; reason.minLength = 10; reason.maxLength = 1000; reasonLabel.append(reason);
  form.append(reasonLabel);
  let evidenceText;
  if (evidence) {
    const evidenceLabel = document.createElement("label"); evidenceText = document.createElement("textarea");
    evidenceLabel.textContent = "ข้อมูลหรือหลักฐานเพิ่มเติม (ไม่บังคับ, 10–2,000 ตัวอักษร)";
    evidenceText.maxLength = 2000; evidenceLabel.append(evidenceText); form.append(evidenceLabel);
  }
  const button = document.createElement("button"); button.type = "submit"; button.textContent = buttonText; form.append(button);
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); button.disabled = true;
    try { await submit(reason.value, evidenceText?.value || ""); await load(); }
    catch (error) { status.textContent = error.message; button.disabled = false; }
  });
  return form;
}

async function load() {
  host.replaceChildren();
  try {
    const configuration = await api("/api/social/config");
    document.querySelector("#reconsideration-section").hidden = !configuration.accountReconsiderationEnabled;
    const [appealData, reconsiderationData] = await Promise.all([
      api("/api/social/account-appeals"),
      configuration.accountReconsiderationEnabled ? api("/api/social/account-reconsiderations") : Promise.resolve({ restrictions: [] }),
    ]);
    const reconsiderations = new Map(reconsiderationData.restrictions.map((item) => [item.id, item]));
    status.textContent = appealData.restrictions.length ? "ข้อมูลข้อจำกัดบัญชีของคุณ" : "ไม่มีรายการจำกัดบัญชีของคุณ";
    for (const row of appealData.restrictions) {
      const reconsideration = reconsiderations.get(row.id) || {};
      const section = document.createElement("section"); const heading = document.createElement("h2");
      heading.textContent = row.status === "active" ? "บัญชีถูกจำกัด" : "คืนสิทธิ์แล้ว";
      section.append(heading, paragraph(row.reason));
      if (reconsideration.reconsideration_status) {
        section.append(paragraph(reconsideration.reconsideration_status === "pending"
          ? "ส่งคำขอพิจารณาใหม่แล้ว · รอผู้ตัดสินเดิมตรวจสอบ (ไม่ใช่การอุทธรณ์อิสระ)"
          : `ผลการพิจารณาใหม่โดยผู้ตัดสินเดิม: ${reconsideration.decision_reason || reconsideration.reconsideration_status}`));
      } else if (configuration.accountReconsiderationEnabled && row.status === "active" && !row.appeal_status) {
        section.append(requestForm({
          label: "เหตุผลขอให้ผู้ตัดสินเดิมพิจารณาใหม่ (10–1,000 ตัวอักษร)",
          buttonText: "ส่งคำขอพิจารณาใหม่ (ไม่ใช่อุทธรณ์อิสระ)", evidence: true,
          submit: (reason, evidenceText) => api("/api/social/account-reconsiderations", { id: row.id, reason, evidenceText }),
        }));
      }
      if (row.appeal_status) {
        section.append(paragraph(row.appeal_status === "pending"
          ? "ส่งคำอุทธรณ์อิสระแล้ว · รอผู้ตรวจคนอื่น"
          : `ผลอุทธรณ์อิสระ: ${row.decision_reason || row.appeal_status}`));
      } else if (row.status === "active" && !reconsideration.reconsideration_status) {
        section.append(requestForm({
          label: "เหตุผลยื่นอุทธรณ์ต่อผู้ตรวจคนอื่น (10–1,000 ตัวอักษร)", buttonText: "ยื่นอุทธรณ์อิสระ",
          submit: (reason) => api("/api/social/account-appeals", { id: row.id, reason }),
        }));
      }
      host.append(section);
    }
  } catch (error) { status.textContent = error.message; }
}

load();
