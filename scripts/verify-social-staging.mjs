import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const ACCOUNT_ID = "23017b53386fb67fc62a52cdd017454c";
const DATABASE = "chatgun-auth-staging";
const DATABASE_ID = "5bbfd55d-eb22-4324-8a7d-57bef14110ea";
const BUCKET = "chatgun-media-staging";
const BATCH_ID = "chatgun-owner-review-v1";
const WRANGLER = "wrangler@4.151.0";

function runWrangler(args, options = {}) {
  return execFileSync("npx", [WRANGLER, ...args], { encoding: "utf8", ...options });
}

function parseJsonOutput(raw) {
  const starts = [raw.indexOf("["), raw.indexOf("{")].filter((index) => index >= 0);
  if (!starts.length) throw new Error("Wrangler did not return JSON");
  return JSON.parse(raw.slice(Math.min(...starts)));
}

function query(command) {
  const result = parseJsonOutput(runWrangler(["d1", "execute", DATABASE, "--remote", "--json", "--command", command]));
  if (!result?.[0]?.success) throw new Error("Staging D1 query failed");
  return result[0].results || [];
}

const identity = runWrangler(["whoami"]);
if (!identity.includes(ACCOUNT_ID)) throw new Error(`Refusing verification: active Cloudflare account is not ${ACCOUNT_ID}`);
const database = parseJsonOutput(runWrangler(["d1", "list", "--json"])).find((candidate) => candidate.name === DATABASE);
if (!database || database.uuid !== DATABASE_ID) throw new Error("Refusing verification: staging D1 identity mismatch");

const expected = {
  users: 20,
  messages: 120,
  acceptedRelationships: 10,
  pendingRelationships: 5,
  media: 33,
  pendingMedia: 2,
  userReports: 5,
  mediaReports: 1,
  appeals: 1,
  ratings: 15,
};

const actual = query(`
SELECT
  (SELECT COUNT(*) FROM users WHERE id LIKE 'cg-syn-v1-%') users,
  (SELECT COUNT(*) FROM social_messages WHERE id LIKE '${BATCH_ID}-message-%') messages,
  (SELECT COUNT(*) FROM social_relationships WHERE id LIKE '${BATCH_ID}-relationship-accepted-%' AND status='accepted') acceptedRelationships,
  (SELECT COUNT(*) FROM social_relationships WHERE id LIKE '${BATCH_ID}-relationship-pending-%' AND status='pending') pendingRelationships,
  (SELECT COUNT(*) FROM social_media WHERE object_key LIKE 'synthetic/${BATCH_ID}/%') media,
  (SELECT COUNT(*) FROM media_safety_reviews WHERE media_id LIKE '${BATCH_ID}-%' AND status='pending') pendingMedia,
  (SELECT COUNT(*) FROM social_reports WHERE id LIKE '${BATCH_ID}-user-report-%') userReports,
  (SELECT COUNT(*) FROM media_reports WHERE id LIKE '${BATCH_ID}-media-report-%') mediaReports,
  (SELECT COUNT(*) FROM media_appeals WHERE id LIKE '${BATCH_ID}-appeal-%') appeals,
  (SELECT COUNT(*) FROM proximity_ratings WHERE id LIKE '${BATCH_ID}-rating-%') ratings
`)[0];

for (const [name, count] of Object.entries(expected)) {
  if (Number(actual?.[name]) !== count) throw new Error(`Fixture count mismatch for ${name}: expected ${count}, got ${actual?.[name]}`);
}

const safeguards = query(`
SELECT
  (SELECT COUNT(*) FROM identities WHERE user_id LIKE 'cg-syn-v1-%') fabricatedIdentities,
  (SELECT COUNT(*) FROM users WHERE id NOT LIKE 'cg-syn-v1-%') unrelatedUsers,
  (SELECT COUNT(*) FROM social_messages WHERE id NOT LIKE '${BATCH_ID}-message-%') unrelatedMessages,
  (SELECT COUNT(*) FROM social_relationships WHERE id NOT LIKE '${BATCH_ID}-relationship-%') unrelatedRelationships,
  (SELECT COUNT(*) FROM social_media WHERE object_key NOT LIKE 'synthetic/${BATCH_ID}/%') unrelatedMedia
`)[0];
if (Number(safeguards.fabricatedIdentities) !== 0) throw new Error("Synthetic users must not have OAuth provider identities");
const unrelatedExpected = { unrelatedUsers: 5, unrelatedMessages: 2, unrelatedRelationships: 1, unrelatedMedia: 6 };
for (const [name, count] of Object.entries(unrelatedExpected)) {
  if (Number(safeguards[name]) !== count) throw new Error(`Unrelated staging record count changed for ${name}: expected ${count}, got ${safeguards[name]}`);
}

const foreignKeyViolations = query("PRAGMA foreign_key_check");
if (foreignKeyViolations.length) throw new Error(`D1 foreign-key violations found: ${foreignKeyViolations.length}`);

const objects = query(`SELECT object_key,sha256,byte_size FROM synthetic_seed_objects WHERE batch_id='${BATCH_ID}' ORDER BY object_key`);
if (objects.length !== expected.media) throw new Error(`Expected ${expected.media} tracked R2 objects, got ${objects.length}`);
if (objects.some(({ object_key: objectKey }) => !objectKey.startsWith(`synthetic/${BATCH_ID}/`))) throw new Error("Tracked object outside the protected batch prefix");

const temporary = mkdtempSync(resolve(tmpdir(), "chatgun-owner-review-verify-"));
try {
  for (const [index, object] of objects.entries()) {
    const output = resolve(temporary, `${index}.png`);
    runWrangler(["r2", "object", "get", `${BUCKET}/${object.object_key}`, "--remote", "--file", output], { stdio: "pipe" });
    const bytes = readFileSync(output);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== object.sha256 || bytes.length !== Number(object.byte_size)) throw new Error(`R2 integrity mismatch for tracked object ${index + 1}`);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  accountId: ACCOUNT_ID,
  database: DATABASE,
  bucket: BUCKET,
  batchId: BATCH_ID,
  counts: Object.fromEntries(Object.entries(actual).map(([key, value]) => [key, Number(value)])),
  unrelatedRecordsPreserved: Object.fromEntries(Object.entries(safeguards).map(([key, value]) => [key, Number(value)])),
  foreignKeyViolations: 0,
  verifiedPrivateR2Objects: objects.length,
}, null, 2));
