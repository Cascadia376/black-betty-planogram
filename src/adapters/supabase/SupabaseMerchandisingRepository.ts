import type { SupabaseClient } from "@supabase/supabase-js";
import type { MerchandisingRepository, PublishCampaignInput } from "../../domain/repositories";
import type { PlatformSnapshot, Product } from "../../domain/types";
import { MockMerchandisingRepository } from "../mock/MockMerchandisingRepository";
import { seedSnapshot } from "../mock/seed";
import { SystemBusinessClock } from "../../services/clock";

export type PhysicalReferenceSnapshot = Pick<
  PlatformSnapshot,
  | "storeLayouts"
  | "categorySpaces"
  | "categorySpaceSections"
  | "zones"
  | "fixtures"
  | "displayAreas"
  | "displayAreaSections"
>;

type SharedPlanningCollections = Pick<
  PlatformSnapshot,
  | "displayAssignments"
  | "displayAssignmentProducts"
  | "programs"
  | "programStores"
  | "campaigns"
  | "campaignImports"
  | "campaignStoreProductAllocations"
  | "campaignDisplays"
  | "campaignDisplayProducts"
  | "campaignStores"
  | "campaignDisplayAssignments"
  | "campaignDisplayAssignmentProducts"
  | "campaignReleases"
  | "storeReleaseNotices"
  | "assignments"
  | "executions"
  | "complianceReviews"
  | "history"
>;

export type SharedPlanningSnapshot = SharedPlanningCollections & {
  /** Product Master records referenced by campaigns; the master tables remain authoritative. */
  campaignProducts: Product[];
};

interface SharedPlanningRow {
  planning: SharedPlanningSnapshot;
  version: number;
  updated_at: string;
  updated_by?: string;
}

interface PhysicalReferenceRow {
  physical: PhysicalReferenceSnapshot;
  version: number;
  updated_at: string;
  updated_by?: string;
}

const SHARED_KEYS: Array<keyof SharedPlanningCollections> = [
  "programs", "programStores", "displayAssignments", "displayAssignmentProducts", "campaigns", "campaignImports", "campaignStoreProductAllocations",
  "campaignDisplays", "campaignDisplayProducts", "campaignStores", "campaignDisplayAssignments",
  "campaignDisplayAssignmentProducts", "campaignReleases", "storeReleaseNotices", "assignments", "executions",
  "complianceReviews", "history",
];

const PHYSICAL_KEYS: Array<keyof PhysicalReferenceSnapshot> = [
  "storeLayouts", "categorySpaces", "categorySpaceSections", "zones", "fixtures", "displayAreas", "displayAreaSections",
];

export const PHYSICAL_LAYOUT_MUTATIONS = new Set<keyof MerchandisingRepository>([
  "updateCategorySpace", "createStoreLayout", "duplicateStoreLayout", "setCurrentStoreLayout",
  "createDisplayArea", "updateDisplayArea", "deleteDisplayArea",
]);

// Only operations whose complete effects are serialized may succeed in shared mode.
// Prototype ordering, supplier intake and measurement mutate collections not in
// SHARED_KEYS; permitting them would report success and then lose the change.
export const SHARED_PLANNING_MUTATIONS = new Set<keyof MerchandisingRepository>([
  "createCampaign", "updateCampaign", "addCampaignProducts", "applyCampaignProductImport",
  "applyCampaignWorkbookImport", "applyStoreDisplayWorkbook", "reconcilePendingCampaignProduct",
  "updateCampaignProduct", "removeCampaignProduct", "createCampaignDisplay", "updateCampaignDisplay",
  "reorderCampaignDisplay", "removeCampaignDisplay", "assignCampaignProductsToDisplay",
  "removeCampaignProductFromDisplay", "setCampaignProductShelfSupport", "setCampaignProductUnassigned",
  "updateCampaignDisplayProduct", "reorderCampaignDisplayProduct", "setCampaignStores",
  "suggestCampaignDisplay", "updateCampaignDisplayAssignment", "updateCampaignDisplayAssignmentProduct",
  "applyCampaignDisplayQuantity", "publishCampaign",
]);

