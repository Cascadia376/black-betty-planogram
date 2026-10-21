import { workspaceTestLocks } from "../../test/workspaceLocks";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DemoIntelligenceRepository, SupabaseIntelligenceRepository } from "./repository";
import { emptyWorkspace } from "../../domain/promotion/schema";
function storage() { const values = new Map<string, string>(); return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } }; }
describe("promotion persistence", () => {
  it("shares durable browser sessions and rejects stale updates", async () => {
    const disk = storage(), a = new DemoIntelligenceRepository(disk, workspaceTestLocks()), b = new DemoIntelligenceRepository(disk, workspaceTestLocks());
    await a.save(emptyWorkspace(), 0); expect((await b.load()).version).toBe(1);
    await expect(b.save(emptyWorkspace(), 0)).rejects.toThrow(/changed/);
  });
  it("does not acknowledge storage failures or reseed corrupt data", async () => {
    const disk = storage(), repository = new DemoIntelligenceRepository(disk, workspaceTestLocks());
    const before = await repository.save(emptyWorkspace(), 0);
    vi.spyOn(disk, "setItem").mockImplementation(() => { throw new Error("Quota"); });
    await expect(repository.save(emptyWorkspace(), 1)).rejects.toThrow("Quota");
    expect(await repository.load()).toEqual(before);
    await expect(new DemoIntelligenceRepository({ ...disk, getItem: () => "{broken" }).load()).rejects.toThrow();
  });
  it("sends expected version and fails stale/denied shared updates without fallbacks", async () => {
    const eq = vi.fn().mockReturnThis();
    const chain = { update: vi.fn().mockReturnThis(), eq, select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { version: 8, workspace: emptyWorkspace() }, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    const repository = new SupabaseIntelligenceRepository({ from: () => chain } as unknown as SupabaseClient);
    await expect(repository.save(emptyWorkspace(), 8)).rejects.toThrow(/changed or access/);
    expect(eq).toHaveBeenCalledWith("version", 8);
    chain.maybeSingle.mockResolvedValue({ data: null, error: { message: "denied" } } as never);
    await expect(repository.save(emptyWorkspace(), 8)).rejects.toThrow(/save failed/);
  });
});
