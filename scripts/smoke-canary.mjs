import assert from "node:assert/strict";
const origin=process.env.CANARY_URL||"https://chatgun.social";
if(new URL(origin).hostname!=="chatgun.social" && !new URL(origin).hostname.endsWith(".chatgun.pages.dev"))throw Error("Unapproved target");
const get=async(path,options={})=>fetch(origin+path,{redirect:"manual",...options});
const auth=await(await get("/api/auth/config")).json();
assert.equal(auth.oauthLoginEnabled,false);assert.deepEqual(auth.oauthProviders,[]);assert.equal(auth.emailOtpEnabled,false);assert.equal(auth.mobileOtpEnabled,false);assert.equal(auth.newAccountRegistrationEnabled,false);
const social=await(await get("/api/social/config")).json();
for(const name of ["socialAppEnabled","publicDiscoveryEnabled","friendRequestsEnabled","messagingEnabled","mediaUploadEnabled","ratingsEnabled","sensitiveContentEnabled","identityVerificationEnabled"])assert.equal(social[name],false,name);
assert.equal(social.demoModeEnabled,true);assert.equal(social.demoAutoStartEnabled,true);
const fixture=await(await get("/assets/demo/network.json")).json();assert.equal(fixture.fictional,true);assert.equal(fixture.profiles.length,20);assert.equal(fixture.conversations.reduce((n,c)=>n+c.messages.length,0),120);
const checks=[];
for(const path of ["/test-results/staging-social-sessions.json","/scripts/fixtures/social-owner-review-v1.json","/.dev.vars","/docs/release-candidate-validation.md","/game"]) {const r=await get(path);assert.equal(r.status,404,path);checks.push({path,status:r.status});}
for(const path of ["/api/social/profile","/api/social/relationships","/api/social/messages?target=demo-02","/api/social/media/unknown","/api/social/moderation/overview"]) {const r=await get(path,{headers:{cookie:"__Host-cg_session=invalid"}});assert.ok([401,403,404].includes(r.status),path);checks.push({path,status:r.status});}
const me=await get("/api/auth/me",{headers:{cookie:"__Host-cg_session=invalid"}});assert.equal(me.status,401);
for(const provider of ["google","facebook","line"]){const r=await get(`/api/auth/oauth/${provider}/start`,{method:"POST",headers:{origin,"content-type":"application/json"},body:"{}"});assert.equal(r.status,503);assert.equal((await r.json()).code,"oauth_unavailable");}
for(const path of ["/privacy","/privacy.html","/terms","/data-deletion"]){const r=await get(path);assert.equal(r.status,200);assert.match(await r.text(),/บุคคลและบทสนทนาสมมติ/u);}
const release=await(await get("/release.json")).json();
if(process.env.EXPECTED_SHA)assert.equal(release.commit,process.env.EXPECTED_SHA);
console.log(JSON.stringify({ok:true,origin,release,fictionalProfiles:20,fictionalMessages:120,oauth:"disabled",liveSocial:"disabled",media:"disabled/unbound",checks},null,2));
