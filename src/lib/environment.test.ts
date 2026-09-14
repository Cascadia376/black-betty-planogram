import { describe, expect, it } from "vitest";
import { readEnvironment } from "./environment";

describe("readEnvironment", () => {
  it.each([undefined, ""])("defaults an unset data adapter (%s) to mock", (value) => {
    expect(readEnvironment({ VITE_DATA_ADAPTER: value }).VITE_DATA_ADAPTER).toBe("mock");
  });

  it("rejects unsupported data adapters", () => {
    expect(() => readEnvironment({ VITE_DATA_ADAPTER: "unknown" })).toThrow(
      "Invalid application environment",
    );
  });

  it("requires Supabase credentials when the Supabase adapter is selected", () => {
    expect(() => readEnvironment({ VITE_DATA_ADAPTER: "supabase" })).toThrow(
      "VITE_SUPABASE_URL and a Supabase publishable key are required",
    );
  });

  it("accepts a fully configured Supabase adapter", () => {
    expect(readEnvironment({
      VITE_DATA_ADAPTER: "supabase",
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "public-key",
    })).toMatchObject({
      VITE_DATA_ADAPTER: "supabase",
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "public-key",
    });
  });

  it("continues to accept the legacy anonymous key", () => {
    expect(readEnvironment({
      VITE_DATA_ADAPTER: "supabase",
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY: "legacy-anon-key",
    }).VITE_SUPABASE_ANON_KEY).toBe("legacy-anon-key");
  });
});
