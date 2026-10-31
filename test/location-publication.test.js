import assert from "node:assert/strict";
import test from "node:test";
import { LOCATION_REPUBLISH_MS, shouldRepublishLocation, shouldRevokeLocationPublication } from "../app/location-publication.js";

const ready = {
  watching: true,
  pending: false,
  visible: true,
  online: true,
  lastPost: 1_000,
  now: 1_000 + LOCATION_REPUBLISH_MS,
};

test("stationary published location is refreshed before server freshness expires", () => {
  assert.equal(shouldRepublishLocation(ready), true);
  assert.equal(shouldRepublishLocation({ ...ready, now: ready.now - 1 }), false);
});

test("location refresh pauses when publication is inactive or unsafe", () => {
  for (const change of [
    { watching: false },
    { pending: true },
    { visible: false },
    { online: false },
  ]) assert.equal(shouldRepublishLocation({ ...ready, ...change }), false);
});

test("only an explicit browser permission denial revokes publication", () => {
  assert.equal(shouldRevokeLocationPublication({ code: 1 }), true);
  assert.equal(shouldRevokeLocationPublication({ code: 2 }), false);
  assert.equal(shouldRevokeLocationPublication({ code: 3 }), false);
  assert.equal(shouldRevokeLocationPublication({ code: "request_failed", status: 503 }), false);
});
