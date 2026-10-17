import {eligibleSql,unblockedSql} from './social-permissions.js';
export const ONLINE_TTL_SECONDS = 110;

export async function onlineStatuses(db,viewer,targets,now=Math.floor(Date.now()/1000)) {
  const ids=[...new Set(targets)];
  if(ids.length>50)throw new Error('too_many_presence_targets');
  const result=Object.fromEntries(ids.map(id=>[id,false]));
  if(!ids.length)return result;
  const rows=await db.prepare(`SELECT p.user_id FROM member_profiles p
    JOIN member_presence_preferences pref ON pref.user_id=p.user_id AND pref.show_online=1
    WHERE p.user_id IN (${ids.map(()=>'?').join(',')}) AND p.discovery_visible=1
    AND ${eligibleSql('p.user_id')} AND ${eligibleSql('?')}
    AND ${unblockedSql('?','p.user_id')}
    AND EXISTS(SELECT 1 FROM member_presence_leases lease
      JOIN sessions s ON s.token_hash=lease.session_token_hash AND s.user_id=lease.user_id
      WHERE lease.user_id=p.user_id AND lease.touched_at>? AND lease.touched_at<=?
        AND s.revoked_at IS NULL AND s.expires_at>?)`)
    .bind(...ids,viewer,viewer,viewer,now-ONLINE_TTL_SECONDS,now,now).all();
  for(const row of rows.results||[])result[row.user_id]=true;
  return result;
}

export async function writeOnlineHeartbeat(db,session,tabId,now=Math.floor(Date.now()/1000)) {
  // Bounded leases; conflict updates still work at the per-session tab limit.
  await db.batch([
    db.prepare('DELETE FROM member_presence_leases WHERE rowid IN (SELECT rowid FROM member_presence_leases WHERE touched_at<=? LIMIT 500)').bind(now-ONLINE_TTL_SECONDS),
    db.prepare(`INSERT INTO member_presence_leases(user_id,session_token_hash,tab_id,touched_at)
      SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM member_presence_preferences WHERE user_id=? AND show_online=1)
      AND ((SELECT COUNT(*) FROM member_presence_leases WHERE session_token_hash=?)<8
        OR EXISTS(SELECT 1 FROM member_presence_leases WHERE session_token_hash=? AND tab_id=?))
      ON CONFLICT(session_token_hash,tab_id) DO UPDATE SET touched_at=excluded.touched_at`)
      .bind(session.user_id,session.token_hash,tabId,now,session.user_id,session.token_hash,session.token_hash,tabId),
  ]);
}
