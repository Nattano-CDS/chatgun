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
const welcome = readFileSync("welcome.html", "utf8");

test("social UI exposes only the approved non-game navigation", () => {
  for (const tab of ["near", "chat", "reviews", "profile"]) {
    assert.match(html, new RegExp(`data-tab="${tab}"`, "u"));
  }
  assert.doesNotMatch(html, /data-tab="(?:game|estate|pet|garden|studio)"/u);
  assert.doesNotMatch(html, /Mobile OTP|Email OTP|เบอร์มือถือ|อีเมล/u);
  assert.match(html, /ChatGun/u);
});

test("root is the authenticated discovery entry and marketing moved to welcome", () => {
  assert.match(redirects, /^\/ \/app\/ 200$/mu);
  assert.match(welcome, /เรื่องดี ๆ เริ่มต้นจาก/u);
  assert.match(headers, /^\/$[\s\S]*?Cache-Control: no-store/mu);
});

test("Phase 1 uses the canonical NEAR tokens, typography, navigation and portrait cards", () => {
  assert.match(styles, /font-family: "Noto Sans Thai", Arial, Tahoma, sans-serif/u);
  assert.match(styles, /--primary: #6d42e5/u);
  assert.match(styles, /--lime: #d0f17b/u);
  const components=readFileSync('app/near-components.js','utf8');
  const sourceStyles=readFileSync('app/near-components.css','utf8');
  assert.match(components, /class="card-open"/u);
  assert.match(components, /class="person-details"/u);
  assert.match(sourceStyles, /object-position: center 25%/u);
  assert.match(sourceStyles, /height: 290px/u);
  assert.match(sourceStyles, /linear-gradient\(transparent 47%/u);
  assert.doesNotMatch(styles, /\.person-card\.context-near/u);
  assert.match(html, /id="filter-toggle"/u);
  assert.match(script, /dataset\.activeTab/u);
  assert.doesNotMatch(script, /alt="รูปของ \$\{escapeHtml\(person\.name\)\}" loading="lazy"/u);
  assert.doesNotMatch(html, />เกม</u);
});

test("social client uses same-origin APIs, CSRF, escaped rendering, and fail-closed config", () => {
  assert.match(script, /credentials: "same-origin"/u);
  assert.match(script, /headers\["x-csrf-token"\]/u);
  assert.match(script, /node\.textContent = String/u);
  assert.match(script, /!state\.config\.socialAppEnabled/u);
  assert.match(script, /\/api\/social\/onboarding\/member/u);
  assert.match(script, /ระวังการหลอกโอนเงินและขอข้อมูลส่วนตัว/u);
  assert.match(script, /last_message_sender_id/u);
  assert.match(script, /navigator\.permissions\.query\(\{ name: "geolocation" \}\)/u);
  assert.match(script, /revokeLocationPublication/u);
  assert.match(script, /refreshOpenThread/u);
  assert.match(script, /hadUnread && await loadRelationships\(\)/u);
  assert.match(script, /if \(!state\.config\.mediaUploadEnabled\) return state\.myGallery = \[\], renderOwnGallery\(\)/u);
  assert.match(script, /#manage-gallery[^\n]+hidden = !state\.config\.mediaUploadEnabled/u);
  assert.match(script, /10_000|1e4/u);
  assert.match(script, /\/app\/people\//u);
  assert.match(script, /popstate/u);
  assert.match(script, /fileDataUrl/u);
  assert.doesNotMatch(script, /demoGallery|demoAssets|startDemo|demoSave/u);
  assert.match(script, /\/api\/social\/upload-quotas/u);
  assert.match(script, /"idempotency-key"/u);
  assert.match(script, /รีเซ็ต 00:00 น\. เวลาไทย/u);
  assert.match(script, /gallery\.remaining <= 0/u);
  assert.match(script, /chat\.remaining <= 0/u);
  assert.match(html, /id="gallery-upload-quota"/u);
  assert.match(styles, /\.upload-quota/u);
  assert.doesNotMatch(script, /innerHTML\s*=\s*(?:location|document\.cookie)/u);
});

test("chat renders chronological DOM without reverse flex and preserves timeline scrolling", () => {
  assert.doesNotMatch(styles, /\.messages[^}]*column-reverse/u);
  assert.match(styles, /\.messages[^}]*flex-direction: column/u);
  assert.match(script, /mergeTimelineMessages/u);
  assert.match(script, /visibleTimelineAnchor/u);
  assert.match(script, /new-messages-indicator/u);
  assert.match(script, /isNearTimelineBottom/u);
  assert.match(script, /state\.threadMessages\[0\]/u);
});

test("responsive social route receives only the required geolocation permission", () => {
  assert.match(styles, /@media \(max-width: 760px\)/u);
  assert.match(headers, /Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(self\), payment=\(\)/u);
  assert.match(headers, /\/app\/\*\s+[\s\S]*Cache-Control: no-store/u);
  assert.match(redirects, /\/app\/people\/\* \/app\/ 200/u);
});

test("moderation UI auto-loads routine overview, justifies restricted evidence, and renders untrusted data as text", () => {
  assert.doesNotMatch(moderationHtml, /id="moderation-purpose"/u);
  assert.match(moderationHtml, /กำลังโหลดภาพรวม/u);
  assert.match(moderationHtml, /name="robots" content="noindex,nofollow"/u);
  assert.match(moderationScript, /exceptionalPurpose/u);
  assert.match(moderationScript, /options\.routine \? \{\} : \{ "x-moderation-purpose": encodeURIComponent\(purpose\(\)\) \}/u);
  assert.match(moderationScript, /load\("overview"\)/u);
  assert.match(moderationScript, /element\.textContent = String\(text\)/u);
  assert.doesNotMatch(moderationScript, /innerHTML|insertAdjacentHTML|document\.write/u);
  assert.match(moderationScript, /__Host-cg_csrf/u);
  assert.match(moderationScript, /\/api\/social\/moderation\/media/u);
  assert.match(moderationScript, /media-view/u);
});

test("staging social and private media activation remain isolated from production", () => {
  const configured=JSON.parse(wrangler).env.production;
  const production = JSON.stringify(configured, null, 2);
  for (const capability of ["PUBLIC_DISCOVERY_ENABLED", "MESSAGING_ENABLED", "RATINGS_ENABLED"]) {
    assert.match(wrangler, new RegExp(`"${capability}": "true"`, "u"));
    assert.match(production, new RegExp(`"${capability}": "false"`, "u"));
  }
  assert.equal(configured.vars.SOCIAL_APP_ENABLED,'true');
  assert.match(wrangler, /"FRIEND_REQUESTS_ENABLED": "false"/u);
  assert.match(wrangler, /"MEDIA_UPLOAD_ENABLED": "true"/u);
  assert.match(wrangler, /"MEDIA_QUARANTINE_ENABLED": "true"/u);
  assert.match(wrangler, /"SENSITIVE_CONTENT_ENABLED": "false"/u);
  assert.match(production, /"MEDIA_UPLOAD_ENABLED": "false"/u);
  assert.match(production, /"MEDIA_QUARANTINE_ENABLED": "true"/u);
  assert.match(production, /"SENSITIVE_CONTENT_ENABLED": "false"/u);
  assert.doesNotMatch(wrangler, /"NEW_ACCOUNT_REGISTRATION_ENABLED": "true"/u);
  assert.match(wrangler, /"NEW_ACCOUNT_REGISTRATION_ENABLED": "false"/u);
  assert.match(production, /"NEW_ACCOUNT_REGISTRATION_ENABLED": "false"/u);
  assert.match(wrangler, /"BETA_INVITATION_REGISTRATION_ENABLED": "false"/u);
  assert.match(production, /"BETA_INVITATION_REGISTRATION_ENABLED": "true"/u);
  assert.match(wrangler, /"MODERATION_TOOLS_ENABLED": "true"/u);
  assert.match(production, /"MODERATION_TOOLS_ENABLED": "true"/u);
  for (const capability of ["IDENTITY_VERIFICATION_ENABLED"]) {
    assert.match(wrangler, new RegExp(`"${capability}": "false"`, "u"));
    assert.match(production, new RegExp(`"${capability}": "false"`, "u"));
  }
  assert.match(production, /"DEMO_MODE_ENABLED": "false"/u);
  assert.match(production, /"OAUTH_LOGIN_ENABLED": "true"/u);
  assert.match(wrangler, /"ADULT_ONBOARDING_ENABLED": "true"/u);
  assert.match(production, /"ADULT_ONBOARDING_ENABLED": "true"/u);
  assert.match(wrangler, /"database_name": "chatgun-auth-staging"/u);
  assert.match(wrangler, /"binding": "MEDIA"[\s\S]*"bucket_name": "chatgun-media-staging"/u);
  assert.match(production, /"database_name": "chatgun-auth"/u);
  assert.deepEqual(configured.r2_buckets,[{binding:'MEDIA',bucket_name:'chatgun-media-production'}]);
  assert.equal(configured.vars.MEDIA_UPLOAD_ENABLED,'false');
});
