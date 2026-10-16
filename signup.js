"use strict";

const $ = (id) => document.getElementById(id);
let busy = false;
let turnstileWidget = null;
let turnstileReady = false;

const ERROR_MESSAGES = {
  provider_denied: "คุณยกเลิกการเข้าสู่ระบบ กรุณาลองอีกครั้งเมื่อต้องการ",
  invalid_state: "คำขอเข้าสู่ระบบหมดอายุ กรุณาเริ่มใหม่",
  oauth_expired: "คำขอเข้าสู่ระบบหมดอายุ กรุณาเริ่มใหม่",
  oauth_used: "คำขอนี้ถูกใช้ไปแล้ว กรุณาเริ่มใหม่",
  identity_linked: "บัญชีนี้เชื่อมกับสมาชิกคนอื่นแล้ว",
  registration_closed: "ขณะนี้เปิดให้เข้าสู่ระบบด้วยบัญชีเดิมเท่านั้น การสมัครใหม่จะเปิดหลังมาตรการคุ้มครองผู้เยาว์ได้รับอนุมัติ",
  invitation_invalid: "รหัสเชิญไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบรหัสแล้วลองใหม่",
  invitation_unavailable: "รหัสเชิญถูกใช้หรือหมดอายุแล้ว กรุณาขอรหัสใหม่จากผู้ดูแล Beta",
  oauth_failed: "ไม่สามารถเข้าสู่ระบบกับผู้ให้บริการนี้ได้ กรุณาลองใหม่",
};

function message(text, ok = false) {
  $("message").textContent = text;
  $("message").classList.toggle("ok", ok);
}

function lock(value) {
  busy = value;
  document.querySelectorAll("[data-provider]").forEach((button) => { button.disabled = value; });
}

function turnstileToken() {
  if (!turnstileReady || turnstileWidget === null) throw new Error("ระบบตรวจสอบความปลอดภัยยังไม่พร้อม กรุณารอสักครู่");
  const token = window.turnstile.getResponse(turnstileWidget);
  if (!token) throw new Error("กรุณายืนยันว่าคุณไม่ใช่โปรแกรมอัตโนมัติ");
  return token;
}

function resetTurnstile() {
  if (turnstileReady && turnstileWidget !== null) window.turnstile.reset(turnstileWidget);
}

async function api(path, data) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(data),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "ระบบยืนยันตัวตนยังไม่พร้อมใช้งาน");
  return body;
}

document.querySelectorAll("[data-provider]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (busy) return;
    let token;
    try { token = turnstileToken(); } catch (error) { message(error.message); return; }
    lock(true);
    try {
      const result = await api(`/api/auth/oauth/${button.dataset.provider}/start`, {
        turnstileToken: token,
        invitationCode: $("invitation-code").value.trim(),
      });
      const target = new URL(result.authorizationUrl);
      if (target.protocol !== "https:") throw new Error("ปลายทางเข้าสู่ระบบไม่ถูกต้อง");
      window.location.assign(target.toString());
    } catch (error) {
      message(error.message);
      lock(false);
      resetTurnstile();
    }
  });
});

async function initializeTurnstile() {
  try {
    const response = await fetch("/api/auth/config", { credentials: "same-origin" });
    const config = await response.json();
    if (!response.ok || !config.turnstileSiteKey) throw new Error("ยังไม่ได้ตั้งค่าระบบตรวจสอบความปลอดภัย");
    if (config.newAccountRegistrationEnabled) {
      $("auth-heading").textContent = "เข้าสู่ระบบหรือสร้างบัญชี";
      $("auth-description").textContent = "เลือกบัญชีโซเชียลที่คุณต้องการใช้กับ ChatGun";
      $("social-consent").textContent = "เมื่อดำเนินการต่อ ChatGun จะรับชื่อ รูปโปรไฟล์ และอีเมลเท่าที่ผู้ให้บริการอนุญาต เพื่อสร้างหรือยืนยันบัญชีและรักษาความปลอดภัยในการเข้าสู่ระบบ";
    } else if (config.invitationOnlyRegistrationEnabled) {
      $("auth-heading").textContent = "เข้าสู่ระบบ หรือเข้าร่วม Beta";
      $("auth-description").textContent = "Beta จำกัดเฉพาะผู้ได้รับเชิญอายุ 18 ปีขึ้นไป ส่วนสมาชิกเดิมเข้าสู่ระบบได้ตามปกติ";
      $("invitation-field").hidden = false;
      $("social-consent").textContent = "เมื่อดำเนินการต่อ ChatGun จะรับชื่อ รูปโปรไฟล์ และอีเมลเท่าที่ผู้ให้บริการอนุญาต เพื่อสร้างหรือยืนยันบัญชีและรักษาความปลอดภัยในการเข้าสู่ระบบ";
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      turnstileWidget = window.turnstile.render("#turnstile", { sitekey: config.turnstileSiteKey, action: "auth_start", theme: "light" });
      turnstileReady = true;
    };
    script.onerror = () => message("โหลดระบบตรวจสอบความปลอดภัยไม่สำเร็จ กรุณารีเฟรชหน้า");
    document.head.appendChild(script);
  } catch (error) {
    message(error.message);
  }
}

const authError = new URLSearchParams(window.location.search).get("auth_error");
if (authError) {
  message(ERROR_MESSAGES[authError] || "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่");
  window.history.replaceState({}, "", window.location.pathname);
}
initializeTurnstile();
