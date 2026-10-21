import { buildCommercialEvidence, canonicalRequest, observationDigest, observationTotals, type CommercialRequest, type SalesObservation, type SourceQualification } from "../../domain/promotion/commercial";
/** Explicit fixture, never a fallback for unavailable shared data. */
export async function syntheticCommercialEvidence(input: CommercialRequest) {
  const request = canonicalRequest(input), rows: SalesObservation[] = [];
  for (let day = Date.parse(request.start), index = 0; day <= Date.parse(request.end); day += 86400000, index++) {
    for (const storeId of request.storeIds) {
      const units = index % 17 === 0 ? -1 : 2 + storeId % 3;
      rows.push({ date: new Date(day).toISOString().slice(0, 10), storeId: String(storeId), units, revenue: units * 10, cost: units * 6 });
    }
  }
  const now = new Date().toISOString();
  const qualification: SourceQualification = {
    contractVersion: "ursus-commercial-source-v1", contractId: "SYNTHETIC-commercial-fixture", version: "1", sourceId: "public.productdailysales", sourceRevision: "SYNTHETIC-v1",
    approvedBy: "SYNTHETIC source-owner fixture", approvedAt: now, sourceAsOf: now, request, observedSha256: await observationDigest(request, rows),
    currency: "CAD", moneyScale: 2, units: "sellable-units", revenue: "net-merchandise-excluding-tax", cost: "signed-total-COGS", returns: "signed-net-including-returns",
    coverage: "all-store-days-including-explicit-zero", storeMappingVersion: "SYNTHETIC-canonical-store-map-v1",
    reconciliation: { reference: "SYNTHETIC independent control", version: "1", totals: observationTotals(rows, 2) },
  };
  return buildCommercialEvidence(request, rows, { qualification, mode: "synthetic", capturedAt: now });
}
