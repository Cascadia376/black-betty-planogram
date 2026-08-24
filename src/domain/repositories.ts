import type {
  CampaignAssignment, ComplianceCheck, NewCampaignInput, PlatformSnapshot,
  RecommendationStatus, ReviewDecision, UUID,
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

export interface MerchandisingRepository {
  load(): Promise<PlatformSnapshot>;
  createCampaign(input: NewCampaignInput): Promise<UUID>;
  assignCampaign(input: AssignCampaignInput): Promise<CampaignAssignment>;
  completeExecution(input: CompleteExecutionInput): Promise<void>;
  reviewCompliance(input: SubmitComplianceInput): Promise<void>;
  updateRecommendation(id: UUID, status: RecommendationStatus, note?: string): Promise<void>;
  reset(): Promise<void>;
}

