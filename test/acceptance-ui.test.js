import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const acceptance = readFileSync("acceptance.html", "utf8");
const acceptanceScript = readFileSync("acceptance.js", "utf8");
const acceptanceStyles = readFileSync("acceptance.css", "utf8");
const signup = readFileSync("signup.html", "utf8");
const onboarding = readFileSync("app/index.html", "utf8");

test("signup defers age and policy confirmation until after OAuth", () => {
  assert.doesNotMatch(signup, /type="checkbox"/u);
  assert.match(signup, /หลังเข้าสู่ระบบ/u);
  assert.doesNotMatch(onboarding, /name="dateOfBirth"|name="adult"/u);
});

test("acceptance page exposes both unchecked confirmations, policy links, and decline", () => {
  assert.match(acceptance, /ข้าพเจ้าขอยืนยันว่ามีอายุ 18 ปีบริบูรณ์ขึ้นไป/u);
  assert.match(acceptance, /type="checkbox"[^>]+required/u);
  assert.match(acceptance, /href="\/terms\.html"/u);
  assert.match(acceptance, /href="\/privacy\.html"/u);
  assert.match(acceptance, /ยอมรับและดำเนินการต่อ/u);
  assert.match(acceptance, /ไม่ยอมรับและออกจากระบบ/u);
  assert.doesNotMatch(acceptance, /checked/u);
  assert.match(acceptanceStyles, /@media\(max-width:640px\)/u);
});

test("acceptance client sends versioned evidence with same-origin CSRF", () => {
  assert.match(acceptanceScript, /"x-csrf-token": csrfToken\(\)/u);
  assert.match(acceptanceScript, /adultNoticeVersion: versions\.adultNotice/u);
  assert.match(acceptanceScript, /termsVersion: versions\.terms/u);
  assert.match(acceptanceScript, /privacyVersion: versions\.privacy/u);
  assert.match(acceptanceScript, /\/api\/auth\/acceptance\/decline/u);
});
