import { cpSync, mkdirSync, readdirSync, copyFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
// An explicit public asset boundary: never publish repository/test/session/backup files.
const output = resolve(process.env.CHATGUN_BUILD_DIR || "dist");
if (output === resolve(".") || output === "/") throw new Error("Refusing workspace output");
if (existsSync(output) && readdirSync(output).length) {
  if (!existsSync(resolve(output,".chatgun-public-build"))) throw new Error("Use an empty build output directory");
  rmSync(output,{recursive:true});
}
mkdirSync(output, { recursive: true, mode: 0o700 });
writeFileSync(resolve(output,".chatgun-public-build"),"generated-public-assets\n");
for (const file of readdirSync(".", { withFileTypes: true })) {
  if (file.isFile() && (/\.(html|css|js|svg|ico|png|webp)$/u.test(file.name) || ["_headers", "_redirects"].includes(file.name))) copyFileSync(file.name, resolve(output, file.name));
}
for (const directory of ["app", "assets"]) cpSync(directory, resolve(output, directory), { recursive: true });
if (process.env.CF_PAGES_BRANCH === "main" || process.env.CHATGUN_CANARY_BUILD === "true") {
  for (const page of ["privacy.html","terms.html","data-deletion.html"]) copyFileSync("canary-notice.html",resolve(output,page));
}
writeFileSync(resolve(output,"release.json"),JSON.stringify({commit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),demoBatch:"chatgun-browser-demo-v1"})+"\n");
console.log(`Public asset package: ${output}`);
