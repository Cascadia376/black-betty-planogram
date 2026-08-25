import type {
  BridgeStrategy,
  CampaignAssignment,
  CampaignDisplay,
  CampaignDisplayPlacement,
  CampaignProduct,
  ComplianceCheck,
  DisplayAssignment,
  DisplayAssignmentProduct,
  MerchandisingProgram,
  NewCampaignInput,
  Product,
  OrderRecommendationStatus,
  PlatformSnapshot,
  RecommendationStatus,
  ReviewDecision,
  SupplierProductOption,
  UUID,
} from "./types";

export interface CreatePendingProductInput {
  sku: string;
  name: string;
  category: string;
  brand?: string;
  packageSize?: string;
  casePack?: number;
  supplierName?: string;
  supplierProductCode?: string;
  notes?: string;
}

export interface AssignCampaignInput {
  campaignId: UUID;
  storeId: UUID;
  displayAreaId: UUID;
  effectiveDate: string;
  notes: string;
}

export interface UpdateCampaignProductsInput {
  campaignId: UUID;
  products: CampaignProduct[];
}

export interface SaveCampaignDisplaysInput {
  campaignId: UUID;
  displays: CampaignDisplay[];
  shelfSupportedProductIds: UUID[];
}

export interface SaveCampaignDisplayPlacementsInput {
  campaignId: UUID;
  placements: CampaignDisplayPlacement[];
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
  searchProducts(query: string): Promise<Product[]>;
  createPendingProduct(input: CreatePendingProductInput): Promise<Product>;
  createCampaign(input: NewCampaignInput): Promise<UUID>;
  updateCampaignProducts(input: UpdateCampaignProductsInput): Promise<void>;
  saveCampaignDisplays(input: SaveCampaignDisplaysInput): Promise<void>;
  saveCampaignDisplayPlacements(input: SaveCampaignDisplayPlacementsInput): Promise<void>;
  publishCampaign(campaignId: UUID): Promise<void>;
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
