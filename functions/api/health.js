export function onRequestGet() {
  return Response.json({ ok: true, service: 'chatgun-functions' }, {
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}
