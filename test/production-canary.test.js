import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { onRequest as auth } from "../functions/api/auth/[[path]].js";
import { onRequest as middleware } from "../functions/_middleware.js";

test("canary rejects OAuth initiation and callbacks before any provider or database access", async () => {
  for (const provider of ["google","facebook","line"]) {
    const response = await auth({env:{OAUTH_LOGIN_ENABLED:"false"},request:new Request(`https://chatgun.social/api/auth/oauth/${provider}/start`,{method:"POST",headers:{origin:"https://chatgun.social","content-type":"application/json"},body:"{}"})});
    assert.equal(response.status,503);
    assert.equal((await response.json()).code,"oauth_unavailable");
    const callback = await auth({env:{OAUTH_LOGIN_ENABLED:"false"},request:new Request(`https://chatgun.social/api/auth/oauth/${provider}/callback?code=untrusted&state=untrusted`)});
    assert.equal(callback.status,303);
    assert.match(callback.headers.get("location"),/oauth_unavailable/u);
  }
});

test("public canary never publishes unapproved legal drafts", async () => {
  for (const path of ["/privacy","/privacy.html","/terms","/terms.html","/data-deletion","/data-deletion.html"]) {
    const response = await middleware({env:{PUBLIC_DEMO_CANARY_ENABLED:"true"},request:new Request(`https://chatgun.social${path}`),next(){throw Error("draft must not be published");}});
    assert.equal(response.status,200);
    assert.match(await response.text(),/บุคคลและบทสนทนาสมมติ/u);
    assert.equal(response.headers.get("cache-control"),"no-store");
  }
});

test("public fictional network asset is removed",()=>{
  assert.equal(existsSync('assets/demo/network.json'),false);
});

test("public build excludes test bundles, credentials, scripts and backups",()=>{
  const directory=mkdtempSync(join(tmpdir(),"chatgun-build-test-"));
  execFileSync(process.execPath,["scripts/build-pages.mjs"],{env:{...process.env,CHATGUN_BUILD_DIR:directory,CHATGUN_CANARY_BUILD:"true"}});
  const names=readdirSync(directory);
  for(const forbidden of ["test-results","playwright-report","scripts","docs",".git",".dev.vars","functions","wrangler.jsonc"]) assert.ok(!names.includes(forbidden));
  assert.ok(names.includes("assets"));assert.ok(names.includes("app"));assert.ok(names.includes("signup.html"));
  for(const file of ["privacy.html","terms.html","data-deletion.html"])assert.equal(readFileSync(join(directory,file),"utf8"),readFileSync("canary-notice.html","utf8"));
});
