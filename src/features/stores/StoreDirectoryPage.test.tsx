import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { MockMerchandisingRepository } from "../../adapters/mock/MockMerchandisingRepository";
import { seedSnapshot } from "../../adapters/mock/seed";
import { PlatformProvider } from "../../services/PlatformProvider";
import { StoreDirectoryPage } from "./StoreDirectoryPage";

describe("StoreDirectoryPage", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows every current store and links each one to its floorplan", async () => {
    render(
      <PlatformProvider adapter={new MockMerchandisingRepository()}>
        <MemoryRouter><StoreDirectoryPage /></MemoryRouter>
      </PlatformProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Physical store network" })).toBeInTheDocument();
    for (const store of seedSnapshot.stores) {
      const heading = screen.getByRole("heading", { name: store.name });
      const card = heading.closest("section") ?? heading.parentElement?.parentElement?.parentElement;
      expect(card).not.toBeNull();
      expect(within(card as HTMLElement).getByRole("link", { name: "View floorplan" })).toHaveAttribute("href", `/stores/${store.id}/floorplan`);
    }
  });
});
