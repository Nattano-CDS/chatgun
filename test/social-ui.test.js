import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync("app/index.html", "utf8");
const script = readFileSync("app/social.js", "utf8");
const styles = readFileSync("app/social.css", "utf8");
const headers = readFileSync("_headers", "utf8");
const redirects = readFileSync("_redirects", "utf8");
const moderationHtml = readFileSync("app/moderation.html", "utf8");
const moderationScript = readFileSync("app/moderation.js", "utf8");
const wrangler = readFileSync("wrangler.jsonc", "utf8");

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
  assert.match(script, /\/api\/social\/onboarding\/member/u);
  assert.match(script, /ระวังการหลอกโอนเงินและขอข้อมูลส่วนตัว/u);
  assert.match(script, /last_message_sender_id/u);
  assert.match(script, /navigator\.permissions\.query\(\{ name: "geolocation" \}\)/u);
  assert.match(script, /revokeLocationPublication/u);
  assert.match(script, /refreshOpenThread/u);
  assert.match(script, /10_000/u);
  assert.match(script, /\/app\/people\//u);
  assert.match(script, /popstate/u);
  assert.match(script, /fileDataUrl/u);
  assert.match(script, /demoGallery/u);
  assert.match(script, /demoAssets/u);
  assert.doesNotMatch(script, /innerHTML\s*=\s*(?:location|document\.cookie)/u);
});

test("responsive social route receives only the required geolocation permission", () => {
  assert.match(styles, /@media \(max-width: 760px\)/u);
  assert.match(headers, /Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(self\), payment=\(\)/u);
  assert.match(headers, /\/app\/\*\s+[\s\S]*Cache-Control: no-store/u);
  assert.match(redirects, /\/app\/people\/\* \/app\/ 200/u);
});

test("moderation UI requires a recorded purpose and renders untrusted data as text", () => {
  assert.match(moderationHtml, /id="moderation-purpose"[^>]+minlength="10"/u);
  assert.match(moderationHtml, /name="robots" content="noindex,nofollow"/u);
  assert.match(moderationScript, /"x-moderation-purpose": encodeURIComponent\(purpose\(\)\)/u);
  assert.match(moderationScript, /element\.textContent = String\(text\)/u);
  assert.doesNotMatch(moderationScript, /innerHTML|insertAdjacentHTML|document\.write/u);
  assert.match(moderationScript, /__Host-cg_csrf/u);
  assert.match(moderationScript, /\/api\/social\/moderation\/media/u);
  assert.match(moderationScript, /media-view/u);
});

test("staging social and private media activation remain isolated from production", () => {
  const production = wrangler.split('"production"', 2)[1];
  for (const capability of ["SOCIAL_APP_ENABLED", "PUBLIC_DISCOVERY_ENABLED", "FRIEND_REQUESTS_ENABLED", "MESSAGING_ENABLED", "RATINGS_ENABLED"]) {
    assert.match(wrangler, new RegExp(`"${capability}": "true"`, "u"));
    assert.match(production, new RegExp(`"${capability}": "false"`, "u"));
  }
  assert.match(wrangler, /"MEDIA_UPLOAD_ENABLED": "true"/u);
  assert.match(wrangler, /"MEDIA_QUARANTINE_ENABLED": "false"/u);
  assert.match(production, /"MEDIA_UPLOAD_ENABLED": "false"/u);
  assert.match(production, /"MEDIA_QUARANTINE_ENABLED": "true"/u);
  assert.match(wrangler, /"NEW_ACCOUNT_REGISTRATION_ENABLED": "true"/u);
  assert.match(production, /"NEW_ACCOUNT_REGISTRATION_ENABLED": "false"/u);
  assert.match(wrangler, /"BETA_INVITATION_REGISTRATION_ENABLED": "false"/u);
  assert.match(production, /"BETA_INVITATION_REGISTRATION_ENABLED": "false"/u);
  for (const capability of ["IDENTITY_VERIFICATION_ENABLED", "MODERATION_TOOLS_ENABLED", "DEMO_MODE_ENABLED"]) {
    assert.match(wrangler, new RegExp(`"${capability}": "false"`, "u"));
    assert.match(production, new RegExp(`"${capability}": "false"`, "u"));
  }
  assert.match(wrangler, /"ADULT_ONBOARDING_ENABLED": "true"/u);
  assert.match(production, /"ADULT_ONBOARDING_ENABLED": "false"/u);
  assert.match(wrangler, /"database_name": "chatgun-auth-staging"/u);
  assert.match(wrangler, /"binding": "MEDIA"[\s\S]*"bucket_name": "chatgun-media-staging"/u);
  assert.match(production, /"database_name": "chatgun-auth"/u);
  assert.match(production, /"r2_buckets": \[\]/u);
  assert.doesNotMatch(production, /"binding": "MEDIA"/u);
});
