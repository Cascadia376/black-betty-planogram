import type {
  BridgeStrategy,
  Campaign,
  CampaignAssignment,
  CampaignDisplay,
  CampaignDisplayAssignment,
  CampaignDisplayAssignmentProduct,
  CampaignDisplayProduct,
  CampaignProduct,
  CategorySpace,
  ComplianceCheck,
  DisplayAssignment,
  DisplayAssignmentProduct,
  DisplayArea,
  MerchandisingProgram,
  NewCampaignInput,
  Product,
  OrderRecommendationStatus,
  PlatformSnapshot,
  RecommendationStatus,
  ReviewDecision,
  SupplierProductOption,
  StoreLayout,
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

export interface AddCampaignProductsInput {
  campaignId: UUID;
  productIds: UUID[];
}

export interface ApplyCampaignProductImportInput {
  campaignId: UUID;
  products: Array<Pick<CampaignProduct, "productId" | "role" | "required" | "note">>;
}

export interface UpdateCampaignProductInput {
  campaignId: UUID;
  campaignProductId: UUID;
  patch: Pick<CampaignProduct, "role" | "required">;
}

export interface UpdateCampaignInput {
  campaignId: UUID;
  patch: Pick<NewCampaignInput, "name" | "type" | "description" | "startDate" | "endDate" | "owner" | "supplier">;
}

export interface CreateCampaignDisplayInput {
  campaignId: UUID;
  display: Omit<CampaignDisplay, "id" | "campaignId" | "sortOrder">;
}

export interface UpdateCampaignDisplayInput {
  campaignDisplayId: UUID;
  patch: Partial<Omit<CampaignDisplay, "id" | "campaignId" | "sortOrder">>;
}

export interface ReorderCampaignDisplayInput {
  campaignDisplayId: UUID;
  direction: "up" | "down";
}

export interface ReorderCampaignDisplayProductInput {
  campaignDisplayProductId: UUID;
  direction: "up" | "down";
}

export interface SetCampaignStoresInput { campaignId: UUID; storeIds: UUID[]; }
export interface SuggestCampaignDisplayInput { campaignId: UUID; campaignDisplayId: UUID; storeIds?: UUID[]; }
export interface UpdateCampaignDisplayAssignmentInput { campaignDisplayAssignmentId: UUID; status?: CampaignDisplayAssignment["status"]; displayAreaId?: UUID; note?: string; placementSource?: CampaignDisplayAssignment["placementSource"]; }
export interface UpdateCampaignDisplayAssignmentProductInput { campaignDisplayAssignmentProductId: UUID; caseQuantity?: number; note?: string; resetToDefault?: boolean; }
export interface ApplyCampaignDisplayQuantityInput { campaignDisplayId: UUID; campaignDisplayProductId: UUID; caseQuantity: number; }

export interface AssignCampaignProductsToDisplayInput {
  campaignId: UUID;
  campaignDisplayId: UUID;
  campaignProductIds: UUID[];
}

export interface UpdateCampaignDisplayProductInput {
  campaignDisplayProductId: UUID;
  patch: Partial<Pick<CampaignDisplayProduct, "role" | "required" | "minimumFacings" | "minimumQuantity" | "note">>;
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

export interface UpdateCategorySpaceInput {
  categorySpaceId: UUID;
  patch: Partial<Omit<CategorySpace, "id" | "storeId" | "layoutId">>;
}

export interface CreateStoreLayoutInput {
  layout: Omit<StoreLayout, "id" | "createdAt" | "updatedAt">;
}

export interface CreateDisplayAreaInput {
  area: Omit<DisplayArea, "id">;
}

export interface UpdateDisplayAreaInput {
  displayAreaId: UUID;
  patch: Partial<Omit<DisplayArea, "id" | "storeId">>;
}

export interface MerchandisingRepository {
  load(): Promise<PlatformSnapshot>;
  getStoreLayouts(storeId: UUID): Promise<StoreLayout[]>;
  getStoreLayout(layoutId: UUID): Promise<StoreLayout | undefined>;
  getCategorySpaces(layoutId: UUID): Promise<CategorySpace[]>;
  updateCategorySpace(input: UpdateCategorySpaceInput): Promise<CategorySpace>;
  createStoreLayout(input: CreateStoreLayoutInput): Promise<StoreLayout>;
  duplicateStoreLayout(layoutId: UUID, name?: string): Promise<StoreLayout>;
  setCurrentStoreLayout(layoutId: UUID): Promise<void>;
  createDisplayArea(input: CreateDisplayAreaInput): Promise<DisplayArea>;
  updateDisplayArea(input: UpdateDisplayAreaInput): Promise<DisplayArea>;
  deleteDisplayArea(displayAreaId: UUID): Promise<void>;
  searchProducts(query: string): Promise<Product[]>;
  createPendingProduct(input: CreatePendingProductInput): Promise<Product>;
  createCampaign(input: NewCampaignInput): Promise<UUID>;
  updateCampaign(input: UpdateCampaignInput): Promise<Campaign>;
  addCampaignProducts(input: AddCampaignProductsInput): Promise<CampaignProduct[]>;
  applyCampaignProductImport(input: ApplyCampaignProductImportInput): Promise<CampaignProduct[]>;
  updateCampaignProduct(input: UpdateCampaignProductInput): Promise<CampaignProduct>;
  removeCampaignProduct(campaignId: UUID, campaignProductId: UUID): Promise<void>;
  createCampaignDisplay(input: CreateCampaignDisplayInput): Promise<CampaignDisplay>;
  updateCampaignDisplay(input: UpdateCampaignDisplayInput): Promise<CampaignDisplay>;
  reorderCampaignDisplay(input: ReorderCampaignDisplayInput): Promise<void>;
  removeCampaignDisplay(campaignDisplayId: UUID): Promise<void>;
  assignCampaignProductsToDisplay(input: AssignCampaignProductsToDisplayInput): Promise<CampaignDisplayProduct[]>;
  removeCampaignProductFromDisplay(campaignDisplayProductId: UUID): Promise<void>;
  setCampaignProductShelfSupport(campaignId: UUID, campaignProductIds: UUID[]): Promise<void>;
  setCampaignProductUnassigned(campaignId: UUID, campaignProductIds: UUID[]): Promise<void>;
  updateCampaignDisplayProduct(input: UpdateCampaignDisplayProductInput): Promise<CampaignDisplayProduct>;
  reorderCampaignDisplayProduct(input: ReorderCampaignDisplayProductInput): Promise<void>;
  setCampaignStores(input: SetCampaignStoresInput): Promise<void>;
  suggestCampaignDisplay(input: SuggestCampaignDisplayInput): Promise<CampaignDisplayAssignment[]>;
  updateCampaignDisplayAssignment(input: UpdateCampaignDisplayAssignmentInput): Promise<CampaignDisplayAssignment>;
  updateCampaignDisplayAssignmentProduct(input: UpdateCampaignDisplayAssignmentProductInput): Promise<CampaignDisplayAssignmentProduct>;
  applyCampaignDisplayQuantity(input: ApplyCampaignDisplayQuantityInput): Promise<void>;
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
