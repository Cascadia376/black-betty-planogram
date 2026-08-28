/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MockMerchandisingRepository } from "../adapters/mock/MockMerchandisingRepository";
import type {
  AddCampaignProductsInput, ApplyCampaignProductImportInput, ApplyOndImportInput, AssignCampaignInput, AssignCampaignProductsToDisplayInput, CompleteExecutionInput, CreateCampaignDisplayInput, CreateDisplayAssignmentInput, CreatePendingProductInput, CreatePurchaseOrderInput, MerchandisingRepository,
  ApplyCampaignDisplayQuantityInput, PublishProgramInput, PublishProgramResult, RefreshOrderRecommendationsInput, ReorderCampaignDisplayInput, ReorderCampaignDisplayProductInput, SetCampaignStoresInput, SetProgramStoreInput, SuggestCampaignDisplayInput, SubmitComplianceInput, UpdateCampaignDisplayAssignmentInput, UpdateCampaignDisplayAssignmentProductInput, UpdateCampaignDisplayInput, UpdateCampaignDisplayProductInput, UpdateCampaignProductInput, UpdateOrderRecommendationInput,
} from "../domain/repositories";
import type { CampaignDisplay, CampaignDisplayAssignment, CampaignDisplayAssignmentProduct, CampaignDisplayProduct, CampaignProduct, NewCampaignInput, PlatformSnapshot, Product, RecommendationStatus, UUID, UserRole } from "../domain/types";

const repository = new MockMerchandisingRepository();

