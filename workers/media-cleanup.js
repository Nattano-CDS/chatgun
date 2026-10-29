const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 10;

function unixTime() {
  return Math.floor(Date.now() / 1000);
}

function retryDelay(attempts) {
  return Math.min(86400, 60 * (2 ** Math.min(attempts, 10)));
}

export async function drainMediaDeletionQueue(env, timestamp = unixTime(), {objectKeys} = {}) {
  if(env.MEDIA_CLEANUP_ENABLED !== 'true')return {disabled:true,completed:0,failed:0};
  if (!env.DB || !env.MEDIA) throw new Error("missing_staging_bindings");
  if(objectKeys!==undefined&&(!Array.isArray(objectKeys)||objectKeys.length>100||objectKeys.some(k=>typeof k!=='string'||!k||k.length>1024)))throw new Error('invalid_cleanup_scope');
  const scope=objectKeys===undefined?'':` AND object_key IN (${objectKeys.map(()=>'?').join(',')||'NULL'})`;
  const exhaustedBefore = await env.DB.prepare(`
    SELECT COUNT(*) count FROM media_deletion_queue
    WHERE completed_at IS NULL AND attempts >= ?
  `).bind(MAX_ATTEMPTS).first();
  const due = await env.DB.prepare(`
    SELECT object_key, attempts FROM media_deletion_queue
    WHERE completed_at IS NULL AND next_attempt_at <= ? AND attempts < ?
      AND (processing_nonce IS NULL OR lease_until<=?) ${scope}
    ORDER BY created_at, object_key LIMIT ?
  `).bind(timestamp, MAX_ATTEMPTS,timestamp,...objectKeys||[], BATCH_SIZE).all();
  let completed = 0;
  let failed = 0;
  for (const row of due.results || []) {
    const nonce=crypto.randomUUID();
    // Claim before touching R2. An appeal cannot release an object being deleted;
    // two cleanup invocations cannot both own the same operation.
    const claim=await env.DB.prepare(`UPDATE media_deletion_queue SET processing_nonce=?,lease_until=?
      WHERE object_key=? AND completed_at IS NULL AND (processing_nonce IS NULL OR lease_until<=?) AND next_attempt_at<=? AND attempts<10
        AND NOT EXISTS(SELECT 1 FROM social_media m WHERE m.object_key=media_deletion_queue.object_key AND m.state<>'pending_deletion')`)
      .bind(nonce,timestamp+300,row.object_key,timestamp,timestamp).run();
    if(!claim.meta?.changes)continue;
    let objectDeleted=false;
    try {
      await env.MEDIA.delete(row.object_key);
      objectDeleted=true;
      await env.DB.batch([
        env.DB.prepare(`UPDATE social_messages SET unsent_at=COALESCE(unsent_at,?)
          WHERE body='' AND media_id IN(SELECT id FROM social_media WHERE object_key=? AND state='pending_deletion')
            AND EXISTS(SELECT 1 FROM media_deletion_queue WHERE object_key=? AND processing_nonce=?)`)
          .bind(timestamp,row.object_key,row.object_key,nonce),
        env.DB.prepare(`
          DELETE FROM social_media WHERE object_key = ? AND state = 'pending_deletion'
            AND EXISTS(SELECT 1 FROM media_deletion_queue WHERE object_key=? AND processing_nonce=?)
        `).bind(row.object_key,row.object_key,nonce),
        env.DB.prepare(`
          UPDATE media_deletion_queue
          SET completed_at = ?, attempts = attempts + 1, last_error_code = NULL
          WHERE object_key = ? AND completed_at IS NULL AND processing_nonce=?
        `).bind(timestamp, row.object_key,nonce),
      ]);
      completed += 1;
    } catch {
      const attempts = Number(row.attempts || 0) + 1;
      await env.DB.prepare(`
        UPDATE media_deletion_queue
        SET attempts = ?, next_attempt_at = ?, last_error_code = ?,processing_nonce=NULL,lease_until=NULL
        WHERE object_key = ? AND completed_at IS NULL AND processing_nonce=?
      `).bind(attempts, timestamp + retryDelay(attempts),objectDeleted?'cleanup_commit_failed':'r2_delete_failed', row.object_key,nonce).run();
      failed += 1;
    }
  }
  const exhaustedAfter = await env.DB.prepare(`
    SELECT COUNT(*) count FROM media_deletion_queue
    WHERE completed_at IS NULL AND attempts >= ?
  `).bind(MAX_ATTEMPTS).first();
  return {
    selected: (due.results || []).length,
    completed,
    failed,
    exhausted: Number(exhaustedAfter?.count || exhaustedBefore?.count || 0),
  };
}

export default {
  async scheduled(_controller, env, context) {
    context.waitUntil((async () => {
      const result = await drainMediaDeletionQueue(env);
      console.log(JSON.stringify({ event: "media_cleanup", ...result }));
    })());
  },
};
