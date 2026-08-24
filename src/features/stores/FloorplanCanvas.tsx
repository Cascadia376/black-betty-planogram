/* eslint-disable react-refresh/only-export-components */
import { clsx } from "clsx";
import { MapPin } from "lucide-react";
import type { DisplayArea, Fixture, StoreZone } from "../../domain/types";
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

function constrainedGeometry(geometry: { x: number; y: number; width: number; height: number }, minimumWidth = 0, minimumHeight = 0) {
  const x = Math.min(Math.max(geometry.x, 0), 1);
  const y = Math.min(Math.max(geometry.y, 0), 1);
  const width = Math.min(Math.max(geometry.width, minimumWidth), 1 - x);
  const height = Math.min(Math.max(geometry.height, minimumHeight), 1 - y);
  return { left: `${x * 100}%`, top: `${y * 100}%`, width: `${width * 100}%`, height: `${height * 100}%` };
}

export function FloorplanCanvas({
  storeName,
  zones,
  fixtures,
  areas,
  selectedAreaId,
  stateFor,
  onSelect,
}: {
  storeName: string;
  zones: StoreZone[];
  fixtures: Fixture[];
  areas: DisplayArea[];
  selectedAreaId?: string;
  stateFor(areaId: string): DisplayAreaState;
  onSelect(areaId: string): void;
}) {
  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden rounded-sm border-4 border-locked bg-surface"
      aria-label={`${storeName} merchandising floorplan`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.22)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.22)_1px,transparent_1px)] bg-[size:4%_4%]" aria-hidden="true" />

      {zones.map((zone) => (
        <div
          key={zone.id}
          className="absolute border border-dashed border-border-strong bg-subtle/50 p-2 text-[10px] font-semibold uppercase leading-4 text-text-muted"
          style={constrainedGeometry(zone.geometry)}
        >
          {zone.name}
        </div>
      ))}

      {contextualLandmarks.map((landmark) => (
        <div
          key={landmark.label}
          className="absolute grid place-items-center border border-border bg-page-canvas/80 px-1 text-center text-[9px] font-medium leading-3 text-text-muted"
          style={constrainedGeometry(landmark)}
          aria-hidden="true"
        >
          {landmark.label}
        </div>
      ))}

      {fixtures.map((fixture) => (
        <div
          key={fixture.id}
          className="absolute border border-locked/50 bg-locked/15"
          title={fixture.name}
          style={constrainedGeometry(fixture.geometry)}
          aria-hidden="true"
        />
      ))}

      <div className="absolute bottom-[1.5%] left-[35%] right-[35%] flex items-end justify-center border-b-4 border-primary pb-1 text-[9px] font-bold uppercase text-primary" aria-hidden="true">
        Entrance / exit
      </div>

      {areas.map((area) => {
        const state = stateFor(area.id);
        return (
          <button
            key={area.id}
            type="button"
            aria-label={`${area.name}, ${displayAreaStateLabels[state]}, ${humanize(area.type)}`}
            aria-pressed={selectedAreaId === area.id}
            title={`${area.name} · ${displayAreaStateLabels[state]}`}
            onClick={() => onSelect(area.id)}
            className={clsx(
              "absolute z-10 grid min-h-7 min-w-7 place-items-center rounded-sm border-2 text-[10px] font-bold shadow-sm transition hover:z-20 hover:scale-110 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus focus-visible:ring-offset-2",
              stateStyles[state],
            )}
            style={constrainedGeometry(area.geometry, 0.045, 0.055)}
          >
            <span className="sr-only">{area.name}</span>
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="absolute -right-1 -top-2 grid h-4 min-w-4 place-items-center rounded bg-text-primary px-1 text-[9px] leading-none text-primary-foreground" aria-hidden="true">{area.displayNumber}</span>
          </button>
        );
      })}
    </div>
  );
}
