"use strict";

const $ = (id) => document.getElementById(id);
let busy = false;
let turnstileWidget = null;
let turnstileReady = false;
let turnstileSiteKey = null;
let turnstileScript = null;
let turnstileLoadTimer = null;
const betaAdmission = window.ChatgunBetaAdmission.capture(window.location,window.history);
let authConfig = null;

const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_CONNECTION_MESSAGE = "ไม่สามารถเชื่อมต่อระบบยืนยันความปลอดภัยได้ โปรดตรวจสอบอินเทอร์เน็ต อนุญาต challenges.cloudflare.com ในตัวบล็อกเนื้อหา แล้วลองใหม่";

const ERROR_MESSAGES = {
  provider_denied: "คุณยกเลิกการเข้าสู่ระบบ กรุณาลองอีกครั้งเมื่อต้องการ",
  invalid_state: "คำขอเข้าสู่ระบบหมดอายุ กรุณาเริ่มใหม่",
  oauth_expired: "คำขอเข้าสู่ระบบหมดอายุ กรุณาเริ่มใหม่",
  oauth_used: "คำขอนี้ถูกใช้ไปแล้ว กรุณาเริ่มใหม่",
  identity_linked: "บัญชีนี้เชื่อมกับสมาชิกคนอื่นแล้ว",
  registration_closed: "ขณะนี้เปิดให้เข้าสู่ระบบด้วยบัญชีเดิมเท่านั้น การสมัครใหม่จะเปิดหลังมาตรการคุ้มครองผู้เยาว์ได้รับอนุมัติ",
  oauth_failed: "ไม่สามารถเข้าสู่ระบบกับผู้ให้บริการนี้ได้ กรุณาลองใหม่",
  invitation_invalid: "ลิงก์เชิญไม่ถูกต้องหรือหมดอายุ กรุณาติดต่อผู้ดูแล",
  invitation_unavailable: "ลิงก์เชิญนี้ไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล",
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

function showTurnstileFailure(text = TURNSTILE_CONNECTION_MESSAGE, retry = true) {
  turnstileReady = false;
  message(text);
  $("turnstile-retry").hidden = !retry;
}

function handleTurnstileError(code) {
  const normalizedCode = String(code || "");
  if (["110100", "110110", "110200", "400020", "400021", "400070"].includes(normalizedCode)) {
    showTurnstileFailure("เว็บไซต์ทดสอบนี้ยังไม่ได้รับอนุญาตให้ใช้ระบบยืนยันความปลอดภัย โปรดแจ้งผู้ดูแล ChatGun", false);
    return;
  }
  showTurnstileFailure();
}

function renderTurnstile() {
  if (!window.turnstile || !turnstileSiteKey) {
    showTurnstileFailure();
    return;
  }
  try {
    turnstileWidget = window.turnstile.render("#turnstile", {
      sitekey: turnstileSiteKey,
      action: "auth_start",
      theme: "light",
      callback: () => {
        turnstileReady = true;
        $("turnstile-retry").hidden = true;
        message("");
      },
      "error-callback": handleTurnstileError,
      "expired-callback": () => {
        turnstileReady = true;
        message("การยืนยันหมดอายุแล้ว กรุณายืนยันอีกครั้ง");
      },
      "timeout-callback": () => showTurnstileFailure("ระบบยืนยันใช้เวลานานเกินไป กรุณาลองโหลดอีกครั้ง"),
      "unsupported-callback": () => showTurnstileFailure("เบราว์เซอร์นี้ไม่รองรับระบบยืนยันความปลอดภัย กรุณาอัปเดตเบราว์เซอร์หรือใช้เบราว์เซอร์อื่น", false),
    });
    turnstileReady = true;
  } catch {
    showTurnstileFailure();
  }
}

function loadTurnstileScript() {
  clearTimeout(turnstileLoadTimer);
  turnstileScript?.remove();
  turnstileScript = document.createElement("script");
  turnstileScript.src = TURNSTILE_SCRIPT_URL;
  turnstileScript.async = true;
  turnstileScript.defer = true;
  turnstileScript.onload = () => {
    clearTimeout(turnstileLoadTimer);
    renderTurnstile();
  };
  turnstileScript.onerror = () => {
    clearTimeout(turnstileLoadTimer);
    showTurnstileFailure();
  };
  document.head.appendChild(turnstileScript);
  turnstileLoadTimer = window.setTimeout(() => {
    if (!window.turnstile) showTurnstileFailure();
  }, 15000);
}

$("turnstile-retry").addEventListener("click", () => {
  $("turnstile-retry").hidden = true;
  message("กำลังโหลดระบบยืนยันความปลอดภัยอีกครั้ง…");
  turnstileReady = false;
  if (window.turnstile) {
    try {
      if (turnstileWidget !== null) window.turnstile.remove(turnstileWidget);
    } catch {
      // The failed widget might already have been removed by Turnstile.
    }
    turnstileWidget = null;
    $("turnstile").replaceChildren();
    renderTurnstile();
    return;
  }
  loadTurnstileScript();
});

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
    if(betaAdmission.error){message(ERROR_MESSAGES[betaAdmission.error]);return;}
    let token;
    try { token = turnstileToken(); } catch (error) { message(error.message); return; }
    lock(true);
    try {
      const result = await api(`/api/auth/oauth/${button.dataset.provider}/start`, {
        turnstileToken: token,
        ...window.ChatgunBetaAdmission.requestFields(betaAdmission,authConfig),
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
    authConfig = config;
    const providers=Array.isArray(config.oauthProviders)?config.oauthProviders:[];
    document.querySelectorAll('[data-provider]').forEach(button=>{button.hidden=!providers.includes(button.dataset.provider);});
    if (config.oauthLoginEnabled === false) {
      document.querySelectorAll("[data-provider]").forEach(button => { button.disabled = true; });
      $("auth-description").textContent = "ChatGun กำลังเตรียมเปิดให้บริการ ยังไม่เปิดรับสมาชิกหรือเข้าสู่บัญชี";
      message("ระบบบัญชียังไม่พร้อมใช้งาน โปรดกลับมาตรวจสอบภายหลัง");
      return;
    }
    if (!response.ok || !config.turnstileSiteKey) throw new Error("ยังไม่ได้ตั้งค่าระบบตรวจสอบความปลอดภัย");
    if(!providers.length){message("ยังไม่มีผู้ให้บริการเข้าสู่ระบบที่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล");return;}
    if(betaAdmission.error){message(ERROR_MESSAGES[betaAdmission.error]);return;}
    if(betaAdmission.code&&config.invitationOnlyRegistrationEnabled&&!config.newAccountRegistrationEnabled){
      $("auth-heading").textContent="เข้าร่วมการทดสอบ ChatGun";
      $("auth-description").textContent="สำหรับผู้ได้รับเชิญอายุ 18 ปีขึ้นไป ยืนยันอายุและอ่านข้อกำหนดหลังเข้าสู่ระบบ";
    }
    if (config.newAccountRegistrationEnabled) {
      $("auth-heading").textContent = "เข้าสู่ระบบหรือสร้างบัญชี";
      $("auth-description").textContent = "เลือกบัญชีโซเชียลที่คุณต้องการใช้กับ ChatGun";
      $("social-consent").textContent = "เมื่อดำเนินการต่อ ChatGun จะรับชื่อ รูปโปรไฟล์ และอีเมลเท่าที่ผู้ให้บริการอนุญาต เพื่อสร้างหรือยืนยันบัญชีและรักษาความปลอดภัยในการเข้าสู่ระบบ";
    }
    turnstileSiteKey = config.turnstileSiteKey;
    loadTurnstileScript();
  } catch (error) {
    showTurnstileFailure(error.message);
  }
}

const authError = new URLSearchParams(window.location.search).get("auth_error");
if (authError) {
  message(ERROR_MESSAGES[authError] || "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่");
  window.history.replaceState({}, "", window.location.pathname);
}
initializeTurnstile();
