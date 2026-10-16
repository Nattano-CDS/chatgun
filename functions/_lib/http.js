import { constantTimeEqual } from "./crypto.js";

export const SESSION_COOKIE = "__Host-cg_session";
export const CSRF_COOKIE = "__Host-cg_csrf";
export const OAUTH_COOKIE = "__Host-cg_oauth";

const SECURITY_HEADERS = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "cross-origin-opener-policy": "same-origin",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

export function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...SECURITY_HEADERS, ...extraHeaders },
  });
}

export function failure(message, status = 400, code = "invalid_request", requestId) {
  return json({ code, message, ...(requestId ? { requestId } : {}) }, status);
}

export function redirect(location, cookies = []) {
  const headers = new Headers({ location, ...SECURITY_HEADERS });
  for (const value of cookies) headers.append("set-cookie", value);
  return new Response(null, { status: 303, headers });
}

export function parseCookies(request) {
  const result = {};
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    try {
      result[key] = decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      result[key] = "";
    }
  }
  return result;
}

export function cookie(name, value, maxAge, { httpOnly = true, sameSite = "Lax" } = {}) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "Secure",
    httpOnly ? "HttpOnly" : "",
    `SameSite=${sameSite}`,
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
  ].filter(Boolean).join("; ");
}

export function appendCookies(response, cookies) {
  const updated = new Response(response.body, response);
  for (const value of cookies) updated.headers.append("set-cookie", value);
  return updated;
}

export async function readJson(request, maximumBytes = 4096) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) throw new RequestError("invalid_content_type");
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maximumBytes) throw new RequestError("body_too_large");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) throw new RequestError("body_too_large");
  try {
    const parsed = JSON.parse(text);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("shape");
    return parsed;
  } catch {
    throw new RequestError("invalid_json");
  }
}

export function requireSameOrigin(request) {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (!origin || !constantTimeEqual(origin, expected)) throw new RequestError("invalid_origin", 403);
}

export class RequestError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = "RequestError";
    this.code = code;
    this.status = status;
  }
}
