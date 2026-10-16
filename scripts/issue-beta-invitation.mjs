import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

const ACCOUNT_ID = "23017b53386fb67fc62a52cdd017454c";
const DATABASE = "chatgun-auth-staging";
const args = process.argv.slice(2);

function argument(name, fallback = null) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}

const outputArgument = argument("--output");
if (!outputArgument) throw new Error("Usage: node scripts/issue-beta-invitation.mjs --output <secure-file> [--days 7] [--label synthetic-beta]");
const output = resolve(outputArgument);
const days = Number(argument("--days", "7"));
const label = String(argument("--label", "controlled-beta")).trim();
if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error("--days must be an integer from 1 to 30");
if (!label || label.length > 80 || /[\r\n]/u.test(label)) throw new Error("--label must contain 1-80 characters without line breaks");

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const identity = execFileSync("npx", ["wrangler@4.151.0", "whoami"], { encoding: "utf8" });
if (!identity.includes(ACCOUNT_ID)) {
  throw new Error(`Refusing to issue invitation: active Cloudflare account is not ${ACCOUNT_ID}`);
}

const now = Math.floor(Date.now() / 1000);
const expiresAt = now + days * 24 * 60 * 60;
const invitationId = randomUUID();
const invitationCode = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(invitationCode).digest("base64url");
const temporary = mkdtempSync(resolve(tmpdir(), "chatgun-beta-invite-"));
const sqlFile = resolve(temporary, "invite.sql");

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${invitationCode}\n`, { flag: "wx", mode: 0o600 });
chmodSync(output, 0o600);
try {
  writeFileSync(sqlFile, `
    INSERT INTO beta_invitations(id, token_hash, label, max_uses, expires_at, created_at)
    VALUES (${sql(invitationId)}, ${sql(tokenHash)}, ${sql(label)}, 1, ${expiresAt}, ${now});
  `, { mode: 0o600 });
  execFileSync(
    "npx",
    ["wrangler@4.151.0", "d1", "execute", DATABASE, "--remote", "--file", sqlFile, "--yes"],
    { stdio: "inherit" },
  );
} catch (error) {
  unlinkSync(output);
  throw error;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

console.log(`Issued one-use staging invitation ${invitationId}; code written with mode 0600 to ${output}`);
console.log(`Expires at ${new Date(expiresAt * 1000).toISOString()}. The code was not printed.`);
