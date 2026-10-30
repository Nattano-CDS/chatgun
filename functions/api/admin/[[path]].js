import { onRequest as socialRequest } from '../social/[[path]].js';
import { failure } from '../../_lib/http.js';

// Dedicated Access-protected namespace. Member moderation notifications remain
// outside this namespace so Access cannot accidentally block ordinary members.
export async function onRequest(context) {
  if (context.env.ADMIN_ACCESS_STANDALONE_ENABLED !== 'true') return failure('ขั้นตอนนี้ยังไม่เปิดใช้งาน', 404, 'feature_disabled');
  const url = new URL(context.request.url);
  // The Access application protects /api/admin/*, which does not include the
  // slashless namespace root. Keep that root fail-closed by sending safe reads
  // to the protected session endpoint without forwarding query parameters.
  if (url.pathname === '/api/admin') {
    if (!['GET', 'HEAD'].includes(context.request.method)) return failure('ไม่พบหน้าที่เรียก', 404, 'not_found');
    return new Response(null, { status: 302, headers: {
      location: '/api/admin/session',
      'cache-control': 'private, no-store, max-age=0',
    } });
  }
  const path = url.pathname.slice('/api/admin/'.length);
  if (!/^[a-z][a-z0-9/-]{0,200}$/u.test(path) || path === 'notifications') return failure('ไม่พบหน้าที่เรียก', 404, 'not_found');
  url.pathname = '/api/social/moderation/' + (path === 'session' ? 'access' : path);
  return socialRequest({ ...context, request: new Request(url, context.request) });
}
