import assert from "node:assert/strict";
import test from "node:test";
import { ImageValidationError, sanitizeImage } from "../functions/_lib/image.js";
import { ONE_PIXEL_JPEG, ONE_PIXEL_PNG, TWO_BY_THREE_WEBP_WITH_ICC } from "./helpers/image.js";

function insertPngChunk(bytes, type, data) {
  const iend = bytes.length - 12;
  const chunk = new Uint8Array(12 + data.length);
  new DataView(chunk.buffer).setUint32(0, data.length, false);
  chunk.set(new TextEncoder().encode(type), 4);
  chunk.set(data, 8);
  const result = new Uint8Array(bytes.length + chunk.length);
  result.set(bytes.slice(0, iend), 0);
  result.set(chunk, iend);
  result.set(bytes.slice(iend), iend + chunk.length);
  return result;
}

test("image sanitizer verifies structure, MIME, and dimensions", () => {
  const image = sanitizeImage(ONE_PIXEL_PNG, "image/png");
  assert.equal(image.contentType, "image/png");
  assert.deepEqual([image.width, image.height], [1, 1]);
  assert.throws(() => sanitizeImage(ONE_PIXEL_PNG, "image/jpeg"), ImageValidationError);
  assert.throws(() => sanitizeImage(ONE_PIXEL_PNG.slice(0, 20), "image/png"), ImageValidationError);

  const oversized = ONE_PIXEL_PNG.slice();
  new DataView(oversized.buffer).setUint32(16, 5000, false);
  assert.throws(() => sanitizeImage(oversized, "image/png"), ImageValidationError);
});

test("image sanitizer strips embedded PNG text metadata before storage", () => {
  const withMetadata = insertPngChunk(ONE_PIXEL_PNG, "tEXt", new TextEncoder().encode("Location\0private"));
  assert.match(new TextDecoder().decode(withMetadata), /Location/u);
  const sanitized = sanitizeImage(withMetadata, "image/png");
  assert.doesNotMatch(new TextDecoder().decode(sanitized.bytes), /Location|private/u);
  assert.ok(sanitized.bytes.length < withMetadata.length);
});

test("image sanitizer accepts decoded JPEG and strips WebP ICC metadata", () => {
  const jpeg = sanitizeImage(ONE_PIXEL_JPEG, "image/jpeg");
  assert.deepEqual([jpeg.width, jpeg.height], [1, 1]);
  const webp = sanitizeImage(TWO_BY_THREE_WEBP_WITH_ICC, "image/webp");
  assert.deepEqual([webp.width, webp.height], [2, 3]);
  assert.ok(webp.bytes.length < TWO_BY_THREE_WEBP_WITH_ICC.length);
  assert.doesNotMatch(new TextDecoder().decode(webp.bytes), /ICCP|Google Inc/u);
});
