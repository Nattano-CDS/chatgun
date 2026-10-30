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

  if (String(context.env?.PUBLIC_DEMO_CANARY_ENABLED).toLowerCase() === "true"
      && /^\/(?:privacy|terms|data-deletion)(?:\.html)?\/?$/u.test(url.pathname)) {
    return new Response(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>เตรียมเปิดให้บริการ | ChatGun</title><link rel="stylesheet" href="/auth-shell.css"><body class="auth-page"><main class="auth-content"><section class="auth-panel"><div class="auth-mark"><img src="/logo.svg" alt="ChatGun"></div><h1>ChatGun กำลังเตรียมเปิดให้บริการ</h1><p class="auth-intro">ยังไม่เปิดรับสมาชิกหรือใช้บริการสังคมออนไลน์ เอกสารสำหรับบริการสมาชิกยังอยู่ระหว่างการพิจารณา หน้านี้ไม่ใช่นโยบายที่ได้รับอนุมัติแล้ว</p><p class="auth-intro">ไม่มีการแสดงสมาชิกหรือบทสนทนาสมมติ ผู้ให้บริการโฮสติ้งประมวลผลคำขอเว็บไซต์ตามการให้บริการของตน</p><p class="auth-intro">ติดต่อผู้ดำเนินการ ChatGun เทพกร ทาโน: <a href="mailto:natttano@outlook.com">natttano@outlook.com</a></p><a class="auth-secondary" href="/">กลับหน้าแรก</a></section></main></body></html>`, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "content-security-policy": "default-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
    });
  }

  return context.next();
}
