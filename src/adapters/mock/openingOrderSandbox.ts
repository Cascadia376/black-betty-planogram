import type { PlatformSnapshot, Product } from "../../domain/types";
import { IDS, seedSnapshot } from "./seed";

export const OPENING_ORDER_SANDBOX_IDS = {
  partialStockProduct: "sandbox-order-product-partial",
  inboundCoveredProduct: "sandbox-order-product-inbound",
  reservedStockProduct: "sandbox-order-product-reserved",
  zeroStockProduct: "sandbox-order-product-zero",
  alternateSupplierProduct: "sandbox-order-product-alternate",
  forecastMultipleProduct: "sandbox-order-product-forecast-multiple",
} as const;

const sandboxProducts: Product[] = [
  {
    id: OPENING_ORDER_SANDBOX_IDS.partialStockProduct,
    sku: "TEST-OND-4001",
    name: "TEST Partial Stock Feature",
    category: "Wine",
    packageSize: "750 mL",
    casePack: 6,
    masterStatus: "verified",
    active: true,
    synthetic: true,
    notes: "Opening-order sandbox: partial on-hand stock; late inbound must not reduce the Sep 24 order.",
  },
  {
    id: OPENING_ORDER_SANDBOX_IDS.inboundCoveredProduct,
    sku: "TEST-OND-4002",
    name: "TEST Inbound Covered Feature",
    category: "Beer",
    packageSize: "12 x 355 mL",
    casePack: 2,
    masterStatus: "verified",
    active: true,
    synthetic: true,
    notes: "Opening-order sandbox: confirmed inbound arrives before the Oct 1 display requirement.",
  },
  {
    id: OPENING_ORDER_SANDBOX_IDS.reservedStockProduct,
    sku: "TEST-OND-4003",
    name: "TEST Reserved Stock Feature",
    category: "Spirits",
    packageSize: "750 mL",
    casePack: 6,
    masterStatus: "verified",
    active: true,
    synthetic: true,
    notes: "Opening-order sandbox: reserved stock is excluded from usable on-hand inventory.",
  },
  {
    id: OPENING_ORDER_SANDBOX_IDS.zeroStockProduct,
    sku: "TEST-OND-4004",
    name: "TEST Zero Stock Feature",
    category: "Ready to drink",
    packageSize: "12 x 355 mL",
    casePack: 2,
    masterStatus: "verified",
    active: true,
    synthetic: true,
    notes: "Opening-order sandbox: zero on hand and no inbound.",
  },
  {
    id: OPENING_ORDER_SANDBOX_IDS.alternateSupplierProduct,
    sku: "TEST-OND-4005",
    name: "TEST Alternate Supplier Feature",
    category: "Cider",
    packageSize: "6 x 355 mL",
    casePack: 6,
    masterStatus: "verified",
    active: true,
    synthetic: true,
    notes: "Opening-order sandbox: preferred supplier is unavailable; alternate supplier can meet Oct 1.",
  },
  {
    id: OPENING_ORDER_SANDBOX_IDS.forecastMultipleProduct,
    sku: "TEST-OND-4006",
    name: "TEST Forecast + Multiple Feature",
    category: "Wine",
    packageSize: "750 mL",
    casePack: 6,
    masterStatus: "verified",
    active: true,
    synthetic: true,
    notes: "Opening-order sandbox: realistic pre-launch demand plus a four-case purchasing multiple.",
  },
];

