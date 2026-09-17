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

  it("preserves actionable optimistic-concurrency conflicts", () => {
    const message = "This campaign changed after you opened it. Reload the latest shared plan, review the other user's changes, and try again.";
    expect(campaignSaveError(new Error(message))).toBe(message);
  });
});
