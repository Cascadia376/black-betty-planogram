import { describe, expect, it } from "vitest";
import { canManagePhysicalReference } from "./PlatformProvider";

describe("physical reference authorization", () => {
  it("allows local development, production buyers, and production admins", () => {
    expect(canManagePhysicalReference(false, undefined)).toBe(true);
    expect(canManagePhysicalReference(true, "admin")).toBe(true);
    expect(canManagePhysicalReference(true, "buyer")).toBe(true);
    expect(canManagePhysicalReference(true, undefined)).toBe(false);
  });
});
