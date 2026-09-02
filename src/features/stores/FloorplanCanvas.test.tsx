import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IDS, seedSnapshot } from "../../adapters/mock/seed";
import { FloorplanCanvas } from "./FloorplanCanvas";

describe("FloorplanCanvas", () => {
  const spaces = seedSnapshot.categorySpaces.filter((space) => space.layoutId === IDS.crownLayout);
  const areas = seedSnapshot.displayAreas.filter((area) => area.storeId === IDS.store);

  it("renders a real background and independently toggled category/display layers", () => {
    const { rerender } = render(<FloorplanCanvas storeName="Crown Isle" zones={[]} fixtures={[]} areas={areas} categorySpaces={spaces} backgroundImageUrl="/floorplans/crown-isle.png" backgroundAspectRatio={1008 / 612} stateFor={() => "available"} onSelect={() => undefined} onSelectCategorySpace={() => undefined} />);
    expect(screen.getByAltText("Crown Isle store layout background")).toHaveAttribute("src", "/floorplans/crown-isle.png");
    expect(screen.getByRole("button", { name: "Vodka category space" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Endcap A/ })).toBeInTheDocument();

    rerender(<FloorplanCanvas storeName="Crown Isle" zones={[]} fixtures={[]} areas={areas} categorySpaces={spaces} backgroundImageUrl="/floorplans/crown-isle.png" showCategories={false} showDisplayAreas={false} stateFor={() => "available"} onSelect={() => undefined} />);
    expect(screen.queryByRole("button", { name: "Vodka category space" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Endcap A/ })).not.toBeInTheDocument();
  });

  it("selects a category space", () => {
    const onSelect = vi.fn();
    render(<FloorplanCanvas storeName="Crown Isle" zones={[]} fixtures={[]} areas={[]} categorySpaces={spaces} backgroundImageUrl="/floorplans/crown-isle.png" stateFor={() => "available"} onSelect={() => undefined} onSelectCategorySpace={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Vodka category space" }));
    expect(onSelect).toHaveBeenCalledWith(spaces.find((space) => space.name === "Vodka")?.id);
  });
});
