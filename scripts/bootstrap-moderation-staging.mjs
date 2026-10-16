import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const ACCOUNT_ID = "23017b53386fb67fc62a52cdd017454c";
const DATABASE = "chatgun-auth-staging";
const DATABASE_ID = "5bbfd55d-eb22-4324-8a7d-57bef14110ea";
const ROLES = ["moderation_admin", "report_reviewer", "safety_admin"];
const userId = String(process.argv[2] || "");
const confirmation = String(process.argv[3] || "");
const days = Number(process.argv[4] || 30);

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
  throw new Error("A valid opaque ChatGun user UUID is required");
}
if (confirmation !== `CONFIRM-STAGING-BOOTSTRAP:${userId}`) {
  throw new Error("Exact staging bootstrap confirmation is required");
}
if (!Number.isInteger(days) || days < 1 || days > 90) {
  throw new Error("Grant duration must be between 1 and 90 days");
}

const identity = execFileSync("npx", ["wrangler@4.151.0", "whoami"], { encoding: "utf8" });
if (!identity.includes(ACCOUNT_ID)) {
  throw new Error(`Refusing bootstrap: active Cloudflare account is not ${ACCOUNT_ID}`);
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function remoteQuery(command) {
  const output = execFileSync("npx", [
    "wrangler@4.151.0", "d1", "execute", DATABASE, "--remote", "--command", command, "--json",
  ], { encoding: "utf8" });
  const parsed = JSON.parse(output.slice(output.indexOf("[")));
  return parsed.flatMap((entry) => entry.results || []);
}

const preflight = remoteQuery(`
  SELECT u.id AS user_id, u.status, u.account_state,
         EXISTS(SELECT 1 FROM member_profiles p WHERE p.user_id=u.id) AS has_profile,
         EXISTS(
           SELECT 1 FROM sessions s
           JOIN session_auth_evidence evidence ON evidence.token_hash=s.token_hash
           WHERE s.user_id=u.id AND s.revoked_at IS NULL AND s.expires_at>unixepoch()
             AND evidence.expires_at>unixepoch() AND evidence.authenticated_at>=unixepoch()-600
         ) AS has_recent_session,
         (SELECT COUNT(*) FROM moderation_access_grants grants
          WHERE grants.user_id=u.id AND grants.revoked_at IS NULL
            AND (grants.expires_at IS NULL OR grants.expires_at>unixepoch())) AS active_grants
  FROM users u WHERE u.id=${sql(userId)};
`)[0];

if (!preflight || preflight.status !== "active" || preflight.account_state !== "active"
    || Number(preflight.has_profile) !== 1 || Number(preflight.has_recent_session) !== 1) {
  throw new Error("Refusing bootstrap: target is not an active, onboarded, recently authenticated staging user");
}
if (Number(preflight.active_grants) !== 0) {
  throw new Error("Refusing bootstrap: target already has an active moderation grant");
}

const now = Math.floor(Date.now() / 1000);
const expiresAt = now + days * 24 * 60 * 60;
const reason = `Owner-confirmed primary Admin staging bootstrap; ${days}-day expiry`;
const statements = ["PRAGMA foreign_keys = ON;"];
for (const role of ROLES) {
  const grantId = randomUUID();
  statements.push(
    `INSERT INTO moderation_access_grants(
      id,user_id,role,granted_by,grant_reason,granted_at,expires_at
    ) VALUES (${sql(grantId)},${sql(userId)},${sql(role)},NULL,${sql(reason)},${now},${expiresAt});`,
    `INSERT INTO moderation_role_events(
      id,grant_id,actor_user_id,target_user_id,role,action,reason,created_at
    ) VALUES (${sql(randomUUID())},${sql(grantId)},NULL,${sql(userId)},${sql(role)},'grant',${sql(reason)},${now});`,
  );
}

const temporary = mkdtempSync(resolve(tmpdir(), "chatgun-admin-bootstrap-"));
const sqlFile = resolve(temporary, "bootstrap.sql");
try {
  writeFileSync(sqlFile, `${statements.join("\n")}\n`, { mode: 0o600 });
  execFileSync("npx", [
    "wrangler@4.151.0", "d1", "execute", DATABASE, "--remote", "--file", sqlFile,
  ], { stdio: "inherit" });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

const verified = remoteQuery(`
  SELECT role, expires_at FROM moderation_access_grants
  WHERE user_id=${sql(userId)} AND revoked_at IS NULL AND expires_at=${expiresAt}
  ORDER BY role;
`);
if (verified.length !== ROLES.length || verified.some((grant) => !ROLES.includes(grant.role))) {
  throw new Error("Bootstrap verification failed: expected grants were not found");
}

console.log(JSON.stringify({
  accountId: ACCOUNT_ID,
  database: DATABASE,
  databaseId: DATABASE_ID,
  userId,
  roles: verified.map((grant) => grant.role),
  expiresAt,
}, null, 2));
