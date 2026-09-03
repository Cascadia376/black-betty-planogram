export type UUID = string;

export type UserRole = "admin" | "merchandising" | "operations" | "store_manager" | "read_only";
export type CampaignStatus = "draft" | "scheduled" | "active" | "completed";
export type MerchandisingProgramStatus = "draft" | "planned" | "active" | "completed" | "archived";
export type DisplayAssignmentStatus = "draft" | "planned" | "ready" | "active" | "completed" | "cancelled";
export type SupplierAvailability = "available" | "limited" | "unavailable" | "unknown";
export type InboundOrderStatus = "draft" | "submitted" | "confirmed" | "received" | "cancelled";
export type OrderRecommendationType = "opening_fill" | "replenishment" | "normal_replenishment" | "peak_build" | "bridge_buy" | "exit_control";
export type ProductInventoryStrategy = "EXIT" | "NORMAL_CARRY" | "BRIDGE_BUY";
export type ProductMasterStatus = "verified" | "pending" | "unresolved";
export type OrderRecommendationStatus = "pending" | "accepted" | "edited" | "dismissed" | "ordered";
export type ProgramStoreStatus = "not_started" | "planning" | "ready" | "published";
export type ProgramReleaseStatus = "published" | "superseded";
export type ExecutionTaskType = "initial_set" | "reset";
export type PurchaseOrderStatus = "draft" | "submitted" | "received" | "cancelled";
export type CampaignType =
  | "OND"
  | "Monthly flyer"
  | "Seasonal"
  | "Supplier feature"
  | "Category feature"
  | "New product"
  | "Clearance"
  | "Local initiative";
export type DisplayType =
  | "endcap"
  | "feature_display"
  | "seasonal_table"
  | "floor_stack"
  | "cooler_doors"
  | "window"
  | "checkout"
  | "contest_space"
  | "supplier_display"
  | "flex"
  | "other"
  // Legacy values remain valid while existing campaigns and screens migrate.
  | "feature_table"
  | "floor_display"
  | "seasonal_area";
export type DisplayAreaVerificationStatus = "unverified" | "verified";
export type DisplayFamily = "WINE" | "BEER_RTD" | "MULTI" | "SEASONAL" | "WINDOW" | "OTHER";
export type DisplaySizeClass = "mini" | "small" | "medium" | "large";
export type DisplayPositionClass = "front_end" | "back_end" | "feature_table" | "window" | "zone" | "other";
export type ProductRole = "Feature" | "Core" | "Supporting" | "Optional";
export type CampaignProductMerchandisingState = "UNASSIGNED" | "DISPLAY_ASSIGNED" | "SHELF_SUPPORTED";
export type CampaignDisplayPlacementMode = "STANDARD" | "STORE_SPECIFIC";
export type CampaignDisplayProductRole = "Hero" | "Supporting";
export type ExecutionStatus = "not_started" | "in_progress" | "completed" | "issue";
export type Compatibility = "compatible" | "requires_review" | "incompatible";
export type ReviewDecision = "approved" | "fix_requested" | "local_variation";

export interface Store {
  id: UUID;
  name: string;
  code: string;
  address: string;
}

export interface Product {
  id: UUID;
  sku: string;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  packageSize?: string;
  casePack?: number;
  supplierName?: string;
  supplierProductCode?: string;
  notes?: string;
  masterStatus: ProductMasterStatus;
  authoritativeProductId?: UUID;
  active: boolean;
  synthetic: boolean;
}

export interface StoreZone {
  id: UUID;
  storeId: UUID;
  name: string;
  category: string;
  geometry: Geometry;
}

export interface Fixture {
  id: UUID;
  storeId: UUID;
  zoneId: UUID;
  name: string;
  type: string;
  geometry: Geometry;
}

export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export type StoreLayoutStatus = "draft" | "current" | "archived";

