const MAX_DIMENSION = 4096;
const MAX_PIXELS = 16_000_000;

export class ImageValidationError extends Error {}

function concat(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function dimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
    throw new ImageValidationError("invalid_dimensions");
  }
  return { width, height };
}

function u32be(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

function png(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 45 || !signature.every((value, index) => bytes[index] === value)) return null;
  const parts = [bytes.slice(0, 8)];
  let offset = 8;
  let width;
  let height;
  let sawImageData = false;
  let sawEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = u32be(bytes, offset);
    const end = offset + 12 + length;
    if (length > bytes.length || end > bytes.length) throw new ImageValidationError("invalid_png");
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (type === "IHDR") {
      if (offset !== 8 || length !== 13 || width !== undefined) throw new ImageValidationError("invalid_png");
      width = u32be(bytes, offset + 8);
      height = u32be(bytes, offset + 12);
    }
    if (type === "IDAT") sawImageData = true;
    if (type === "IEND") {
      if (length !== 0) throw new ImageValidationError("invalid_png");
      sawEnd = true;
    }
    // Remove textual, EXIF, and embedded color-profile metadata. Other chunks
    // are retained so transparency, animation, and color rendering still work.
    if (!["eXIf", "tEXt", "zTXt", "iTXt", "iCCP"].includes(type)) parts.push(bytes.slice(offset, end));
    offset = end;
    if (sawEnd) break;
  }
  if (!sawEnd || !sawImageData || offset !== bytes.length || width === undefined) {
    throw new ImageValidationError("invalid_png");
  }
  return { contentType: "image/png", bytes: concat(parts), ...dimensions(width, height) };
}

const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpeg(bytes) {
  if (bytes.length < 16 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const parts = [bytes.slice(0, 2)];
  let offset = 2;
  let width;
  let height;
  let sawScan = false;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new ImageValidationError("invalid_jpeg");
    while (bytes[offset] === 0xff) offset += 1;
    const markerStart = offset - 1;
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      parts.push(bytes.slice(markerStart, offset));
      break;
    }
    if (marker === 0xda) {
      if (offset + 2 > bytes.length) throw new ImageValidationError("invalid_jpeg");
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) throw new ImageValidationError("invalid_jpeg");
      if (bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) throw new ImageValidationError("invalid_jpeg");
      parts.push(bytes.slice(markerStart));
      offset = bytes.length;
      sawScan = true;
      break;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.slice(markerStart, offset));
      continue;
    }
    if (offset + 2 > bytes.length) throw new ImageValidationError("invalid_jpeg");
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    const end = offset + length;
    if (length < 2 || end > bytes.length) throw new ImageValidationError("invalid_jpeg");
    if (JPEG_SOF.has(marker)) {
      if (length < 8) throw new ImageValidationError("invalid_jpeg");
      height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      width = (bytes[offset + 5] << 8) | bytes[offset + 6];
    }
    // Keep JFIF/Adobe application data for correct rendering, but remove EXIF,
    // XMP, comments, thumbnails, and unrelated application metadata.
    const strip = marker === 0xfe || (marker >= 0xe1 && marker <= 0xed) || marker === 0xef;
    if (!strip) parts.push(bytes.slice(markerStart, end));
    offset = end;
  }
  if (!sawScan || width === undefined) throw new ImageValidationError("invalid_jpeg");
  return { contentType: "image/jpeg", bytes: concat(parts), ...dimensions(width, height) };
}

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function u24le(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function webpDimensions(type, data) {
  if (type === "VP8X" && data.length >= 10) return dimensions(u24le(data, 4) + 1, u24le(data, 7) + 1);
  if (type === "VP8L" && data.length >= 5 && data[0] === 0x2f) {
    const width = 1 + (((data[2] & 0x3f) << 8) | data[1]);
    const height = 1 + (((data[4] & 0x0f) << 10) | (data[3] << 2) | ((data[2] & 0xc0) >> 6));
    return dimensions(width, height);
  }
  if (type === "VP8 " && data.length >= 10 && data[3] === 0x9d && data[4] === 0x01 && data[5] === 0x2a) {
    return dimensions((data[6] | (data[7] << 8)) & 0x3fff, (data[8] | (data[9] << 8)) & 0x3fff);
  }
  return null;
}

function webp(bytes) {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  const declaredLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8;
  if (declaredLength !== bytes.length) throw new ImageValidationError("invalid_webp");
  const chunks = [];
  let offset = 12;
  let size;
  let sawImage = false;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset + 4, true);
    const padded = length + (length % 2);
    const end = offset + 8 + padded;
    if (end > bytes.length) throw new ImageValidationError("invalid_webp");
    let data = bytes.slice(offset + 8, offset + 8 + length);
    const candidate = webpDimensions(type, data);
    if (candidate) size ||= candidate;
    if (["VP8 ", "VP8L"].includes(type)) sawImage = true;
    if (type === "VP8X") {
      data = data.slice();
      data[0] &= ~(0x20 | 0x08 | 0x04);
    }
    if (!["EXIF", "XMP ", "ICCP"].includes(type)) {
      const header = bytes.slice(offset, offset + 8);
      const padding = padded === length ? new Uint8Array() : new Uint8Array([0]);
      chunks.push(concat([header, data, padding]));
    }
    offset = end;
  }
  if (offset !== bytes.length || !size || (!sawImage && !chunks.some((chunk) => ascii(chunk, 0, 4) === "ANMF"))) {
    throw new ImageValidationError("invalid_webp");
  }
  const payload = concat([new TextEncoder().encode("WEBP"), ...chunks]);
  const output = new Uint8Array(payload.length + 8);
  output.set(new TextEncoder().encode("RIFF"), 0);
  new DataView(output.buffer).setUint32(4, payload.length, true);
  output.set(payload, 8);
  return { contentType: "image/webp", bytes: output, ...size };
}

export function sanitizeImage(input, declaredType) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let image;
  try {
    image = png(bytes) || jpeg(bytes) || webp(bytes);
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new ImageValidationError("invalid_image");
  }
  if (!image || image.contentType !== declaredType) throw new ImageValidationError("invalid_image");
  return image;
}
