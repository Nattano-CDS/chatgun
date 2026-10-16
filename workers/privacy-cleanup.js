import { runRetentionCleanup } from "../functions/_lib/retention.js";

export default {
  async fetch() {
    return new Response("Not Found", {
      status: 404,
      headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
    });
  },

  async scheduled(controller, env, context) {
    const timestamp = Math.floor(controller.scheduledTime / 1000);
    context.waitUntil((async () => {
      const deleted = await runRetentionCleanup(env.DB, timestamp);
      console.log(JSON.stringify({ event: "privacy_cleanup_completed", deleted }));
    })());
  },
};
