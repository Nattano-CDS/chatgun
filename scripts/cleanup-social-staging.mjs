import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { createHash } from 'node:crypto';
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const ACCOUNT_ID = "23017b53386fb67fc62a52cdd017454c";
const DATABASE = "chatgun-auth-staging";
const DATABASE_ID = "5bbfd55d-eb22-4324-8a7d-57bef14110ea";
const BUCKET = "chatgun-media-staging";
const WRANGLER = "wrangler@4.151.0";
const batchFlag = process.argv.indexOf("--batch");
const confirmFlag = process.argv.indexOf("--confirm");
const execute = process.argv.includes("--execute");
const batchId = batchFlag >= 0 ? process.argv[batchFlag + 1] : "";
const confirmation = confirmFlag >= 0 ? process.argv[confirmFlag + 1] : "";

if (!batchId) throw new Error("Usage: node scripts/cleanup-social-staging.mjs --batch <batch-id> [--execute --confirm <batch-id>]");
if (!/^[a-z0-9-]{8,80}$/u.test(batchId)) throw new Error("Invalid batch ID");
if (execute && confirmation !== batchId) throw new Error("Execution requires --confirm with the exact batch ID");
// A dry run is not a backup or a cascade/provenance review. Never accept the old
// confirmation-only destructive invocation, especially for untracked audit data.
if(execute){
  const auditFlag=process.argv.indexOf('--audit'),backupFlag=process.argv.indexOf('--backup-sql');
  if(auditFlag<0||backupFlag<0)throw Error('Execution requires --audit and --backup-sql after a protected backup and cascade review');
  const audit=JSON.parse(readFileSync(process.argv[auditFlag+1],'utf8'));
  const backup=process.argv[backupFlag+1];
  if((statSync(backup).mode&0o077)!==0)throw Error('Backup must have private 0600 permissions');
  const digest=createHash('sha256').update(readFileSync(backup)).digest('hex');
  const checkedAt=Date.parse(audit.checkedAt),age=Date.now()-checkedAt;
  if(audit.batch!==batchId||audit.databaseId!==DATABASE_ID||audit.backupSha256!==digest
    ||audit.safeToExecute!==true||audit.r2BackupVerified!==true
    ||!Number.isFinite(checkedAt)||age<0||age>15*60*1000)throw Error('Cleanup blocked: backup, R2 recovery, freshness, or untracked-record provenance not approved');
}

function sql(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function runWrangler(args, options = {}) { return execFileSync("npx", [WRANGLER, ...args], { encoding: "utf8", ...options }); }
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
if (!identity.includes(ACCOUNT_ID)) throw new Error(`Refusing cleanup: active Cloudflare account is not ${ACCOUNT_ID}`);
const database = parseJsonOutput(runWrangler(["d1", "list", "--json"])).find((candidate) => candidate.name === DATABASE);
if (!database || database.uuid !== DATABASE_ID) throw new Error("Refusing cleanup: staging D1 identity mismatch");

const batch = query(`SELECT id,label,status FROM synthetic_seed_batches WHERE id=${sql(batchId)}`)[0];
if (!batch) throw new Error("Synthetic seed batch not found");
const counts = query(`SELECT record_type,COUNT(*) count FROM synthetic_seed_records WHERE batch_id=${sql(batchId)} GROUP BY record_type ORDER BY record_type`);
const objects = query(`SELECT object_key FROM synthetic_seed_objects WHERE batch_id=${sql(batchId)} ORDER BY object_key`);
const unsafeObjects = objects.filter(({ object_key: objectKey }) => !objectKey.startsWith(`synthetic/${batchId}/`));
if (unsafeObjects.length) throw new Error("Refusing cleanup: batch contains an object outside its synthetic prefix");
const unsafeUsers = query(`SELECT COUNT(*) count FROM users WHERE id IN (SELECT record_id FROM synthetic_seed_records WHERE batch_id=${sql(batchId)} AND record_type='users') AND email NOT LIKE '%@synthetic.chatgun.invalid'`);
if (Number(unsafeUsers[0]?.count || 0) !== 0) throw new Error("Refusing cleanup: batch contains a non-synthetic user");

console.log(JSON.stringify({
  dryRun: !execute,
  accountId: ACCOUNT_ID,
  database: DATABASE,
  bucket: BUCKET,
  batch: { id: batch.id, label: batch.label, status: batch.status },
  trackedRecords: Object.fromEntries(counts.map((row) => [row.record_type, Number(row.count)])),
  r2Objects: objects.length,
}, null, 2));

if (!execute) {
  console.log("Dry run only. No D1 rows or R2 objects were changed.");
  process.exit(0);
}

for (const { object_key: objectKey } of objects) {
  runWrangler(["r2", "object", "delete", `${BUCKET}/${objectKey}`, "--remote", "--force"], { stdio: "pipe" });
}

const temporary = mkdtempSync(resolve(tmpdir(), "chatgun-owner-review-cleanup-"));
try {
  const cleanupFile = resolve(temporary, "cleanup.sql");
  writeFileSync(cleanupFile, `
PRAGMA foreign_keys = ON;
DELETE FROM media_deletion_queue WHERE object_key IN (
  SELECT object_key FROM synthetic_seed_objects WHERE batch_id=${sql(batchId)}
);
DELETE FROM media_moderation_decisions WHERE id IN (
  SELECT record_id FROM synthetic_seed_records WHERE batch_id=${sql(batchId)} AND record_type='media_moderation_decisions'
);
DELETE FROM users WHERE id IN (
  SELECT record_id FROM synthetic_seed_records WHERE batch_id=${sql(batchId)} AND record_type='users'
) AND email LIKE '%@synthetic.chatgun.invalid';
DELETE FROM synthetic_seed_batches WHERE id=${sql(batchId)};
PRAGMA foreign_key_check;
`, { mode: 0o600 });
  runWrangler(["d1", "execute", DATABASE, "--remote", "--file", cleanupFile], { stdio: "inherit" });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
console.log(`Cleaned only synthetic staging batch ${batchId}.`);
