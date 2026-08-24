import type {
  AssignCampaignInput, CompleteExecutionInput, MerchandisingRepository, SubmitComplianceInput,
} from "../../domain/repositories";
import { calculateComplianceScore, getAssignmentCompatibility, validateCampaign } from "../../domain/rules";
import type { NewCampaignInput, PlatformSnapshot, RecommendationStatus, UUID } from "../../domain/types";
import { seedSnapshot } from "./seed";

const STORAGE_KEY = "cascadia-merchandising-platform-v1";

function cloneSeed(): PlatformSnapshot {
  return structuredClone(seedSnapshot);
}

function readInitialState(): PlatformSnapshot {
  if (typeof window === "undefined") return cloneSeed();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as PlatformSnapshot) : cloneSeed();
  } catch {
    return cloneSeed();
  }
}

export class MockMerchandisingRepository implements MerchandisingRepository {
  private state = readInitialState();

  private persist() {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  async load(): Promise<PlatformSnapshot> {
    return structuredClone(this.state);
  }

  async createCampaign(input: NewCampaignInput): Promise<UUID> {
    const errors = validateCampaign(input);
    if (errors.length) throw new Error(errors.join(" "));
    const id = crypto.randomUUID();
    this.state.campaigns.unshift({ ...input, id, status: "draft" });
    this.persist();
    return id;
  }

  async assignCampaign(input: AssignCampaignInput) {
    const campaign = this.state.campaigns.find((item) => item.id === input.campaignId);
    const area = this.state.displayAreas.find((item) => item.id === input.displayAreaId);
    if (!campaign || !area) throw new Error("Campaign or display area was not found.");
    if (area.storeId !== input.storeId) throw new Error("Display area does not belong to the selected store.");
    const compatibility = getAssignmentCompatibility(campaign, area);
    if (compatibility === "incompatible") throw new Error("This campaign is incompatible with the selected display area.");
    const assignment = { id: crypto.randomUUID(), ...input, compatibility };
    this.state.assignments.push(assignment);
    this.state.executions.push({
      id: crypto.randomUUID(), assignmentId: assignment.id, dueDate: input.effectiveDate, status: "not_started",
    });
    this.persist();
    return structuredClone(assignment);
  }

  async completeExecution(input: CompleteExecutionInput): Promise<void> {
    const execution = this.state.executions.find((item) => item.id === input.executionId);
    if (!execution) throw new Error("Execution task was not found.");
    execution.status = input.unavailableSkus.length ? "issue" : "completed";
    execution.submission = {
      id: crypto.randomUUID(), executionId: execution.id, submittedAt: new Date().toISOString(),
      note: input.note, photoName: input.photoName, unavailableSkus: input.unavailableSkus,
      substitutionRequested: input.substitutionRequested,
    };
    this.persist();
  }

  async reviewCompliance(input: SubmitComplianceInput): Promise<void> {
    const execution = this.state.executions.find((item) => item.id === input.executionId);
    if (!execution?.submission) throw new Error("A completed submission is required before compliance review.");
    const existing = this.state.complianceReviews.find((item) => item.executionId === input.executionId);
    const review = {
      id: existing?.id ?? crypto.randomUUID(), executionId: input.executionId, reviewer: "Mock Operations Reviewer",
      reviewedAt: new Date().toISOString(), decision: input.decision,
      score: calculateComplianceScore(input.checks), checks: input.checks, comment: input.comment,
    };
    this.state.complianceReviews = this.state.complianceReviews.filter((item) => item.executionId !== input.executionId);
    this.state.complianceReviews.push(review);
    this.persist();
  }

  async updateRecommendation(id: UUID, status: RecommendationStatus, note?: string): Promise<void> {
    const recommendation = this.state.recommendations.find((item) => item.id === id);
    if (!recommendation) throw new Error("Recommendation was not found.");
    recommendation.status = status;
    recommendation.note = note;
    this.persist();
  }

  async reset(): Promise<void> {
    this.state = cloneSeed();
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  }
}

