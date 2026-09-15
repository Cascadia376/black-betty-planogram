/* eslint-disable react-refresh/only-export-components */
import { clsx } from "clsx";
import { MapPin } from "lucide-react";
import { Fragment } from "react";
import { FloorplanViewport, type FloorplanGeometryEdit } from "./FloorplanViewport";
import type { CategorySpace, DisplayArea, DisplayAreaSection, Fixture, Geometry, StoreZone } from "../../domain/types";
import { humanize } from "../../components/ui";

export type DisplayAreaState = "available" | "active_campaign" | "upcoming_campaign" | "current" | "upcoming_reset" | "requires_attention" | "selected";

const stateStyles: Record<DisplayAreaState, string> = {
  available: "border-border-strong bg-surface text-text-primary",
  active_campaign: "border-success bg-success text-primary-foreground",
  upcoming_campaign: "border-info bg-info text-primary-foreground",
  current: "border-success bg-success text-primary-foreground",
  upcoming_reset: "border-warning bg-warning text-primary-foreground",
  requires_attention: "border-error bg-error text-destructive-foreground",
  selected: "border-primary bg-primary text-primary-foreground ring-4 ring-focus",
};

export const displayAreaStateLabels: Record<DisplayAreaState, string> = {
  available: "Available",
  active_campaign: "Active campaign",
  upcoming_campaign: "Upcoming campaign",
  current: "Current",
  upcoming_reset: "Upcoming reset",
  requires_attention: "Requires attention",
  selected: "Selected",
};

const contextualLandmarks = [
  { label: "Checkout", x: 0.02, y: 0.44, width: 0.13, height: 0.16 },
  { label: "Cellar / premium", x: 0.04, y: 0.66, width: 0.2, height: 0.2 },
  { label: "Central gondolas / spirits", x: 0.34, y: 0.3, width: 0.27, height: 0.38 },
  { label: "RTD / cider", x: 0.73, y: 0.68, width: 0.16, height: 0.13 },
] as const;

function constrainedGeometry(geometry: Geometry, minimumWidth = 0, minimumHeight = 0) {
  const x = Math.min(Math.max(geometry.x, 0), 1);
  const y = Math.min(Math.max(geometry.y, 0), 1);
  const width = Math.min(Math.max(geometry.width, minimumWidth), 1 - x);
  const height = Math.min(Math.max(geometry.height, minimumHeight), 1 - y);
  return { left: `${x * 100}%`, top: `${y * 100}%`, width: `${width * 100}%`, height: `${height * 100}%`, transform: geometry.rotation ? `rotate(${geometry.rotation}deg)` : undefined };
}

