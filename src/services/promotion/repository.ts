import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyWorkspace, validateWorkspace, type WorkspaceRevision, type IntelligenceWorkspace } from "../../domain/promotion/schema";
import { assertCommercialHistoryPreserved } from "../../domain/promotion/decision";
export interface IntelligenceRepository { load(): Promise<WorkspaceRevision>; save(workspace: IntelligenceWorkspace, expectedVersion: number): Promise<WorkspaceRevision> }
const KEY = "black-betty-promotion-intelligence-demo-v1";
function validateSharedReceipts(workspace: IntelligenceWorkspace) {
  for (const item of workspace.opportunities) for (const decision of item.intelligence.commercialDecisions ?? []) {
    if (decision.receipt.mode !== "observed" || decision.receipt.qualification !== "unverified" || decision.receipt.sourceContract) throw new Error("Shared commercial qualification requires an approved server-owned source boundary. Synthetic or buyer-supplied qualified receipts are not accepted.");
  }
}
export class DemoIntelligenceRepository implements IntelligenceRepository {
  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem">) {}
  async load(): Promise<WorkspaceRevision> {
    const raw = this.storage.getItem(KEY);
    if (!raw) return { version: 0, workspace: emptyWorkspace() };
    const parsed = JSON.parse(raw) as WorkspaceRevision;
    if (!Number.isSafeInteger(parsed.version) || parsed.version < 0) throw new Error("Damaged promotion workspace; preserve site data for recovery.");
    validateWorkspace(parsed.workspace); return parsed;
  }
  async save(workspace: IntelligenceWorkspace, expectedVersion: number): Promise<WorkspaceRevision> {
    const current = await this.load();
    if (current.version !== expectedVersion) throw new Error("Promotion inbox changed. Reload before retrying; your draft remains visible.");
    validateWorkspace(workspace);
    assertCommercialHistoryPreserved(current.workspace, workspace);
    const next = { version: expectedVersion + 1, workspace };
    this.storage.setItem(KEY, JSON.stringify(next)); return structuredClone(next);
  }
}
export class SupabaseIntelligenceRepository implements IntelligenceRepository {
  constructor(private readonly client: SupabaseClient) {}
  private decode(row: { version: number; workspace: unknown } | null): WorkspaceRevision {
    if (!row || !Number.isSafeInteger(row.version) || row.version < 0) throw new Error("Promotion storage is unavailable. An admin must review the additive migration in staging.");
    const workspace = validateWorkspace(row.workspace);
    validateSharedReceipts(workspace);
    return { version: row.version, workspace };
  }
  async load(): Promise<WorkspaceRevision> {
    const { data, error } = await this.client.from("black_betty_promotion_intelligence").select("workspace,version").eq("singleton", true).single();
    if (error) throw new Error("Unable to read promotion inbox. Check sign-in, buyer access and migration availability.");
    return this.decode(data);
  }
  async save(workspace: IntelligenceWorkspace, expectedVersion: number): Promise<WorkspaceRevision> {
    validateWorkspace(workspace);
    validateSharedReceipts(workspace);
    const current = await this.load();
    if (current.version !== expectedVersion) throw new Error("Promotion inbox changed or access was revoked. Reload before retrying; your draft remains visible.");
    assertCommercialHistoryPreserved(current.workspace, workspace);
    const { data, error } = await this.client.from("black_betty_promotion_intelligence").update({ workspace }).eq("singleton", true).eq("version", expectedVersion).select("workspace,version").maybeSingle();
    if (error) throw new Error("Promotion save failed. No acknowledged changes were overwritten; reload to check before retrying.");
    if (!data) throw new Error("Promotion inbox changed or access was revoked. Reload before retrying; your draft remains visible.");
    return this.decode(data);
  }
}