export function buildOpeningOrderSandboxSnapshot(): PlatformSnapshot {
  const data = structuredClone(seedSnapshot);
  const scenarioProductIds = new Set<string>([
    IDS.ondHarvestProduct,
    IDS.ondBridgeProduct,
    IDS.ondHolidayProduct,
    IDS.ondExitProduct,
    IDS.ondCiderProduct,
    ...Object.values(OPENING_ORDER_SANDBOX_IDS),
  ]);
  const assignmentIds = new Set([
    IDS.ondEndcapAEarlyAssignment,
    IDS.ondFeatureAssignment,
    IDS.ondCoolerAssignment,
  ]);

  data.products = [
    ...data.products.filter((product) => !sandboxProducts.some((sandbox) => sandbox.id === product.id)),
    ...sandboxProducts,
  ];

  data.displayAssignments = [
    ...data.displayAssignments.filter((assignment) => !(assignment.programId === IDS.ondProgram && assignment.storeId === IDS.store)),
    {
      id: IDS.ondEndcapAEarlyAssignment,
      programId: IDS.ondProgram,
      periodId: IDS.ondEarlyPeriod,
      storeId: IDS.store,
      displayAreaId: IDS.endcapA,
      startDate: "2026-10-01",
      endDate: "2026-11-11",
      resetRequired: true,
      notes: "TEST opening-order scenario · coverage, late inbound, and reserved stock.",
      status: "planned",
    },
    {
      id: IDS.ondFeatureAssignment,
      programId: IDS.ondProgram,
      periodId: IDS.ondEarlyPeriod,
      storeId: IDS.store,
      displayAreaId: IDS.feature1,
      startDate: "2026-10-01",
      endDate: "2026-11-11",
      resetRequired: true,
      notes: "TEST opening-order scenario · zero stock, alternate supplier, and at-risk supply.",
      status: "planned",
    },
    {
      id: IDS.ondCoolerAssignment,
      programId: IDS.ondProgram,
      periodId: IDS.ondEarlyPeriod,
      storeId: IDS.store,
      displayAreaId: IDS.cooler14,
      startDate: "2026-10-01",
      endDate: "2026-11-11",
      resetRequired: true,
      notes: "TEST opening-order scenario · bridge buy, high stock, and exit control.",
      status: "planned",
    },
  ];

  data.displayAssignmentProducts = [
    ...data.displayAssignmentProducts.filter((product) => !assignmentIds.has(product.assignmentId)),
    {
      id: "sandbox-order-line-01",
      assignmentId: IDS.ondEndcapAEarlyAssignment,
      productId: IDS.ondHarvestProduct,
      sku: "MOCK-OND-1001",
      caseQuantity: 12,
      required: true,
      preferredSupplierId: IDS.ondPreferredSupplier,
      note: "TEST exact coverage: 12 required / 12 usable on hand.",
    },
    {
      id: "sandbox-order-line-02",
      assignmentId: IDS.ondEndcapAEarlyAssignment,
      productId: OPENING_ORDER_SANDBOX_IDS.partialStockProduct,
      sku: "TEST-OND-4001",
      caseQuantity: 8,
      required: true,
      preferredSupplierId: IDS.ondPreferredSupplier,
      note: "TEST partial coverage: 8 required / 2 on hand / 3 inbound after required date.",
    },
    {
      id: "sandbox-order-line-03",
      assignmentId: IDS.ondEndcapAEarlyAssignment,
      productId: OPENING_ORDER_SANDBOX_IDS.inboundCoveredProduct,
      sku: "TEST-OND-4002",
      caseQuantity: 10,
      required: true,
      preferredSupplierId: IDS.ondPreferredSupplier,
      note: "TEST inbound coverage: 10 required / 4 on hand / 6 inbound before required date.",
    },
    {
      id: "sandbox-order-line-04",
      assignmentId: IDS.ondEndcapAEarlyAssignment,
      productId: OPENING_ORDER_SANDBOX_IDS.reservedStockProduct,
      sku: "TEST-OND-4003",
      caseQuantity: 6,
      required: true,
      preferredSupplierId: IDS.ondPreferredSupplier,
      note: "TEST reserved stock: 6 on hand but 2 reserved.",
    },
    {
      id: "sandbox-order-line-05",
      assignmentId: IDS.ondFeatureAssignment,
      productId: OPENING_ORDER_SANDBOX_IDS.zeroStockProduct,
      sku: "TEST-OND-4004",
      caseQuantity: 4,
      required: true,
      preferredSupplierId: IDS.ondPreferredSupplier,
      note: "TEST zero stock: order the full display requirement.",
    },
    {
      id: "sandbox-order-line-06",
      assignmentId: IDS.ondFeatureAssignment,
      productId: OPENING_ORDER_SANDBOX_IDS.alternateSupplierProduct,
      sku: "TEST-OND-4005",
      caseQuantity: 7,
      required: true,
      note: "TEST supplier fallback: preferred unavailable, alternate can meet required date.",
    },
    {
      id: "sandbox-order-line-06b",
      assignmentId: IDS.ondFeatureAssignment,
      productId: OPENING_ORDER_SANDBOX_IDS.forecastMultipleProduct,
      sku: "TEST-OND-4006",
      caseQuantity: 8,
      required: true,
      preferredSupplierId: IDS.ondPreferredSupplier,
      note: "TEST forecast + multiple: 8 display cases + 4 forecast cases - 2 usable on hand = 10 raw, rounded to 12.",
    },
    {
      id: "sandbox-order-line-07",
      assignmentId: IDS.ondFeatureAssignment,
      productId: IDS.ondCiderProduct,
      sku: "MOCK-OND-3001",
      caseQuantity: 5,
      required: true,
      preferredSupplierId: IDS.ondPreferredSupplier,
      note: "TEST at risk: configured supplier cannot meet required date and no alternate exists.",
    },
    {
      id: "sandbox-order-line-08",
      assignmentId: IDS.ondCoolerAssignment,
      productId: IDS.ondBridgeProduct,
      sku: "MOCK-OND-1002",
      caseQuantity: 8,
      required: true,
      preferredSupplierId: IDS.ondPreferredSupplier,
      note: "TEST intentional bridge: central bridge strategy can increase order above opening-fill need.",
    },
    {
      id: "sandbox-order-line-09",
      assignmentId: IDS.ondCoolerAssignment,
      productId: IDS.ondHolidayProduct,
      sku: "MOCK-OND-2001",
      caseQuantity: 9,
      required: true,
      preferredSupplierId: IDS.ondPreferredSupplier,
      note: "TEST high stock: on hand exceeds display requirement.",
    },
    {
      id: "sandbox-order-line-10",
      assignmentId: IDS.ondCoolerAssignment,
      productId: IDS.ondExitProduct,
      sku: "MOCK-OND-EXIT-01",
      caseQuantity: 6,
      required: true,
      preferredSupplierId: IDS.ondPreferredSupplier,
      note: "TEST exit control: recommendation is forced to zero.",
    },
  ];

  data.supplierProductOptions = [
    ...data.supplierProductOptions.filter((option) => !Object.values(OPENING_ORDER_SANDBOX_IDS).includes(option.productId as never)),
    {
      productId: OPENING_ORDER_SANDBOX_IDS.partialStockProduct,
      supplierId: IDS.ondPreferredSupplier,
      supplierName: "Mock Coastal Distribution",
      preferred: true,
      leadTimeDays: 5,
      orderDays: ["Monday", "Thursday"],
      casePack: 6,
      availability: "available",
    },
    {
      productId: OPENING_ORDER_SANDBOX_IDS.inboundCoveredProduct,
      supplierId: IDS.ondPreferredSupplier,
      supplierName: "Mock Coastal Distribution",
      preferred: true,
      leadTimeDays: 5,
      orderDays: ["Monday", "Thursday"],
      casePack: 2,
      availability: "available",
    },
    {
      productId: OPENING_ORDER_SANDBOX_IDS.reservedStockProduct,
      supplierId: IDS.ondPreferredSupplier,
      supplierName: "Mock Coastal Distribution",
      preferred: true,
      leadTimeDays: 5,
      orderDays: ["Monday", "Thursday"],
      casePack: 6,
      availability: "available",
    },
    {
      productId: OPENING_ORDER_SANDBOX_IDS.zeroStockProduct,
      supplierId: IDS.ondPreferredSupplier,
      supplierName: "Mock Coastal Distribution",
      preferred: true,
      leadTimeDays: 5,
      orderDays: ["Monday", "Thursday"],
      casePack: 2,
      availability: "available",
    },
    {
      productId: OPENING_ORDER_SANDBOX_IDS.alternateSupplierProduct,
      supplierId: IDS.ondPreferredSupplier,
      supplierName: "Mock Coastal Distribution",
      preferred: true,
      leadTimeDays: 4,
      orderDays: ["Monday", "Thursday"],
      casePack: 6,
      availability: "unavailable",
    },
    {
      productId: OPENING_ORDER_SANDBOX_IDS.alternateSupplierProduct,
      supplierId: IDS.ondAlternateSupplier,
      supplierName: "Mock Island Wholesale",
      preferred: false,
      leadTimeDays: 6,
      orderDays: ["Tuesday"],
      casePack: 6,
      availability: "available",
    },
    {
      productId: OPENING_ORDER_SANDBOX_IDS.forecastMultipleProduct,
      supplierId: IDS.ondPreferredSupplier,
      supplierName: "Mock Coastal Distribution",
      preferred: true,
      leadTimeDays: 5,
      orderDays: ["Monday", "Thursday"],
      casePack: 6,
      orderMultipleCases: 4,
      availability: "available",
    },
  ];

  data.inventoryPositions = [
    ...data.inventoryPositions.filter((position) => !(position.storeId === IDS.store && scenarioProductIds.has(position.productId))),
    { storeId: IDS.store, productId: IDS.ondHarvestProduct, onHandCases: 12, updatedAt: "2026-09-24T16:00:00Z" },
    { storeId: IDS.store, productId: OPENING_ORDER_SANDBOX_IDS.partialStockProduct, onHandCases: 2, updatedAt: "2026-09-24T16:00:00Z" },
    { storeId: IDS.store, productId: OPENING_ORDER_SANDBOX_IDS.inboundCoveredProduct, onHandCases: 4, updatedAt: "2026-09-24T16:00:00Z" },
    { storeId: IDS.store, productId: OPENING_ORDER_SANDBOX_IDS.reservedStockProduct, onHandCases: 6, reservedCases: 2, updatedAt: "2026-09-24T16:00:00Z" },
    { storeId: IDS.store, productId: OPENING_ORDER_SANDBOX_IDS.zeroStockProduct, onHandCases: 0, updatedAt: "2026-09-24T16:00:00Z" },
    { storeId: IDS.store, productId: OPENING_ORDER_SANDBOX_IDS.alternateSupplierProduct, onHandCases: 0, updatedAt: "2026-09-24T16:00:00Z" },
    { storeId: IDS.store, productId: OPENING_ORDER_SANDBOX_IDS.forecastMultipleProduct, onHandCases: 2, updatedAt: "2026-09-24T16:00:00Z" },
    { storeId: IDS.store, productId: IDS.ondCiderProduct, onHandCases: 0, updatedAt: "2026-09-24T16:00:00Z" },
    { storeId: IDS.store, productId: IDS.ondBridgeProduct, onHandCases: 2, updatedAt: "2026-09-24T16:00:00Z" },
    { storeId: IDS.store, productId: IDS.ondHolidayProduct, onHandCases: 20, updatedAt: "2026-09-24T16:00:00Z" },
    { storeId: IDS.store, productId: IDS.ondExitProduct, onHandCases: 0, updatedAt: "2026-09-24T16:00:00Z" },
  ];

  data.inboundOrders = [
    ...data.inboundOrders.filter((order) => !(order.storeId === IDS.store && scenarioProductIds.has(order.productId))),
    {
      id: "sandbox-order-inbound-late",
      storeId: IDS.store,
      productId: OPENING_ORDER_SANDBOX_IDS.partialStockProduct,
      supplierId: IDS.ondPreferredSupplier,
      cases: 3,
      expectedArrivalDate: "2026-10-02",
      status: "confirmed",
    },
    {
      id: "sandbox-order-inbound-cover",
      storeId: IDS.store,
      productId: OPENING_ORDER_SANDBOX_IDS.inboundCoveredProduct,
      supplierId: IDS.ondPreferredSupplier,
      cases: 6,
      expectedArrivalDate: "2026-09-29",
      status: "confirmed",
    },
  ];

  data.historicalDemand = [
    ...data.historicalDemand.filter((record) => !record.productId || !scenarioProductIds.has(record.productId)),
    ...[...scenarioProductIds].map((productId, index) => ({
      id: `sandbox-order-history-${String(index + 1).padStart(2, "0")}`,
      storeId: IDS.store,
      productId,
      category: data.products.find((product) => product.id === productId)?.category,
      date: "2025-10-15",
      cases: productId === OPENING_ORDER_SANDBOX_IDS.forecastMultipleProduct ? 0.5 : 0,
    })),
  ];

  data.orderRecommendations = data.orderRecommendations.filter((recommendation) => recommendation.storeId !== IDS.store);
  data.purchaseOrders = data.purchaseOrders.filter((order) => order.storeId !== IDS.store);

  const crownStore = data.programStores.find((item) => item.programId === IDS.ondProgram && item.storeId === IDS.store);
  if (crownStore) {
    crownStore.included = true;
    crownStore.status = "planning";
  }
  const program = data.programs.find((item) => item.id === IDS.ondProgram);
  if (program) {
    program.status = "planned";
    program.description = "TEST opening-order sandbox with controlled purchasing, forecast, and rounding scenarios.";
  }

  return data;
}
