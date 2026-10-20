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

describe("production authorization adapter with isolated HTTP fixtures", () => {
  it.each([
    { label: "active buyer", user: { id: "buyer-id", email: "Buyer@Example.test", is_anonymous: false }, access: { role: "buyer", is_active: true, auth_user_id: "buyer-id" }, allowed: true },
    { label: "active admin", user: { id: "admin-id", email: "admin@example.test", is_anonymous: false }, access: { role: "admin", is_active: true, auth_user_id: "admin-id" }, allowed: true },
    { label: "unrelated identity", user: { id: "outsider", email: "outsider@example.test", is_anonymous: false }, access: { role: "buyer", is_active: true, auth_user_id: "different-id" }, allowed: false },
    { label: "anonymous session", user: { id: "anonymous", email: "", is_anonymous: true }, access: { role: "admin", is_active: true }, allowed: false },
    { label: "no authorized access row despite editable metadata", user: { id: "outsider", email: "outsider@example.test", is_anonymous: false, user_metadata: { role: "admin" } }, access: null, allowed: false },
  ])("$label", async ({ user, access, allowed }) => {
    const urls: URL[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      urls.push(url);
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic-session-token");
      if (url.pathname === "/auth/v1/user") return Response.json(user);
      expect(url.pathname).toBe("/rest/v1/black_betty_user_access");
      expect(url.searchParams.get("is_active")).toBe("eq.true");
      expect(url.searchParams.get("email")).toBe(`eq.${user.email.toLowerCase()}`);
      return Response.json(access ? [access] : []);
    });
    try {
      const dependencies = productionDependencies({ SUPABASE_URL: "https://isolated-fixture.supabase.co", SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key" });
      expect(await dependencies.authorize("synthetic-session-token")).toBe(allowed);
      expect(urls[0].pathname).toBe("/auth/v1/user");
      if (user.is_anonymous) expect(urls).toHaveLength(1);
    } finally { fetchMock.mockRestore(); }
  });
});
