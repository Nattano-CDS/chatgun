import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const ACCOUNT_ID = "23017b53386fb67fc62a52cdd017454c";
const DATABASE = "chatgun-auth-staging";
const DATABASE_ID = "5bbfd55d-eb22-4324-8a7d-57bef14110ea";
const BUCKET = "chatgun-media-staging";
const WRANGLER = "wrangler@4.151.0";
const manifestPath = resolve("scripts/fixtures/social-owner-review-v1.json");
const manifestSource = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestSource);
const manifestHash = createHash("sha256").update(manifestSource).digest("hex");
const dryRun = process.argv.includes("--dry-run");
const outputFlag = process.argv.indexOf("--output");
const output = resolve(outputFlag >= 0 ? process.argv[outputFlag + 1] : "test-results/staging-social-sessions.json");
const now = Math.floor(Date.now() / 1000);
const sessionExpiresAt = now + 7 * 24 * 60 * 60;
const localDay = new Date(now * 1000 + 7 * 3600 * 1000).toISOString().slice(0, 10);
const userId = (slug) => `cg-syn-v1-${slug}`;
const batchPrefix = `synthetic/${manifest.batchId}`;

function hashBase64(value) { return createHash("sha256").update(value).digest("base64url"); }
function hashHex(value) { return createHash("sha256").update(value).digest("hex"); }
function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}
function runWrangler(args, options = {}) {
  return execFileSync("npx", [WRANGLER, ...args], { encoding: "utf8", ...options });
}
function parseJsonOutput(raw) {
  const starts = [raw.indexOf("["), raw.indexOf("{")].filter((index) => index >= 0);
  if (!starts.length) throw new Error("Wrangler did not return JSON");
  return JSON.parse(raw.slice(Math.min(...starts)));
}
function d1Query(command) {
  const result = parseJsonOutput(runWrangler(["d1", "execute", DATABASE, "--remote", "--json", "--command", command]));
  if (!result?.[0]?.success) throw new Error("Staging D1 query failed");
  return result[0].results || [];
}
function verifyStagingTargets() {
  const identity = runWrangler(["whoami"]);
  if (!identity.includes(ACCOUNT_ID)) throw new Error(`Refusing to seed: active Cloudflare account is not ${ACCOUNT_ID}`);
  const databases = parseJsonOutput(runWrangler(["d1", "list", "--json"]));
  const database = databases.find((candidate) => candidate.name === DATABASE);
  if (!database || database.uuid !== DATABASE_ID) throw new Error("Refusing to seed: staging D1 identity mismatch");
  const buckets = runWrangler(["r2", "bucket", "list"]);
  if (!buckets.includes(BUCKET)) throw new Error("Refusing to seed: staging R2 bucket is unavailable");
  const conflicts = d1Query("SELECT COUNT(*) count FROM users WHERE id LIKE 'cg-syn-v1-%' AND email NOT LIKE '%@synthetic.chatgun.invalid'");
  if (Number(conflicts[0]?.count || 0) !== 0) throw new Error("Refusing to seed: reserved synthetic IDs contain non-synthetic accounts");
  const currentBatch = d1Query(`SELECT manifest_sha256 FROM synthetic_seed_batches WHERE id=${sql(manifest.batchId)}`)[0];
  if (currentBatch && currentBatch.manifest_sha256 !== manifestHash) throw new Error("Refusing to seed: existing batch uses a different manifest");
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}
const palettes = [
  ["#7356bf", "#c8ef9c", "#f1c6ad", "#302642"], ["#496f9c", "#ffe08a", "#d9a98e", "#26354b"],
  ["#9b5579", "#badfd2", "#efc2a6", "#44283a"], ["#527965", "#f0c37a", "#dba58c", "#26382f"],
  ["#805ea4", "#aee0e8", "#f2c9aa", "#382847"], ["#416e8c", "#d9e7a3", "#c98e78", "#283947"],
  ["#a15b64", "#cfe9b2", "#e8b493", "#4b2b30"], ["#5366a0", "#f0d698", "#d7a187", "#29304c"],
  ["#7b679b", "#bde1cf", "#efc4a8", "#352d43"], ["#3f786f", "#f3c986", "#c98f78", "#223d38"]
];
function rgb(hex) { return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)); }
function mix(a, b, amount) { return a.map((value, index) => Math.round(value + (b[index] - value) * amount)); }
function deterministicPng(index, kind = "portrait") {
  const width = 512; const height = 640;
  const palette = palettes[index % palettes.length].map(rgb);
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1); raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      let color = mix(palette[0], palette[1], (x + y) / (width + height));
      if (kind === "portrait") {
        const dx = x - width / 2; const dy = y - 285;
        const face = (dx * dx) / (115 * 115) + (dy * dy) / (145 * 145) <= 1;
        const hair = (dx * dx) / (132 * 132) + ((y - 235) ** 2) / (150 * 150) <= 1 && y < 290;
        const shoulders = ((x - width / 2) ** 2) / (220 * 220) + ((y - 610) ** 2) / (180 * 180) <= 1;
        if (shoulders) color = palette[0];
        if (hair) color = palette[3];
        if (face) color = palette[2];
        const eyeY = 280 + (index % 3) * 2;
        const eye = Math.abs(y - eyeY) < 6 && (Math.abs(x - 215) < 9 || Math.abs(x - 297) < 9);
        const smile = y > 337 && y < 344 && Math.abs(Math.hypot(dx, y - 310) - 45) < 5;
        if (eye || (smile && y > 310)) color = palette[3];
      } else {
        if (y > 390) color = mix(palette[0], palette[3], (y - 390) / 250);
        const sunX = 105 + (index * 37) % 300;
        if ((x - sunX) ** 2 + (y - 155) ** 2 < 52 ** 2) color = palette[1];
        if (y > 300 + ((x + index * 17) % 85) && y < 470 && Math.floor(x / 70) % 2 === 0) color = palette[3];
      }
      raw[offset] = color[0]; raw[offset + 1] = color[1]; raw[offset + 2] = color[2]; raw[offset + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(raw, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]);
}

