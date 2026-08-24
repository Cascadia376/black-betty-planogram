import type {
  BridgeStrategy,
  CampaignAssignment,
  ComplianceCheck,
  DisplayAssignment,
  DisplayAssignmentProduct,
  NewCampaignInput,
  OrderRecommendationStatus,
  PlatformSnapshot,
  RecommendationStatus,
  ReviewDecision,
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

export interface UpdateOrderRecommendationInput {
  id: UUID;
  status: OrderRecommendationStatus;
  recommendedCases?: number;
  note?: string;
}

export interface MerchandisingRepository {
  load(): Promise<PlatformSnapshot>;
  createCampaign(input: NewCampaignInput): Promise<UUID>;
  assignCampaign(input: AssignCampaignInput): Promise<CampaignAssignment>;
  createDisplayAssignment(input: CreateDisplayAssignmentInput): Promise<DisplayAssignment>;
  updateDisplayAssignment(id: UUID, input: CreateDisplayAssignmentInput): Promise<DisplayAssignment>;
  saveBridgeStrategy(strategy: BridgeStrategy): Promise<void>;
  completeExecution(input: CompleteExecutionInput): Promise<void>;
  reviewCompliance(input: SubmitComplianceInput): Promise<void>;
  updateRecommendation(id: UUID, status: RecommendationStatus, note?: string): Promise<void>;
  updateOrderRecommendation(input: UpdateOrderRecommendationInput): Promise<void>;
  reset(): Promise<void>;
}
