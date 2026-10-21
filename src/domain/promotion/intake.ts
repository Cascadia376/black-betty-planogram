import type { ProductMasterLookup } from "../../services/products/ProductMasterLookup";
import { normalizeProductSku } from "../../services/products/ProductMasterLookup";
import { sourceInputSchema, validateExtraction, type SourceInput, type Extraction, type Claim, type IntelligenceWorkspace, type IntelligenceOpportunity, type ReviewStatus } from "./schema";

export async function sourceFingerprint(text: string, context?: Pick<SourceInput, "supplier" | "date">): Promise<string> {
  const normalized = text.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ text: normalized, supplier: context?.supplier.trim().toLowerCase() ?? "", date: context?.date ?? "" }))))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function literalValue(claims: Claim[], field: Claim["field"]): string | undefined {
  const values = [...new Set(claims.filter((c) => c.field === field && c.kind !== "inference" && c.kind !== "buyer_judgement").map((c) => c.value))];
  return values.length === 1 ? values[0] : undefined;
}
export function materialGaps(claims: Claim[]): string[] {
  const gaps = ["productName", "sku", "price", "cost", "dates"].filter((field) => !literalValue(claims, field as Claim["field"])).map((field) => `Missing or conflicting ${field}`);
  for (const field of new Set(claims.map((c) => c.field))) {
    if (!["action", "question", "buyerComment"].includes(field) && new Set(claims.filter((c) => c.field === field && c.kind !== "inference").map((c) => c.value)).size > 1) gaps.push(`Conflicting ${field}: buyer correction required`);
  }
  return [...new Set(gaps)];
}
export async function ingestSource(workspace: IntelligenceWorkspace, raw: SourceInput, output: Extraction, mode: "demo" | "model", actor: string): Promise<IntelligenceWorkspace> {
  const input = sourceInputSchema.parse(raw);
  const fingerprint = await sourceFingerprint(input.text, input);
  if (workspace.sources.some((s) => s.fingerprint === fingerprint)) return workspace;
  const extracted = validateExtraction(output, input.text);
  const next = structuredClone(workspace);
  const source = { ...input, id: crypto.randomUUID(), fingerprint, createdAt: new Date().toISOString(), mode };
  next.sources.push(source);
  for (const entry of extracted.opportunities) {
    const claims = entry.claims.map((claim) => ({ ...claim, sourceId: source.id }));
    const item: IntelligenceOpportunity = {
      id: crypto.randomUUID(), sourceSubmissionId: source.id, productName: literalValue(claims, "productName") ?? "Unresolved product",
      supplierSku: literalValue(claims, "sku"), supplier: literalValue(claims, "supplier") ?? input.supplier,
      promotionEvidence: {}, commercialTerms: {}, merchandisingRequest: {}, availability: {}, supplierEvidence: {},
      status: "NEEDS_REVIEW", createdAt: source.createdAt, updatedAt: source.createdAt,
      provenance: { formatId: "promotion-intelligence-v1", workbookName: source.title, workbookSha256: fingerprint, sheet: input.kind, row: 1, importedAt: source.createdAt, sourceValues: {}, normalizedValues: {}, productMatchMethod: "NOT_ATTEMPTED", issues: [] },
      intelligence: { claims, missing: [...new Set([...entry.missing, ...materialGaps(claims)])], owner: actor, resolution: "UNMATCHED", history: [{ at: source.createdAt, actor, action: `Captured ${mode} extraction` }] },
    };
    next.opportunities.push(item);
  }
  return next;
}
export async function reconcileOpportunity(item: IntelligenceOpportunity, lookup: ProductMasterLookup): Promise<IntelligenceOpportunity> {
  const next = structuredClone(item);
  next.productId = undefined; next.authoritativeSku = undefined; next.intelligence.productEvidence = undefined;
  const sku = normalizeProductSku(next.supplierSku);
  const result = sku ? await lookup.findByExactSkus([sku]) : { products: [], ambiguousSkus: [] };
  const products = result.products.filter((p) => normalizeProductSku(p.sku) === sku);
  const resolution = result.ambiguousSkus.includes(sku) || products.length > 1 ? "AMBIGUOUS" : result.inactiveSkus?.includes(sku) ? "INACTIVE" : products.length === 1 ? !products[0].active ? "INACTIVE" : products[0].masterStatus !== "verified" ? "PENDING" : "MATCHED" : "UNMATCHED";
  next.intelligence.resolution = resolution;
  if (resolution === "MATCHED") { next.productId = products[0].id; next.authoritativeSku = products[0].sku; next.authoritativeCategory = products[0].category; next.intelligence.productEvidence = { description: [products[0].name, products[0].packageSize, "Active · verified"].filter(Boolean).join(" · "), checkedAt: new Date().toISOString() }; }
  return next;
}
export function reviewOpportunity(item: IntelligenceOpportunity, patch: { productName: string; sku: string; supplier: string; comment: string; owner: string; status: ReviewStatus; corrections?: Partial<Record<Claim["field"], string>> }, actor: string): IntelligenceOpportunity {
  if (!patch.productName.trim() || patch.productName.length > 500 || patch.comment.length > 5000 || patch.sku.length > 100 || patch.supplier.length > 200 || patch.owner.length > 200) throw new Error("Review fields are missing or too long.");
  if (item.status === "ADDED_TO_CAMPAIGN" || item.intelligence.associatedWith) throw new Error("Linked history is read-only. Review a new source for a new offer.");
  if (patch.corrections && Object.values(patch.corrections).some((v) => v && v.length > 1500)) throw new Error("Corrections are too long.");
  const next = structuredClone(item);
  next.intelligence.corrections = patch.corrections;
  if (next.supplierSku !== patch.sku.trim()) { next.productId = undefined; next.authoritativeSku = undefined; next.intelligence.productEvidence = undefined; next.intelligence.resolution = "UNMATCHED"; next.intelligence.productEvidence = undefined; }
  next.productName = patch.productName.trim(); next.supplierSku = patch.sku.trim(); next.supplier = patch.supplier.trim(); next.jeremyComment = patch.comment; next.status = patch.status; next.intelligence.owner = patch.owner;
  next.updatedAt = new Date().toISOString();
  next.intelligence.history.push({ at: next.updatedAt, actor, action: "Buyer review", before: JSON.stringify({ productName: item.productName, sku: item.supplierSku, supplier: item.supplier, comment: item.jeremyComment, owner: item.intelligence.owner, status: item.status, corrections: item.intelligence.corrections }), after: JSON.stringify(patch) });
  return next;
}
export function duplicateCandidates(item: IntelligenceOpportunity, workspace: IntelligenceWorkspace): IntelligenceOpportunity[] {
  return workspace.opportunities.filter((o) => o.id !== item.id && !o.intelligence.associatedWith && ((item.supplierSku && normalizeProductSku(o.supplierSku) === normalizeProductSku(item.supplierSku)) || o.productName.toLowerCase() === item.productName.toLowerCase()));
}
export function associateEvidence(workspace: IntelligenceWorkspace, fromId: string, intoId: string, actor: string): IntelligenceWorkspace {
  const next = structuredClone(workspace);
  const from = next.opportunities.find((o) => o.id === fromId), into = next.opportunities.find((o) => o.id === intoId);
  if (!from || !into || from.id === into.id || from.intelligence.linkedCampaignId || into.intelligence.linkedCampaignId || into.intelligence.associatedWith) throw new Error("Choose two unlinked opportunities to associate.");
  if (from.intelligence.associatedWith === intoId) return workspace;
  if (from.intelligence.associatedWith) throw new Error("Evidence already associated elsewhere.");
  into.intelligence.claims.push(...from.intelligence.claims.filter((c) => !into.intelligence.claims.some((e) => JSON.stringify(e) === JSON.stringify(c))));
  into.intelligence.missing = materialGaps(into.intelligence.claims);
  into.status = "NEEDS_REVIEW"; into.productId = undefined; into.authoritativeSku = undefined; into.supplierSku = literalValue(into.intelligence.claims, "sku"); into.intelligence.resolution = "UNMATCHED";
  from.intelligence.associatedWith = intoId; from.status = "REJECTED";
  for (const item of [from, into]) item.intelligence.history.push({ at: new Date().toISOString(), actor, action: `Buyer associated ${fromId} with ${intoId}; terms require review` });
  return next;
}
export function deleteSource(workspace: IntelligenceWorkspace, sourceId: string, actor: string): IntelligenceWorkspace {
  const next = structuredClone(workspace), source = next.sources.find((s) => s.id === sourceId);
  if (!source) throw new Error("Source not found.");
  source.text = ""; source.title = "Deleted source"; source.representative = ""; source.supplier = ""; source.date = ""; source.deletedAt = new Date().toISOString();
  for (const o of next.opportunities.filter((o) => o.intelligence.claims.some((c) => c.sourceId === sourceId))) {
    o.intelligence.claims = o.intelligence.claims.filter((c) => c.sourceId !== sourceId);
    o.intelligence.corrections = undefined; o.intelligence.productEvidence = undefined;
    // Historical commercial decisions remain, but deleted source identity cannot qualify a current comparison.
    o.productId = undefined; o.authoritativeSku = undefined; o.authoritativeCategory = undefined; o.intelligence.resolution = "UNMATCHED";
    o.productName = "Source deleted"; o.supplier = ""; o.supplierSku = undefined; o.jeremyComment = undefined;
    o.intelligence.history = [{ at: source.deletedAt, actor, action: "Source and derived correspondence redacted; campaign references retained" }];
    o.intelligence.missing = ["Source deleted; evidence unavailable"];
    o.provenance.workbookName = "Deleted source";
    if (o.status !== "ADDED_TO_CAMPAIGN") o.status = "NEEDS_REVIEW";
  }
  return next;
}
