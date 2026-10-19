import { runRetentionCleanup } from "../functions/_lib/retention.js";

export default {
  async fetch() {
    return new Response("Not Found", {
      status: 404,
      headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
    });
  },

  async scheduled(controller, env, context) {
    if(String(env.RETENTION_CLEANUP_ENABLED).toLowerCase()==='false')return;
    const timestamp = Math.floor(controller.scheduledTime / 1000);
    context.waitUntil((async () => {
      const deleted = await runRetentionCleanup(env.DB, timestamp);
      // Additive-schema compatibility: presence cleanup needs its optional table.
      const presence=await env.DB.prepare("SELECT 1 ok FROM sqlite_master WHERE type='table' AND name='member_presence_leases'").first();
      if(presence)await env.DB.prepare('DELETE FROM member_presence_leases WHERE rowid IN (SELECT rowid FROM member_presence_leases WHERE touched_at<=? LIMIT 500)').bind(timestamp-90).run();
      console.log(JSON.stringify({ event: "privacy_cleanup_completed", deleted }));
    })());
  },
};