interface PlatformContextValue {
  data?: PlatformSnapshot;
  loading: boolean;
  error?: string;
  role: UserRole;
  setRole(role: UserRole): void;
  refresh(): Promise<void>;
  searchProducts(query: string): Promise<Product[]>;
  createPendingProduct(input: CreatePendingProductInput): Promise<Product>;
  createCampaign(input: NewCampaignInput): Promise<UUID>;
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
  assignCampaign(input: AssignCampaignInput): Promise<void>;
  createDisplayAssignment(input: CreateDisplayAssignmentInput): Promise<void>;
  updateDisplayAssignment(id: UUID, input: CreateDisplayAssignmentInput): Promise<void>;
  applyOndImport(input: ApplyOndImportInput): Promise<void>;
  publishProgram(input: PublishProgramInput): Promise<PublishProgramResult>;
  refreshOrderRecommendations(input: RefreshOrderRecommendationsInput): Promise<number>;
  createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<UUID>;
  setProgramStore(input: SetProgramStoreInput): Promise<void>;
  completeExecution(input: CompleteExecutionInput): Promise<void>;
  reviewCompliance(input: SubmitComplianceInput): Promise<void>;
  updateRecommendation(id: UUID, status: RecommendationStatus, note?: string): Promise<void>;
  updateOrderRecommendation(input: UpdateOrderRecommendationInput): Promise<void>;
  resetDemo(): Promise<void>;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformProvider({ children, adapter = repository }: { children: ReactNode; adapter?: MerchandisingRepository }) {
  const [data, setData] = useState<PlatformSnapshot>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [role, setRole] = useState<UserRole>("merchandising");

  const refresh = useCallback(async () => {
    try {
      setData(await adapter.load());
      setError(undefined);
    } catch (cause) {
      console.error("Failed to load merchandising data", cause);
      setError(cause instanceof Error ? cause.message : "Unable to load merchandising data.");
    } finally {
      setLoading(false);
    }
  }, [adapter]);

  // The repository is an external data source and must be synchronized on mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const mutate = useCallback(async (operation: () => Promise<unknown>) => {
    try {
      await operation();
      await refresh();
    } catch (cause) {
      console.error("Merchandising operation failed", cause);
      throw cause;
    }
  }, [refresh]);

  const value = useMemo<PlatformContextValue>(() => ({
    data, loading, error, role, setRole, refresh,
    searchProducts: (query) => adapter.searchProducts(query),
    createPendingProduct: async (input) => {
      let product: Product | undefined;
      await mutate(async () => { product = await adapter.createPendingProduct(input); });
      if (!product) throw new Error("Pending product creation did not return a product.");
      return product;
    },
    createCampaign: async (input) => {
      let id = "";
      await mutate(async () => { id = await adapter.createCampaign(input); });
      return id;
    },
    addCampaignProducts: async (input) => {
      let products: CampaignProduct[] | undefined;
      await mutate(async () => { products = await adapter.addCampaignProducts(input); });
      return products ?? [];
    },
    applyCampaignProductImport: async (input) => {
      let products: CampaignProduct[] | undefined;
      await mutate(async () => { products = await adapter.applyCampaignProductImport(input); });
      return products ?? [];
    },
    updateCampaignProduct: async (input) => {
      let product: CampaignProduct | undefined;
      await mutate(async () => { product = await adapter.updateCampaignProduct(input); });
      if (!product) throw new Error("Campaign product update did not return a product.");
      return product;
    },
    removeCampaignProduct: (campaignId, campaignProductId) => mutate(() => adapter.removeCampaignProduct(campaignId, campaignProductId)).then(() => undefined),
    createCampaignDisplay: async (input) => { let display: CampaignDisplay | undefined; await mutate(async () => { display = await adapter.createCampaignDisplay(input); }); if (!display) throw new Error("Campaign display creation did not return a display."); return display; },
    updateCampaignDisplay: async (input) => { let display: CampaignDisplay | undefined; await mutate(async () => { display = await adapter.updateCampaignDisplay(input); }); if (!display) throw new Error("Campaign display update did not return a display."); return display; },
    reorderCampaignDisplay: (input) => mutate(() => adapter.reorderCampaignDisplay(input)).then(() => undefined),
    removeCampaignDisplay: (id) => mutate(() => adapter.removeCampaignDisplay(id)).then(() => undefined),
    assignCampaignProductsToDisplay: async (input) => { let products: CampaignDisplayProduct[] | undefined; await mutate(async () => { products = await adapter.assignCampaignProductsToDisplay(input); }); return products ?? []; },
    removeCampaignProductFromDisplay: (id) => mutate(() => adapter.removeCampaignProductFromDisplay(id)).then(() => undefined),
    setCampaignProductShelfSupport: (campaignId, ids) => mutate(() => adapter.setCampaignProductShelfSupport(campaignId, ids)).then(() => undefined),
    setCampaignProductUnassigned: (campaignId, ids) => mutate(() => adapter.setCampaignProductUnassigned(campaignId, ids)).then(() => undefined),
    updateCampaignDisplayProduct: async (input) => { let product: CampaignDisplayProduct | undefined; await mutate(async () => { product = await adapter.updateCampaignDisplayProduct(input); }); if (!product) throw new Error("Display product update did not return a product."); return product; },
    reorderCampaignDisplayProduct: (input) => mutate(() => adapter.reorderCampaignDisplayProduct(input)).then(() => undefined),
    setCampaignStores: (input) => mutate(() => adapter.setCampaignStores(input)).then(() => undefined),
    suggestCampaignDisplay: async (input) => { let result: CampaignDisplayAssignment[] = []; await mutate(async () => { result = await adapter.suggestCampaignDisplay(input); }); return result; },
    updateCampaignDisplayAssignment: async (input) => { let result: CampaignDisplayAssignment | undefined; await mutate(async () => { result = await adapter.updateCampaignDisplayAssignment(input); }); if (!result) throw new Error("Campaign display allocation update did not return an allocation."); return result; },
    updateCampaignDisplayAssignmentProduct: async (input) => { let result: CampaignDisplayAssignmentProduct | undefined; await mutate(async () => { result = await adapter.updateCampaignDisplayAssignmentProduct(input); }); if (!result) throw new Error("Allocation product update did not return a product."); return result; },
    applyCampaignDisplayQuantity: (input) => mutate(() => adapter.applyCampaignDisplayQuantity(input)).then(() => undefined),
    assignCampaign: (input) => mutate(() => adapter.assignCampaign(input)).then(() => undefined),
    createDisplayAssignment: (input) => mutate(() => adapter.createDisplayAssignment(input)).then(() => undefined),
    updateDisplayAssignment: (id, input) => mutate(() => adapter.updateDisplayAssignment(id, input)).then(() => undefined),
    applyOndImport: (input) => mutate(() => adapter.applyOndImport(input)).then(() => undefined),
    publishProgram: async (input) => {
      let result: PublishProgramResult | undefined;
      await mutate(async () => { result = await adapter.publishProgram(input); });
      if (!result) throw new Error("Program publish did not return a result.");
      return result;
    },
    refreshOrderRecommendations: async (input) => {
      let count = 0;
      await mutate(async () => { count = await adapter.refreshOrderRecommendations(input); });
      return count;
    },
    createPurchaseOrder: async (input) => {
      let id = "";
      await mutate(async () => { id = await adapter.createPurchaseOrder(input); });
      return id;
    },
    setProgramStore: (input) => mutate(() => adapter.setProgramStore(input)).then(() => undefined),
    completeExecution: (input) => mutate(() => adapter.completeExecution(input)).then(() => undefined),
    reviewCompliance: (input) => mutate(() => adapter.reviewCompliance(input)).then(() => undefined),
    updateRecommendation: (id, status, note) => mutate(() => adapter.updateRecommendation(id, status, note)).then(() => undefined),
    updateOrderRecommendation: (input) => mutate(() => adapter.updateOrderRecommendation(input)).then(() => undefined),
    resetDemo: () => mutate(() => adapter.reset()).then(() => undefined),
  }), [adapter, data, error, loading, mutate, refresh, role]);

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) throw new Error("usePlatform must be used inside PlatformProvider.");
  return context;
}
