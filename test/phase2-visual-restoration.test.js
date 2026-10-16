import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 2 auth and acceptance use the canonical compact NEAR shell", async () => {
  const [shell, signup, acceptance] = await Promise.all([read("auth-shell.css"), read("signup.html"), read("acceptance.html")]);
  assert.match(shell, /Noto Sans Thai/u);
  assert.match(shell, /--near-violet:#6d42e5/u);
  assert.match(shell, /--near-lime:#d0f17b/u);
  assert.match(shell, /width:min\(100%,560px\)/u);
  assert.match(signup, /class="auth-panel signup-panel"/u);
  assert.match(signup, /id="turnstile"/u);
  assert.match(acceptance, /class="auth-panel acceptance-card"/u);
  assert.match(acceptance, /id="adult-confirmation"/u);
  assert.match(acceptance, /id="policy-confirmation"/u);
});

test("Phase 2 onboarding and member profile retain state and authorization hooks", async () => {
  const [html, css, client] = await Promise.all([read("app/index.html"), read("app/social.css"), read("app/social.js")]);
  assert.match(html, /class="onboarding-panel"/u);
  assert.match(client, /document\.body\.dataset\.flow = "onboarding"/u);
  assert.match(client, /member-profile-view/u);
  assert.match(client, /data-profile-gallery/u);
  assert.match(client, /api\(`\/api\/social\/gallery\?user=/u);
  assert.match(css, /NEAR v91 visual restoration — Phase 2/u);
  assert.match(css, /#profile-dialog \{ inset: 0; width: 100vw/u);
  assert.match(css, /background: #d0f17b/u);
});
