import type {
  BridgeStrategy,
  CampaignAssignment,
  ComplianceCheck,
  DisplayAssignment,
  DisplayAssignmentProduct,
  MerchandisingProgram,
  NewCampaignInput,
  OrderRecommendationStatus,
  PlatformSnapshot,
  RecommendationStatus,
  ReviewDecision,
  SupplierProductOption,
  UUID,
} from "./types";

export interface AssignCampaignInput {
  campaignId: UUID;
  storeId: UUID;
  displayAreaId: UUID;
  effectiveDate: string;
  notes: string;
}

export interface CompleteExecutionInput {
  executionId: UUID;
  note: string;
  photoName?: string;
  unavailableSkus: string[];
  substitutionRequested: boolean;
}

export interface SubmitComplianceInput {
  executionId: UUID;
  decision: ReviewDecision;
  checks: ComplianceCheck[];
  comment: string;
}

export interface CreateDisplayAssignmentInput {
  assignment: Omit<DisplayAssignment, "id">;
  products: Omit<DisplayAssignmentProduct, "id" | "assignmentId">[];
}

export interface ApplyOndImportInput {
  program: MerchandisingProgram;
  assignments: CreateDisplayAssignmentInput[];
  supplierProductOptions: SupplierProductOption[];
}

export interface UpdateOrderRecommendationInput {
  id: UUID;
  status: OrderRecommendationStatus;
  recommendedCases?: number;
  note?: string;
}

export interface PublishProgramInput {
  programId: UUID;
  publishedBy: string;
}

export interface PublishProgramResult {
  releaseId: UUID;
  version: number;
  executionCount: number;
  recommendationCount: number;
  warnings: string[];
}

export interface RefreshOrderRecommendationsInput {
  programId: UUID;
  storeId?: UUID;
  recommendationDate?: string;
}

export interface CreatePurchaseOrderInput {
  storeId: UUID;
  supplierId: UUID;
  programId?: UUID;
  recommendationIds: UUID[];
}

export interface SetProgramStoreInput {
  programId: UUID;
  storeId: UUID;
  included: boolean;
}

export interface MerchandisingRepository {
  load(): Promise<PlatformSnapshot>;
  createCampaign(input: NewCampaignInput): Promise<UUID>;
  assignCampaign(input: AssignCampaignInput): Promise<CampaignAssignment>;
  createDisplayAssignment(input: CreateDisplayAssignmentInput): Promise<DisplayAssignment>;
  updateDisplayAssignment(id: UUID, input: CreateDisplayAssignmentInput): Promise<DisplayAssignment>;
  applyOndImport(input: ApplyOndImportInput): Promise<void>;
  publishProgram(input: PublishProgramInput): Promise<PublishProgramResult>;
  refreshOrderRecommendations(input: RefreshOrderRecommendationsInput): Promise<number>;
  createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<UUID>;
  setProgramStore(input: SetProgramStoreInput): Promise<void>;
  saveBridgeStrategy(strategy: BridgeStrategy): Promise<void>;
  completeExecution(input: CompleteExecutionInput): Promise<void>;
  reviewCompliance(input: SubmitComplianceInput): Promise<void>;
  updateRecommendation(id: UUID, status: RecommendationStatus, note?: string): Promise<void>;
  updateOrderRecommendation(input: UpdateOrderRecommendationInput): Promise<void>;
  reset(): Promise<void>;
}
