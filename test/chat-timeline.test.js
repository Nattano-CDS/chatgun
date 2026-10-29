import assert from "node:assert/strict";
import test from "node:test";

import {
  compareTimelineMessages,
  isNearTimelineBottom,
  mergeTimelineMessages,
  timelineMessageKey,
} from "../app/chat-timeline.js";

test("chat timeline is oldest-first with a deterministic id tie-breaker", () => {
  const messages = [
    { id: "z", created_at: 12 },
    { id: "b", created_at: 10 },
    { id: "a", created_at: 10 },
    { id: "c", created_at: 11 },
  ];
  assert.deepEqual(messages.sort(compareTimelineMessages).map(({ id }) => id), ["a", "b", "c", "z"]);
});

test("chat timeline merge deduplicates refreshes and appends newer messages", () => {
  const current = [{ id: "a", created_at: 10, body: "old" }, { id: "b", created_at: 11 }];
  const incoming = [{ id: "a", created_at: 10, body: "updated" }, { id: "c", created_at: 12 }];
  const merged = mergeTimelineMessages(current, incoming);
  assert.deepEqual(merged.map(({ id }) => id), ["a", "b", "c"]);
  assert.equal(merged[0].body, "updated");
});

test("normal messages and system events cannot collide during pagination merge", () => {
  const normal = { id: "same", created_at: 10 };
  const system = { id: "same", created_at: 10, system: true };
  assert.notEqual(timelineMessageKey(normal), timelineMessageKey(system));
  assert.equal(mergeTimelineMessages([normal], [system]).length, 2);
});

test("near-bottom detection uses remaining scroll distance", () => {
  assert.equal(isNearTimelineBottom({ scrollHeight: 1000, scrollTop: 620, clientHeight: 300 }), true);
  assert.equal(isNearTimelineBottom({ scrollHeight: 1000, scrollTop: 500, clientHeight: 300 }), false);
});
