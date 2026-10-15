"use strict";

let turnstileWidget = null;
let turnstileReady = false;
let busy = false;

function readCookie(name) {
  const prefix = `${name}=`;
  const value = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : "";
}

function message(text) {
  document.getElementById("message").textContent = text;
}

function lock(value) {
  busy = value;
  document.querySelectorAll(".link-provider").forEach((button) => { button.disabled = value; });
}

async function initializeTurnstile() {
  const response = await fetch("/api/auth/config", { credentials: "same-origin" });
  const config = await response.json();
  if (!response.ok || !config.turnstileSiteKey) throw new Error("ยังไม่ได้ตั้งค่าระบบตรวจสอบความปลอดภัย");
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.defer = true;
  script.onload = () => {
    turnstileWidget = window.turnstile.render("#turnstile", {
      sitekey: config.turnstileSiteKey,
      action: "auth_start",
      theme: "light",
    });
    turnstileReady = true;
  };
  script.onerror = () => message("โหลดระบบตรวจสอบความปลอดภัยไม่สำเร็จ กรุณารีเฟรชหน้า");
  document.head.appendChild(script);
}

fetch("/api/auth/me", { credentials: "same-origin" })
  .then((response) => {
    if (!response.ok) throw new Error("unauthorized");
    return response.json();
  })
  .then(({ user }) => {
    document.getElementById("status").textContent = `เข้าสู่ระบบแล้ว ${user.displayName || user.email || "สมาชิก ChatGun"}`;
    document.getElementById("logout").hidden = false;
    document.getElementById("linking").hidden = false;
    return initializeTurnstile();
  })
  .catch((error) => {
    if (error.message === "unauthorized") window.location.replace("./signup.html");
    else message(error.message || "ไม่สามารถเริ่มระบบเชื่อมบัญชีได้");
  });

document.querySelectorAll(".link-provider").forEach((button) => {
  button.addEventListener("click", async () => {
    if (busy) return;
    if (!turnstileReady || turnstileWidget === null) { message("ระบบตรวจสอบความปลอดภัยยังไม่พร้อม กรุณารอสักครู่"); return; }
    const turnstileToken = window.turnstile.getResponse(turnstileWidget);
    if (!turnstileToken) { message("กรุณายืนยันว่าคุณไม่ใช่โปรแกรมอัตโนมัติ"); return; }
    lock(true);
    try {
      const response = await fetch(`/api/auth/oauth/${button.dataset.provider}/start`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": readCookie("__Host-cg_csrf") },
        body: JSON.stringify({ link: true, turnstileToken }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "ไม่สามารถเริ่มเชื่อมบัญชีได้");
      const target = new URL(result.authorizationUrl);
      if (target.protocol !== "https:") throw new Error("ปลายทางเข้าสู่ระบบไม่ถูกต้อง");
      window.location.assign(target.toString());
    } catch (error) {
      message(error.message);
      lock(false);
      window.turnstile.reset(turnstileWidget);
    }
  });
});

document.getElementById("logout").addEventListener("click", async () => {
  const csrf = readCookie("__Host-cg_csrf");
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-CSRF-Token": csrf },
  });
  if (response.ok) window.location.replace("./");
});
