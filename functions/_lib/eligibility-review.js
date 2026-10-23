import { safeUuid } from './crypto.js';
import { getSession, requireCsrf, hasRecentAuthentication, rateLimit, unixTime } from './db.js';
import { failure, json, readJson, requireSameOrigin } from './http.js';

const enabled = env => env.ELIGIBILITY_REVIEW_ENABLED === 'true';
const reasonText = (value, max) => typeof value === 'string' && value.trim().length >= 10 && value.trim().length <= max
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value) ? value.trim() : null;

export async function eligibilityRequest(request, env) {
  const session = await getSession(request, env.DB);
  if (!session) return failure('กรุณาเข้าสู่ระบบ', 401, 'unauthorized');
  if (!enabled(env)) return request.method === 'GET' ? json({ enabled: false, requests: [] }) : failure('ยังไม่เปิดรับคำขอผ่านระบบ กรุณาติดต่อผู้ดูแล', 404, 'feature_disabled');
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT id,status,revision,created_at,updated_at,decision_reason
      FROM eligibility_review_requests WHERE user_id=? ORDER BY created_at DESC,id LIMIT 20`).bind(session.user_id).all();
    return json({ enabled: true, requests: rows.results || [], notice: 'การยื่นหรือถอนคำขอไม่ปลดข้อจำกัดอายุ และไม่ใช่การยืนยันอายุโดยอิสระ' });
  }
  requireSameOrigin(request);
  if (!await requireCsrf(request, session)) return failure('คำขอไม่ถูกต้อง', 403, 'invalid_csrf');
  if (!hasRecentAuthentication(session)) return failure('กรุณาเข้าสู่ระบบใหม่ก่อนส่งหรือถอนคำขอ', 428, 'recent_auth_required');
  const body = await readJson(request);
  if (!['request','withdraw'].includes(body.action)) return failure('คำขอไม่ถูกต้อง', 400, 'invalid_action');
  const reason = reasonText(body.reason, 1000);
  if (!reason) return failure('กรุณาระบุเหตุผล 10–1000 ตัวอักษร โดยไม่ส่งวันเกิดเต็มหรือเอกสารยืนยันตัวตน', 400, 'invalid_reason');
  if (!await rateLimit(env.DB, 'eligibility_review', session.user_id, 10, 86400, env.RATE_LIMIT_PEPPER)) return failure('ส่งคำขอบ่อยเกินไป กรุณารอ', 429, 'rate_limited');
  const now = unixTime(), eventId = safeUuid();
  if (body.action === 'request') {
    const held = await env.DB.prepare("SELECT 1 held FROM member_age_safety_holds WHERE user_id=? AND (state='held' OR age_band<>'20_plus')").bind(session.user_id).first();
    if (!held) return failure('ไม่มีข้อจำกัดช่วงอายุที่ต้องทบทวน', 409, 'review_not_required');
    const id = safeUuid();
    const results = await env.DB.batch([
      env.DB.prepare(`INSERT INTO eligibility_review_requests(id,user_id,reason,created_at,updated_at)
        VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING`).bind(id, session.user_id, reason, now, now),
      env.DB.prepare(`INSERT INTO eligibility_review_events(id,request_id,actor_id,action,reason,revision,created_at)
        SELECT ?,id,user_id,'requested',reason,0,? FROM eligibility_review_requests WHERE id=?`).bind(eventId, now, id),
    ]);
    if (!results[0].meta.changes) return failure('มีคำขอรอตรวจแล้ว กรุณาตรวจสอบสถานะ', 409, 'request_pending');
    return json({ id, status: 'pending', revision: 0 }, 201);
  }
  if (typeof body.id !== 'string' || !Number.isSafeInteger(body.revision) || body.revision < 0) return failure('คำขอไม่ถูกต้อง', 400, 'invalid_request');
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE eligibility_review_requests SET status='withdrawn',revision=revision+1,updated_at=?
      WHERE id=? AND user_id=? AND status='pending' AND revision=?`).bind(now, body.id, session.user_id, body.revision),
    env.DB.prepare(`INSERT INTO eligibility_review_events(id,request_id,actor_id,action,reason,revision,created_at)
      SELECT ?,id,user_id,'withdrawn',?,revision,? FROM eligibility_review_requests
      WHERE id=? AND user_id=? AND status='withdrawn' AND revision=? AND changes()=1`).bind(eventId, reason, now, body.id, session.user_id, body.revision + 1),
  ]);
  if (!results[0].meta.changes) return failure('คำขอเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่', 409, 'revision_conflict');
  return json({ ok: true, status: 'withdrawn', accessRestored: false });
}