export function FloorplanCanvas({
  storeName,
  zones,
  fixtures,
  areas,
  displayAreaSections = [],
  categorySpaces = [],
  backgroundImageUrl,
  backgroundAspectRatio,
  showBase = true,
  showCategories = true,
  showDisplayAreas = true,
  showCampaignPlacements = true,
  selectedAreaId,
  selectedCategorySpaceId,
  stateFor,
  onSelect,
  onSelectCategorySpace,
  onGeometrySave,
}: {
  storeName: string;
  zones: StoreZone[];
  fixtures: Fixture[];
  areas: DisplayArea[];
  displayAreaSections?: DisplayAreaSection[];
  categorySpaces?: CategorySpace[];
  backgroundImageUrl?: string;
  backgroundAspectRatio?: number;
  showBase?: boolean;
  showCategories?: boolean;
  showDisplayAreas?: boolean;
  showCampaignPlacements?: boolean;
  selectedAreaId?: string;
  selectedCategorySpaceId?: string;
  stateFor(areaId: string): DisplayAreaState;
  onSelect(areaId: string): void;
  onSelectCategorySpace?(categorySpaceId: string): void;
  onGeometrySave?(edit: FloorplanGeometryEdit): Promise<void>;
}) {
  const hasRealBackground = Boolean(backgroundImageUrl);
  const displayHotspots = areas.flatMap((area) => [
    { key: area.id, area, geometry: area.geometry, sectionLabel: undefined as string | undefined },
    ...displayAreaSections
      .filter((section) => section.displayAreaId === area.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((section) => ({ key: section.id, area, geometry: section.geometry, sectionLabel: section.label })),
  ]);
  return (
    <FloorplanViewport aspectRatio={backgroundAspectRatio ?? 4 / 3} onSave={onGeometrySave}>{(editor) => (
    <div
      className="relative w-full overflow-hidden rounded-sm border-4 border-locked bg-surface"
      style={{ aspectRatio: backgroundAspectRatio ?? 4 / 3 }}
      aria-label={`${storeName} merchandising floorplan`}
    >
      {showBase && (backgroundImageUrl ? <img src={backgroundImageUrl} alt={`${storeName} store layout background`} className="absolute inset-0 h-full w-full object-contain" /> : <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.22)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.22)_1px,transparent_1px)] bg-[size:4%_4%]" aria-hidden="true" />)}

      {showBase && !hasRealBackground && zones.map((zone) => (
        <div
          key={zone.id}
          className="absolute border border-dashed border-border-strong bg-subtle/50 p-2 text-[10px] font-semibold uppercase leading-4 text-text-muted"
          style={constrainedGeometry(zone.geometry)}
        >
          {zone.name}
        </div>
      ))}

      {showBase && !hasRealBackground && contextualLandmarks.map((landmark) => (
        <div
          key={landmark.label}
          className="absolute grid place-items-center border border-border bg-page-canvas/80 px-1 text-center text-[9px] font-medium leading-3 text-text-muted"
          style={constrainedGeometry(landmark)}
          aria-hidden="true"
        >
          {landmark.label}
        </div>
      ))}

      {showBase && !hasRealBackground && fixtures.map((fixture) => (
        <div
          key={fixture.id}
          className="absolute border border-locked/50 bg-locked/15"
          title={fixture.name}
          style={constrainedGeometry(fixture.geometry)}
          aria-hidden="true"
        />
      ))}

      {showBase && !hasRealBackground && <div className="absolute bottom-[1.5%] left-[35%] right-[35%] flex items-end justify-center border-b-4 border-primary pb-1 text-[9px] font-bold uppercase text-primary" aria-hidden="true">
        Entrance / exit
      </div>}

      {showCategories && categorySpaces.map((space) => space.geometry && (
        <button
          key={space.id}
          type="button"
          aria-label={`${space.name} category space`}
          aria-pressed={selectedCategorySpaceId === space.id}
          title={`${space.name}${space.shelfCount !== undefined ? ` · ${space.shelfCount} shelves` : ""}`}
          onClick={() => onSelectCategorySpace?.(space.id)}
          className={clsx(
            "absolute z-[5] overflow-hidden rounded-sm border-2 border-cyan-700 bg-cyan-300/15 px-0.5 text-center text-[8px] font-bold leading-tight text-cyan-950 shadow-sm transition hover:z-20 hover:bg-cyan-200/50 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus",
            selectedCategorySpaceId === space.id && "z-20 border-primary bg-primary/25 ring-4 ring-focus",
          )}
          style={constrainedGeometry(space.geometry, 0.012, 0.018)}
        >
          <span className="block truncate bg-white/75 px-0.5">{space.name}</span>
        </button>
      ))}

      {showDisplayAreas && displayHotspots.map(({ key, area, geometry, sectionLabel }) => {
        const displayedGeometry = editor.draft?.key === key ? editor.draft.geometry : geometry;
        const target = { key, areaId: area.id, sectionId: key === area.id ? undefined : key, geometry: displayedGeometry };
        const resolvedState = stateFor(area.id);
        const state = selectedAreaId === area.id ? "selected" : showCampaignPlacements ? resolvedState : "available";
        return (
          <Fragment key={key}><button
            data-display-hotspot={key}
            type="button"
            aria-label={`${area.localCode ?? area.displayNumber}, ${area.name}${sectionLabel ? `, ${sectionLabel}` : ""}, ${displayAreaStateLabels[state]}, ${humanize(area.type)}`}
            aria-pressed={selectedAreaId === area.id}
            title={`${area.name} · ${displayAreaStateLabels[state]}`}
            onClick={() => onSelect(area.id)}
            onPointerDown={(event) => editor.start(event, target)}
            onKeyDown={(event) => editor.keyboard(event, target)}
            className={clsx(
              "absolute z-10 grid min-h-7 min-w-7 place-items-center rounded-sm border-2 text-[10px] font-bold shadow-sm hover:z-20 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus focus-visible:ring-offset-2",
              !editor.editing && "transition hover:scale-110",
              stateStyles[state],
            )}
            style={{ ...constrainedGeometry(displayedGeometry, onGeometrySave ? 0 : 0.045, onGeometrySave ? 0 : 0.055), ...(onGeometrySave ? { minWidth: 0, minHeight: 0 } : {}), ...(editor.editing ? { transition: "none", cursor: "move" } : {}) }}
          >
            <span className="sr-only">{area.name}</span>
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="absolute -right-1 -top-2 grid h-4 min-w-4 place-items-center rounded bg-text-primary px-1 text-[9px] leading-none text-primary-foreground" aria-hidden="true">{area.displayNumber}</span>
          </button>
          {editor.editing && selectedAreaId === area.id && (!editor.draft || editor.draft.key === key) && <button
            type="button" aria-label={`Resize ${area.localCode ?? area.displayNumber}${sectionLabel ? ` ${sectionLabel}` : ""}`}
            className="absolute z-30 h-4 w-4 border-2 border-white bg-primary shadow"
            style={{ left: `${(displayedGeometry.x + displayedGeometry.width) * 100}%`, top: `${(displayedGeometry.y + displayedGeometry.height) * 100}%`, transform: "translate(-50%, -50%)", cursor: "nwse-resize" }}
            onPointerDown={(event) => editor.start(event, target, true)}
            onKeyDown={(event) => editor.keyboard(event, target)} />}
          </Fragment>
        );
      })}
    </div>
    )}</FloorplanViewport>
  );
}
