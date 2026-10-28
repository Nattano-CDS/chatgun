import { cleanupUatCampaignAuditEvidence, runRetentionCleanup } from "../functions/_lib/retention.js";
import { cleanupAdminAccessSessions } from '../functions/_lib/cloudflare-admin-session.js';

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
      deleted.uatCampaignAuditEvidence = await cleanupUatCampaignAuditEvidence(env.DB, timestamp, env);
      // Optional migration: old Production schema remains supported until an
      // explicitly approved migration and Access rollout has occurred.
      const adminSessions=await env.DB.prepare("SELECT 1 ok FROM sqlite_master WHERE type='table' AND name='cloudflare_admin_sessions'").first();
      if(adminSessions)deleted.adminAccessSessions=await cleanupAdminAccessSessions(env.DB,timestamp);
      // Additive-schema compatibility: presence cleanup needs its optional table.
      const presence=await env.DB.prepare("SELECT 1 ok FROM sqlite_master WHERE type='table' AND name='member_presence_leases'").first();
      if(presence)await env.DB.prepare('DELETE FROM member_presence_leases WHERE rowid IN (SELECT rowid FROM member_presence_leases WHERE touched_at<=? LIMIT 500)').bind(timestamp-90).run();
      console.log(JSON.stringify({ event: "privacy_cleanup_completed", deleted }));
    })());
  },
};
