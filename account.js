"use strict";

function readCookie(name) {
  const prefix = `${name}=`;
  const value = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : "";
}

fetch("/api/auth/me", { credentials: "same-origin" })
  .then((response) => {
    if (!response.ok) throw new Error("unauthorized");
    return response.json();
  })
  .then(({ user }) => {
    document.getElementById("status").textContent = `เข้าสู่ระบบแล้ว ${user.displayName || user.email || "สมาชิก ChatGun"}`;
    document.getElementById("logout").hidden = false;
  })
  .catch(() => window.location.replace("./signup.html"));

document.getElementById("logout").addEventListener("click", async () => {
  const csrf = readCookie("__Host-cg_csrf");
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-CSRF-Token": csrf },
  });
  if (response.ok) window.location.replace("./");
});
