"use strict";

let versions = null;
let busy = false;

function csrfToken() {
  const prefix = "__Host-cg_csrf=";
  const item = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll("button,input").forEach((element) => { element.disabled = value; });
}

function showMessage(text) {
  document.getElementById("message").textContent = text;
}

async function request(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || "ไม่สามารถดำเนินการได้ กรุณาลองใหม่");
    error.status = response.status;
    throw error;
  }
  return body;
}

document.getElementById("acceptance-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || !versions) return;
  setBusy(true);
  showMessage("");
  try {
    const result = await request("/api/auth/acceptance", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
      body: JSON.stringify({
        confirmedAdult: document.getElementById("adult-confirmation").checked,
        acceptedTerms: document.getElementById("policy-confirmation").checked,
        acknowledgedPrivacy: document.getElementById("policy-confirmation").checked,
        adultNoticeVersion: versions.adultNotice,
        termsVersion: versions.terms,
        privacyVersion: versions.privacy,
      }),
    });
    location.replace(result.nextPath);
  } catch (error) {
    showMessage(error.message);
    setBusy(false);
  }
});

document.getElementById("decline").addEventListener("click", async () => {
  if (busy) return;
  setBusy(true);
  showMessage("");
  try {
    const result = await request("/api/auth/acceptance/decline", {
      method: "POST",
      headers: { "x-csrf-token": csrfToken() },
    });
    location.replace(result.redirectUrl || "/");
  } catch (error) {
    showMessage(error.message);
    setBusy(false);
  }
});

request("/api/auth/acceptance")
  .then((status) => {
    if (status.accepted || status.nextPath !== "/acceptance") return location.replace(status.nextPath);
    versions = status.versions;
    return null;
  })
  .catch((error) => {
    if (error.status === 401) return location.replace("/signup.html");
    showMessage(error.message);
  });