function stripPngMetadata(bytes) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!bytes.subarray(0, 8).equals(signature)) throw new Error("Synthetic portrait fixture is not a PNG");
  const kept = [signature];
  const allowed = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS"]);
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error("Synthetic portrait fixture is truncated");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (allowed.has(type)) kept.push(bytes.subarray(offset, end));
    offset = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(kept);
}

const members = manifest.profiles.map((profile, index) => ({
  ...profile,
  id: userId(profile.slug),
  email: `member${profile.slug}@synthetic.chatgun.invalid`,
  latitude: 13.7563 + ((index % 5) - 2) * 0.00055,
  longitude: 100.5018 + (Math.floor(index / 5) - 1.5) * 0.00058,
}));
const media = [];
for (const [index, member] of members.entries()) {
  media.push({ id: `${manifest.batchId}-primary-${member.slug}`, owner: member.id, objectKey: `${batchPrefix}/profiles/${member.slug}.png`, caption: `ภาพประกอบโปรไฟล์ของ${member.name} · ข้อมูลสังเคราะห์`, kind: "portrait", index, review: "released", category: "general", selected: true });
  if (index < 10) media.push({ id: `${manifest.batchId}-gallery-${member.slug}`, owner: member.id, objectKey: `${batchPrefix}/gallery/${member.slug}.png`, caption: ["บ่ายวันหยุดที่คาเฟ่", "วิวระหว่างทริปสั้น ๆ", "มุมโปรดในวันธรรมดา", "แสงเย็นระหว่างเดินเล่น", "บันทึกภาพจากวันสบาย ๆ"][index % 5], kind: "scene", index: index + 20, review: "released", category: "general", selected: false });
}
media.push(
  { id: `${manifest.batchId}-pending-18`, owner: userId("18"), objectKey: `${batchPrefix}/moderation/pending-18.png`, caption: "ตัวอย่างรอตรวจสอบหนึ่ง", kind: "scene", index: 31, review: "pending", category: null, selected: false },
  { id: `${manifest.batchId}-pending-19`, owner: userId("19"), objectKey: `${batchPrefix}/moderation/pending-19.png`, caption: "ตัวอย่างรอตรวจสอบสอง", kind: "scene", index: 32, review: "pending", category: null, selected: false },
  { id: `${manifest.batchId}-prohibited-20`, owner: userId("20"), objectKey: `${batchPrefix}/moderation/prohibited-20.png`, caption: "ตัวอย่างสำหรับทดสอบการปฏิเสธ", kind: "scene", index: 33, review: "rejected", category: "prohibited", selected: false }
);
const sessionMembers = [members[0], members[1], members[11]].map((member) => ({ id: member.id, name: member.name, token: randomBytes(32).toString("base64url"), csrf: randomBytes(32).toString("base64url") }));
function track(statements, type, id) { statements.push(`INSERT OR IGNORE INTO synthetic_seed_records(batch_id,record_type,record_id,created_at) VALUES (${sql(manifest.batchId)},${sql(type)},${sql(id)},${now});`); }

