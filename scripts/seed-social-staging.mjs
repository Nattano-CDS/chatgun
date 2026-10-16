import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

const ACCOUNT_ID = "23017b53386fb67fc62a52cdd017454c";
const DATABASE = "chatgun-auth-staging";
const DATABASE_ID = "5bbfd55d-eb22-4324-8a7d-57bef14110ea";
const output = resolve(process.argv[2] || "test-results/staging-social-sessions.json");
const now = Math.floor(Date.now() / 1000);
const expiresAt = now + 24 * 60 * 60;
const members = [
  { id: "cg-stage-alice", name: "อลิซ ทดสอบ", email: "alice.social@example.test", latitude: 13.75630, longitude: 100.50180 },
  { id: "cg-stage-bob", name: "บ็อบ ทดสอบ", email: "bob.social@example.test", latitude: 13.75655, longitude: 100.50195 },
  { id: "cg-stage-charlie", name: "ชาร์ลี ทดสอบ", email: "charlie.social@example.test", latitude: 13.76000, longitude: 100.50400 },
].map((member) => ({ ...member, token: randomBytes(32).toString("base64url"), csrf: randomBytes(32).toString("base64url") }));

function hash(value) {
  return createHash("sha256").update(value).digest("base64url");
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const identity = execFileSync("npx", ["wrangler@4.151.0", "whoami"], { encoding: "utf8" });
if (!identity.includes(ACCOUNT_ID)) throw new Error(`Refusing to seed: active Cloudflare account is not ${ACCOUNT_ID}`);

const statements = [
  "PRAGMA foreign_keys = ON;",
  `DELETE FROM rate_limits WHERE scope IN (
    'adult_onboarding_user_hour','profile_write_user_hour','presence_user_10m',
    'discovery_read_user_10m','relationship_write_user_hour','block_write_user_hour',
    'message_write_user_minute','report_user_day','rating_user_day',
    'gallery_upload_user_hour','gallery_like_user_hour','gallery_comment_user_hour',
    'verification_submit_user_day','account_deletion_user_hour'
  );`,
  `INSERT OR IGNORE INTO media_deletion_queue(object_key,operation_id,next_attempt_at,created_at)
   SELECT object_key,'synthetic-reseed-' || id,${now},${now} FROM social_media
   WHERE owner_user_id IN (${members.map((member) => sql(member.id)).join(",")});`,
  `DELETE FROM users WHERE id IN (${members.map((member) => sql(member.id)).join(",")});`,
];
for (const member of members) {
  const assuranceId = randomUUID();
  const tokenHash = hash(member.token);
  statements.push(
    `INSERT INTO users(id,email,email_verified_at,display_name,status,created_at,updated_at) VALUES (${sql(member.id)},${sql(member.email)},${now},${sql(member.name)},'active',${now},${now});`,
    `INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at) VALUES (${sql(assuranceId)},${sql(member.id)},'adult_18_plus','self_declaration','synthetic-staging-v1',${now});`,
    `INSERT INTO member_profiles(user_id,age_assurance_id,name,gender,bio,interests,discovery_visible,latitude,longitude,accuracy,located_at,created_at,updated_at) VALUES (${sql(member.id)},${sql(assuranceId)},${sql(member.name)},'ไม่ระบุ','บัญชีสังเคราะห์สำหรับทดสอบ staging','ทดสอบ, ความปลอดภัย',1,${member.latitude},${member.longitude},5,${now},${now},${now});`,
    `INSERT INTO sessions(token_hash,user_id,csrf_hash,created_at,expires_at,last_seen_at) VALUES (${sql(tokenHash)},${sql(member.id)},${sql(hash(member.csrf))},${now},${expiresAt},${now});`,
    `INSERT INTO session_auth_evidence(token_hash,user_id,authenticated_at,expires_at) VALUES (${sql(tokenHash)},${sql(member.id)},${now},${expiresAt});`,
  );
}
const temporary = mkdtempSync(resolve(tmpdir(), "chatgun-social-seed-"));
const sqlFile = resolve(temporary, "seed.sql");
try {
  writeFileSync(sqlFile, `${statements.join("\n")}\n`, { mode: 0o600 });
  execFileSync("npx", ["wrangler@4.151.0", "d1", "execute", DATABASE, "--remote", "--file", sqlFile], { stdio: "inherit" });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify({ accountId: ACCOUNT_ID, databaseId: DATABASE_ID, generatedAt: now, expiresAt, members }, null, 2)}\n`, { mode: 0o600 });
chmodSync(output, 0o600);
console.log(`Seeded ${members.length} synthetic staging members; session bundle written to ${output}`);
