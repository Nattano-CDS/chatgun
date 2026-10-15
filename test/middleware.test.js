import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/_middleware.js";

test("redirects the production pages.dev hostname to the canonical origin", async () => {
  const response = await onRequest({
    request: new Request("https://chatgun.pages.dev/account?from=oauth"),
    next: () => {
      throw new Error("canonical redirect must not call next");
    },
  });

  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://chatgun.social/account?from=oauth");
});

test("does not redirect Preview or custom hostnames", async () => {
  const expected = new Response(null, { status: 204 });

  for (const hostname of [
    "feature-cloudflare-auth.chatgun.pages.dev",
    "d7209836.chatgun.pages.dev",
    "chatgun.social",
  ]) {
    let calls = 0;
    const response = await onRequest({
      request: new Request(`https://${hostname}/signup`),
      next: () => {
        calls += 1;
        return expected;
      },
    });

    assert.equal(response, expected);
    assert.equal(calls, 1);
  }
});
