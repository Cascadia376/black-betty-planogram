import { describe, expect, it, vi } from "vitest";
import { extractionHandler, productionDependencies } from "./promotionExtraction";
import { extractionSchema } from "../src/domain/promotion/schema";
import { demoExtract } from "../src/services/promotion/demoExtractor";
const source = { kind: "email", text: "Product: Demo\nSKU: REAL" };
const request = (token = "token", body: unknown = source) => new Request("http://localhost/api/promotion-extract", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) });
describe("authenticated server extraction", () => {
  it("denies unauthenticated and unauthorized requests before model calls", async () => {
    const generate = vi.fn(), handler = extractionHandler({ authorize: async () => false, generate });
    expect((await handler(request(""))).status).toBe(401);
    expect((await handler(request())).status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
    expect(await productionDependencies({}).authorize("forged")).toBe(false);
  });
  it("validates request and model output and hides provider/raw content errors", async () => {
    const generate = vi.fn().mockResolvedValue(demoExtract(source.text));
    const handler = extractionHandler({ authorize: async () => true, generate });
    const valid = await handler(request()); expect(valid.status).toBe(200); expect(valid.headers.get("cache-control")).toBe("no-store");
    expect(extractionSchema.parse(await valid.json())).toEqual(demoExtract(source.text));
    expect((await handler(request("token", { ...source, text: "" }))).status).toBe(400);
    generate.mockResolvedValue({ opportunities: [{ claims: [{ field: "cost", value: "$9", excerpt: "not in source", kind: "source_fact" }], missing: [] }] });
    expect((await handler(request())).status).toBe(502);
    generate.mockRejectedValue(new Error("Secret supplier terms API_KEY"));
    const error = await handler(request()); expect(await error.text()).not.toContain("Secret supplier");
  });
  it("fails closed on auth outage, enforces method and body-size caps", async () => {
    const handler = extractionHandler({ authorize: async () => true, generate: async () => ({}) });
    expect((await handler(new Request("http://localhost"))).status).toBe(405);
    expect((await handler(request("token", { ...source, text: "x".repeat(150001) }))).status).toBe(413);
    expect((await extractionHandler({ authorize: async () => { throw new Error("down"); }, generate: async () => ({}) })(request())).status).toBe(503);
  });
});