function buildStatements(objects) {
  const statements = [
    "PRAGMA foreign_keys = ON;",
    `INSERT INTO synthetic_seed_batches(id,label,scope,manifest_sha256,status,created_at,updated_at) VALUES (${sql(manifest.batchId)},${sql(manifest.label)},'staging_owner_review',${sql(manifestHash)},'active',${now},${now}) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,status='active';`,
    `DELETE FROM synthetic_seed_records WHERE batch_id=${sql(manifest.batchId)} AND record_type='sessions';`,
    `DELETE FROM sessions WHERE user_id IN (${members.map((member) => sql(member.id)).join(",")});`
  ];
  for (const member of members) {
    const assuranceId = `${manifest.batchId}-age-${member.slug}`;
    const acceptanceId = `${manifest.batchId}-acceptance-${member.slug}`;
    statements.push(
      `INSERT INTO users(id,email,email_verified_at,display_name,status,account_state,created_at,updated_at) VALUES (${sql(member.id)},${sql(member.email)},${now},${sql(member.name)},'active','active',${now},${now}) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,status='active',account_state='active',updated_at=excluded.updated_at;`,
      `INSERT OR IGNORE INTO account_acceptances(id,user_id,adult_notice_version,terms_version,privacy_version,adult_declared_at,terms_accepted_at,privacy_acknowledged_at,accepted_at) VALUES (${sql(acceptanceId)},${sql(member.id)},'controlled-beta-v1','controlled-beta-terms-v1','controlled-beta-privacy-v1',${now},${now},${now},${now});`,
      `INSERT OR IGNORE INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at) VALUES (${sql(assuranceId)},${sql(member.id)},'adult_18_plus','self_declaration','synthetic-owner-review-v1',${now});`,
      `INSERT INTO member_profiles(user_id,age_assurance_id,name,gender,bio,interests,discovery_visible,latitude,longitude,accuracy,located_at,created_at,updated_at) VALUES (${sql(member.id)},${sql(assuranceId)},${sql(member.name)},${sql(member.gender)},${sql(member.bio)},${sql(member.interests)},1,${member.latitude},${member.longitude},12,${now},${now},${now}) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,gender=excluded.gender,bio=excluded.bio,interests=excluded.interests,discovery_visible=1,latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,located_at=excluded.located_at,updated_at=excluded.updated_at;`
    );
    for (const [type, id] of [["users", member.id], ["account_acceptances", acceptanceId], ["age_assurance_events", assuranceId], ["member_profiles", member.id]]) track(statements, type, id);
  }
  for (const session of sessionMembers) {
    const tokenHash = hashBase64(session.token);
    statements.push(`INSERT INTO sessions(token_hash,user_id,csrf_hash,created_at,expires_at,last_seen_at) VALUES (${sql(tokenHash)},${sql(session.id)},${sql(hashBase64(session.csrf))},${now},${sessionExpiresAt},${now});`, `INSERT INTO session_auth_evidence(token_hash,user_id,authenticated_at,expires_at) VALUES (${sql(tokenHash)},${sql(session.id)},${now},${sessionExpiresAt});`);
    track(statements, "sessions", tokenHash);
  }
  for (const role of ["moderation_admin", "safety_admin", "report_reviewer"]) {
    const id = `${manifest.batchId}-grant-${role}`;
    statements.push(`INSERT INTO moderation_access_grants(id,user_id,role,grant_reason,granted_at,expires_at) VALUES (${sql(id)},${sql(members[0].id)},${sql(role)},'Synthetic owner-review staging access only',${now},${sessionExpiresAt}) ON CONFLICT(id) DO UPDATE SET expires_at=excluded.expires_at,revoked_at=NULL,revoked_by=NULL,revocation_reason=NULL;`);
    track(statements, "moderation_access_grants", id);
  }
  for (const [index, other] of members.slice(1, 11).entries()) {
    const [low, high] = [members[0].id, other.id].sort(); const id = `${manifest.batchId}-relationship-accepted-${other.slug}`;
    statements.push(`INSERT INTO social_relationships(id,user_low,user_high,requested_by,status,created_at,updated_at) VALUES (${sql(id)},${sql(low)},${sql(high)},${sql(index % 2 ? other.id : members[0].id)},'accepted',${now - 86400 * (index + 2)},${now - 3600 * index}) ON CONFLICT(user_low,user_high) DO UPDATE SET status='accepted',updated_at=excluded.updated_at;`); track(statements, "social_relationships", id);
  }
  for (const [index, other] of members.slice(11, 16).entries()) {
    const [low, high] = [members[0].id, other.id].sort(); const id = `${manifest.batchId}-relationship-pending-${other.slug}`;
    statements.push(`INSERT INTO social_relationships(id,user_low,user_high,requested_by,status,created_at,updated_at) VALUES (${sql(id)},${sql(low)},${sql(high)},${sql(index % 2 ? members[0].id : other.id)},'pending',${now - 1800 * (index + 1)},${now - 1800 * (index + 1)}) ON CONFLICT(user_low,user_high) DO UPDATE SET status='pending',requested_by=excluded.requested_by,updated_at=excluded.updated_at;`); track(statements, "social_relationships", id);
  }
  for (const [conversationIndex, conversation] of manifest.conversations.entries()) {
    const other = members.find((member) => member.slug === conversation.with);
    conversation.messages.forEach((body, messageIndex) => {
      const fromViewer = messageIndex % 2 === 0; const sender = fromViewer ? members[0].id : other.id; const receiver = fromViewer ? other.id : members[0].id;
      const id = `${manifest.batchId}-message-${conversation.with}-${String(messageIndex + 1).padStart(2, "0")}`; const createdAt = now - (manifest.conversations.length - conversationIndex) * 7200 + messageIndex * 180;
      const readAt = !fromViewer && messageIndex >= conversation.messages.length - 3 ? null : createdAt + 120;
      statements.push(`INSERT OR IGNORE INTO social_messages(id,sender_user_id,receiver_user_id,body,read_at,created_at) VALUES (${sql(id)},${sql(sender)},${sql(receiver)},${sql(body)},${sql(readAt)},${createdAt});`); track(statements, "social_messages", id);
    });
  }
  for (const item of objects) {
    statements.push(
      `INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,state,created_at) VALUES (${sql(item.id)},${sql(item.owner)},${sql(item.objectKey)},'gallery','image/png',${item.bytes.length},'active',${now - item.index * 120}) ON CONFLICT(id) DO UPDATE SET object_key=excluded.object_key,byte_size=excluded.byte_size,state='active';`,
      `INSERT INTO profile_photos(media_id,owner_user_id,caption,created_at) VALUES (${sql(item.id)},${sql(item.owner)},${sql(item.caption)},${now - item.index * 120}) ON CONFLICT(media_id) DO UPDATE SET caption=excluded.caption;`,
      `INSERT OR IGNORE INTO media_safety_reviews(media_id,status,source,reason,category,created_at) VALUES (${sql(item.id)},${sql(item.review)},'manual','Synthetic owner-review fixture',${sql(item.category)},${now - item.index * 120});`,
      `INSERT INTO synthetic_seed_objects(batch_id,object_key,media_id,sha256,byte_size,created_at) VALUES (${sql(manifest.batchId)},${sql(item.objectKey)},${sql(item.id)},${sql(hashHex(item.bytes))},${item.bytes.length},${now}) ON CONFLICT(batch_id,object_key) DO UPDATE SET media_id=excluded.media_id,sha256=excluded.sha256,byte_size=excluded.byte_size;`
    );
    if (item.selected) statements.push(`UPDATE member_profiles SET selected_photo_id=${sql(item.id)} WHERE user_id=${sql(item.owner)};`);
    for (const type of ["social_media", "profile_photos", "media_safety_reviews"]) track(statements, type, item.id);
  }
  const releasedGallery = objects.filter((item) => item.review === "released" && item.kind === "scene");
  for (const [index, photo] of releasedGallery.entries()) {
    const likers = [members[(index + 2) % members.length], members[(index + 6) % members.length], members[(index + 11) % members.length]];
    for (const liker of likers) statements.push(`INSERT OR IGNORE INTO photo_likes(media_id,user_id,created_at) VALUES (${sql(photo.id)},${sql(liker.id)},${now - index * 300});`);
    const comments = ["ภาพนี้บรรยากาศดีมาก", "ชอบโทนสี ดูสบายตา", "เห็นแล้วอยากออกไปเดินเล่นบ้าง"];
    comments.slice(0, index % 3 + 1).forEach((body, commentIndex) => { const id = `${manifest.batchId}-comment-${String(index + 1).padStart(2, "0")}-${commentIndex + 1}`; statements.push(`INSERT OR IGNORE INTO photo_comments(id,media_id,sender_user_id,body,created_at) VALUES (${sql(id)},${sql(photo.id)},${sql(likers[commentIndex].id)},${sql(body)},${now - index * 240 + commentIndex});`); track(statements, "photo_comments", id); });
  }
  members.slice(1, 16).forEach((sender, index) => { const id = `${manifest.batchId}-rating-${sender.slug}`; const comments = ["คุยสุภาพและเป็นกันเอง", "ตรงเวลาและแนะนำร้านดี", "บทสนทนาสบาย ๆ เป็นมิตร", "แชร์ไอเดียทริปได้น่าสนใจ", "ให้เกียรติและรับฟังดี"]; statements.push(`INSERT OR IGNORE INTO proximity_ratings(id,sender_user_id,receiver_user_id,local_day,score,comment,created_at) VALUES (${sql(id)},${sql(sender.id)},${sql(members[0].id)},${sql(localDay)},${4 + (index % 2)},${sql(comments[index % comments.length])},${now - index * 500});`); track(statements, "proximity_ratings", id); });
  ["spam", "harassment", "impersonation", "privacy", "other"].forEach((category, index) => { const id = `${manifest.batchId}-user-report-${index + 1}`; const status = index === 1 ? "escalated" : "pending"; statements.push(`INSERT OR IGNORE INTO social_reports(id,reporter_user_id,subject_user_id,category,details,status,created_at,reason_code) VALUES (${sql(id)},${sql(members[index + 1].id)},${sql(members[index + 12].id)},${sql(category)},${sql(`กรณีสังเคราะห์สำหรับทดสอบคิวผู้ดูแล: ${category}`)},${sql(status)},${now - index * 600},${sql(category)});`); track(statements, "social_reports", id); });
  const reportedMedia = releasedGallery[8]; const mediaReportId = `${manifest.batchId}-media-report-1`;
  statements.push(`INSERT OR IGNORE INTO media_reports(id,media_id,reporter_user_id,reason_code,details,status,created_at) VALUES (${sql(mediaReportId)},${sql(reportedMedia.id)},${sql(members[3].id)},'privacy','รายงานสังเคราะห์สำหรับตรวจสอบขั้นตอนการดูแลสื่อ','pending',${now - 900});`); track(statements, "media_reports", mediaReportId);
  const prohibited = objects.find((item) => item.review === "rejected"); const decisionId = `${manifest.batchId}-decision-prohibited`; const appealId = `${manifest.batchId}-appeal-prohibited`;
  statements.push(`INSERT OR IGNORE INTO media_moderation_decisions(id,media_id,actor_user_id,previous_status,new_status,previous_category,new_category,reason,revision,created_at) VALUES (${sql(decisionId)},${sql(prohibited.id)},${sql(members[0].id)},'pending','rejected',NULL,'prohibited','Synthetic prohibited-content workflow sample',1,${now - 1200});`, `INSERT OR IGNORE INTO media_appeals(id,media_id,appellant_user_id,reason,status,created_at) VALUES (${sql(appealId)},${sql(prohibited.id)},${sql(prohibited.owner)},'ขอให้ตรวจสอบคำตัดสินอีกครั้งในกรณีสังเคราะห์สำหรับ owner review','pending',${now - 600});`);
  track(statements, "media_moderation_decisions", decisionId); track(statements, "media_appeals", appealId);
  const notifications = [[members[0].id, "media_decision", releasedGallery[0].id, "media_approved_general", null], [members[2].id, "media_restricted", reportedMedia.id, "media_restricted", null], [members[19].id, "media_decision", prohibited.id, "media_rejected_prohibited", null], [members[3].id, "appeal_decision", releasedGallery[1].id, "appeal_granted", appealId]];
  notifications.forEach(([owner, kind, mediaId, code, appeal], index) => { const id = `${manifest.batchId}-notification-${index + 1}`; statements.push(`INSERT INTO moderation_notifications(id,user_id,kind,media_id,appeal_id,message_code,created_at,read_at) VALUES (${sql(id)},${sql(owner)},${sql(kind)},${sql(mediaId)},${sql(appeal)},${sql(code)},${now - index * 500},${sql(index === 0 ? null : now)}) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,kind=excluded.kind,media_id=excluded.media_id,appeal_id=excluded.appeal_id,message_code=excluded.message_code,read_at=excluded.read_at;`); track(statements, "moderation_notifications", id); });
  return statements;
}

