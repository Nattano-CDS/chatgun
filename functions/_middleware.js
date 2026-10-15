const CANONICAL_HOST = "chatgun.social";
const PAGES_PRODUCTION_HOST = "chatgun.pages.dev";

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname === PAGES_PRODUCTION_HOST) {
    url.protocol = "https:";
    url.hostname = CANONICAL_HOST;
    url.port = "";
    return Response.redirect(url.toString(), 308);
  }

  return context.next();
}
