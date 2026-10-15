"use strict";

const $ = (id) => document.getElementById(id);
let challengeId = null;
let busy = false;
let turnstileWidget = null;
let turnstileReady = false;
let resendTimer = null;
let resendCoolingDown = false;

const ERROR_MESSAGES = {
  provider_denied: "คุณยกเลิกการเข้าสู่ระบบ กรุณาลองอีกครั้งเมื่อต้องการ",
  invalid_state: "คำขอเข้าสู่ระบบหมดอายุ กรุณาเริ่มใหม่",
  oauth_expired: "คำขอเข้าสู่ระบบหมดอายุ กรุณาเริ่มใหม่",
  oauth_used: "คำขอนี้ถูกใช้ไปแล้ว กรุณาเริ่มใหม่",
  identity_linked: "บัญชีนี้เชื่อมกับสมาชิกคนอื่นแล้ว",
  oauth_failed: "ไม่สามารถเข้าสู่ระบบกับผู้ให้บริการนี้ได้ กรุณาลองใหม่",
};

function message(text, ok = false) {
  $("message").textContent = text;
  $("message").classList.toggle("ok", ok);
}

function lock(value) {
  busy = value;
  document.querySelectorAll("button").forEach((button) => {
    if (button.id !== "phone-tab") button.disabled = value || (button.id === "resend" && resendCoolingDown);
  });
  document.querySelectorAll(".primary").forEach((button) => button.classList.toggle("loading", value));
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

function emailAddress() {
  const email = $("contact").value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new Error("กรุณากรอกอีเมลให้ถูกต้อง");
  return email;
}

function beginCooldown(seconds) {
  clearInterval(resendTimer);
  let remaining = seconds;
  resendCoolingDown = true;
  $("resend").disabled = true;
  $("resend").textContent = `ส่งรหัสใหม่ (${remaining})`;
  resendTimer = setInterval(() => {
    remaining -= 1;
    $("resend").textContent = remaining > 0 ? `ส่งรหัสใหม่ (${remaining})` : "ส่งรหัสใหม่";
    if (remaining <= 0) {
      clearInterval(resendTimer);
      resendCoolingDown = false;
      $("resend").disabled = false;
    }
  }, 1000);
}

async function sendOtp() {
  if (busy) return;
  let email;
  let token;
  try {
    email = emailAddress();
    token = turnstileToken();
  } catch (error) {
    message(error.message);
    return;
  }
  lock(true);
  try {
    const result = await api("/api/auth/otp/start", { channel: "email", destination: email, turnstileToken: token });
    challengeId = result.challengeId;
    $("destination").textContent = email;
    $("start").hidden = true;
    $("verify").hidden = false;
    $("code").focus();
    beginCooldown(result.resendAfter || 60);
    message("ส่งรหัส OTP แล้ว กรุณาตรวจสอบอีเมล", true);
  } catch (error) {
    message(error.message);
  } finally {
    lock(false);
    resetTurnstile();
  }
}

$("start").addEventListener("submit", (event) => { event.preventDefault(); sendOtp(); });
$("resend").addEventListener("click", sendOtp);
$("change").addEventListener("click", () => {
  challengeId = null;
  clearInterval(resendTimer);
  resendCoolingDown = false;
  $("verify").hidden = true;
  $("start").hidden = false;
  $("code").value = "";
  $("contact").focus();
  message("");
});
$("phone-tab").addEventListener("click", () => message("ยังไม่เปิดให้ยืนยันด้วย SMS"));

$("verify").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  const code = $("code").value.trim();
  if (!challengeId || !/^\d{6}$/u.test(code)) { message("กรุณากรอก OTP 6 หลัก"); return; }
  lock(true);
  try {
    const result = await api("/api/auth/otp/verify", { challengeId, code });
    if (!result.authenticated || !result.redirectUrl?.startsWith("/") || result.redirectUrl.startsWith("//")) throw new Error("ยืนยันตัวตนไม่สำเร็จ");
    window.location.assign(result.redirectUrl);
  } catch (error) {
    message(error.message);
  } finally {
    lock(false);
  }
});

document.querySelectorAll("[data-provider]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (busy) return;
    let token;
    try { token = turnstileToken(); } catch (error) { message(error.message); return; }
    lock(true);
    try {
      const result = await api(`/api/auth/oauth/${button.dataset.provider}/start`, { turnstileToken: token });
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