verifyStagingTargets();
const objects = media.map((item) => ({
  ...item,
  bytes: item.kind === "portrait"
    ? stripPngMetadata(readFileSync(resolve(`scripts/fixtures/portraits/${item.owner.slice(-2)}.png`)))
    : deterministicPng(item.index, item.kind),
}));
if (dryRun) {
  console.log(JSON.stringify({ dryRun: true, accountId: ACCOUNT_ID, database: DATABASE, bucket: BUCKET, batchId: manifest.batchId, profiles: members.length, conversations: manifest.conversations.length, messages: manifest.conversations.reduce((total, conversation) => total + conversation.messages.length, 0), mediaObjects: objects.length }, null, 2));
  process.exit(0);
}
const temporary = mkdtempSync(resolve(tmpdir(), "chatgun-owner-review-seed-"));
try {
  for (const item of objects) {
    const path = resolve(temporary, `${item.id}.png`); writeFileSync(path, item.bytes, { mode: 0o600 });
    runWrangler(["r2", "object", "put", `${BUCKET}/${item.objectKey}`, "--remote", "--file", path, "--content-type", "image/png", "--cache-control", "private, no-store", "--force"], { stdio: "pipe" });
  }
  const sqlFile = resolve(temporary, "seed.sql"); writeFileSync(sqlFile, `${buildStatements(objects).join("\n")}\n`, { mode: 0o600 });
  runWrangler(["d1", "execute", DATABASE, "--remote", "--file", sqlFile], { stdio: "inherit" });
} finally { rmSync(temporary, { recursive: true, force: true }); }
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify({ accountId: ACCOUNT_ID, databaseId: DATABASE_ID, batchId: manifest.batchId, generatedAt: now, expiresAt: sessionExpiresAt, members: sessionMembers }, null, 2)}\n`, { mode: 0o600 });
chmodSync(output, 0o600);
console.log(`Seeded ${members.length} synthetic members, ${manifest.conversations.length} conversations, and ${objects.length} private media objects into staging.`);
console.log(`Authorized synthetic session bundle written to ${output}`);
