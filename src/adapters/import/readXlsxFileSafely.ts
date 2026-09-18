import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import readXlsxFile from "read-excel-file";

type ReadOptions = { sheet?: string | number };

/**
 * Reads workbook rows while tolerating empty inline-string cells emitted by
 * otherwise valid XLSX writers. `read-excel-file` rejects those cells when
 * they omit the optional `<is><t /></is>` payload, even though they represent
 * the same blank value as an omitted cell.
 */
export async function readXlsxFileSafely(file: Blob, options?: ReadOptions): Promise<unknown[][]> {
  try {
    return await readXlsxFile(file, options);
  } catch (cause) {
    if (!(cause instanceof Error) || !cause.message.includes('Unsupported "inline string" cell value structure')) throw cause;
    return await readXlsxFile(await normalizeEmptyInlineStrings(file), options);
  }
}

async function normalizeEmptyInlineStrings(file: Blob): Promise<Blob> {
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  let changed = false;

  for (const [path, bytes] of Object.entries(archive)) {
    if (!/^xl\/worksheets\/.*\.xml$/i.test(path)) continue;
    const source = strFromU8(bytes);
    const normalized = source
      .replace(/<((?:[\w.-]+:)?c)\b([^>]*\bt\s*=\s*(["'])inlineStr\3[^>]*)\/>/gi, (_match, tag: string, attributes: string) => {
        changed = true;
        return `<${tag}${toBlankCellType(attributes)}></${tag}>`;
      })
      .replace(/<((?:[\w.-]+:)?c)\b([^>]*\bt\s*=\s*(["'])inlineStr\3[^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag: string, attributes: string, _quote: string, content: string) => {
        if (/<(?:[\w.-]+:)?t\b/i.test(content)) return match;
        changed = true;
        return `<${tag}${toBlankCellType(attributes)}></${tag}>`;
      });
    if (normalized !== source) archive[path] = strToU8(normalized);
  }

  if (!changed) throw new Error("The workbook contains an unsupported inline-string cell that could not be normalized safely.");
  const normalizedArchive = Uint8Array.from(zipSync(archive));
  return new Blob([normalizedArchive.buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function toBlankCellType(attributes: string): string {
  return attributes.replace(/\bt\s*=\s*(["'])inlineStr\1/i, 't="z"');
}
