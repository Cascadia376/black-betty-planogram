import { describe, expect, it } from "vitest";
import { campaignSaveError } from "./campaignErrors";

describe("campaignSaveError", () => {
  it("preserves useful validation errors", () => {
    expect(campaignSaveError(new Error("Campaign name is required."))).toBe("Campaign name is required.");
  });

  it("translates infrastructure failures without exposing raw details", () => {
    const message = campaignSaveError(new Error("database connection failed: secret-host.internal"));
    expect(message).toContain("could not be saved");
    expect(message).not.toContain("secret-host");
  });
});
