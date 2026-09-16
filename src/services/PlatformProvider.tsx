/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { MockMerchandisingRepository } from "../adapters/mock/MockMerchandisingRepository";
import { MockProductMasterLookup } from "../adapters/mock/MockProductMasterLookup";
import { SupabaseProductMasterLookup } from "../adapters/supabase/SupabaseProductMasterLookup";
import type {
  AddCampaignProductsInput, ApplyCampaignProductImportInput, ApplyCampaignWorkbookImportInput, ApplyCampaignWorkbookImportResult, ApplyOndImportInput, AssignCampaignInput, AssignCampaignProductsToDisplayInput, CompleteExecutionInput, CreateCampaignDisplayInput, CreateDisplayAreaInput, CreateDisplayAssignmentInput, CreatePendingProductInput, CreatePurchaseOrderInput, MerchandisingRepository,
  ApplyCampaignDisplayQuantityInput, ApplySupplierSubmissionImportInput, ApplySupplierSubmissionImportResult, PublishProgramInput, PublishProgramResult, RefreshOrderRecommendationsInput, ReorderCampaignDisplayInput, ReorderCampaignDisplayProductInput, SetCampaignStoresInput, SetProgramStoreInput, SuggestCampaignDisplayInput, SubmitComplianceInput, UpdateCampaignDisplayAssignmentInput, UpdateCampaignDisplayAssignmentProductInput, UpdateCampaignDisplayInput, UpdateCampaignDisplayProductInput, UpdateCampaignInput, UpdateCampaignProductInput, UpdateCategorySpaceInput, UpdateDisplayAreaInput, UpdateOrderRecommendationInput, UpdatePromotionOpportunityInput,
} from "../domain/repositories";
import type { Campaign, CampaignDisplay, CampaignDisplayAssignment, CampaignDisplayAssignmentProduct, CampaignDisplayProduct, CampaignProduct, CategorySpace, DisplayArea, NewCampaignInput, PlatformSnapshot, Product, PromotionOpportunity, RecommendationStatus, StoreLayout, UUID, UserRole } from "../domain/types";
import { readEnvironment } from "../lib/environment";
import type { ProductMasterLookup } from "./products/ProductMasterLookup";

const repository = new MockMerchandisingRepository();
const environment = readEnvironment();
const productMasterKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY || environment.VITE_SUPABASE_ANON_KEY;
const configuredSupabase = environment.VITE_SUPABASE_URL && productMasterKey
  ? createClient(environment.VITE_SUPABASE_URL, productMasterKey)
  : undefined;
const configuredProductMaster = configuredSupabase
  ? new SupabaseProductMasterLookup(configuredSupabase)
  : undefined;

type BlackBettyRole = "buyer" | "admin";

