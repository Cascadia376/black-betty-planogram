import { workspaceTestLocks } from "../../test/workspaceLocks";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DemoIntelligenceRepository, SupabaseIntelligenceRepository } from "./repository";
import { emptyWorkspace } from "../../domain/promotion/schema";
import { deleteSource, ingestSource } from "../../domain/promotion/intake";
import { currentCommercialReceipt, retainCommercialDecision } from "../../domain/promotion/decision";
import { rankComparableReceipts } from "../../domain/promotion/ranking";
import { syntheticCommercialEvidence } from "./commercialFixture";
import { DEMO_SOURCE, demoExtract } from "./demoExtractor";

function memory() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

describe("second-pass commercial recovery counterexamples", () => {
  it("acknowledges only one concurrent browser writer at the same version", async () => {
    const disk = memory(), locks = workspaceTestLocks(), a = new DemoIntelligenceRepository(disk, locks), b = new DemoIntelligenceRepository(disk, locks);
    const first = emptyWorkspace(), second = emptyWorkspace();
    first.priorities.volume = 1; second.priorities.margin = 1;
    const results = await Promise.allSettled([a.save(first, 0), b.save(second, 0)]);
    console.log(JSON.stringify({ probe: "concurrent-demo-save", results: results.map(result => result.status), persisted: await a.load() }));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  });

  it.each(["unchanged-version", "different-workspace"])("does not acknowledge a %s shared save receipt", async kind => {
    const next = emptyWorkspace(); next.priorities.volume = 1;
    const returned = kind === "different-workspace" ? emptyWorkspace() : next;
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { workspace: emptyWorkspace(), version: 0 }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: { workspace: returned, version: kind === "unchanged-version" ? 0 : 1 }, error: null }) };
    const repository = new SupabaseIntelligenceRepository({ from: () => chain } as unknown as SupabaseClient);
    await expect(repository.save(next, 0)).rejects.toThrow(/acknowledgement|receipt/i);
  });

  it("withdraws deleted-source product identity from active comparison while preserving decision receipts", async () => {
    let workspace = emptyWorkspace();
    for (const text of [DEMO_SOURCE, DEMO_SOURCE + "\nJeremy: Second distinct synthetic offer"]) {
      workspace = await ingestSource(workspace, { kind: "email", title: "SYNTHETIC", text, supplier: "", representative: "", date: "" }, demoExtract(text), "demo", "Buyer");
      const index = workspace.opportunities.length - 1, item = workspace.opportunities[index];
      item.authoritativeSku = item.supplierSku; item.productId = crypto.randomUUID(); item.intelligence.resolution = "MATCHED";
      const evidence = await syntheticCommercialEvidence({ sku: item.supplierSku!, start: "2026-01-01", end: "2026-01-03", storeIds: [1] });
      workspace.opportunities[index] = await retainCommercialDecision(item, evidence, { volume: 1, margin: 0, lift: 0 }, "Buyer");
    }
    const after = deleteSource(workspace, workspace.sources[0].id, "Buyer");
    const comparison = rankComparableReceipts(after.opportunities.map(item => ({ id: item.id, receipt: currentCommercialReceipt(item) })), { volume: 1, margin: 0, lift: 0 });
    console.log(JSON.stringify({ probe: "source-deletion", resolution: after.opportunities[0].intelligence.resolution, sku: after.opportunities[0].authoritativeSku, comparison: comparison.state }));
    expect(comparison.state).toBe("Insufficient Evidence");
    expect(after.opportunities[0].authoritativeSku).toBeUndefined();
    expect(after.opportunities[0].productId).toBeUndefined();
    expect(after.opportunities[0].intelligence.resolution).toBe("UNMATCHED");
    expect(after.opportunities[0].intelligence.commercialDecisions).toEqual(workspace.opportunities[0].intelligence.commercialDecisions);
    const legacyDeleted = { ...after.opportunities[0], authoritativeSku: workspace.opportunities[0].authoritativeSku };
    legacyDeleted.intelligence.resolution = "MATCHED";
    expect(currentCommercialReceipt(legacyDeleted)).toBeUndefined();
    expect(currentCommercialReceipt(workspace.opportunities[0])).toEqual(workspace.opportunities[0].intelligence.commercialDecisions![0].receipt);
  });

  it("allows inspection but blocks demo writes when Web Locks are unavailable", async () => {
    const disk = memory();
    await new DemoIntelligenceRepository(disk, workspaceTestLocks()).save(emptyWorkspace(), 0);
    const repository = new DemoIntelligenceRepository(disk);
    expect((await repository.load()).version).toBe(1);
    await expect(repository.save(emptyWorkspace(), 1)).rejects.toThrow(/Web Locks/);
    expect((await repository.load()).version).toBe(1);
  });

  it("accepts JSONB object key reordering while retaining exact submitted values", async () => {
    const next = emptyWorkspace(); next.priorities.volume = 1;
    const reordered = { priorities: { lift: 0, volume: 1, margin: 0 }, opportunities: [], sources: [] };
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { workspace: emptyWorkspace(), version: 0 }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: { workspace: reordered, version: 1 }, error: null }) };
    const repository = new SupabaseIntelligenceRepository({ from: () => chain } as unknown as SupabaseClient);
    const saved = await repository.save(next, 0);
    expect(saved.workspace).toEqual(next);
    reordered.priorities.volume = 99;
    expect(saved.workspace.priorities.volume).toBe(1);
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER, Infinity])("rejects unsupported expected version %s before storage calls", async version => {
    const disk = memory(), write = vi.spyOn(disk, "setItem");
    await expect(new DemoIntelligenceRepository(disk, workspaceTestLocks()).save(emptyWorkspace(), version)).rejects.toThrow(/revision/);
    expect(write).not.toHaveBeenCalled();
    const from = vi.fn();
    await expect(new SupabaseIntelligenceRepository({ from } as unknown as SupabaseClient).save(emptyWorkspace(), version)).rejects.toThrow(/revision/);
    expect(from).not.toHaveBeenCalled();
  });

});