const READ_ONLY_METHODS = new Set(["getCommittedSnapshot", "getStoreLayouts", "getStoreLayout", "getCategorySpaces", "searchProducts"]);

export class SharedPlanningConflictError extends Error {
  constructor() {
    super("This campaign changed after you opened it. Reload the latest shared plan, review the other user's changes, and try again.");
    this.name = "SharedPlanningConflictError";
  }
}

export class PhysicalReferenceConflictError extends Error {
  constructor() {
    super("The physical store layout changed after you opened it. Reload the latest layout before making another layout edit.");
    this.name = "PhysicalReferenceConflictError";
  }
}

export function sharedPlanningFromSnapshot(snapshot: PlatformSnapshot): SharedPlanningSnapshot {
  const shared = Object.fromEntries(SHARED_KEYS.map((key) => [key, structuredClone(snapshot[key])])) as SharedPlanningCollections;
  const campaignProductIds = new Set([
    ...snapshot.campaigns.flatMap((campaign) => campaign.products.map((product) => product.productId)),
    ...snapshot.campaignStoreProductAllocations.map((allocation) => allocation.productId),
  ]);
  return { ...shared, campaignProducts: structuredClone(snapshot.products.filter((product) => campaignProductIds.has(product.id))) };
}

export function physicalReferenceFromSnapshot(snapshot: PlatformSnapshot): PhysicalReferenceSnapshot {
  return Object.fromEntries(PHYSICAL_KEYS.map((key) => [key, structuredClone(snapshot[key])])) as PhysicalReferenceSnapshot;
}

function mergeSharedState(planning: SharedPlanningSnapshot, physical: PhysicalReferenceSnapshot): PlatformSnapshot {
  // Reject incomplete server documents rather than filling them with demo plans.
  for (const [label, value, keys] of [
    ["planning", planning, [...SHARED_KEYS, "campaignProducts"]],
    ["physical", physical, PHYSICAL_KEYS],
  ] as const) {
    if (!value || typeof value !== "object" || keys.some((key) => !Array.isArray((value as unknown as Record<string, unknown>)[key]))) {
      throw new Error(`The shared ${label} document is incomplete or damaged. No data was changed. Ask support to validate the stored snapshot before continuing.`);
    }
  }
  const shared = structuredClone(planning);
  const products = new Map(seedSnapshot.products.map((product) => [product.id, structuredClone(product)]));
  (shared.campaignProducts ?? []).forEach((product) => products.set(product.id, product));
  const collections = Object.fromEntries(SHARED_KEYS.map((key) => [key, shared[key]])) as SharedPlanningCollections;
  return { ...structuredClone(seedSnapshot), ...collections, ...structuredClone(physical), products: [...products.values()] };
}

/**
 * Preserves existing aggregate/domain behavior while sharing mutable planning
 * state through separately versioned, RLS-protected planning and physical
 * reference documents.
 */
