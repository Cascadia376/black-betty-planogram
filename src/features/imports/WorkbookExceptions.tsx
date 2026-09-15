import { useState } from "react";
import { Button, Card, inputClass } from "../../components/ui";
import type { FlyerWorkbookImportResult, FlyerWorkbookReviewRow } from "../../adapters/import/FlyerWorkbookImportAdapter";
import { resolveWorkbookRow } from "../../adapters/import/workbookReview";
import type { PlatformSnapshot, Product } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";

export function WorkbookExceptions({ result, data, onChange }: { result: FlyerWorkbookImportResult; data: PlatformSnapshot; onChange(result: FlyerWorkbookImportResult): void }) {
  return <Card><h2 className="font-semibold">Exceptions first — review before Apply</h2><p className="my-2 text-sm">Only exact active SKUs are eligible. Display alternatives require approval after Apply; no supplier-by-supplier upload is needed.</p>
    <p role="status">{result.rows.filter((row) => row.source.reviewedSku || row.source.reviewedDisplay).length} explicit row decisions recorded; original source cells and store cases retained.</p>
    {result.rows.filter((row) => row.status !== "information" && (row.status !== "ready" || hasRowDisplayException(row))).map((row) => <WorkbookRowException key={row.rowNumber} row={row} result={result} data={data} onChange={onChange} />)}
    <details className="mt-3"><summary className="cursor-pointer font-semibold">No-display / shelf-support ({result.rows.filter((row) => row.status === "ready" && rowIsShelfOnly(row)).length})</summary><p>Keep these products in regular shelf locations. No floor display will be assigned; store quantities are retained.</p>{result.rows.filter((row) => row.status === "ready" && rowIsShelfOnly(row)).map((row) => <p key={row.rowNumber}>{row.sku} · {row.productName} · {row.allocations.reduce((total, allocation) => total + allocation.quantityCases, 0)} cases across allocated stores</p>)}</details>
    <h3 className="mt-3 font-semibold">Suggested alternative requiring approval</h3><p className="text-sm">{result.placements.filter((item) => item.status === "SUGGESTED").length} store placements. Apply the reviewed draft, then approve each alternative on Campaign Review.</p>
    <h3 className="mt-3 font-semibold">Missing store display</h3><p className="text-sm">{result.placements.filter((item) => item.status === "NEEDS_REVIEW").length} store placements. Choose a permanent area or approve shelf support on Campaign Review.</p>
  </Card>;
}

function WorkbookRowException({ row, result, data, onChange }: { row: FlyerWorkbookReviewRow; result: FlyerWorkbookImportResult; data: PlatformSnapshot; onChange(result: FlyerWorkbookImportResult): void }) {
  const { productMaster } = usePlatform();
  const [code, setCode] = useState("");
  const [sku, setSku] = useState(row.sku);
  const [candidate, setCandidate] = useState<Product>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const approve = (decision: Parameters<typeof resolveWorkbookRow>[2]) => {
    try { onChange(resolveWorkbookRow(result, row.rowNumber, decision, data)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Decision could not be applied."); }
  };
  const lookup = async () => {
    setBusy(true); setError(""); setCandidate(undefined);
    try {
      const normalized = sku.trim().toUpperCase();
      if (!normalized || normalized === "TBD" || normalized.includes("/")) throw new Error("Enter one exact SKU, not a name or compound SKU.");
      const matches = await productMaster.findByExactSkus([normalized]);
      const product = matches.products.find((item) => item.sku.trim().toUpperCase() === normalized && item.active);
      if (matches.ambiguousSkus.includes(normalized)) throw new Error("Multiple exact records: ask the catalog owner to resolve them.");
      if (!product) throw new Error(matches.inactiveSkus?.includes(normalized) ? "This SKU is inactive. Ask the catalog owner for the correct active SKU." : "No active exact match. Confirm the SKU with the catalog owner.");
      setCandidate(product);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Lookup failed."); }
    finally { setBusy(false); }
  };
  const productException = row.status !== "ready";
  return <article className="mt-3 rounded border border-border p-3 text-sm">
    <h3 className="font-semibold">{productException ? row.status === "inactive" ? "Inactive SKU" : row.status === "unmatched" ? "Unmatched SKU" : "Source row requires correction" : hasRowDisplayException(row) ? "Missing display code" : "No-display / shelf-support"} · row {row.rowNumber}</h3>
    <p>{row.sku || "No SKU"} · {row.productName}</p>
    {productException ? <>
      <p>Confirm the exact SKU with the source owner. Original SKU and case allocations are retained.</p>
      <label>Exact SKU for row {row.rowNumber}<input className={inputClass} value={sku} onChange={(e) => { setSku(e.target.value); setCandidate(undefined); }} /></label>
      <Button disabled={busy} onClick={() => void lookup()}>Look up exact SKU</Button>
      {candidate && <div role="status"><p>Exact active match: {candidate.sku} · {candidate.name}</p><Button onClick={() => approve({ kind: "product", product: candidate })}>Approve exact product for row {row.rowNumber}</Button></div>}
      {row.issues.some((item) => item.code === "invalid_case_quantity") && <p>Correct the invalid case quantity in the original workbook and upload it again before Apply.</p>}
    </> : hasRowDisplayException(row) ? <>
      <label>Cross-store code for row {row.rowNumber}<input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} placeholder="W8 or BR2" /></label>
      <div className="mt-2 flex gap-2"><Button disabled={!code.trim()} onClick={() => approve({ kind: "display", code })}>Approve display code</Button><Button onClick={() => approve({ kind: "display" })}>Approve shelf support</Button></div>
    </> : <p>Regular shelf support; quantities retained. No floor display will be assigned.</p>}
    {error && <p role="alert" className="text-error">{error}</p>}
  </article>;
}

function hasRowDisplayException(row: FlyerWorkbookReviewRow) {
  return row.displayRequired && row.allocations.some((allocation) => allocation.displayRequired && !allocation.displayLocalCode);
}

function rowIsShelfOnly(row: FlyerWorkbookReviewRow) {
  return !row.displayRequired || row.allocations.every((allocation) => !allocation.displayRequired);
}
