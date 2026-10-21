import { workspaceTestLocks } from "../../test/workspaceLocks";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyWorkspace, validateWorkspace } from "./schema";
import { ingestSource, reviewOpportunity } from "./intake";
import { retainCommercialDecision } from "./decision";
import { buildCommercialEvidence, evidenceReceiptSchema } from "./commercial";
import { DemoIntelligenceRepository, SupabaseIntelligenceRepository } from "../../services/promotion/repository";
import { DEMO_SOURCE, demoExtract } from "../../services/promotion/demoExtractor";
import { syntheticCommercialEvidence } from "../../services/promotion/commercialFixture";
const priorities = { volume: 1, margin: 0, lift: 0 };
async function fixture() {
  const workspace = await ingestSource(emptyWorkspace(), { kind: "email", title: "SYNTHETIC", text: DEMO_SOURCE, supplier: "", representative: "", date: "" }, demoExtract(DEMO_SOURCE), "demo", "Buyer");
  const item = workspace.opportunities[0]; item.authoritativeSku = item.supplierSku; item.intelligence.resolution = "MATCHED";
  const evidence = await syntheticCommercialEvidence({ sku: item.supplierSku!, start: "2026-01-01", end: "2026-01-03", storeIds: [1] });
  workspace.opportunities[0] = await retainCommercialDecision(item, evidence, priorities, "Buyer");
  return { workspace, item, evidence };
}
function memory() { let value: string | null = null; return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } }; }
function shared(workspace: ReturnType<typeof emptyWorkspace>, options: { error?: boolean; stale?: boolean } = {}) {
  const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { workspace, version: 1 }, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: options.stale ? null : { workspace, version: 2 }, error: options.error ? { message: "network" } : null }) };
  return { repository: new SupabaseIntelligenceRepository({ from: () => chain } as unknown as SupabaseClient), chain };
}
describe("commercial decision receipts", () => {
  it("persists version, exact period/store scope, actor, weights and qualification across reloads", async () => {
    const { workspace } = await fixture(), disk = memory();
    const writer = new DemoIntelligenceRepository(disk, workspaceTestLocks()), reader = new DemoIntelligenceRepository(disk, workspaceTestLocks());
    await writer.save(workspace, 0);
    const restored = await reader.load();
    expect(restored.workspace.opportunities[0].intelligence.commercialDecisions).toEqual(workspace.opportunities[0].intelligence.commercialDecisions);
    const decision = restored.workspace.opportunities[0].intelligence.commercialDecisions![0];
    expect(decision.receipt.scope).toEqual({ start: "2026-01-01", end: "2026-01-03", storeIds: [1] });
    expect(decision.receipt.sourceContract?.sourceRevision).toBe("SYNTHETIC-v1");
    expect(decision.actor).toBe("Buyer"); expect(decision.priorities).toEqual(priorities);
  });
  it("retains source revision changes as separate historical decisions without rewriting old receipts", async () => {
    const { workspace, evidence } = await fixture(), disk = memory(), repository = new DemoIntelligenceRepository(disk, workspaceTestLocks());
    await repository.save(workspace, 0);
    const nextEvidence = structuredClone(evidence); nextEvidence.receipt.id = crypto.randomUUID(); nextEvidence.receipt.sourceContract!.sourceRevision = "SYNTHETIC-v2";
    const next = structuredClone(workspace); next.opportunities[0] = await retainCommercialDecision(next.opportunities[0], nextEvidence, priorities, "Buyer 2");
    await repository.save(next, 1);
    const receipts = (await repository.load()).workspace.opportunities[0].intelligence.commercialDecisions!;
    expect(receipts.map((decision) => decision.receipt.sourceContract?.sourceRevision)).toEqual(["SYNTHETIC-v1", "SYNTHETIC-v2"]);
    const overwritten = structuredClone(next); overwritten.opportunities[0].intelligence.commercialDecisions![0].actor = "Other";
    await expect(repository.save(overwritten, 2)).rejects.toThrow(/cannot be rewritten/);
    await expect(repository.save(emptyWorkspace(), 2)).rejects.toThrow(/cannot be rewritten/);
  });
  it("keeps a failed save unacknowledged and rejects stale recovery", async () => {
    const { workspace } = await fixture(), disk = memory(), repository = new DemoIntelligenceRepository(disk, workspaceTestLocks());
    vi.spyOn(disk, "setItem").mockImplementationOnce(() => { throw new Error("quota"); });
    await expect(repository.save(workspace, 0)).rejects.toThrow("quota");
    expect((await repository.load()).version).toBe(0);
    await repository.save(workspace, 0);
    await expect(repository.save(workspace, 0)).rejects.toThrow(/changed/);
  });
  it("rejects changed SKU or changed row content when retaining a decision", async () => {
    const { item, evidence } = await fixture();
    const revised = reviewOpportunity(item, { productName: item.productName, sku: "other", supplier: item.supplier, comment: "", owner: "Buyer", status: "UNDER_CONSIDERATION" }, "Buyer");
    await expect(retainCommercialDecision(revised, evidence, priorities, "Buyer")).rejects.toThrow(/identity changed/);
    evidence.observations[0].cost += 1;
    await expect(retainCommercialDecision(item, evidence, priorities, "Buyer")).rejects.toThrow(/no longer match/);
  });
  it.each(["synthetic", "qualified-observed"])("rejects %s buyer-supplied authority on shared reads and writes", async (kind) => {
    const { workspace } = await fixture();
    if (kind === "qualified-observed") workspace.opportunities[0].intelligence.commercialDecisions![0].receipt.mode = "observed";
    const { repository, chain } = shared(workspace);
    await expect(repository.load()).rejects.toThrow(/server-owned source/);
    await expect(repository.save(workspace, 1)).rejects.toThrow(/server-owned source/);
    expect(chain.update).not.toHaveBeenCalled();
  });
  it("saves observed unverified receipts through existing shared CAS and preserves uncertain outcome", async () => {
    const { workspace, item, evidence } = await fixture();
    const observed = await buildCommercialEvidence({ sku: item.authoritativeSku!, ...evidence.receipt.scope }, evidence.observations);
    workspace.opportunities[0] = await retainCommercialDecision(item, observed, priorities, "Buyer");
    const fake = shared(workspace);
    expect((await fake.repository.save(workspace, 1)).version).toBe(2);
    expect(fake.chain.eq).toHaveBeenCalledWith("version", 1);
    await expect(shared(workspace, { error: true }).repository.save(workspace, 1)).rejects.toThrow(/No acknowledged/);
    await expect(shared(workspace, { stale: true }).repository.save(workspace, 1)).rejects.toThrow(/changed or access/);
  });
  it("captures shared save payload before an awaited read so caller mutation cannot bypass authority gates", async () => {
    const { workspace, item, evidence } = await fixture();
    const observed = await buildCommercialEvidence({ sku: item.authoritativeSku!, ...evidence.receipt.scope }, evidence.observations);
    workspace.opportunities[0] = await retainCommercialDecision(item, observed, priorities, "Buyer");
    const before = structuredClone(workspace), fake = shared(before);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    fake.chain.single.mockImplementation(async () => { await gate; return { data: { workspace: before, version: 1 }, error: null }; });
    fake.chain.maybeSingle.mockImplementation(async () => ({ data: { workspace: fake.chain.update.mock.calls[0][0].workspace, version: 2 }, error: null }));
    const pending = fake.repository.save(workspace, 1);
    workspace.opportunities[0].intelligence.commercialDecisions![0].receipt = evidence.receipt;
    workspace.opportunities[0].intelligence.commercialDecisions![0].receipt.mode = "observed";
    release();
    const saved = await pending;
    expect(fake.chain.update.mock.calls[0][0].workspace).toEqual(before);
    expect(saved.workspace.opportunities[0].intelligence.commercialDecisions![0].receipt.qualification).toBe("unverified");
  });
  it("captures buyer status and weights while receipt hashing is pending", async () => {
    const { item, evidence } = await fixture(), weights = { ...priorities };
    const status = item.status;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const original = crypto.subtle.digest.bind(crypto.subtle);
    const digest = vi.spyOn(crypto.subtle, "digest").mockImplementation(async (...args) => { await gate; return original(...args); });
    try {
      const pending = retainCommercialDecision(item, evidence, weights, "Buyer");
      item.status = "APPROVED"; weights.volume = 99;
      release();
      const saved = await pending;
      expect(saved.status).toBe(status);
      expect(saved.intelligence.commercialDecisions!.at(-1)!.priorities.volume).toBe(1);
    } finally { release(); digest.mockRestore(); }
  });
  it("rejects malformed or relabelled qualified receipts and bounds durable history", async () => {
    const { workspace, evidence, item } = await fixture();
    const receipt = { ...evidence.receipt, sourceContract: undefined };
    expect(() => evidenceReceiptSchema.parse(receipt)).toThrow(/require complete/);
    expect(() => evidenceReceiptSchema.parse({ ...evidence.receipt, missingStoreDays: 5 })).toThrow();
    const next = structuredClone(workspace); next.opportunities[0].intelligence.commercialDecisions![0].receipt.observedSha256 = "b".repeat(64);
    expect(() => validateWorkspace(next)).toThrow(/accepted source/);
    item.intelligence.commercialDecisions = Array.from({ length: 20 }, () => ({ ...workspace.opportunities[0].intelligence.commercialDecisions![0], id: crypto.randomUUID() }));
    await expect(retainCommercialDecision(item, evidence, priorities, "Buyer")).rejects.toThrow(/history is full/);
  });
});
