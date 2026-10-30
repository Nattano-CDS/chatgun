// Parameterized PLAN ONLY; no API, filesystem, grant or public endpoint.
import assert from 'node:assert/strict';
export function finalUatRolePlan({database,userId,now,expiresAt,roles,ids}){
 assert.equal(database,'e3cb426c-b88a-4b93-90fd-39df524f68ae');
 assert.match(userId,/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
 assert.ok(Number.isSafeInteger(now)&&now>0&&Number.isSafeInteger(expiresAt)&&expiresAt>now&&expiresAt<=now+8*3600,'Bounded UAT scope at most eight hours; exact duration still needs approval');
 assert.deepEqual(roles,['report_reviewer','safety_admin'],'Role administration and identity-document review are not in this plan');
 assert.equal(ids.length,4);assert.equal(new Set(ids).size,4);
 const reason='Separately confirmed genuine UAT owner; bounded report and safety review only';
 return roles.flatMap((role,i)=>[
  {sql:`INSERT INTO moderation_access_grants(id,user_id,role,granted_by,grant_reason,granted_at,expires_at)
   VALUES(?,(SELECT u.id FROM users u WHERE u.id=? AND u.status='active' AND u.account_state='active'
    AND EXISTS(SELECT 1 FROM member_profiles p WHERE p.user_id=u.id)
    AND EXISTS(SELECT 1 FROM identities i WHERE i.user_id=u.id AND i.provider IN ('google','facebook','line'))
    AND EXISTS(SELECT 1 FROM beta_enrollments e WHERE e.user_id=u.id AND e.status='active')
    AND NOT EXISTS(SELECT 1 FROM member_age_safety_holds h WHERE h.user_id=u.id AND (h.state='held' OR h.age_band<>'20_plus'))
    AND EXISTS(SELECT 1 FROM sessions s JOIN session_auth_evidence a ON a.token_hash=s.token_hash
     WHERE s.user_id=u.id AND s.revoked_at IS NULL AND s.expires_at>? AND a.expires_at>? AND a.authenticated_at>=?-600)),?,NULL,?,?,?)`,params:[ids[i*2],userId,now,now,now,role,reason,now,expiresAt]},
  {sql:"INSERT INTO moderation_role_events(id,grant_id,actor_user_id,target_user_id,role,action,reason,created_at)VALUES(?,?,NULL,?,?,'grant',?,?)",params:[ids[i*2+1],ids[i*2],userId,role,reason,now]},
 ]);
}
