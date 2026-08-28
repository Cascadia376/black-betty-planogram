import type {
  AddCampaignProductsInput, ApplyCampaignProductImportInput, ApplyOndImportInput, AssignCampaignInput, AssignCampaignProductsToDisplayInput, CompleteExecutionInput, CreateCampaignDisplayInput, CreateDisplayAssignmentInput, CreatePendingProductInput, CreatePurchaseOrderInput, MerchandisingRepository,
  PublishProgramInput, PublishProgramResult, RefreshOrderRecommendationsInput, SetProgramStoreInput, SubmitComplianceInput, UpdateCampaignDisplayInput, UpdateCampaignDisplayProductInput, UpdateCampaignProductInput, UpdateOrderRecommendationInput,
} from "../../domain/repositories";
import {
  calculateComplianceScore,
  getAssignmentCompatibility,
  validateCampaignDetails,
  validateDisplayAssignment,
  validateDisplayAssignmentProducts,
} from "../../domain/rules";
import type { BridgeStrategy, CampaignDisplay, CampaignDisplayProduct, CampaignProduct, DisplayRequirement, NewCampaignInput, OrderRecommendation, PlatformSnapshot, Product, RecommendationStatus, UUID } from "../../domain/types";
import { productDetails } from "../../features/programs/allocationPlanner";
import type { BusinessClock } from "../../services/clock";
import { mockBusinessClock } from "../../services/clock";
import { MockHistoricalDemandSource } from "../../services/demand/MockHistoricalDemandSource";
import { RuleBasedOndDemandService } from "../../services/demand/RuleBasedOndDemandService";
import { RuleBasedOrderRecommendationService } from "../../services/orders/OrderRecommendationService";
import { calculateResidualInventory } from "../../services/orders/ResidualInventoryService";
import { seedSnapshot } from "./seed";

const STORAGE_KEY = "cascadia-merchandising-platform-v1";
const defaultDisplayRequirement: DisplayRequirement = {
  displayType: "flex",
  priority: "standard",
  signage: "To be defined during display building",
  minimumSpace: "To be defined during display building",
  executionNotes: "Display guidance has not been built yet.",
  prescriptive: false,
};

function cloneSeed(): PlatformSnapshot {
  return structuredClone(seedSnapshot);
}

