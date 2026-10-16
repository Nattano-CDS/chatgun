import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

class PreparedStatement {
  constructor(database, sql) {
    this.statement = database.prepare(sql);
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    return this.statement.get(...this.values) || null;
  }

  async run() {
    const result = this.statement.run(...this.values);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }

  async all() {
    return { success: true, results: this.statement.all(...this.values) };
  }
}

export class TestD1 {
  constructor() {
    this.database = new DatabaseSync(":memory:");
    for (const migration of readdirSync(resolve("migrations")).filter((name) => name.endsWith(".sql")).sort()) {
      this.database.exec(readFileSync(resolve("migrations", migration), "utf8"));
    }
  }

  prepare(sql) {
    return new PreparedStatement(this.database, sql);
  }

  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  exec(sql) {
    return this.database.exec(sql);
  }

  close() {
    this.database.close();
  }
}

export function environment(database) {
  return {
    DB: database,
    OTP_PEPPER: "test-otp-pepper-that-is-long",
    RATE_LIMIT_PEPPER: "test-rate-limit-pepper-that-is-long",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "ChatGun <login@example.test>",
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    TURNSTILE_SITE_KEY: "turnstile-site",
    EMAIL_OTP_ENABLED: "false",
    MOBILE_OTP_ENABLED: "false",
    NEW_ACCOUNT_REGISTRATION_ENABLED: "true",
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
    LINE_CLIENT_ID: "line-client",
    LINE_CLIENT_SECRET: "line-secret",
    LINE_EMAIL_ENABLED: "false",
    FACEBOOK_CLIENT_ID: "facebook-client",
    FACEBOOK_CLIENT_SECRET: "facebook-secret",
    FACEBOOK_GRAPH_VERSION: "v24.0",
  };
}

export function jsonRequest(path, body, extraHeaders = {}) {
  return new Request(`https://chatgun.pages.dev${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://chatgun.pages.dev",
      "cf-connecting-ip": "203.0.113.8",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

export function cookieValue(response, name) {
  const values = response.headers.getSetCookie?.() || [response.headers.get("set-cookie") || ""];
  const match = values.join(",").match(new RegExp(`${name}=([^;,]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}
