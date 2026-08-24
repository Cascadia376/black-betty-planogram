import type {
  AssignCampaignInput, CompleteExecutionInput, CreateDisplayAssignmentInput, MerchandisingRepository, SubmitComplianceInput,
} from "../../domain/repositories";
import {
  calculateComplianceScore,
  getAssignmentCompatibility,
  validateCampaign,
  validateDisplayAssignment,
  validateDisplayAssignmentProducts,
} from "../../domain/rules";
import type { BridgeStrategy, NewCampaignInput, PlatformSnapshot, RecommendationStatus, UUID } from "../../domain/types";
import { seedSnapshot } from "./seed";

const STORAGE_KEY = "cascadia-merchandising-platform-v1";

function cloneSeed(): PlatformSnapshot {
  return structuredClone(seedSnapshot);
}

function normalizeSnapshot(snapshot: PlatformSnapshot): PlatformSnapshot {
  const defaults = cloneSeed();
  return {
    ...snapshot,
    displayAreas: snapshot.displayAreas.map((area) => {
      const seededArea = defaults.displayAreas.find((candidate) => candidate.id === area.id);
      return {
        ...area,
        displayNumber: area.displayNumber ?? seededArea?.displayNumber ?? area.name,
        code: area.code ?? seededArea?.code ?? area.id,
      };
    }),
    programs: snapshot.programs ?? defaults.programs,
    programPeriods: snapshot.programPeriods ?? defaults.programPeriods,
    displayAssignments: snapshot.displayAssignments ?? defaults.displayAssignments,
    displayAssignmentProducts: snapshot.displayAssignmentProducts ?? defaults.displayAssignmentProducts,
    supplierProductOptions: snapshot.supplierProductOptions ?? defaults.supplierProductOptions,
    bridgeStrategies: snapshot.bridgeStrategies ?? defaults.bridgeStrategies,
  };
}

function readInitialState(): PlatformSnapshot {
  if (typeof window === "undefined") return cloneSeed();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeSnapshot(JSON.parse(stored) as PlatformSnapshot) : cloneSeed();
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

  async createDisplayAssignment(input: CreateDisplayAssignmentInput) {
    const { assignment: candidate, products } = input;
    const program = this.state.programs.find((item) => item.id === candidate.programId);
    const store = this.state.stores.find((item) => item.id === candidate.storeId);
    const area = this.state.displayAreas.find((item) => item.id === candidate.displayAreaId);
    if (!program || !store || !area) throw new Error("Program, store, or display area was not found.");
    if (area.storeId !== store.id) throw new Error("Display area does not belong to the selected store.");
    if (candidate.startDate < program.startDate || candidate.endDate > program.endDate) {
      throw new Error("Display assignment dates must remain inside the merchandising program.");
    }
    if (candidate.periodId) {
      const period = this.state.programPeriods.find((item) => item.id === candidate.periodId && item.programId === program.id);
      if (!period) throw new Error("Program period was not found for this merchandising program.");
      if (candidate.startDate < period.startDate || candidate.endDate > period.endDate) {
        throw new Error("Display assignment dates must remain inside the selected program period.");
      }
    }
    const errors = [
      ...validateDisplayAssignment(candidate, this.state.displayAssignments),
      ...validateDisplayAssignmentProducts(products),
    ];
    if (errors.length) throw new Error(errors.join(" "));

    const assignment = { id: crypto.randomUUID(), ...candidate };
    this.state.displayAssignments.push(assignment);
    this.state.displayAssignmentProducts.push(...products.map((product) => ({
      ...product,
      id: crypto.randomUUID(),
      assignmentId: assignment.id,
    })));
    this.persist();
    return structuredClone(assignment);
  }

  async saveBridgeStrategy(strategy: BridgeStrategy): Promise<void> {
    this.state.bridgeStrategies = this.state.bridgeStrategies.filter((item) => item.productId !== strategy.productId);
    this.state.bridgeStrategies.push(structuredClone(strategy));
    this.persist();
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
