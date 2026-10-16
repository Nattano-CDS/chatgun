import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync("app/index.html", "utf8");
const script = readFileSync("app/social.js", "utf8");
const styles = readFileSync("app/social.css", "utf8");
const headers = readFileSync("_headers", "utf8");

test("social UI exposes only the approved non-game navigation", () => {
  for (const tab of ["near", "friends", "chat", "reviews", "profile"]) {
    assert.match(html, new RegExp(`data-tab="${tab}"`, "u"));
  }
  assert.doesNotMatch(html, /data-tab="(?:game|estate|pet|garden|studio)"/u);
  assert.doesNotMatch(html, /Mobile OTP|Email OTP|เบอร์มือถือ|อีเมล/u);
  assert.match(html, /ChatGun/u);
});

test("social client uses same-origin APIs, CSRF, escaped rendering, and fail-closed config", () => {
  assert.match(script, /credentials: "same-origin"/u);
  assert.match(script, /headers\["x-csrf-token"\]/u);
  assert.match(script, /node\.textContent = String/u);
  assert.match(script, /if \(!state\.config\.socialAppEnabled\)/u);
  assert.match(script, /\/api\/social\/onboarding\/adult/u);
  assert.doesNotMatch(script, /innerHTML\s*=\s*(?:location|document\.cookie)/u);
});

test("responsive social route receives only the required geolocation permission", () => {
  assert.match(styles, /@media \(max-width: 760px\)/u);
  assert.match(headers, /Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(self\), payment=\(\)/u);
  assert.match(headers, /\/app\/\*\s+[\s\S]*Cache-Control: no-store/u);
});
