import { cpSync, mkdirSync, readdirSync, copyFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { approvedOwnerPilot } from './lib/owner-pilot-release.mjs';
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
  if (file.isFile() && !file.name.startsWith('playwright.') && (/\.(html|css|js|svg|ico|png|webp)$/u.test(file.name) || ["_headers", "_redirects", "_routes.json"].includes(file.name))) copyFileSync(file.name, resolve(output, file.name));
}
for (const directory of ["app", "assets"]) cpSync(directory, resolve(output, directory), { recursive: true, filter: source => !/\/(?:assets\/demo|app\/demo-(?:network|gallery|bootstrap)\.js)(?:\/|$)/u.test(source) });
// Explicit, static-only public release mode for an exhausted/unavailable Functions API.
// It never enables a real account, seeds a profile, or invents an API response.
const releaseMode=process.env.CHATGUN_RELEASE_MODE||'default';
if(!['default','closed-prelaunch','controlled-beta'].includes(releaseMode))throw Error('Unknown ChatGun release mode');
const policyRelease=releaseMode==='controlled-beta'?approvedOwnerPilot():null;
const staticPrelaunch=releaseMode==='closed-prelaunch';
if(staticPrelaunch){
  const file=resolve(output,'app/index.html'),html=readFileSync(file,'utf8');
  if(!html.includes('<body>'))throw Error('Static prelaunch marker insertion failed');
  writeFileSync(file,html.replace('<body>','<body data-static-prelaunch="true" data-prelaunch="true">')
    .replace('<section id="disabled-view" class="empty" hidden>','<section id="disabled-view" class="empty">')
    .replace('aria-busy="true"','aria-busy="false"')
    .replace('กำลังโหลด ChatGun…',''));
  // Real OAuth/registration are disabled in a closed release. Never leave
  // clickable provider buttons pointing into a known-unavailable API.
  for(const page of ['signup.html','account.html','acceptance.html']){
    const destination=resolve(output,page);
    if(existsSync(destination))copyFileSync('canary-notice.html',destination);
  }
}
if ((process.env.CF_PAGES_BRANCH === "main" || process.env.CHATGUN_CANARY_BUILD === "true") && !policyRelease) {
  for (const page of ["privacy.html","terms.html","data-deletion.html","beta-notice.html"]) copyFileSync("canary-notice.html",resolve(output,page));
}
const commit=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const files=[];
function versionAssets(directory,prefix=''){
  for(const entry of readdirSync(directory,{withFileTypes:true})){
    const path=resolve(directory,entry.name),relative=prefix+entry.name;
    if(entry.isDirectory()){versionAssets(path,relative+'/');continue;}
    if(/\.(?:html|js)$/u.test(relative)){
      let source=readFileSync(path,'utf8');
      if(relative.endsWith('.html'))source=source.replace(/(src|href)=(["'])((?:\/(?!\/)|\.\/|\.\.\/)[^"'?#]+\.(?:js|css))\2/gu,(_,attribute,quote,url)=>`${attribute}=${quote}${url}?v=${commit}${quote}`);
      else source=source.replace(/(from\s*["'])(\.{1,2}\/[^"'?#]+\.js)(["'])/gu,(_,before,url,after)=>`${before}${url}?v=${commit}${after}`);
      writeFileSync(path,source);
    }
    if(/\.(?:html|js|css)$/u.test(relative))files.push({path:relative,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
  }
}
versionAssets(output);
const manifest=JSON.stringify({commit,files},null,2)+'\n';writeFileSync(resolve(output,'release-assets.json'),manifest);
writeFileSync(resolve(output,"release.json"),JSON.stringify({commit,fictionalDemoEnabled:false,staticPrelaunch,releaseMode,...(policyRelease?{policyVersions:policyRelease.versions}:{}),assetsManifestSha256:createHash('sha256').update(manifest).digest('hex')})+"\n");
console.log(`Public asset package: ${output}`);
