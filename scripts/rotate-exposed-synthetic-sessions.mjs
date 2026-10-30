// Incident containment only. Explicit staging targets; no provider identities, roles or user data changes.
import {execFileSync} from "node:child_process";
import {createHash,randomBytes} from "node:crypto";
import {readFileSync,writeFileSync,chmodSync,copyFileSync} from "node:fs";
const account="23017b53386fb67fc62a52cdd017454c",database="5bbfd55d-eb22-4324-8a7d-57bef14110ea";
if(!process.argv.includes("--contain-confirmed-exposure"))throw Error("Explicit containment flag required");
const identity=execFileSync("npx",["wrangler@4.151.1","whoami"],{encoding:"utf8"});if(!identity.includes(account))throw Error("Account mismatch");
const {token}=JSON.parse(execFileSync("npx",["wrangler@4.151.1","auth","token","--json"],{encoding:"utf8"}));
const query=async(sql,params=[])=>{const j=await(await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({sql,params})})).json();if(!j.success||j.result.some(r=>!r.success))throw Error("Staging containment query failed");return j.result;};
const ids=["cg-stage-alice","cg-stage-bob","cg-stage-moderator","cg-syn-v1-01","cg-syn-v1-02","cg-syn-v1-12"];
const placeholders=ids.map(()=>"?").join(",");
const identities=await query(`SELECT COUNT(*) AS count FROM identities WHERE user_id IN (${placeholders})`,ids);if(identities[0].results[0].count!==0)throw Error("Refusing to rotate a provider-linked account");
const source="test-results/staging-social-sessions.json",bundle=JSON.parse(readFileSync(source,"utf8"));
if(bundle.accountId!==account||bundle.databaseId!==database||bundle.batchId!=="chatgun-owner-review-v1"||bundle.members.some(m=>!ids.includes(m.id)))throw Error("Synthetic bundle mismatch");
const privateRoot=process.env.CHATGUN_PRIVATE_ROOT;
if(!privateRoot)throw new Error('CHATGUN_PRIVATE_ROOT is required');
const receipt=privateRoot+'/revoked-synthetic-sessions.json';
copyFileSync(source,receipt);chmodSync(receipt,0o600);
const now=Math.floor(Date.now()/1000),expires=now+86400;
const revoked=await query(`UPDATE sessions SET revoked_at=? WHERE user_id IN (${placeholders}) AND revoked_at IS NULL`,[now,...ids]);
const hash=s=>createHash("sha256").update(s).digest("base64url");
for(const member of bundle.members){member.token=randomBytes(32).toString("base64url");member.csrf=randomBytes(32).toString("base64url");await query("INSERT INTO sessions(token_hash,user_id,csrf_hash,created_at,expires_at,last_seen_at) VALUES(?,?,?,?,?,?)",[hash(member.token),member.id,hash(member.csrf),now,expires,now]);await query("INSERT INTO synthetic_seed_records(batch_id,record_type,record_id,created_at) VALUES(?,?,?,?)",[bundle.batchId,"sessions",hash(member.token),now]);}
// No recent-authentication evidence is manufactured. Restricted Admin actions still require real reauthentication.
bundle.generatedAt=new Date(now*1000).toISOString();bundle.expiresAt=new Date(expires*1000).toISOString();
writeFileSync(source,JSON.stringify(bundle,null,2)+"\n",{mode:0o600});chmodSync(source,0o600);
console.log(JSON.stringify({database:"chatgun-auth-staging",revokedSyntheticSessions:revoked[0].meta.changes,replacementReadOnlyFixtureSessions:bundle.members.length,productionTouched:false,userRecordsDeleted:0,providerIdentitiesCreated:0,recentAuthenticationFabricated:false}));
