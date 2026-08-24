import type { PlatformSnapshot } from "../../domain/types";

export const IDS = {
  store: "10000000-0000-4000-8000-000000000001",
  zoneEntrance: "20000000-0000-4000-8000-000000000001",
  zoneBeer: "20000000-0000-4000-8000-000000000002",
  zoneWine: "20000000-0000-4000-8000-000000000003",
  fixtureEndcaps: "30000000-0000-4000-8000-000000000001",
  fixtureCooler: "30000000-0000-4000-8000-000000000002",
  fixtureFeature: "30000000-0000-4000-8000-000000000003",
  endcapA: "40000000-0000-4000-8000-000000000001",
  endcapB: "40000000-0000-4000-8000-000000000002",
  cooler14: "40000000-0000-4000-8000-000000000003",
  feature1: "40000000-0000-4000-8000-000000000004",
  beerCampaign: "50000000-0000-4000-8000-000000000001",
  seasonalCampaign: "50000000-0000-4000-8000-000000000002",
  summerCampaign: "50000000-0000-4000-8000-000000000003",
  beerAssignment: "60000000-0000-4000-8000-000000000001",
  seasonalAssignment: "60000000-0000-4000-8000-000000000002",
  summerAssignment: "60000000-0000-4000-8000-000000000003",
  beerExecution: "70000000-0000-4000-8000-000000000001",
  seasonalExecution: "70000000-0000-4000-8000-000000000002",
  summerExecution: "70000000-0000-4000-8000-000000000003",
} as const;

