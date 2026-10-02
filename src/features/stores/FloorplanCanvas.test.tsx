import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IDS, seedSnapshot } from "../../adapters/mock/seed";
import { FloorplanCanvas } from "./FloorplanCanvas";

describe("FloorplanCanvas", () => {
  it("retains a failed keyboard save for retry and cancel", async () => {
    const area = seedSnapshot.displayAreas[0];
    const save = vi.fn().mockRejectedValueOnce(new Error("Storage unavailable")).mockResolvedValueOnce(undefined);
    render(<FloorplanCanvas storeName="Test" zones={[]} fixtures={[]} areas={[area]} stateFor={() => "available"} onSelect={() => undefined} onGeometrySave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit display positions" }));
    const hotspot = screen.getByRole("button", { name: new RegExp(area.name) });
    const original = hotspot.getAttribute("style");
    fireEvent.keyDown(hotspot, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Save floorplan" }));
    expect(await screen.findByText(/Storage unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save floorplan" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel unsaved change" }));
    expect(hotspot).toHaveAttribute("style", original);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("autosaves a completed drag", async () => {
    const area = seedSnapshot.displayAreas[0];
    const save = vi.fn().mockResolvedValue(undefined);
    const rect = { x: 0, y: 0, width: 1000, height: 800, top: 0, right: 1000, bottom: 800, left: 0, toJSON: () => ({}) } as DOMRect;
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rect);
    const capture = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: capture });

    render(<FloorplanCanvas storeName="Test" zones={[]} fixtures={[]} areas={[area]} stateFor={() => "available"} onSelect={() => undefined} onGeometrySave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit display positions" }));
    const hotspot = screen.getByRole("button", { name: new RegExp(area.name) });
    const viewport = screen.getByTestId("floorplan-viewport");
    fireEvent.pointerDown(hotspot, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 150, clientY: 100 });
    fireEvent.pointerUp(viewport, { pointerId: 1, clientX: 150, clientY: 100 });

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Floorplan saved. You can leave and reopen this layout.")).toBeInTheDocument();
    rectSpy.mockRestore();
  });

  const spaces = seedSnapshot.categorySpaces.filter((space) => space.layoutId === IDS.crownLayout);
  const areas = seedSnapshot.displayAreas.filter((area) => area.storeId === IDS.store);

  it("renders independently controlled base, category, display, and placement layers", () => {
    const { rerender } = render(<FloorplanCanvas storeName="Crown Isle" zones={[]} fixtures={[]} areas={areas} categorySpaces={spaces} backgroundImageUrl="/floorplans/crown-isle.png" backgroundAspectRatio={1008 / 612} stateFor={() => "available"} onSelect={() => undefined} onSelectCategorySpace={() => undefined} />);
    expect(screen.getByAltText("Crown Isle store layout background")).toHaveAttribute("src", "/floorplans/crown-isle.png");
    expect(screen.getByRole("button", { name: "Vodka category space" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Endcap A/ })).toBeInTheDocument();

    rerender(<FloorplanCanvas storeName="Crown Isle" zones={[]} fixtures={[]} areas={areas} categorySpaces={spaces} backgroundImageUrl="/floorplans/crown-isle.png" showBase={false} showCategories={false} showDisplayAreas stateFor={() => "active_campaign"} showCampaignPlacements={false} onSelect={() => undefined} />);
    expect(screen.queryByAltText("Crown Isle store layout background")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vodka category space" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Endcap A.*Available/ })).toBeInTheDocument();

    rerender(<FloorplanCanvas storeName="Crown Isle" zones={[]} fixtures={[]} areas={areas} categorySpaces={spaces} backgroundImageUrl="/floorplans/crown-isle.png" showCategories={false} showDisplayAreas={false} stateFor={() => "active_campaign"} onSelect={() => undefined} />);
    expect(screen.queryByRole("button", { name: /Endcap A/ })).not.toBeInTheDocument();
  });

  it("selects a category space", () => {
    const onSelect = vi.fn();
    render(<FloorplanCanvas storeName="Crown Isle" zones={[]} fixtures={[]} areas={[]} categorySpaces={spaces} backgroundImageUrl="/floorplans/crown-isle.png" stateFor={() => "available"} onSelect={() => undefined} onSelectCategorySpace={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Vodka category space" }));
    expect(onSelect).toHaveBeenCalledWith(spaces.find((space) => space.name === "Vodka")?.id);
  });
  it("keeps Done editing disabled while dirty and locks duplicate saves until acknowledgement", async () => {
    const area = seedSnapshot.displayAreas[0];
    let finish!: () => void;
    const save = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<FloorplanCanvas storeName="Test" zones={[]} fixtures={[]} areas={[area]} stateFor={() => "available"} onSelect={() => undefined} onGeometrySave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit display positions" }));
    const hotspot = screen.getByRole("button", { name: new RegExp(area.name) });
    fireEvent.keyDown(hotspot, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "Done editing" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save floorplan" }));
    fireEvent.click(screen.getByRole("button", { name: "Saving..." }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]).toBeDefined();
    await act(async () => finish());
    expect(screen.getByRole("button", { name: "Done editing" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Undo last saved change" })).toBeEnabled();
  });

  it("Escape cancels an active drag, so its later pointer-up cannot save it", () => {
    const area = seedSnapshot.displayAreas[0];
    const save = vi.fn();
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 1000, height: 800 } as DOMRect);
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
    render(<FloorplanCanvas storeName="Test" zones={[]} fixtures={[]} areas={[area]} stateFor={() => "available"} onSelect={() => undefined} onGeometrySave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit display positions" }));
    const hotspot = screen.getByRole("button", { name: new RegExp(area.name) });
    const original = hotspot.getAttribute("style");
    const viewport = screen.getByTestId("floorplan-viewport");
    fireEvent.pointerDown(hotspot, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 160, clientY: 100 });
    fireEvent.keyDown(hotspot, { key: "Escape" });
    fireEvent.pointerUp(viewport, { pointerId: 1 });
    expect(save).not.toHaveBeenCalled();
    expect(hotspot).toHaveAttribute("style", original);
    rectSpy.mockRestore();
  });

  it("does not let a second touch cancel the primary drag, and pointer cancellation restores the saved position", () => {
    const area = seedSnapshot.displayAreas[0];
    const save = vi.fn();
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 1000, height: 800 } as DOMRect);
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
    render(<FloorplanCanvas storeName="Test" zones={[]} fixtures={[]} areas={[area]} stateFor={() => "available"} onSelect={() => undefined} onGeometrySave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit display positions" }));
    const hotspot = screen.getByRole("button", { name: new RegExp(area.name) });
    const original = hotspot.getAttribute("style");
    const viewport = screen.getByTestId("floorplan-viewport");
    fireEvent.pointerDown(hotspot, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 160, clientY: 100 });
    fireEvent.pointerCancel(viewport, { pointerId: 2 });
    expect(hotspot.getAttribute("style")).not.toBe(original);
    fireEvent.pointerCancel(viewport, { pointerId: 1 });
    fireEvent.pointerUp(viewport, { pointerId: 1 });
    expect(save).not.toHaveBeenCalled();
    expect(hotspot).toHaveAttribute("style", original);
    rectSpy.mockRestore();
  });

});