function normalizeSnapshot(snapshot: PlatformSnapshot): PlatformSnapshot {
  const defaults = cloneSeed();
  const products: Product[] = (snapshot.products ?? defaults.products).map((product) => ({
    ...product,
    masterStatus: product.masterStatus ?? "verified",
  }));
  const campaigns = snapshot.campaigns.map((campaign) => ({
    ...campaign,
    requirement: campaign.requirement ?? structuredClone(defaultDisplayRequirement),
    products: campaign.products.map((campaignProduct) => {
      const legacy = campaignProduct as unknown as CampaignProduct & { sku?: string; name?: string; category?: string };
      if (legacy.productId) return { ...campaignProduct, campaignId: campaign.id };
      let master = products.find((product) => product.sku === legacy.sku);
      if (!master) {
        master = {
          id: `migrated-${campaignProduct.id}`,
          sku: legacy.sku ?? campaignProduct.id,
          name: legacy.name ?? "Migrated campaign product",
          category: legacy.category ?? "Uncategorized",
          masterStatus: "pending",
          active: true,
          synthetic: true,
          notes: "Migrated from legacy campaign-specific product data; Product Master review required.",
        };
        products.push(master);
      }
      return { id: campaignProduct.id, campaignId: campaign.id, productId: master.id, role: campaignProduct.role, required: campaignProduct.required };
    }),
  }));
  return {
    ...snapshot,
    products,
    campaigns,
    campaignDisplays: snapshot.campaignDisplays ?? [],
    campaignDisplayProducts: snapshot.campaignDisplayProducts ?? [],
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
    programStores: snapshot.programStores ?? defaults.programStores,
    programReleases: snapshot.programReleases ?? defaults.programReleases,
    displayAssignments: snapshot.displayAssignments ?? defaults.displayAssignments,
    displayAssignmentProducts: snapshot.displayAssignmentProducts ?? defaults.displayAssignmentProducts,
    suppliers: snapshot.suppliers ?? defaults.suppliers,
    supplierProductOptions: snapshot.supplierProductOptions ?? defaults.supplierProductOptions,
    inventoryPositions: snapshot.inventoryPositions ?? defaults.inventoryPositions,
    inboundOrders: snapshot.inboundOrders ?? defaults.inboundOrders,
    orderRecommendations: snapshot.orderRecommendations ?? defaults.orderRecommendations,
    purchaseOrders: snapshot.purchaseOrders ?? defaults.purchaseOrders,
    historicalDemand: snapshot.historicalDemand ?? defaults.historicalDemand,
    bridgeStrategies: (snapshot.bridgeStrategies ?? defaults.bridgeStrategies).map((strategy) => {
      const seeded = defaults.bridgeStrategies.find((item) => item.productId === strategy.productId);
      return { ...strategy, strategy: strategy.strategy ?? seeded?.strategy ?? "NORMAL_CARRY" };
    }),
    residualDemandInputs: snapshot.residualDemandInputs ?? defaults.residualDemandInputs,
    ondPerformance: snapshot.ondPerformance ?? defaults.ondPerformance,
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

  constructor(private readonly clock: BusinessClock = mockBusinessClock) {}

  private persist() {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  async load(): Promise<PlatformSnapshot> {
    return structuredClone(this.state);
  }

  async searchProducts(query: string): Promise<Product[]> {
    const normalized = query.trim().toLocaleLowerCase();
    const matches = normalized
      ? this.state.products.filter((product) => [product.sku, product.name, product.category].some((value) => value?.toLocaleLowerCase().includes(normalized)))
      : this.state.products;
    return structuredClone(matches.slice(0, 50));
  }

  async createPendingProduct(input: CreatePendingProductInput): Promise<Product> {
    const sku = input.sku.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sku)) throw new Error("Enter a valid SKU using letters, numbers, periods, underscores, or hyphens.");
    if (!input.name.trim() || !input.category.trim()) throw new Error("SKU, product name, and category are required.");
    if (this.state.products.some((product) => product.sku.toLocaleLowerCase() === sku.toLocaleLowerCase())) {
      throw new Error("This SKU already exists in Product Master.");
    }
    const product: Product = {
      ...input,
      id: crypto.randomUUID(),
      sku,
      name: input.name.trim(),
      category: input.category.trim(),
      masterStatus: "pending",
      active: true,
      synthetic: true,
    };
    this.state.products.push(product);
    this.persist();
    return structuredClone(product);
  }

  async createCampaign(input: NewCampaignInput): Promise<UUID> {
    const errors = validateCampaignDetails(input);
    if (errors.length) throw new Error(errors.join(" "));
    const id = crypto.randomUUID();
    const products = input.products.map((product) => ({ ...product, campaignId: id }));
    this.state.campaigns.unshift({ ...input, products, requirement: input.requirement ?? structuredClone(defaultDisplayRequirement), id, status: "draft" });
    this.persist();
    return id;
  }

  async addCampaignProducts(input: AddCampaignProductsInput): Promise<CampaignProduct[]> {
    const campaign = this.state.campaigns.find((item) => item.id === input.campaignId);
    if (!campaign) throw new Error("Campaign was not found.");
    if (!input.productIds.length) return [];

    const uniqueIds = [...new Set(input.productIds)];
    const missing = uniqueIds.filter((productId) => !this.state.products.some((product) => product.id === productId));
    if (missing.length) throw new Error("One or more selected products were not found in Product Master.");

    const existing = new Set(campaign.products.map((product) => product.productId));
    const created = uniqueIds
      .filter((productId) => !existing.has(productId))
      .map((productId): CampaignProduct => ({
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        productId,
        role: "Supporting",
        required: true,
      }));
    campaign.products.push(...created);
    this.persist();
    return structuredClone(created);
  }

  async applyCampaignProductImport(input: ApplyCampaignProductImportInput): Promise<CampaignProduct[]> {
    const campaign = this.state.campaigns.find((item) => item.id === input.campaignId);
    if (!campaign) throw new Error("Campaign was not found.");
    const importedProductIds = input.products.map((product) => product.productId);
    if (new Set(importedProductIds).size !== importedProductIds.length) throw new Error("The import contains duplicate product identities.");
    if (input.products.some((product) => !this.state.products.some((master) => master.id === product.productId))) throw new Error("One or more imported products were not found in Product Master.");
    const existing = new Set(campaign.products.map((product) => product.productId));
    if (importedProductIds.some((productId) => existing.has(productId))) throw new Error("One or more imported products already belong to this campaign.");
    const created = input.products.map((product): CampaignProduct => ({ id: crypto.randomUUID(), campaignId: campaign.id, ...product }));
    campaign.products.push(...created);
    this.persist();
    return structuredClone(created);
  }

  async updateCampaignProduct(input: UpdateCampaignProductInput): Promise<CampaignProduct> {
    const campaign = this.state.campaigns.find((item) => item.id === input.campaignId);
    const campaignProduct = campaign?.products.find((product) => product.id === input.campaignProductId);
    if (!campaign || !campaignProduct) throw new Error("Campaign product was not found.");
    campaignProduct.role = input.patch.role;
    campaignProduct.required = input.patch.required;
    this.persist();
    return structuredClone(campaignProduct);
  }

  async removeCampaignProduct(campaignId: UUID, campaignProductId: UUID): Promise<void> {
    const campaign = this.state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) throw new Error("Campaign was not found.");
    const before = campaign.products.length;
    campaign.products = campaign.products.filter((product) => product.id !== campaignProductId);
    this.state.campaignDisplayProducts = this.state.campaignDisplayProducts.filter((item) => item.campaignProductId !== campaignProductId);
    if (campaign.products.length === before) throw new Error("Campaign product was not found.");
    this.persist();
  }

  async createCampaignDisplay(input: CreateCampaignDisplayInput): Promise<CampaignDisplay> {
    if (!this.state.campaigns.some((campaign) => campaign.id === input.campaignId)) throw new Error("Campaign was not found.");
    if (!input.display.name.trim()) throw new Error("Display name is required.");
    const display: CampaignDisplay = {
      ...input.display,
      id: crypto.randomUUID(),
      campaignId: input.campaignId,
      name: input.display.name.trim(),
      sortOrder: this.state.campaignDisplays.filter((item) => item.campaignId === input.campaignId).length,
    };
    this.state.campaignDisplays.push(display);
    this.persist();
    return structuredClone(display);
  }

  async updateCampaignDisplay(input: UpdateCampaignDisplayInput): Promise<CampaignDisplay> {
    const display = this.state.campaignDisplays.find((item) => item.id === input.campaignDisplayId);
    if (!display) throw new Error("Campaign display was not found.");
    if (input.patch.name !== undefined && !input.patch.name.trim()) throw new Error("Display name is required.");
    Object.assign(display, input.patch, input.patch.name ? { name: input.patch.name.trim() } : {});
    this.persist();
    return structuredClone(display);
  }

  async removeCampaignDisplay(campaignDisplayId: UUID): Promise<void> {
    const display = this.state.campaignDisplays.find((item) => item.id === campaignDisplayId);
    if (!display) throw new Error("Campaign display was not found.");
    const memberIds = new Set(this.state.campaignDisplayProducts.filter((item) => item.campaignDisplayId === campaignDisplayId).map((item) => item.campaignProductId));
    const campaign = this.state.campaigns.find((item) => item.id === display.campaignId)!;
    campaign.products.forEach((product) => { if (memberIds.has(product.id)) product.merchandisingState = "UNASSIGNED"; });
    this.state.campaignDisplays = this.state.campaignDisplays.filter((item) => item.id !== campaignDisplayId);
    this.state.campaignDisplayProducts = this.state.campaignDisplayProducts.filter((item) => item.campaignDisplayId !== campaignDisplayId);
    this.persist();
  }

  async assignCampaignProductsToDisplay(input: AssignCampaignProductsToDisplayInput): Promise<CampaignDisplayProduct[]> {
    const campaign = this.state.campaigns.find((item) => item.id === input.campaignId);
    const display = this.state.campaignDisplays.find((item) => item.id === input.campaignDisplayId && item.campaignId === input.campaignId);
    if (!campaign || !display) throw new Error("Campaign or campaign display was not found.");
    const ids = [...new Set(input.campaignProductIds)];
    const products = ids.map((id) => campaign.products.find((item) => item.id === id));
    if (!ids.length || products.some((item) => !item)) throw new Error("Select valid campaign products.");
    this.state.campaignDisplayProducts = this.state.campaignDisplayProducts.filter((item) => !ids.includes(item.campaignProductId));
    const created = products.map((campaignProduct, index): CampaignDisplayProduct => ({
      id: crypto.randomUUID(), campaignDisplayId: display.id, campaignProductId: campaignProduct!.id, productId: campaignProduct!.productId,
      role: "Supporting", required: campaignProduct!.required, sortOrder: index,
    }));
    this.state.campaignDisplayProducts.push(...created);
    products.forEach((item) => { item!.merchandisingState = "DISPLAY_ASSIGNED"; });
    this.persist();
    return structuredClone(created);
  }

  async removeCampaignProductFromDisplay(campaignDisplayProductId: UUID): Promise<void> {
    const member = this.state.campaignDisplayProducts.find((item) => item.id === campaignDisplayProductId);
    if (!member) throw new Error("Display product was not found.");
    const display = this.state.campaignDisplays.find((item) => item.id === member.campaignDisplayId)!;
    const campaign = this.state.campaigns.find((item) => item.id === display.campaignId)!;
    const product = campaign.products.find((item) => item.id === member.campaignProductId);
    if (product) product.merchandisingState = "UNASSIGNED";
    this.state.campaignDisplayProducts = this.state.campaignDisplayProducts.filter((item) => item.id !== campaignDisplayProductId);
    this.persist();
  }

  async setCampaignProductShelfSupport(campaignId: UUID, campaignProductIds: UUID[]): Promise<void> {
    await this.setCampaignProductState(campaignId, campaignProductIds, "SHELF_SUPPORTED");
  }

  async setCampaignProductUnassigned(campaignId: UUID, campaignProductIds: UUID[]): Promise<void> {
    await this.setCampaignProductState(campaignId, campaignProductIds, "UNASSIGNED");
  }

  private async setCampaignProductState(campaignId: UUID, campaignProductIds: UUID[], state: "SHELF_SUPPORTED" | "UNASSIGNED"): Promise<void> {
    const campaign = this.state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) throw new Error("Campaign was not found.");
    const ids = [...new Set(campaignProductIds)];
    if (!ids.length || ids.some((id) => !campaign.products.some((product) => product.id === id))) throw new Error("Select valid campaign products.");
    this.state.campaignDisplayProducts = this.state.campaignDisplayProducts.filter((item) => !ids.includes(item.campaignProductId));
    campaign.products.forEach((product) => { if (ids.includes(product.id)) product.merchandisingState = state; });
    this.persist();
  }

  async updateCampaignDisplayProduct(input: UpdateCampaignDisplayProductInput): Promise<CampaignDisplayProduct> {
    const product = this.state.campaignDisplayProducts.find((item) => item.id === input.campaignDisplayProductId);
    if (!product) throw new Error("Display product was not found.");
    if ((input.patch.minimumFacings !== undefined && (!Number.isInteger(input.patch.minimumFacings) || input.patch.minimumFacings < 0))
      || (input.patch.minimumQuantity !== undefined && (!Number.isInteger(input.patch.minimumQuantity) || input.patch.minimumQuantity < 0))) throw new Error("Minimum facings and quantity must be non-negative whole numbers.");
    Object.assign(product, input.patch);
    this.persist();
    return structuredClone(product);
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
    return this.saveDisplayAssignment(input);
  }

  async updateDisplayAssignment(id: UUID, input: CreateDisplayAssignmentInput) {
    if (!this.state.displayAssignments.some((item) => item.id === id)) {
      throw new Error("Display assignment was not found.");
    }
    return this.saveDisplayAssignment(input, id);
  }

  async applyOndImport(input: ApplyOndImportInput): Promise<void> {
    const stagedAssignments = [...this.state.displayAssignments];
    const importedAssignments: typeof this.state.displayAssignments = [];
    const importedProducts: typeof this.state.displayAssignmentProducts = [];
    for (const item of input.assignments) {
      const { assignment, products } = item;
      const store = this.state.stores.find((candidate) => candidate.id === assignment.storeId);
      const area = this.state.displayAreas.find((candidate) => candidate.id === assignment.displayAreaId);
      if (!store || !area || area.storeId !== store.id) throw new Error("Imported store or display area is invalid.");
      if (assignment.programId !== input.program.id || assignment.startDate < input.program.startDate || assignment.endDate > input.program.endDate) {
        throw new Error("Imported assignment dates must remain inside the imported program.");
      }
      if (assignment.periodId) {
        const period = this.state.programPeriods.find((candidate) => candidate.id === assignment.periodId && candidate.programId === input.program.id);
        if (!period || assignment.startDate < period.startDate || assignment.endDate > period.endDate) throw new Error("Imported program period is invalid.");
      }
      const errors = [...validateDisplayAssignment(assignment, stagedAssignments), ...validateDisplayAssignmentProducts(products)];
      if (errors.length) throw new Error(errors.join(" "));
      const id = crypto.randomUUID();
      const normalized = { ...assignment, id };
      stagedAssignments.push(normalized);
      importedAssignments.push(normalized);
      importedProducts.push(...products.map((product) => ({ ...product, id: crypto.randomUUID(), assignmentId: id })));
    }
    for (const option of input.supplierProductOptions) {
      if (!this.state.suppliers.some((supplier) => supplier.id === option.supplierId)) throw new Error("Imported supplier option references an unknown supplier.");
    }
    this.state.programs = this.state.programs.filter((program) => program.id !== input.program.id);
    this.state.programs.push(structuredClone(input.program));
    this.state.displayAssignments.push(...importedAssignments);
    this.state.displayAssignmentProducts.push(...importedProducts);
    for (const option of input.supplierProductOptions) {
      this.state.supplierProductOptions = this.state.supplierProductOptions.filter((candidate) => candidate.productId !== option.productId || candidate.supplierId !== option.supplierId);
      this.state.supplierProductOptions.push(structuredClone(option));
    }
    await this.refreshOrderRecommendationsInternal({ programId: input.program.id });
    this.persist();
  }

  private async saveDisplayAssignment(input: CreateDisplayAssignmentInput, assignmentId?: UUID) {
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
      ...validateDisplayAssignment(candidate, this.state.displayAssignments.filter((item) => item.id !== assignmentId)),
      ...validateDisplayAssignmentProducts(products),
    ];
    if (errors.length) throw new Error(errors.join(" "));

    const assignment = { id: assignmentId ?? crypto.randomUUID(), ...candidate };
    this.state.displayAssignments = this.state.displayAssignments.filter((item) => item.id !== assignment.id);
    this.state.displayAssignments.push(assignment);
    this.state.displayAssignmentProducts = this.state.displayAssignmentProducts.filter((product) => product.assignmentId !== assignment.id);
    this.state.displayAssignmentProducts.push(...products.map((product) => ({
      ...product,
      id: crypto.randomUUID(),
      assignmentId: assignment.id,
    })));
    await this.refreshOrderRecommendationsInternal({ programId: assignment.programId, storeId: assignment.storeId });
    this.persist();
    return structuredClone(assignment);
  }

  async publishProgram(input: PublishProgramInput): Promise<PublishProgramResult> {
    const program = this.state.programs.find((item) => item.id === input.programId);
    if (!program) throw new Error("Merchandising program was not found.");
    const assignments = this.state.displayAssignments.filter((item) => item.programId === program.id && item.status !== "cancelled");
    if (!assignments.length) throw new Error("At least one display assignment is required before publishing.");
    const validationErrors = assignments.flatMap((assignment) => {
      const products = this.state.displayAssignmentProducts.filter((item) => item.assignmentId === assignment.id);
      return [
        ...validateDisplayAssignment(assignment, assignments.filter((item) => item.id !== assignment.id)),
        ...validateDisplayAssignmentProducts(products),
        ...products.filter((product) => !this.state.supplierProductOptions.some((option) => option.productId === product.productId)).map((product) => `SKU ${product.sku} has no supplier option.`),
      ];
    });
    if (validationErrors.length) throw new Error([...new Set(validationErrors)].join(" "));

    const scopedStores = this.state.programStores.filter((item) => item.programId === program.id && item.included);
    const warnings = scopedStores.flatMap((programStore) => {
      const storeAssignments = assignments.filter((item) => item.storeId === programStore.storeId);
      const store = this.state.stores.find((item) => item.id === programStore.storeId);
      if (!storeAssignments.length) return [`${store?.name ?? "An included store"} has no display assignments and remains not started.`];
      const assignedAreas = new Set(storeAssignments.map((item) => item.displayAreaId));
      const unassigned = this.state.displayAreas.filter((item) => item.storeId === programStore.storeId && !assignedAreas.has(item.id)).length;
      return unassigned ? [`${store?.name ?? "An included store"} has ${unassigned} unassigned display space${unassigned === 1 ? "" : "s"}.`] : [];
    });

    this.state.programReleases.forEach((release) => {
      if (release.programId === program.id && release.status === "published") release.status = "superseded";
    });
    const version = Math.max(0, ...this.state.programReleases.filter((item) => item.programId === program.id).map((item) => item.version)) + 1;
    const releaseId = crypto.randomUUID();
    const executionIds: string[] = [];
    for (const assignment of assignments) {
      assignment.status = "ready";
      const prior = assignments.some((item) => item.displayAreaId === assignment.displayAreaId && item.endDate < assignment.startDate);
      let execution = this.state.executions.find((item) => item.displayAssignmentId === assignment.id);
      if (!execution) {
        execution = {
          id: crypto.randomUUID(), displayAssignmentId: assignment.id, dueDate: assignment.startDate,
          status: "not_started", taskType: prior ? "reset" : "initial_set", programReleaseId: releaseId,
        };
        this.state.executions.push(execution);
      } else {
        execution.programReleaseId = releaseId;
        execution.taskType = prior ? "reset" : "initial_set";
      }
      executionIds.push(execution.id);
    }
    program.status = "active";
    for (const programStore of scopedStores) {
      programStore.status = assignments.some((item) => item.storeId === programStore.storeId) ? "published" : "not_started";
    }
    const recommendationCount = await this.refreshOrderRecommendationsInternal({ programId: program.id });
    const recommendationIds = this.state.orderRecommendations
      .filter((item) => assignments.some((assignment) => assignment.id === item.displayAssignmentId))
      .map((item) => item.id);
    this.state.programReleases.push({
      id: releaseId, programId: program.id, version, status: "published", publishedAt: this.clock.now(), publishedBy: input.publishedBy,
      assignmentIds: assignments.map((item) => item.id),
      assignments: assignments.map((assignment) => ({
        assignment: structuredClone(assignment),
        products: structuredClone(this.state.displayAssignmentProducts.filter((item) => item.assignmentId === assignment.id)),
      })),
      executionIds, recommendationIds,
    });
    this.persist();
    return { releaseId, version, executionCount: executionIds.length, recommendationCount, warnings };
  }

  async refreshOrderRecommendations(input: RefreshOrderRecommendationsInput): Promise<number> {
    const count = await this.refreshOrderRecommendationsInternal(input);
    this.persist();
    return count;
  }

  private async refreshOrderRecommendationsInternal(input: RefreshOrderRecommendationsInput): Promise<number> {
    const assignments = this.state.displayAssignments.filter((item) =>
      item.programId === input.programId && item.status !== "cancelled" && (!input.storeId || item.storeId === input.storeId),
    );
    const assignmentIds = new Set(assignments.map((item) => item.id));
    const existing = this.state.orderRecommendations.filter((item) => assignmentIds.has(item.displayAssignmentId ?? ""));
    const preservedOrdered = existing.filter((item) => item.status === "ordered");
    const generated: OrderRecommendation[] = [];
    const recommendationDate = input.recommendationDate ?? this.clock.today();
    const demand = new RuleBasedOndDemandService(new MockHistoricalDemandSource(this.state.historicalDemand));
    const service = new RuleBasedOrderRecommendationService(demand);
    for (const assignment of assignments) {
      for (const assignmentProduct of this.state.displayAssignmentProducts.filter((item) => item.assignmentId === assignment.id)) {
        if (preservedOrdered.some((item) => item.displayAssignmentId === assignment.id && item.productId === assignmentProduct.productId)) continue;
        const previous = existing.find((item) => item.displayAssignmentId === assignment.id && item.productId === assignmentProduct.productId);
        const strategy = this.state.bridgeStrategies.find((item) => item.productId === assignmentProduct.productId);
        const details = productDetails(assignmentProduct, this.state);
        const type = strategy?.strategy === "EXIT" ? "exit_control" : strategy?.strategy === "BRIDGE_BUY" && strategy.eligibility === "yes" ? "bridge_buy" : "opening_fill";
        const result = await service.generate({
          id: previous?.id ?? crypto.randomUUID(), storeId: assignment.storeId, productId: assignmentProduct.productId,
          category: details.category, displayAssignmentId: assignment.id, recommendationDate,
          requiredByDate: assignment.startDate < recommendationDate ? recommendationDate : assignment.startDate,
          recommendationType: type,
        }, this.state);
        let recommendation = result.recommendation;
        if (type === "exit_control") {
          const residualInput = this.state.residualDemandInputs.find((item) => item.storeId === assignment.storeId && item.productId === assignmentProduct.productId);
          const projection = strategy && residualInput ? calculateResidualInventory(strategy, residualInput) : undefined;
          recommendation = { ...recommendation, recommendedCases: 0, rationale: projection?.explanation ?? "Exit strategy. Do not add inventory beyond the assignment requirement." };
        } else if (type === "bridge_buy") {
          const residualInput = this.state.residualDemandInputs.find((item) => item.storeId === assignment.storeId && item.productId === assignmentProduct.productId);
          const projection = strategy && residualInput ? calculateResidualInventory(strategy, residualInput) : undefined;
          if (projection) recommendation = {
            ...recommendation,
            recommendedCases: Math.max(recommendation.recommendedCases, projection.safeBridgeQuantity),
            rationale: `${recommendation.rationale} ${projection.explanation}`,
          };
        }
        generated.push({
          ...recommendation,
          note: previous?.note,
          status: previous && ["accepted", "edited"].includes(previous.status) ? "pending" : recommendation.status,
          forecastCases: Math.ceil(result.forecast.dailyDemand.reduce((sum, day) => sum + day.expectedCases, 0)),
          forecastConfidence: result.forecast.confidence,
          forecastSource: result.forecast.source,
          generatedAt: this.clock.now(),
        });
      }
    }
    this.state.orderRecommendations = this.state.orderRecommendations.filter((item) => !assignmentIds.has(item.displayAssignmentId ?? ""));
    this.state.orderRecommendations.push(...preservedOrdered, ...generated);
    return generated.length;
  }

  async createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<UUID> {
    const recommendations = input.recommendationIds.map((id) => this.state.orderRecommendations.find((item) => item.id === id));
    if (!input.recommendationIds.length || recommendations.some((item) => !item)) throw new Error("Select at least one valid recommendation.");
    if (recommendations.some((item) => item!.storeId !== input.storeId || item!.supplierId !== input.supplierId)) {
      throw new Error("Purchase order recommendations must share one store and supplier.");
    }
    if (recommendations.some((item) => item!.recommendedCases <= 0 || ["dismissed", "ordered"].includes(item!.status))) {
      throw new Error("Only actionable, positive recommendations can be ordered.");
    }
    const id = crypto.randomUUID();
    const expectedArrivalDate = recommendations.map((item) => item!.requiredByDate).sort()[0];
    const lines = recommendations.map((item) => ({
      id: crypto.randomUUID(), purchaseOrderId: id, recommendationId: item!.id, productId: item!.productId, cases: item!.recommendedCases,
    }));
    this.state.purchaseOrders.push({ id, storeId: input.storeId, supplierId: input.supplierId, programId: input.programId, createdAt: this.clock.now(), expectedArrivalDate, status: "submitted", lines });
    for (const item of recommendations) {
      item!.status = "ordered";
      this.state.inboundOrders.push({
        id: crypto.randomUUID(), storeId: input.storeId, productId: item!.productId, supplierId: input.supplierId,
        cases: item!.recommendedCases, expectedArrivalDate, status: "submitted",
      });
    }
    if (input.programId) await this.refreshOrderRecommendationsInternal({ programId: input.programId, storeId: input.storeId });
    this.persist();
    return id;
  }

  async setProgramStore(input: SetProgramStoreInput): Promise<void> {
    if (!this.state.programs.some((item) => item.id === input.programId)) throw new Error("Merchandising program was not found.");
    if (!this.state.stores.some((item) => item.id === input.storeId)) throw new Error("Store was not found.");
    const existing = this.state.programStores.find((item) => item.programId === input.programId && item.storeId === input.storeId);
    if (existing) {
      existing.included = input.included;
      if (!input.included) existing.status = "not_started";
    } else {
      this.state.programStores.push({ id: crypto.randomUUID(), programId: input.programId, storeId: input.storeId, included: input.included, status: "not_started" });
    }
    this.persist();
  }

  async saveBridgeStrategy(strategy: BridgeStrategy): Promise<void> {
    this.state.bridgeStrategies = this.state.bridgeStrategies.filter((item) => item.productId !== strategy.productId);
    this.state.bridgeStrategies.push(structuredClone(strategy));
    const affectedPrograms = new Set(this.state.displayAssignmentProducts
      .filter((item) => item.productId === strategy.productId)
      .map((product) => this.state.displayAssignments.find((assignment) => assignment.id === product.assignmentId)?.programId)
      .filter((programId): programId is string => Boolean(programId)));
    for (const programId of affectedPrograms) await this.refreshOrderRecommendationsInternal({ programId });
    this.persist();
  }

  async completeExecution(input: CompleteExecutionInput): Promise<void> {
    const execution = this.state.executions.find((item) => item.id === input.executionId);
    if (!execution) throw new Error("Execution task was not found.");
    execution.status = input.unavailableSkus.length ? "issue" : "completed";
    execution.submission = {
      id: crypto.randomUUID(), executionId: execution.id, submittedAt: this.clock.now(),
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
      reviewedAt: this.clock.now(), decision: input.decision,
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

  async updateOrderRecommendation(input: UpdateOrderRecommendationInput): Promise<void> {
    const recommendation = this.state.orderRecommendations.find((item) => item.id === input.id);
    if (!recommendation) throw new Error("Order recommendation was not found.");
    if (input.recommendedCases !== undefined && (!Number.isInteger(input.recommendedCases) || input.recommendedCases < 0)) {
      throw new Error("Recommended cases must be a non-negative whole number.");
    }
    recommendation.status = input.status;
    if (input.recommendedCases !== undefined) recommendation.recommendedCases = input.recommendedCases;
    recommendation.note = input.note;
    this.persist();
  }

  async reset(): Promise<void> {
    this.state = cloneSeed();
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  }
}