// Caller supplies the existing recent-auth/RBAC/CSRF/purpose-validated moderator.
export async function eligibilityModeration(request, env, access) {
  if (!enabled(env)) return failure('ขั้นตอนนี้ยังไม่เปิดใช้งาน', 404, 'feature_disabled');
  const { session, purpose } = access;
  if (request.method === 'GET') {
    const url = new URL(request.url), page = Math.min(1000, Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1)));
    const status = url.searchParams.get('status') || 'pending';
    if (!['pending','withdrawn','upheld','deferred'].includes(status)) return failure('สถานะไม่ถูกต้อง', 400, 'invalid_status');
    const rows = await env.DB.prepare(`SELECT id,user_id,status,reason,revision,created_at,updated_at,decision_reason
      FROM eligibility_review_requests WHERE status=? ORDER BY created_at,id LIMIT 21 OFFSET ?`).bind(status, (page - 1) * 20).all();
    await env.DB.prepare(`INSERT INTO administration_access_events(id,actor_id,scope,purpose,created_at)
      VALUES(?,?,'eligibility_queue',?,?)`).bind(safeUuid(),session.user_id,purpose,unixTime()).run();
    return json({ items: (rows.results || []).slice(0,20), page, hasMore: rows.results.length > 20, admissionEnabled: false });
  }
  const body = await readJson(request), reason = reasonText(body.reason, 300);
  if (!reason || typeof body.id !== 'string' || !Number.isSafeInteger(body.revision) || body.revision < 0 || !['upheld','deferred'].includes(body.action)) return failure('ระบุคำตัดสิน เหตุผล และรุ่นคำขอให้ถูกต้อง', 400, 'invalid_decision');
  const row = await env.DB.prepare('SELECT user_id FROM eligibility_review_requests WHERE id=?').bind(body.id).first();
  if (!row) return failure('ไม่พบคำขอ',404,'not_found');
  if (row.user_id === session.user_id) return failure('ไม่สามารถพิจารณาคำขอของตนเอง',403,'review_conflict');
  const now = unixTime(), eventId = safeUuid();
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE eligibility_review_requests SET status=?,revision=revision+1,updated_at=?,reviewed_by=?,decision_reason=?
      WHERE id=? AND status='pending' AND revision=?`).bind(body.action,now,session.user_id,reason,body.id,body.revision),
    env.DB.prepare(`INSERT INTO eligibility_review_events(id,request_id,actor_id,action,reason,purpose,revision,created_at)
      SELECT ?,id,?,?,?,?,revision,? FROM eligibility_review_requests
      WHERE id=? AND status=? AND revision=? AND changes()=1`).bind(eventId,session.user_id,body.action,reason,purpose,now,body.id,body.action,body.revision+1),
    env.DB.prepare(`INSERT INTO account_safety_notifications(id,user_id,message_code,created_at)
      SELECT ?,? ,?,? WHERE EXISTS(SELECT 1 FROM eligibility_review_events WHERE id=?)`)
      .bind(safeUuid(),row.user_id,'eligibility_'+body.action,now,eventId),
  ]);
  if (!results[0].meta.changes) return failure('คำขอเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่',409,'revision_conflict');
  return json({ ok: true, status: body.action, accessRestored: false });
}
