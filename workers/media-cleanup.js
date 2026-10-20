const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 10;

function unixTime() {
  return Math.floor(Date.now() / 1000);
}

function retryDelay(attempts) {
  return Math.min(86400, 60 * (2 ** Math.min(attempts, 10)));
}

export async function drainMediaDeletionQueue(env, timestamp = unixTime()) {
  if(String(env.MEDIA_CLEANUP_ENABLED).toLowerCase()==='false')return {disabled:true,completed:0,failed:0};
  if (!env.DB || !env.MEDIA) throw new Error("missing_staging_bindings");
  const exhaustedBefore = await env.DB.prepare(`
    SELECT COUNT(*) count FROM media_deletion_queue
    WHERE completed_at IS NULL AND attempts >= ?
  `).bind(MAX_ATTEMPTS).first();
  const due = await env.DB.prepare(`
    SELECT object_key, attempts FROM media_deletion_queue
    WHERE completed_at IS NULL AND next_attempt_at <= ? AND attempts < ?
      AND (processing_nonce IS NULL OR lease_until<=?)
    ORDER BY created_at, object_key LIMIT ?
  `).bind(timestamp, MAX_ATTEMPTS,timestamp, BATCH_SIZE).all();
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
    try {
      await env.MEDIA.delete(row.object_key);
      await env.DB.batch([
        env.DB.prepare(`
          DELETE FROM social_media WHERE object_key = ? AND state = 'pending_deletion'
        `).bind(row.object_key),
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
        SET attempts = ?, next_attempt_at = ?, last_error_code = 'r2_delete_failed',processing_nonce=NULL,lease_until=NULL
        WHERE object_key = ? AND completed_at IS NULL AND processing_nonce=?
      `).bind(attempts, timestamp + retryDelay(attempts), row.object_key,nonce).run();
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
