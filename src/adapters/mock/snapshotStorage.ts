import { strFromU8, strToU8, unzlibSync, zlibSync } from "fflate";
import type { PlatformSnapshot } from "../../domain/types";

const COMPRESSED_PREFIX = "zlib-base64:";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Serialize a browser snapshot compactly enough for realistic workbook imports. */
export function serializeSnapshot(snapshot: PlatformSnapshot): string {
  const json = JSON.stringify(snapshot);
  const compressed = zlibSync(strToU8(json), { level: 6 });
  return `${COMPRESSED_PREFIX}${bytesToBase64(compressed)}`;
}

/** Read both current compressed snapshots and legacy plain-JSON snapshots. */
export function deserializeSnapshot(value: string): PlatformSnapshot {
  const json = value.startsWith(COMPRESSED_PREFIX)
    ? strFromU8(unzlibSync(base64ToBytes(value.slice(COMPRESSED_PREFIX.length))))
    : value;
  return JSON.parse(json) as PlatformSnapshot;
}