export const seedSnapshot: PlatformSnapshot = {
  stores: [{ id: IDS.store, name: "Crown Isle", code: "CI", address: "Courtenay, BC" }],
  zones: [
    { id: IDS.zoneEntrance, storeId: IDS.store, name: "Front feature", category: "Promotional", geometry: { x: 0.04, y: 0.06, width: 0.22, height: 0.36 } },
    { id: IDS.zoneBeer, storeId: IDS.store, name: "Beer & cooler", category: "Beer", geometry: { x: 0.7, y: 0.06, width: 0.26, height: 0.88 } },
    { id: IDS.zoneWine, storeId: IDS.store, name: "Wine gondolas", category: "Wine", geometry: { x: 0.3, y: 0.18, width: 0.34, height: 0.66 } },
  ],
  fixtures: [
    { id: IDS.fixtureEndcaps, storeId: IDS.store, zoneId: IDS.zoneWine, name: "Central gondola endcaps", type: "gondola", geometry: { x: 0.33, y: 0.22, width: 0.26, height: 0.56 } },
    { id: IDS.fixtureCooler, storeId: IDS.store, zoneId: IDS.zoneBeer, name: "Beer cooler perimeter", type: "cooler", geometry: { x: 0.74, y: 0.1, width: 0.18, height: 0.78 } },
    { id: IDS.fixtureFeature, storeId: IDS.store, zoneId: IDS.zoneEntrance, name: "Front feature fixtures", type: "feature", geometry: { x: 0.08, y: 0.12, width: 0.12, height: 0.22 } },
  ],
  displayAreas: [
    { id: IDS.endcapA, storeId: IDS.store, zoneId: IDS.zoneWine, fixtureId: IDS.fixtureEndcaps, name: "Endcap A", type: "endcap", description: "North-facing endcap on the central wine gondola.", capacity: "Approx. 24 cases", geometry: { x: 0.315, y: 0.22, width: 0.035, height: 0.14 } },
    { id: IDS.endcapB, storeId: IDS.store, zoneId: IDS.zoneWine, fixtureId: IDS.fixtureEndcaps, name: "Endcap B", type: "endcap", description: "South-facing endcap on the central wine gondola.", capacity: "Approx. 20 cases", geometry: { x: 0.57, y: 0.64, width: 0.035, height: 0.14 } },
    { id: IDS.cooler14, storeId: IDS.store, zoneId: IDS.zoneBeer, fixtureId: IDS.fixtureCooler, name: "Cooler Doors 1-4", type: "cooler_doors", description: "Four-door group at the start of the beer cooler run.", capacity: "4 cooler doors", geometry: { x: 0.87, y: 0.18, width: 0.045, height: 0.28 } },
    { id: IDS.feature1, storeId: IDS.store, zoneId: IDS.zoneEntrance, fixtureId: IDS.fixtureFeature, name: "Feature Area 1", type: "feature_table", description: "Front-of-store feature table visible from entry.", capacity: "Approx. 16 cases", geometry: { x: 0.1, y: 0.17, width: 0.09, height: 0.08 } },
  ],
  campaigns: [
    {
      id: IDS.beerCampaign, name: "September Beer Feature", type: "Monthly flyer",
      description: "Mock monthly feature highlighting local and import beer packs.", startDate: "2026-08-20", endDate: "2026-09-30",
      owner: "Merchandising Team", supplier: "Multiple suppliers", status: "active",
      products: [
        { id: "51000000-0000-4000-8000-000000000001", sku: "MOCK-1001", name: "Coastal Lager 12 Pack", category: "Beer", role: "Feature", required: true, minimumQuantity: 8, minimumFacings: 3 },
        { id: "51000000-0000-4000-8000-000000000002", sku: "MOCK-1002", name: "Island IPA 6 Pack", category: "Beer", role: "Core", required: true, minimumQuantity: 6, minimumFacings: 2 },
        { id: "51000000-0000-4000-8000-000000000003", sku: "MOCK-1003", name: "Pacific Pilsner 8 Pack", category: "Beer", role: "Supporting", required: false, minimumQuantity: 4, minimumFacings: 1 },
      ],
      requirement: { displayType: "endcap", priority: "high", signage: "September feature header card", minimumSpace: "One full endcap", executionNotes: "Feature Coastal Lager at eye level. Keep required products together.", prescriptive: false },
    },
    {
      id: IDS.seasonalCampaign, name: "Autumn Gathering", type: "Seasonal",
      description: "Mock seasonal table for fall entertaining.", startDate: "2026-10-01", endDate: "2026-11-15",
      owner: "Buying Team", supplier: "Multiple suppliers", status: "scheduled",
      products: [{ id: "52000000-0000-4000-8000-000000000001", sku: "MOCK-2001", name: "Harvest Red Blend", category: "Wine", role: "Feature", required: true, minimumQuantity: 12, minimumFacings: 3 }],
      requirement: { displayType: "feature_table", priority: "standard", signage: "Autumn Gathering sign", minimumSpace: "One feature table", executionNotes: "Use warm seasonal signage and preserve clear customer access.", prescriptive: false },
    },
    {
      id: IDS.summerCampaign, name: "Summer Refresh", type: "Seasonal",
      description: "Completed mock campaign used for display history.", startDate: "2026-06-01", endDate: "2026-07-15",
      owner: "Merchandising Team", supplier: "Multiple suppliers", status: "completed",
      products: [{ id: "53000000-0000-4000-8000-000000000001", sku: "MOCK-3001", name: "Citrus Cooler Variety", category: "Ready to drink", role: "Feature", required: true, minimumQuantity: 10, minimumFacings: 4 }],
      requirement: { displayType: "endcap", priority: "high", signage: "Summer Refresh header", minimumSpace: "One full endcap", executionNotes: "Keep product chilled where possible.", prescriptive: false },
    },
  ],
  assignments: [
    { id: IDS.beerAssignment, campaignId: IDS.beerCampaign, storeId: IDS.store, displayAreaId: IDS.endcapA, effectiveDate: "2026-08-20", compatibility: "compatible", notes: "Pilot execution at Crown Isle." },
    { id: IDS.seasonalAssignment, campaignId: IDS.seasonalCampaign, storeId: IDS.store, displayAreaId: IDS.feature1, effectiveDate: "2026-10-01", compatibility: "compatible", notes: "Prepare after September feature changeover." },
    { id: IDS.summerAssignment, campaignId: IDS.summerCampaign, storeId: IDS.store, displayAreaId: IDS.endcapA, effectiveDate: "2026-06-01", compatibility: "compatible", notes: "Historical mock assignment." },
  ],
  executions: [
    { id: IDS.beerExecution, assignmentId: IDS.beerAssignment, dueDate: "2026-08-28", status: "in_progress" },
    { id: IDS.seasonalExecution, assignmentId: IDS.seasonalAssignment, dueDate: "2026-09-29", status: "not_started" },
    { id: IDS.summerExecution, assignmentId: IDS.summerAssignment, dueDate: "2026-06-01", status: "completed", submission: { id: "71000000-0000-4000-8000-000000000003", executionId: IDS.summerExecution, submittedAt: "2026-06-01T17:20:00Z", photoName: "summer-refresh-mock.jpg", note: "Completed with approved local spacing.", unavailableSkus: [], substitutionRequested: false } },
  ],
  complianceReviews: [{ id: "80000000-0000-4000-8000-000000000003", executionId: IDS.summerExecution, reviewer: "Operations Review", reviewedAt: "2026-06-02T16:00:00Z", decision: "approved", score: 100, checks: [{ key: "products", label: "Required products present", passed: true, required: true }, { key: "signage", label: "Required signage present", passed: true, required: true }, { key: "prominence", label: "Feature product is prominent", passed: true, required: true }], comment: "Mock review: execution met requirements." }],
  performance: [
    { id: "90000000-0000-4000-8000-000000000001", campaignId: IDS.summerCampaign, storeId: IDS.store, displayAreaId: IDS.endcapA, periodStart: "2026-06-01", periodEnd: "2026-07-15", salesLiftPercent: 14.2, grossMarginLift: 1260, unitLiftPercent: 12.5, compliancePercent: 100, outOfStockRate: 0.11, weeksOfSupply: 3.2, agedInventoryPercent: 0.03 },
    { id: "90000000-0000-4000-8000-000000000002", campaignId: IDS.summerCampaign, storeId: IDS.store, displayAreaId: IDS.endcapB, periodStart: "2026-06-01", periodEnd: "2026-07-15", salesLiftPercent: 0.8, grossMarginLift: 90, unitLiftPercent: 0.5, compliancePercent: 86, outOfStockRate: 0.01, weeksOfSupply: 11.4, agedInventoryPercent: 0.24 },
  ],
  recommendations: [
    { id: "a0000000-0000-4000-8000-000000000001", displayAreaId: IDS.endcapA, campaignId: IDS.summerCampaign, title: "Increase space or replenishment frequency", rationale: "High unit lift coincided with repeated stockouts during the measured Summer Refresh period.", rule: "increase_space", status: "open" },
    { id: "a0000000-0000-4000-8000-000000000002", displayAreaId: IDS.endcapB, campaignId: IDS.summerCampaign, title: "Review aging inventory", rationale: "High weeks of supply and aged inventory were observed together in mock data.", rule: "aging_inventory", status: "open" },
  ],
  history: [{ id: "b0000000-0000-4000-8000-000000000001", displayAreaId: IDS.endcapA, campaignId: IDS.summerCampaign, assignmentId: IDS.summerAssignment, executionId: IDS.summerExecution, startDate: "2026-06-01", endDate: "2026-07-15" }],
};

