import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MockMerchandisingRepository } from "../adapters/mock/MockMerchandisingRepository";
import { seedSnapshot } from "../adapters/mock/seed";
import { PlatformProvider, usePlatform } from "./PlatformProvider";

function Harness() {
  const { data, createCampaign } = usePlatform();
  return <><button onClick={() => void createCampaign({ name: "Acknowledged save", type: "OND", startDate: "2027-10-01", endDate: "2027-12-31", owner: "Test buyer", supplier: "", description: "", products: [] })}>Create</button>{data?.campaigns.map((item) => <p key={item.id}>{item.name}</p>)}</>;
}

describe("acknowledged save feedback", () => {
  it("updates the screen from committed state without a fallible second remote read", async () => {
    const repository = new MockMerchandisingRepository(undefined, seedSnapshot, false);
    const load = vi.spyOn(repository, "load");
    render(<PlatformProvider adapter={repository}><Harness /></PlatformProvider>);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    load.mockRejectedValue(new Error("Network unavailable after a successful write"));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("Acknowledged save")).toBeVisible();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
