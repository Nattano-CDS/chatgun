import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
export const OWNER_ADMIN_ROLES=Object.freeze(['report_reviewer','safety_admin']);
export const OWNER_ADMIN_DAYS=7;
export function ownerAdminScope(){
  if(!process.env.CHATGUN_OWNER_ADMIN_SCOPE)return false;
  assert.equal(process.env.CHATGUN_OWNER_ADMIN_SCOPE,'approved-seven-day-report-safety');
  const file=(()=>{const root=process.env.CHATGUN_PRIVATE_ROOT;if(!root)throw new Error('CHATGUN_PRIVATE_ROOT is required');return root;})()+'/owner-admin-approval-20261020.json';assert.equal(statSync(file).mode&511,384);
  const r=JSON.parse(readFileSync(file));assert.equal(r.ownerApproved,true);assert.equal(r.scope,'owner-admin-seven-days');assert.equal(r.account,'23017b53386fb67fc62a52cdd017454c');assert.equal(r.database,'9738a051-d914-42d0-8e7b-8098ef2b959d');assert.deepEqual(r.roles,OWNER_ADMIN_ROLES);assert.ok(r.expiresAt>Math.floor(Date.now()/1000));assert.equal(r.moderationToolsApproved,true);assert.equal(r.broaderServicesApproved,false);return true;
}
export function ownerAdminStatements({userId,now,ids}) {
  assert.match(userId,/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.ok(Number.isSafeInteger(now)&&now>0);assert.equal(ids.length,4);assert.equal(new Set(ids).size,4);
  const reason='Owner explicitly approved seven-day Production report_reviewer and safety_admin bootstrap';
  return OWNER_ADMIN_ROLES.flatMap((role,i)=>[
    {sql:`INSERT INTO moderation_access_grants(id,user_id,role,granted_by,grant_reason,granted_at,expires_at)
      VALUES (?,(SELECT u.id FROM users u WHERE u.id=? AND u.status='active' AND u.account_state='active'
        AND EXISTS(SELECT 1 FROM member_profiles p WHERE p.user_id=u.id)
        AND EXISTS(SELECT 1 FROM identities i WHERE i.user_id=u.id AND i.provider='line')
        AND EXISTS(SELECT 1 FROM beta_enrollments e WHERE e.user_id=u.id AND e.status='active')
        AND EXISTS(SELECT 1 FROM sessions s JOIN session_auth_evidence a ON a.token_hash=s.token_hash
          WHERE s.user_id=u.id AND s.revoked_at IS NULL AND s.expires_at>? AND a.expires_at>?
            AND a.authenticated_at>=?-600)),?,NULL,?,?,?)`,params:[ids[i*2],userId,now,now,now,role,reason,now,now+OWNER_ADMIN_DAYS*86400]},
    {sql:`INSERT INTO moderation_role_events(id,grant_id,actor_user_id,target_user_id,role,action,reason,created_at)
      VALUES (?,?,NULL,?,?,'grant',?,?)`,params:[ids[i*2+1],ids[i*2],userId,role,reason,now]},
  ]);
}
