"use strict";

let turnstileWidget = null;
let turnstileReady = false;
let busy = false;
let account = null;
let pendingDeletion = null;
let availableProviders = new Set();

function readCookie(name) {
  const prefix = `${name}=`;
  const value = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : "";
}

function message(text) { document.getElementById("message").textContent = text; }
function deletionMessage(text) { document.getElementById("delete-message").textContent = text; }

function lock(value) {
  busy = value;
  document.querySelectorAll(".link-provider,.reauth-provider,#delete-start,#delete-confirm button")
    .forEach((button) => { button.disabled = value; });
}

async function initializeTurnstile() {
  const response = await fetch("/api/auth/config", { credentials: "same-origin" });
  const config = await response.json();
  if (!response.ok || !config.turnstileSiteKey) throw new Error("ยังไม่ได้ตั้งค่าระบบตรวจสอบความปลอดภัย");
  availableProviders=new Set(config.oauthProviders||[]);
  document.querySelectorAll('.link-provider').forEach(button=>{button.hidden=!availableProviders.has(button.dataset.provider);});
  if(!availableProviders.size){message("ผู้ให้บริการยืนยันตัวตนยังไม่พร้อมใช้งาน หากต้องการความช่วยเหลือกรุณาติดต่อผู้ดูแล");return;}
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

function turnstileToken() {
  if (!turnstileReady || turnstileWidget === null) throw new Error("ระบบตรวจสอบความปลอดภัยยังไม่พร้อม กรุณารอสักครู่");
  const token = window.turnstile.getResponse(turnstileWidget);
  if (!token) throw new Error("กรุณายืนยันว่าคุณไม่ใช่โปรแกรมอัตโนมัติ");
  return token;
}

async function startOauth(provider, payload) {
  const response = await fetch(`/api/auth/oauth/${provider}/start`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": readCookie("__Host-cg_csrf") },
    body: JSON.stringify({ ...payload, turnstileToken: turnstileToken() }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "ไม่สามารถเริ่มยืนยันตัวตนได้");
  const target = new URL(result.authorizationUrl);
  if (target.protocol !== "https:") throw new Error("ปลายทางเข้าสู่ระบบไม่ถูกต้อง");
  window.location.assign(target.toString());
}

function showReauthentication() {
  // Deletion verification must remain usable even when identity linking is denied.
  document.getElementById('account-security').hidden = false;
  const container = document.getElementById("reauth-providers");
  container.replaceChildren();
  const providers=account.providers.filter(provider=>availableProviders.has(provider));
  for (const provider of providers) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reauth-provider";
    button.dataset.provider = provider;
    button.textContent = provider === "line" ? "LINE" : `${provider[0].toUpperCase()}${provider.slice(1)}`;
    button.addEventListener("click", async () => {
      if (busy) return;
      lock(true);
      try { await startOauth(provider, { purpose: "account_deletion" }); }
      catch (error) {
        deletionMessage(error.message);
        lock(false);
        if(turnstileWidget!==null)window.turnstile?.reset(turnstileWidget);
      }
    });
    container.appendChild(button);
  }
  document.getElementById("delete-reauth").hidden = false;
  deletionMessage(providers.length?"ต้องยืนยันตัวตนล่าสุดก่อนสร้างคำขอลบบัญชี":"ผู้ให้บริการที่เชื่อมบัญชียังไม่พร้อมยืนยันตัวตน กรุณาติดต่อผู้ดูแลเพื่อดำเนินการอย่างปลอดภัย");
}

async function createDeletionRequest() {
  const response = await fetch("/api/auth/account-deletion/request", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": readCookie("__Host-cg_csrf") },
    body: JSON.stringify({ acknowledged: true }),
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 428 && result.code === "recent_auth_required") {
    showReauthentication();
    return;
  }
  if (!response.ok) throw new Error(result.message || "ไม่สามารถสร้างคำขอลบบัญชีได้");
  pendingDeletion = result;
  document.getElementById("delete-reauth").hidden = true;
  document.getElementById("delete-confirm").hidden = false;
  deletionMessage("คำขอพร้อมแล้ว โปรดยืนยันภายใน 10 นาที");
}

fetch("/api/auth/me", { credentials: "same-origin" })
  .then((response) => {
    if (!response.ok) throw new Error("unauthorized");
    return response.json();
  })
  .then((result) => {
    account = result;
    // Never trust an age-review query string as evidence of an account hold.
    document.getElementById('age-safety-notice').hidden = account.ageSafetyReviewRequired !== true;
    if (account.ageSafetyReviewRequired === true) {
      const socialNavigation = document.querySelector('.auth-navigation');
      if (socialNavigation) socialNavigation.hidden = true;
      const homeLink = document.querySelector('.auth-header-link');
      if (homeLink) homeLink.textContent = 'กลับหน้าแรก';
    }
    document.getElementById("status").textContent = `เข้าสู่ระบบแล้ว ${account.user.displayName || account.user.email || "สมาชิก ChatGun"}`;
    document.getElementById("logout").hidden = false;
    document.getElementById("linking").hidden = !account.canLinkAccounts || account.ageSafetyReviewRequired === true;
    document.getElementById('account-security').hidden = document.getElementById('linking').hidden;
    document.getElementById("deletion").hidden = false;
    document.getElementById('session-management').hidden=false;loadSessions();
    fetch("/api/social/config", { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .then((config) => {
        if (config?.socialAppEnabled && account.nextPath === "/app/" && account.ageSafetyReviewRequired !== true) document.getElementById("open-social").hidden = false;
        document.getElementById('account-appeals-link').hidden = !config?.accountModerationEnabled || account.ageSafetyReviewRequired === true;
        if(config?.moderationToolsEnabled)fetch('/api/social/moderation/capabilities',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(c=>{document.getElementById('account-moderation-link').hidden=!(c?.canReviewReports||c?.canReviewMedia);}).catch(()=>{});
      })
      .catch(() => {});
    if (new URLSearchParams(window.location.search).get("reauth") === "account_deletion") {
      deletionMessage("ยืนยันตัวตนสำเร็จแล้ว คุณสามารถเริ่มคำขอลบบัญชีได้");
    }
    return initializeTurnstile();
  })
  .catch((error) => {
    if (error.message === "unauthorized") window.location.replace("./signup.html");
    else message(error.message || "ไม่สามารถเริ่มระบบบัญชีได้");
  });

document.querySelectorAll(".link-provider").forEach((button) => {
  button.addEventListener("click", async () => {
    if (busy) return;
    lock(true);
    try { await startOauth(button.dataset.provider, { link: true }); }
    catch (error) {
      message(error.message);
      lock(false);
      if(turnstileWidget!==null)window.turnstile?.reset(turnstileWidget);
    }
  });
});

document.getElementById("delete-start").addEventListener("click", async () => {
  if (busy) return;
  lock(true);
  deletionMessage("");
  try { await createDeletionRequest(); }
  catch (error) { deletionMessage(error.message); }
  finally { lock(false); }
});

document.getElementById("delete-confirm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || !pendingDeletion) return;
  const confirmText = document.getElementById("delete-phrase").value;
  lock(true);
  try {
    const response = await fetch("/api/auth/account-deletion/confirm", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": readCookie("__Host-cg_csrf") },
      body: JSON.stringify({ requestId: pendingDeletion.requestId, confirmationToken: pendingDeletion.confirmationToken, confirmText }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "ไม่สามารถลบบัญชีได้");
    pendingDeletion = null;
    const main = document.querySelector("main");
    main.replaceChildren();
    const heading = document.createElement("h1");
    heading.textContent = result.mediaDeletionPending ? "ปิดบัญชีและเริ่มลบข้อมูลแล้ว" : "ลบบัญชีแล้ว";
    const summary = document.createElement("p");
    summary.textContent = result.mediaDeletionPending
      ? `ปิดการเข้าถึงบัญชีแล้ว และมีไฟล์ ${result.mediaDeletionPending} รายการอยู่ในคิวลบอย่างปลอดภัย`
      : "บัญชีและข้อมูลที่เกี่ยวข้องถูกลบแล้ว";
    const receipt = document.createElement("p");
    receipt.append("รหัสยืนยัน: ");
    const code = document.createElement("code");
    code.textContent = result.receipt.requestId;
    receipt.append(code);
    const home = document.createElement("a");
    home.className = "button";
    home.href = "./";
    home.textContent = "กลับหน้าแรก";
    main.append(heading, summary, receipt, home);
  } catch (error) {
    deletionMessage(error.message);
    lock(false);
  }
});

document.getElementById("logout").addEventListener("click", async () => {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-CSRF-Token": readCookie("__Host-cg_csrf") },
  });
  if (response.ok) window.location.replace("./");
});

async function loadSessions(){
  try{const r=await fetch('/api/auth/sessions',{credentials:'same-origin'}),j=await r.json();if(!r.ok)throw Error(j.message||'โหลดเซสชันไม่สำเร็จ');const host=document.getElementById('session-list');host.replaceChildren(...j.sessions.map(s=>{const p=document.createElement('p');p.textContent=`${s.current?'เซสชันนี้':'เซสชันอื่น'} · เริ่ม ${new Date(s.createdAt*1000).toLocaleString('th-TH')} · หมดอายุ ${new Date(s.expiresAt*1000).toLocaleString('th-TH')}`;return p;}));document.getElementById('revoke-other-sessions').disabled=!j.sessions.some(s=>!s.current)&&!j.hasMore;}
  catch(error){document.getElementById('session-message').textContent=error.message||'โหลดเซสชันไม่สำเร็จ กรุณารีเฟรชหน้า';}
}
document.getElementById('revoke-other-sessions').addEventListener('click',async(event)=>{
  if(!confirm('ยืนยันออกจากระบบบนเซสชันอื่นทั้งหมดหรือไม่? เซสชันนี้จะยังใช้งานได้'))return;
  event.currentTarget.disabled=true;
  try{const r=await fetch('/api/auth/sessions',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-csrf-token':readCookie('__Host-cg_csrf')},body:JSON.stringify({action:'revoke_others'})}),j=await r.json();if(!r.ok)throw Error(j.message||'ไม่สามารถเพิกถอนเซสชันได้');document.getElementById('session-message').textContent=`เพิกถอนเซสชันอื่นแล้ว ${j.revoked} รายการ`;await loadSessions();}
  catch(error){document.getElementById('session-message').textContent=error.message;event.currentTarget.disabled=false;}
});