export function createSupabaseMerchandisingRepository(client: SupabaseClient): MerchandisingRepository {
  const localRepository = new MockMerchandisingRepository(new SystemBusinessClock(), structuredClone(seedSnapshot), false);
  let initialized = false;
  let loadedPlanningVersion = 0;
  let loadedPhysicalVersion = 0;
  let mutationQueue = Promise.resolve();
  const enqueue = <T,>(operation: () => Promise<T>): Promise<T> => {
    const result = mutationQueue.then(operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
  };

  const loadRemote = async (): Promise<PlatformSnapshot> => {
    const [planningResult, physicalResult] = await Promise.all([
      client.from("black_betty_planning_snapshot").select("planning, version, updated_at, updated_by").eq("singleton", true).single(),
      client.from("black_betty_physical_snapshot").select("physical, version, updated_at, updated_by").eq("singleton", true).single(),
    ]);
    if (planningResult.error) throw new Error(`Unable to load shared Black Betty planning data: ${planningResult.error.message}`);
    if (physicalResult.error) throw new Error(`Unable to load canonical Black Betty physical data: ${physicalResult.error.message}`);
    const planningRow = planningResult.data as SharedPlanningRow;
    const physicalRow = physicalResult.data as PhysicalReferenceRow;
    if (!Number.isSafeInteger(planningRow?.version) || planningRow.version < 1 || !Number.isSafeInteger(physicalRow?.version) || physicalRow.version < 1) {
      throw new Error("The shared snapshot revision is invalid. No data was changed; ask support to check the stored revision.");
    }
    const snapshot = mergeSharedState(planningRow.planning, physicalRow.physical);
    localRepository.replaceSnapshot(snapshot);
    loadedPlanningVersion = planningRow.version;
    loadedPhysicalVersion = physicalRow.version;
    initialized = true;
    return structuredClone(snapshot);
  };

  const ensureInitialized = async (): Promise<void> => {
    if (!initialized) await loadRemote();
  };

  const persistPlanning = async (): Promise<void> => {
    const snapshot = await localRepository.load();
    const { data, error } = await client
      .from("black_betty_planning_snapshot")
      .update({ planning: sharedPlanningFromSnapshot(snapshot) })
      .eq("singleton", true)
      .eq("version", loadedPlanningVersion)
      .select("planning, version, updated_at, updated_by")
      .maybeSingle();
    if (error) throw new Error(`Unable to save shared Black Betty planning data: ${error.message}`);
    if (!data) throw new SharedPlanningConflictError();
    loadedPlanningVersion = (data as SharedPlanningRow).version;
  };

  const persistPhysicalReference = async (): Promise<void> => {
    const snapshot = await localRepository.load();
    const { data, error } = await client
      .from("black_betty_physical_snapshot")
      .update({ physical: physicalReferenceFromSnapshot(snapshot) })
      .eq("singleton", true)
      .eq("version", loadedPhysicalVersion)
      .select("physical, version, updated_at, updated_by")
      .maybeSingle();
    if (error) throw new Error(`Unable to save canonical Black Betty physical data: ${error.message}`);
    if (!data) throw new PhysicalReferenceConflictError();
    loadedPhysicalVersion = (data as PhysicalReferenceRow).version;
  };

  return new Proxy(localRepository, {
    get(target, property, receiver) {
      const member = Reflect.get(target, property, receiver);
      if (typeof member !== "function") return member;
      if (property === "load") return () => enqueue(loadRemote);

      return (...args: unknown[]) => {
        if (READ_ONLY_METHODS.has(String(property))) {
          return enqueue(async () => { await ensureInitialized(); return member.apply(target, args); });
        }
        if (property === "reset") {
          return Promise.reject(new Error("Shared planning data cannot be reset from the browser."));
        }
        if (property === "createPendingProduct") {
          return Promise.reject(new Error("Create pending products through the secured Product Master workflow before adding them to a shared campaign."));
        }

        if (!SHARED_PLANNING_MUTATIONS.has(property as keyof MerchandisingRepository) && !PHYSICAL_LAYOUT_MUTATIONS.has(property as keyof MerchandisingRepository)) {
          return Promise.reject(new Error("This prototype action is not available in shared planning. Nothing was changed. Use campaigns, store placements and floorplan editing; ordering and execution integrations are not live."));
        }
        return enqueue(async () => {
          await ensureInitialized();
          const before = await localRepository.load();
          if (property === "publishCampaign") {
            const { campaignId } = args[0] as PublishCampaignInput;
            const productIds = new Set(before.campaigns.find((campaign) => campaign.id === campaignId)?.products.map((item) => item.productId));
            if (before.products.some((product) => productIds.has(product.id) && product.synthetic)) {
              throw new Error("This campaign contains demo products. Replace them with verified Product Master products before publishing a shared store pack. Nothing was published.");
            }
          }
          try {
            const result = await member.apply(target, args);
            if (PHYSICAL_LAYOUT_MUTATIONS.has(property as keyof MerchandisingRepository)) await persistPhysicalReference();
            else await persistPlanning();
            return result;
          } catch (cause) {
            localRepository.replaceSnapshot(before);
            throw cause;
          }
        });
      };
    },
  }) as MerchandisingRepository;
}
