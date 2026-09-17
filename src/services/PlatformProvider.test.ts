import { describe, expect, it } from "vitest";
import { canManagePhysicalReference } from "./PlatformProvider";

describe("physical reference authorization", () => {
  it("allows local development and production admins, but not production buyers", () => {
    expect(canManagePhysicalReference(false, undefined)).toBe(true);
    expect(canManagePhysicalReference(true, "admin")).toBe(true);
    expect(canManagePhysicalReference(true, "buyer")).toBe(false);
    expect(canManagePhysicalReference(true, undefined)).toBe(false);
  });
});