interface PlatformContextValue {
  data?: PlatformSnapshot;
  loading: boolean;
  error?: string;
  role: UserRole;
  authEnabled: boolean;
  userEmail?: string;
  blackBettyRole?: BlackBettyRole;
  productMaster: ProductMasterLookup;
  setRole(role: UserRole): void;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  updateCategorySpace(input: UpdateCategorySpaceInput): Promise<CategorySpace>;
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
  applyCampaignWorkbookImport(input: ApplyCampaignWorkbookImportInput): Promise<ApplyCampaignWorkbookImportResult>;
  applySupplierSubmissionImport(input: ApplySupplierSubmissionImportInput): Promise<ApplySupplierSubmissionImportResult>;
  updatePromotionOpportunity(input: UpdatePromotionOpportunityInput): Promise<PromotionOpportunity>;
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

export function PlatformProvider({ children, adapter = repository, productMaster }: { children: ReactNode; adapter?: MerchandisingRepository; productMaster?: ProductMasterLookup }) {
  const [data, setData] = useState<PlatformSnapshot>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [role, setRole] = useState<UserRole>("merchandising");
  const [session, setSession] = useState<Session | null | undefined>(configuredSupabase ? undefined : null);
  const [access, setAccess] = useState<{ userId: string; role?: BlackBettyRole }>();
  const [authError, setAuthError] = useState<string>();
  const blackBettyRole = access && access.userId === session?.user.id ? access.role : undefined;

  useEffect(() => {
    if (!configuredSupabase) return undefined;

    void configuredSupabase.auth.getSession().then(({ data: { session: currentSession }, error: sessionError }) => {
      if (sessionError) setAuthError(sessionError.message);
      setSession(currentSession);
    });
    const { data: { subscription } } = configuredSupabase.auth.onAuthStateChange((_event, currentSession) => {
      setAuthError(undefined);
      setSession(currentSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!configuredSupabase || session === undefined) return;
    if (!session) return;

    let active = true;
    void configuredSupabase
      .from("black_betty_user_access")
      .select("role")
      .eq("email", session.user.email?.trim().toLowerCase() ?? "")
      .maybeSingle()
      .then(({ data: access, error: accessError }) => {
        if (!active) return;
        if (accessError) {
          setAuthError(accessError.message);
          setAccess({ userId: session.user.id });
          return;
        }
        const accessRole = access?.role === "admin" || access?.role === "buyer" ? access.role : undefined;
        setAccess({ userId: session.user.id, role: accessRole });
        setRole(accessRole === "admin" ? "admin" : "merchandising");
        setAuthError(undefined);
      });
    return () => { active = false; };
  }, [session]);

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

  const effectiveProductMaster = useMemo(
    () => productMaster ?? configuredProductMaster ?? new MockProductMasterLookup(data?.products ?? []),
    [data?.products, productMaster],
  );

  const value = useMemo<PlatformContextValue>(() => ({
    data, loading, error, role, setRole, refresh, productMaster: effectiveProductMaster,
    authEnabled: Boolean(configuredSupabase),
    userEmail: session?.user.email,
    blackBettyRole,
    signOut: async () => {
      if (!configuredSupabase) return;
      const { error: signOutError } = await configuredSupabase.auth.signOut();
      if (signOutError) throw signOutError;
    },
    updateCategorySpace: async (input) => { let result: CategorySpace | undefined; await mutate(async () => { result = await adapter.updateCategorySpace(input); }); if (!result) throw new Error("Category space update did not return a result."); return result; },
    duplicateStoreLayout: async (layoutId, name) => { let result: StoreLayout | undefined; await mutate(async () => { result = await adapter.duplicateStoreLayout(layoutId, name); }); if (!result) throw new Error("Layout duplication did not return a result."); return result; },
    setCurrentStoreLayout: (layoutId) => mutate(() => adapter.setCurrentStoreLayout(layoutId)).then(() => undefined),
    createDisplayArea: async (input) => { let result: DisplayArea | undefined; await mutate(async () => { result = await adapter.createDisplayArea(input); }); if (!result) throw new Error("Display area creation did not return a result."); return result; },
    updateDisplayArea: async (input) => { let result: DisplayArea | undefined; await mutate(async () => { result = await adapter.updateDisplayArea(input); }); if (!result) throw new Error("Display area update did not return a result."); return result; },
    deleteDisplayArea: (displayAreaId) => mutate(() => adapter.deleteDisplayArea(displayAreaId)).then(() => undefined),
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
    updateCampaign: async (input) => {
      let campaign: Campaign | undefined;
      await mutate(async () => { campaign = await adapter.updateCampaign(input); });
      if (!campaign) throw new Error("Campaign update did not return a campaign.");
      return campaign;
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
    applyCampaignWorkbookImport: async (input) => {
      let result: ApplyCampaignWorkbookImportResult | undefined;
      await mutate(async () => { result = await adapter.applyCampaignWorkbookImport(input); });
      if (!result) throw new Error("Campaign workbook import did not return a result.");
      return result;
    },
    applySupplierSubmissionImport: async (input) => {
      let result: ApplySupplierSubmissionImportResult | undefined;
      await mutate(async () => { result = await adapter.applySupplierSubmissionImport(input); });
      if (!result) throw new Error("Supplier submission import did not return a result.");
      return result;
    },
    updatePromotionOpportunity: async (input) => {
      let result: PromotionOpportunity | undefined;
      await mutate(async () => { result = await adapter.updatePromotionOpportunity(input); });
      if (!result) throw new Error("Promotion opportunity update did not return a result.");
      return result;
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
  }), [adapter, blackBettyRole, data, effectiveProductMaster, error, loading, mutate, refresh, role, session?.user.email]);

  if (configuredSupabase && session === undefined) return <AuthStatus message="Checking Black Betty access…" />;
  if (configuredSupabase && !session) return <BlackBettySignIn error={authError} />;
  if (configuredSupabase && !blackBettyRole) return <AuthStatus message={authError ?? "Your account does not have Black Betty access."} canSignOut />;

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-page-canvas p-6"><section className="w-full max-w-md rounded-lg border border-border bg-surface p-8 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Black Betty</p>{children}</section></main>;
}

function AuthStatus({ message, canSignOut = false }: { message: string; canSignOut?: boolean }) {
  return <AuthFrame><h1 className="mt-2 text-xl font-semibold">Merchandising operations</h1><p className="mt-3 text-sm text-text-secondary">{message}</p>{canSignOut && <button type="button" className="mt-5 min-h-10 w-full rounded-md border border-border px-4 text-sm font-semibold" onClick={() => { void configuredSupabase?.auth.signOut(); }}>Sign out</button>}</AuthFrame>;
}

function BlackBettySignIn({ error }: { error?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!configuredSupabase) return;
    if (creatingAccount && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setMessage(undefined);
    try {
      const credentials = { email: email.trim().toLowerCase(), password };
      const result = creatingAccount
        ? await configuredSupabase.auth.signUp(credentials)
        : await configuredSupabase.auth.signInWithPassword(credentials);
      if (result.error) setMessage(result.error.message);
      else if (creatingAccount && !result.data.session) setMessage("Account created. Confirm your email before signing in.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <AuthFrame>
      <h1 className="mt-2 text-xl font-semibold">{creatingAccount ? "Create your Black Betty account" : "Sign in to Black Betty"}</h1>
      <p className="mt-3 text-sm text-text-secondary">Use your approved Cascadia or Truffles email. Access is managed separately from Ursus Major.</p>
      {error && <p role="alert" className="mt-4 rounded-md border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</p>}
      <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label className="block text-sm font-medium" htmlFor="black-betty-email">Email</label>
        <input id="black-betty-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" />
        <label className="block text-sm font-medium" htmlFor="black-betty-password">Password</label>
        <input id="black-betty-password" type="password" autoComplete={creatingAccount ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" />
        {creatingAccount && <><label className="block text-sm font-medium" htmlFor="black-betty-confirm-password">Confirm password</label><input id="black-betty-confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="min-h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" /></>}
        <button type="submit" disabled={submitting} className="min-h-10 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{submitting ? "Working…" : creatingAccount ? "Create account" : "Sign in"}</button>
      </form>
      <button type="button" disabled={submitting} onClick={() => { setCreatingAccount((value) => !value); setMessage(undefined); }} className="mt-4 text-sm font-semibold text-primary hover:underline disabled:opacity-60">{creatingAccount ? "Already have an account? Sign in" : "New to Black Betty? Create account"}</button>
      {message && <p role="status" className="mt-4 text-sm text-text-secondary">{message}</p>}
    </AuthFrame>
  );
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) throw new Error("usePlatform must be used inside PlatformProvider.");
  return context;
}