export interface StoreLayout {
  id: UUID;
  storeId: UUID;
  name: string;
  effectiveDate?: string;
  status: StoreLayoutStatus;
  backgroundImageUrl?: string;
  backgroundAspectRatio?: number;
  sourceReference?: string;
  createdAt: string;
  updatedAt: string;
}

export type CategorySpaceFixtureType =
  | "gondola"
  | "perimeter_shelf"
  | "cooler"
  | "open_cooler"
  | "wall"
  | "cabinet"
  | "table"
  | "other";

/** A regular merchandise category home in one versioned store layout. */
export interface CategorySpace {
  id: UUID;
  storeId: UUID;
  layoutId: UUID;
  name: string;
  category: string;
  subcategory?: string;
  geometry?: Geometry;
  fixtureType?: CategorySpaceFixtureType;
  shelfWidthIn?: number;
  shelfDepthIn?: number;
  shelfCount?: number;
  maxFacings?: number;
  coolerDoorEquivalent?: number;
  notes?: string;
  active: boolean;
  source?: "FLOORPLAN" | "PLANOGRAM_WORKBOOK" | "COOLER_WORKBOOK" | "MANUAL";
}

/** Optional capacity detail for an irregular CategorySpace; not an individual shelf. */
export interface CategorySpaceSection {
  id: UUID;
  categorySpaceId: UUID;
  label?: string;
  shelfWidthIn?: number;
  shelfDepthIn?: number;
  shelfCount?: number;
  maxFacings?: number;
  coolerDoorEquivalent?: number;
  notes?: string;
  sortOrder: number;
}

export interface DisplayArea {
  id: UUID;
  displayNumber: string;
  code: string;
  storeId: UUID;
  zoneId?: UUID;
  fixtureId?: UUID;
  localCode?: string;
  name: string;
  type: DisplayType;
  displayFamily?: DisplayFamily;
  displayClassDefinitionId?: UUID;
  description: string;
  capacity: string;
  primaryCategory?: string;
  compatibleCategories?: string[];
  flexible?: boolean;
  geometry: Geometry;
  active: boolean;
  verificationStatus: DisplayAreaVerificationStatus;
  sourceReference?: string;
  notes?: string;
}

/** Shared naming taxonomy from Master Display Naming.xlsx. Legacy codes are intentionally non-unique. */
export interface DisplayClassDefinition {
  id: UUID;
  family: DisplayFamily;
  name: string;
  legacyCode?: string;
  sizeClass?: DisplaySizeClass;
  positionClass?: DisplayPositionClass;
  notes?: string;
}

/** An additional physical hotspot for one logical DisplayArea. */
export interface DisplayAreaSection {
  id: UUID;
  displayAreaId: UUID;
  geometry: Geometry;
  label?: string;
  sortOrder: number;
}

export interface CampaignProduct {
  id: UUID;
  campaignId?: UUID;
  productId: UUID;
  role: ProductRole;
  required: boolean;
  note?: string;
  merchandisingState?: CampaignProductMerchandisingState;
}

/** A reusable campaign merchandising concept; it is not a physical store DisplayArea. */
export interface CampaignDisplay {
  id: UUID;
  campaignId: UUID;
  name: string;
  displayType: DisplayType;
  placementMode: CampaignDisplayPlacementMode;
  description?: string;
  signage?: string;
  minimumSpace?: string;
  prescriptive: boolean;
  executionNotes?: string;
  sortOrder: number;
  status?: "draft" | "ready";
}

export interface CampaignDisplayProduct {
  id: UUID;
  campaignDisplayId: UUID;
  campaignProductId: UUID;
  productId: UUID;
  role: CampaignDisplayProductRole;
  required: boolean;
  minimumFacings?: number;
  minimumQuantity?: number;
  sortOrder: number;
  note?: string;
}

/** Store scope exists before a physical allocation is decided. */
export interface CampaignStore {
  id: UUID;
  campaignId: UUID;
  storeId: UUID;
  included: boolean;
  status: "NOT_STARTED" | "PLANNING" | "READY";
}

