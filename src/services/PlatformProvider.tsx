/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MockMerchandisingRepository } from "../adapters/mock/MockMerchandisingRepository";
import type {
  AssignCampaignInput, CompleteExecutionInput, CreateDisplayAssignmentInput, MerchandisingRepository, SubmitComplianceInput,
} from "../domain/repositories";
import type { NewCampaignInput, PlatformSnapshot, RecommendationStatus, UUID, UserRole } from "../domain/types";

const repository = new MockMerchandisingRepository();

interface PlatformContextValue {
  data?: PlatformSnapshot;
  loading: boolean;
  error?: string;
  role: UserRole;
  setRole(role: UserRole): void;
  refresh(): Promise<void>;
  createCampaign(input: NewCampaignInput): Promise<UUID>;
  assignCampaign(input: AssignCampaignInput): Promise<void>;
  createDisplayAssignment(input: CreateDisplayAssignmentInput): Promise<void>;
  updateDisplayAssignment(id: UUID, input: CreateDisplayAssignmentInput): Promise<void>;
  completeExecution(input: CompleteExecutionInput): Promise<void>;
  reviewCompliance(input: SubmitComplianceInput): Promise<void>;
  updateRecommendation(id: UUID, status: RecommendationStatus, note?: string): Promise<void>;
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
    createCampaign: async (input) => {
      let id = "";
      await mutate(async () => { id = await adapter.createCampaign(input); });
      return id;
    },
    assignCampaign: (input) => mutate(() => adapter.assignCampaign(input)).then(() => undefined),
    createDisplayAssignment: (input) => mutate(() => adapter.createDisplayAssignment(input)).then(() => undefined),
    updateDisplayAssignment: (id, input) => mutate(() => adapter.updateDisplayAssignment(id, input)).then(() => undefined),
    completeExecution: (input) => mutate(() => adapter.completeExecution(input)).then(() => undefined),
    reviewCompliance: (input) => mutate(() => adapter.reviewCompliance(input)).then(() => undefined),
    updateRecommendation: (id, status, note) => mutate(() => adapter.updateRecommendation(id, status, note)).then(() => undefined),
    resetDemo: () => mutate(() => adapter.reset()).then(() => undefined),
  }), [adapter, data, error, loading, mutate, refresh, role]);

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) throw new Error("usePlatform must be used inside PlatformProvider.");
  return context;
}
