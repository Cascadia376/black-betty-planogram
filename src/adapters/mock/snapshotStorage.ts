import { strFromU8, strToU8, unzlibSync, zlibSync } from "fflate";
import type { PlatformSnapshot } from "../../domain/types";

const BASE64_COMPRESSED_PREFIX = "zlib-base64:";
const UTF16_COMPRESSED_PREFIX = "zlib-utf16:";

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToUtf16(bytes: Uint8Array): string {
  const codeUnits = new Uint16Array(Math.ceil(bytes.length / 2));
  for (let index = 0; index < bytes.length; index += 2) {
    codeUnits[index / 2] = bytes[index] | ((bytes[index + 1] ?? 0) << 8);
  }

  let packed = "";
  const chunkSize = 32_768;
  for (let offset = 0; offset < codeUnits.length; offset += chunkSize) {
    packed += String.fromCharCode(...codeUnits.subarray(offset, offset + chunkSize));
  }
  return `${bytes.length}:${packed}`;
}

function utf16ToBytes(value: string): Uint8Array {
  const separator = value.indexOf(":");
  const byteLength = Number(value.slice(0, separator));
  if (separator < 1 || !Number.isSafeInteger(byteLength) || byteLength < 0) {
    throw new Error("The stored merchandising snapshot has an invalid length header.");
  }
  const packed = value.slice(separator + 1);
  if (packed.length !== Math.ceil(byteLength / 2)) {
    throw new Error("The stored merchandising snapshot is truncated.");
  }

  const bytes = new Uint8Array(byteLength);
  for (let index = 0; index < packed.length; index += 1) {
    const codeUnit = packed.charCodeAt(index);
    const byteIndex = index * 2;
    bytes[byteIndex] = codeUnit & 0xff;
    if (byteIndex + 1 < byteLength) bytes[byteIndex + 1] = codeUnit >>> 8;
  }
  return bytes;
}

/** Serialize a browser snapshot compactly enough for realistic workbook imports. */
export function serializeSnapshot(snapshot: PlatformSnapshot): string {
  const json = JSON.stringify(snapshot);
  const compressed = zlibSync(strToU8(json), { level: 6 });
  return `${UTF16_COMPRESSED_PREFIX}${bytesToUtf16(compressed)}`;
}

/** Read current packed snapshots plus prior Base64-compressed and plain-JSON formats. */
export function deserializeSnapshot(value: string): PlatformSnapshot {
  let json = value;
  if (value.startsWith(UTF16_COMPRESSED_PREFIX)) {
    json = strFromU8(unzlibSync(utf16ToBytes(value.slice(UTF16_COMPRESSED_PREFIX.length))));
  } else if (value.startsWith(BASE64_COMPRESSED_PREFIX)) {
    json = strFromU8(unzlibSync(base64ToBytes(value.slice(BASE64_COMPRESSED_PREFIX.length))));
  }
  return JSON.parse(json) as PlatformSnapshot;
}
