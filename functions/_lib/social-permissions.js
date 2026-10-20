// SQL predicates are constants composed only with source-owned aliases, never input.
export function eligibleSql(alias) {
  return `EXISTS(SELECT 1 FROM users eu JOIN member_profiles ep ON ep.user_id=eu.id
    JOIN age_assurance_events ea ON ea.id=ep.age_assurance_id AND ea.user_id=eu.id
    WHERE eu.id=${alias} AND eu.status='active' AND eu.account_state='active'
      AND ea.age_band='adult_18_plus' AND ea.revoked_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM beta_enrollments eb WHERE eb.user_id=eu.id AND eb.status='revoked')
      AND NOT EXISTS(SELECT 1 FROM beta_account_restrictions restriction WHERE restriction.user_id=eu.id AND restriction.status='active'))`;
}
export function unblockedSql(a,b) {
  return `NOT EXISTS(SELECT 1 FROM social_blocks sb WHERE
    (sb.blocker_user_id=${a} AND sb.blocked_user_id=${b}) OR
    (sb.blocker_user_id=${b} AND sb.blocked_user_id=${a}))`;
}
export async function canContact(db, viewer, target, {send=true}={}) {
  if (!target || viewer===target) return false;
  return Boolean(await db.prepare(`SELECT 1 ok FROM member_profiles p WHERE p.user_id=?
    AND (?=0 OR p.direct_messages_enabled=1) AND ${eligibleSql('p.user_id')}
    AND ${eligibleSql('?')} AND ${unblockedSql('?','p.user_id')}`)
    .bind(target,send?1:0,viewer,viewer,viewer).first());
}
export async function albumGrant(db, viewer, owner) {
  if (viewer===owner) return true;
  return Boolean(await db.prepare(`SELECT 1 ok FROM album_access_grants g
    JOIN album_access_requests r ON r.id=g.approved_request_id AND r.status='approved' AND r.revision=g.revision
    WHERE g.album_owner_id=? AND g.viewer_id=? AND g.revoked_at IS NULL
      AND ${eligibleSql('g.album_owner_id')} AND ${eligibleSql('g.viewer_id')}
      AND ${unblockedSql('g.album_owner_id','g.viewer_id')}`).bind(owner,viewer).first());
}
export async function canViewPhoto(db, viewer, photo) {
  if (!photo) return false;
  if (photo.owner_user_id===viewer) return true;
  const eligible=await db.prepare(`SELECT 1 ok WHERE ${eligibleSql('?')} AND ${eligibleSql('?')}
    AND ${unblockedSql('?','?')}`).bind(viewer,photo.owner_user_id,viewer,photo.owner_user_id,photo.owner_user_id,viewer).first();
  return Boolean(eligible && (photo.visibility==='public' || await albumGrant(db,viewer,photo.owner_user_id)));
}
export async function publicPortrait(db, id, owner) {
  if (!id) return null;
  return (await db.prepare(`SELECT p.media_id FROM profile_photos p
    JOIN social_media m ON m.id=p.media_id AND m.state='active'
    JOIN media_safety_reviews r ON r.media_id=m.id AND r.status='released' AND r.category='general'
    WHERE p.media_id=? AND p.owner_user_id=? AND p.visibility='public'`).bind(id,owner).first())?.media_id || null;
}
// Source-owned alias p only. Resolve portraits within discovery/inbox queries,
// rather than issuing one D1 network query per card.
export const publicPortraitColumn=`CASE WHEN EXISTS(SELECT 1 FROM profile_photos portrait
  JOIN social_media portrait_media ON portrait_media.id=portrait.media_id AND portrait_media.state='active'
  JOIN media_safety_reviews portrait_review ON portrait_review.media_id=portrait.media_id AND portrait_review.status='released' AND portrait_review.category='general'
  WHERE portrait.media_id=p.selected_photo_id AND portrait.owner_user_id=p.user_id AND portrait.visibility='public')
  THEN p.selected_photo_id ELSE NULL END selected_photo_id`;