/** Planning-layer mapping. It becomes a canonical DisplayAssignment at Publish in a later phase. */
export interface CampaignDisplayAssignment {
  id: UUID;
  campaignId: UUID;
  campaignDisplayId: UUID;
  storeId: UUID;
  displayAreaId?: UUID;
  status: "UNASSIGNED" | "SUGGESTED" | "ASSIGNED" | "NEEDS_REVIEW" | "EXCLUDED";
  placementSource?: "AUTO_SUGGESTED" | "BUYER_SELECTED" | "COPIED" | "LEGACY";
  compatibility?: "recommended" | "compatible" | "review" | "incompatible";
  suggestionDisplayAreaId?: UUID;
  suggestionReasons?: string[];
  startDate: string;
  endDate: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDisplayAssignmentProduct {
  id: UUID;
  campaignDisplayAssignmentId: UUID;
  campaignDisplayProductId: UUID;
  productId: UUID;
  recommendedCases?: number;
  caseQuantity?: number;
  quantitySource?: "RECOMMENDED" | "BUYER_OVERRIDE" | "MANUAL";
  buyerOverride: boolean;
  preferredSupplierId?: UUID;
  note?: string;
}

/** Immutable snapshot of mutable campaign planning at publish time. */
export interface CampaignRelease {
  id: UUID;
  campaignId: UUID;
  version: number;
  status: "published" | "superseded";
  publishedAt: string;
  publishedBy: string;
  snapshot: { campaign: Campaign; stores: CampaignStore[]; displays: CampaignDisplay[]; displayProducts: CampaignDisplayProduct[]; allocations: CampaignDisplayAssignment[]; allocationProducts: CampaignDisplayAssignmentProduct[] };
  displayAssignmentIds: UUID[];
  planningFingerprint?: string;
}

export interface StoreReleaseNotice {
  id: UUID;
  storeId: UUID;
  campaignId: UUID;
  releaseId: UUID;
  publishedAt: string;
  title: string;
  summary: string;
  read?: boolean;
}

export interface DisplayRequirement {
  displayType: DisplayType;
  priority: "standard" | "high" | "critical";
  signage: string;
  minimumSpace: string;
  executionNotes: string;
  prescriptive: boolean;
}

export interface Campaign {
  id: UUID;
  programId?: UUID;
  periodId?: UUID;
  name: string;
  type: CampaignType;
  description: string;
  startDate: string;
  endDate: string;
  owner: string;
  supplier: string;
  status: CampaignStatus;
  products: CampaignProduct[];
  requirement: DisplayRequirement;
}

export interface MerchandisingProgram {
  id: UUID;
  name: string;
  startDate: string;
  endDate: string;
  status: MerchandisingProgramStatus;
  description: string;
}

export interface ProgramPeriod {
  id: UUID;
  programId: UUID;
  name: string;
  startDate: string;
  endDate: string;
  resetDate?: string;
}

export interface ProgramStore {
  id: UUID;
  programId: UUID;
  storeId: UUID;
  included: boolean;
  status: ProgramStoreStatus;
  owner?: string;
}

export interface ProgramRelease {
  id: UUID;
  programId: UUID;
  version: number;
  status: ProgramReleaseStatus;
  publishedAt: string;
  publishedBy: string;
  assignmentIds: UUID[];
  assignments: Array<{ assignment: DisplayAssignment; products: DisplayAssignmentProduct[] }>;
  executionIds: UUID[];
  recommendationIds: UUID[];
}

export interface DisplayAssignment {
  id: UUID;
  programId: UUID;
  periodId?: UUID;
  storeId: UUID;
  displayAreaId: UUID;
  startDate: string;
  endDate: string;
  resetRequired: boolean;
  notes: string;
  status: DisplayAssignmentStatus;
  campaignReleaseId?: UUID;
  campaignDisplayAssignmentId?: UUID;
}

export interface DisplayAssignmentProduct {
  id: UUID;
  assignmentId: UUID;
  productId: UUID;
  sku: string;
  caseQuantity: number;
  required: boolean;
  minimumFacings?: number;
  preferredSupplierId?: UUID;
  note?: string;
}

export interface SupplierProductOption {
  productId: UUID;
  supplierId: UUID;
  supplierName: string;
  preferred: boolean;
  leadTimeDays?: number;
  orderDays?: string[];
  casePack?: number;
  availability?: SupplierAvailability;
  availableFrom?: string;
}

export interface Supplier {
  id: UUID;
  name: string;
  code: string;
  active: boolean;
}

export interface InventoryPosition {
  storeId: UUID;
  productId: UUID;
  onHandCases: number;
  reservedCases?: number;
  updatedAt: string;
}

export interface DemandHistoryRecord {
  id: UUID;
  storeId?: UUID;
  productId?: UUID;
  category?: string;
  date: string;
  cases: number;
}

export interface InboundOrder {
  id: UUID;
  storeId: UUID;
  productId: UUID;
  supplierId: UUID;
  cases: number;
  expectedArrivalDate: string;
  status: InboundOrderStatus;
}

export interface OrderRecommendation {
  id: UUID;
  storeId: UUID;
  productId: UUID;
  displayAssignmentId?: UUID;
  supplierId: UUID;
  recommendationDate: string;
  requiredByDate: string;
  recommendedCases: number;
  recommendationType: OrderRecommendationType;
  rationale: string;
  status: OrderRecommendationStatus;
  note?: string;
  forecastCases?: number;
  forecastConfidence?: "high" | "medium" | "low";
  forecastSource?: "store_sku" | "chainwide_sku" | "store_category" | "chainwide_category" | "default_ond_curve";
  generatedAt?: string;
}

export interface PurchaseOrderLine {
  id: UUID;
  purchaseOrderId: UUID;
  recommendationId: UUID;
  productId: UUID;
  cases: number;
}

export interface PurchaseOrder {
  id: UUID;
  storeId: UUID;
  supplierId: UUID;
  programId?: UUID;
  createdAt: string;
  expectedArrivalDate: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
}

export interface BridgeStrategy {
  productId: UUID;
  strategy: ProductInventoryStrategy;
  eligibility: "yes" | "no" | "review";
  bridgeHorizonDays?: number;
  maxWeeksOfSupply?: number;
  maxCases?: number;
  ltoEndDate?: string;
  promotionalCost?: number;
  expectedPostLtoCost?: number;
  note?: string;
}

export interface ResidualDemandInput {
  storeId: UUID;
  productId: UUID;
  projectedQ1Volume: number;
  currentStock: number;
  inboundStock: number;
  ondForecastConsumption: number;
  normalWeeksOfSupply?: number;
}

export interface CampaignAssignment {
  id: UUID;
  campaignId: UUID;
  storeId: UUID;
  displayAreaId: UUID;
  effectiveDate: string;
  compatibility: Compatibility;
  notes: string;
}

export interface ExecutionSubmission {
  id: UUID;
  executionId: UUID;
  submittedAt: string;
  photoName?: string;
  note: string;
  unavailableSkus: string[];
  substitutionRequested: boolean;
}

export interface ExecutionTask {
  id: UUID;
  assignmentId?: UUID;
  displayAssignmentId?: UUID;
  dueDate: string;
  status: ExecutionStatus;
  taskType?: ExecutionTaskType;
  programReleaseId?: UUID;
  issue?: string;
  submission?: ExecutionSubmission;
}

export interface ComplianceCheck {
  key: string;
  label: string;
  passed: boolean;
  required: boolean;
}

export interface ComplianceReview {
  id: UUID;
  executionId: UUID;
  reviewer: string;
  reviewedAt: string;
  decision: ReviewDecision;
  score: number;
  checks: ComplianceCheck[];
  comment: string;
}

export interface PerformanceRecord {
  id: UUID;
  campaignId: UUID;
  storeId: UUID;
  displayAreaId: UUID;
  periodStart: string;
  periodEnd: string;
  salesLiftPercent: number;
  grossMarginLift: number;
  unitLiftPercent: number;
  compliancePercent: number;
  outOfStockRate: number;
  weeksOfSupply: number;
  agedInventoryPercent: number;
}

export interface OndPerformanceRecord {
  id: UUID;
  programId: UUID;
  storeId: UUID;
  displayAreaId: UUID;
  displayAssignmentId: UUID;
  productId: UUID;
  periodId?: UUID;
  periodStart: string;
  periodEnd: string;
  salesDollars: number;
  units: number;
  grossMarginDollars: number;
  salesLiftPercent?: number;
  stockoutRate: number;
  compliancePercent: number;
  openingFillReadinessPercent: number;
  recommendedOrderCases: number;
  actualOrderCases: number;
  projectedResidualCases: number;
  actualResidualCases: number;
  bridgeInventoryCases: number;
  bridgeSoldThroughCases: number;
  incrementalBridgeMargin?: number;
}

export type RecommendationStatus = "open" | "accepted" | "dismissed" | "addressed";

export interface Recommendation {
  id: UUID;
  displayAreaId: UUID;
  campaignId?: UUID;
  title: string;
  rationale: string;
  rule: "increase_space" | "review_allocation" | "aging_inventory" | "assortment_opportunity";
  status: RecommendationStatus;
  note?: string;
}

export interface DisplayAreaHistoryEntry {
  id: UUID;
  displayAreaId: UUID;
  campaignId: UUID;
  assignmentId: UUID;
  executionId: UUID;
  startDate: string;
  endDate: string;
}

export interface PlatformSnapshot {
  stores: Store[];
  storeLayouts: StoreLayout[];
  categorySpaces: CategorySpace[];
  categorySpaceSections: CategorySpaceSection[];
  products: Product[];
  zones: StoreZone[];
  fixtures: Fixture[];
  displayClassDefinitions: DisplayClassDefinition[];
  displayAreas: DisplayArea[];
  displayAreaSections: DisplayAreaSection[];
  programs: MerchandisingProgram[];
  programPeriods: ProgramPeriod[];
  programStores: ProgramStore[];
  programReleases: ProgramRelease[];
  displayAssignments: DisplayAssignment[];
  displayAssignmentProducts: DisplayAssignmentProduct[];
  suppliers: Supplier[];
  supplierProductOptions: SupplierProductOption[];
  inventoryPositions: InventoryPosition[];
  inboundOrders: InboundOrder[];
  orderRecommendations: OrderRecommendation[];
  purchaseOrders: PurchaseOrder[];
  historicalDemand: DemandHistoryRecord[];
  bridgeStrategies: BridgeStrategy[];
  residualDemandInputs: ResidualDemandInput[];
  campaigns: Campaign[];
  campaignDisplays: CampaignDisplay[];
  campaignDisplayProducts: CampaignDisplayProduct[];
  campaignStores: CampaignStore[];
  campaignDisplayAssignments: CampaignDisplayAssignment[];
  campaignDisplayAssignmentProducts: CampaignDisplayAssignmentProduct[];
  campaignReleases: CampaignRelease[];
  storeReleaseNotices: StoreReleaseNotice[];
  assignments: CampaignAssignment[];
  executions: ExecutionTask[];
  complianceReviews: ComplianceReview[];
  performance: PerformanceRecord[];
  ondPerformance: OndPerformanceRecord[];
  recommendations: Recommendation[];
  history: DisplayAreaHistoryEntry[];
}

export interface NewCampaignInput {
  name: string;
  type: CampaignType;
  description: string;
  startDate: string;
  endDate: string;
  owner: string;
  supplier: string;
  products: CampaignProduct[];
  requirement?: DisplayRequirement;
}
