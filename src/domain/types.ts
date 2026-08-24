export type UUID = string;

export type UserRole = "admin" | "merchandising" | "operations" | "store_manager" | "read_only";
export type CampaignStatus = "draft" | "scheduled" | "active" | "completed";
export type MerchandisingProgramStatus = "draft" | "planned" | "active" | "completed" | "archived";
export type DisplayAssignmentStatus = "draft" | "planned" | "ready" | "active" | "completed" | "cancelled";
export type CampaignType =
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
export type ProductRole = "Feature" | "Core" | "Supporting" | "Optional";
export type ExecutionStatus = "not_started" | "in_progress" | "completed" | "issue";
export type Compatibility = "compatible" | "requires_review" | "incompatible";
export type ReviewDecision = "approved" | "fix_requested" | "local_variation";

export interface Store {
  id: UUID;
  name: string;
  code: string;
  address: string;
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

export interface DisplayArea {
  id: UUID;
  displayNumber: string;
  code: string;
  storeId: UUID;
  zoneId: UUID;
  fixtureId: UUID;
  name: string;
  type: DisplayType;
  description: string;
  capacity: string;
  geometry: Geometry;
}

export interface CampaignProduct {
  id: UUID;
  sku: string;
  name: string;
  category: string;
  role: ProductRole;
  required: boolean;
  minimumQuantity: number;
  minimumFacings: number;
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
}

export interface BridgeStrategy {
  productId: UUID;
  eligibility: "yes" | "no" | "review";
  bridgeHorizonDays?: number;
  maxWeeksOfSupply?: number;
  maxCases?: number;
  note?: string;
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
  assignmentId: UUID;
  dueDate: string;
  status: ExecutionStatus;
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
  zones: StoreZone[];
  fixtures: Fixture[];
  displayAreas: DisplayArea[];
  programs: MerchandisingProgram[];
  programPeriods: ProgramPeriod[];
  displayAssignments: DisplayAssignment[];
  displayAssignmentProducts: DisplayAssignmentProduct[];
  supplierProductOptions: SupplierProductOption[];
  bridgeStrategies: BridgeStrategy[];
  campaigns: Campaign[];
  assignments: CampaignAssignment[];
  executions: ExecutionTask[];
  complianceReviews: ComplianceReview[];
  performance: PerformanceRecord[];
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
  requirement: DisplayRequirement;
}
