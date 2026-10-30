import assert from 'node:assert/strict';

export const PRODUCTION_RBAC_ROLE = 'moderation_admin';
export const PRODUCTION_RBAC_TTL_SECONDS = 3600;
export const PRODUCTION_RBAC_REASON = 'Owner-authorized one-hour Production moderation_admin bootstrap';

export const PRODUCTION_RBAC_SCHEMA = Object.freeze({
  users: ['id', 'status', 'account_state'],
  identities: ['provider', 'user_id'],
  beta_enrollments: ['user_id', 'status'],
  member_profiles: ['user_id', 'age_assurance_id'],
  age_assurance_events: ['id', 'user_id', 'age_band', 'revoked_at'],
  account_acceptances: ['user_id'],
  beta_account_restrictions: ['user_id', 'status'],
  member_age_safety_holds: ['user_id', 'age_band', 'state'],
  moderation_access_grants: ['id', 'user_id', 'role', 'granted_by', 'grant_reason', 'granted_at', 'expires_at', 'revoked_at'],
  moderation_roles: ['user_id', 'role'],
  moderation_role_events: ['id', 'grant_id', 'actor_user_id', 'target_user_id', 'role', 'action', 'reason', 'created_at'],
});

export const productionOwnerEligibilitySql = `SELECT
  u.id,
  EXISTS(SELECT 1 FROM identities i WHERE i.user_id=u.id AND i.provider='line') line_identity,
  EXISTS(SELECT 1 FROM beta_enrollments e WHERE e.user_id=u.id AND e.status='active') active_enrollment,
  EXISTS(SELECT 1 FROM member_profiles p JOIN age_assurance_events a
    ON a.id=p.age_assurance_id AND a.user_id=p.user_id
    WHERE p.user_id=u.id AND a.age_band='adult_18_plus' AND a.revoked_at IS NULL) adult_assurance,
  EXISTS(SELECT 1 FROM account_acceptances a WHERE a.user_id=u.id) adult_acceptance,
  EXISTS(SELECT 1 FROM beta_account_restrictions r WHERE r.user_id=u.id AND r.status='active') restricted,
  EXISTS(SELECT 1 FROM member_age_safety_holds h WHERE h.user_id=u.id
    AND (h.state='held' OR h.age_band<>'20_plus')) unsafe_age_hold
  FROM users u WHERE u.id=? AND u.status='active' AND u.account_state='active'`;

export const productionGrantInventorySql = `SELECT
  (SELECT COUNT(*) FROM users) users,
  (SELECT COUNT(*) FROM identities) identities,
  (SELECT COUNT(*) FROM sessions) sessions,
  (SELECT COUNT(*) FROM moderation_access_grants) grants,
  (SELECT COUNT(*) FROM moderation_role_events) events,
  (SELECT COUNT(*) FROM moderation_access_grants WHERE revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at>?)) active_grants,
  (SELECT COUNT(*) FROM moderation_access_grants WHERE expires_at IS NOT NULL AND expires_at<=?) expired_grants,
  (SELECT COUNT(*) FROM moderation_access_grants WHERE revoked_at IS NOT NULL) revoked_grants,
  (SELECT COUNT(*) FROM moderation_access_grants WHERE user_id=? AND role='moderation_admin'
    AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)) active_target_role,
  (SELECT COUNT(*) FROM moderation_access_grants WHERE user_id=? AND role='moderation_admin'
    AND revoked_at IS NULL) unrevoked_target_role,
  (SELECT COUNT(*) FROM moderation_roles WHERE user_id=? AND role='moderation_admin') legacy_target_role`;

export function assertProductionOwnerEligibility(row, userId) {
  assert.equal(row?.id, userId, 'Owner account must be active');
  assert.equal(Number(row.line_identity), 1, 'Exact owner LINE identity is required');
  assert.equal(Number(row.active_enrollment), 1, 'Active owner enrollment is required');
  assert.equal(Number(row.adult_assurance), 1, 'Linked unrevoked adult assurance is required');
  assert.equal(Number(row.adult_acceptance), 1, 'Adult policy acceptance is required');
  assert.equal(Number(row.restricted), 0, 'Restricted accounts are ineligible');
  assert.equal(Number(row.unsafe_age_hold), 0, 'Age-held or under-20 accounts are ineligible');
  return true;
}

export function assertProductionGrantInventory(row) {
  assert.equal(Number(row.active_target_role), 0, 'Active moderation_admin already exists');
  // The partial unique index treats an expired but unrevoked grant as occupied,
  // so preflight must reject it rather than attempting an unsafe renewal.
  assert.equal(Number(row.unrevoked_target_role), 0, 'Unrevoked moderation_admin already exists');
  assert.equal(Number(row.legacy_target_role), 0, 'Legacy moderation_admin already exists');
  return true;
}

export function productionRbacBootstrapBatch({ userId, grantId, eventId, now }) {
  for (const value of [userId, grantId, eventId]) assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
  assert.ok(Number.isSafeInteger(now) && now > 0);
  const expiresAt = now + PRODUCTION_RBAC_TTL_SECONDS;
  return [
    {
      sql: `INSERT INTO moderation_access_grants(id,user_id,role,granted_by,grant_reason,granted_at,expires_at)
        SELECT ?,u.id,'moderation_admin',NULL,?,?,? FROM users u
        WHERE u.id=? AND u.status='active' AND u.account_state='active'
          AND EXISTS(SELECT 1 FROM identities i WHERE i.user_id=u.id AND i.provider='line')
          AND EXISTS(SELECT 1 FROM beta_enrollments e WHERE e.user_id=u.id AND e.status='active')
          AND EXISTS(SELECT 1 FROM member_profiles p JOIN age_assurance_events a
            ON a.id=p.age_assurance_id AND a.user_id=p.user_id
            WHERE p.user_id=u.id AND a.age_band='adult_18_plus' AND a.revoked_at IS NULL)
          AND EXISTS(SELECT 1 FROM account_acceptances a WHERE a.user_id=u.id)
          AND NOT EXISTS(SELECT 1 FROM beta_account_restrictions r WHERE r.user_id=u.id AND r.status='active')
          AND NOT EXISTS(SELECT 1 FROM member_age_safety_holds h WHERE h.user_id=u.id
            AND (h.state='held' OR h.age_band<>'20_plus'))
          AND NOT EXISTS(SELECT 1 FROM moderation_access_grants g WHERE g.user_id=u.id
            AND g.role='moderation_admin' AND g.revoked_at IS NULL)
          AND NOT EXISTS(SELECT 1 FROM moderation_roles m WHERE m.user_id=u.id AND m.role='moderation_admin')`,
      params: [grantId, PRODUCTION_RBAC_REASON, now, expiresAt, userId],
    },
    {
      sql: `INSERT INTO moderation_role_events(id,grant_id,actor_user_id,target_user_id,role,action,reason,created_at)
        SELECT ?,g.id,NULL,g.user_id,g.role,'grant',?,? FROM moderation_access_grants g
        WHERE g.id=? AND g.user_id=? AND g.role='moderation_admin'
          AND g.granted_at=? AND g.expires_at=?`,
      params: [eventId, PRODUCTION_RBAC_REASON, now, grantId, userId, now, expiresAt],
    },
  ];
}
