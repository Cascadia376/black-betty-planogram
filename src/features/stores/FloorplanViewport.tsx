import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { Geometry } from "../../domain/types";
import { changeFloorplanGeometry, constrainPan } from "./floorplanGeometry";

export interface FloorplanGeometryEdit {
  key: string;
  areaId: string;
  sectionId?: string;
  geometry: Geometry;
}

interface EditorControls {
  editing: boolean;
  draft?: FloorplanGeometryEdit;
  start(event: PointerEvent<HTMLElement>, target: FloorplanGeometryEdit, resize?: boolean): void;
  keyboard(event: KeyboardEvent<HTMLElement>, target: FloorplanGeometryEdit): void;
}

/** View transforms are transient. Only explicit Save sends normalized geometry to storage. */
export function FloorplanViewport({ aspectRatio, onSave, children }: {
  aspectRatio: number;
  onSave?(edit: FloorplanGeometryEdit): Promise<void>;
  children(controls: EditorControls): ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FloorplanGeometryEdit>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const gesture = useRef<{ pointerId: number; x: number; y: number; width: number; height: number; target?: FloorplanGeometryEdit; resize?: boolean; pan: typeof pan; previous?: FloorplanGeometryEdit } | undefined>(undefined);

  const setScale = (next: number) => {
    const bounded = Math.max(1, Math.min(4, next));
    const rect = viewport.current?.getBoundingClientRect();
    if (rect) setPan(constrainPan(rect.width / 2 - (rect.width / 2 - pan.x) * bounded / zoom, rect.height / 2 - (rect.height / 2 - pan.y) * bounded / zoom, bounded, rect.width, rect.height));
    setZoom(bounded);
  };
  const start = (event: PointerEvent<HTMLElement>, target: FloorplanGeometryEdit, resize = false) => {
    if (!editing || panMode || saving || event.button !== 0) return;
    event.stopPropagation();
    if (draft && draft.key !== target.key) { setMessage("Save or cancel this display change before editing another area."); return; }
    const rect = map.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, width: rect.width, height: rect.height, target: draft ?? target, resize, pan, previous: draft };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (current.target) {
      if (Math.abs(dx) + Math.abs(dy) < 2) return;
      setDraft({ ...current.target, geometry: changeFloorplanGeometry(current.target.geometry, dx / current.width, dy / current.height, Boolean(current.resize)) });
      setMessage("Unsaved display position. Save to keep it or Cancel to restore it.");
    } else setPan(constrainPan(current.pan.x + dx, current.pan.y + dy, zoom, current.width, current.height));
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>, target: FloorplanGeometryEdit) => {
    if (!editing || saving || panMode) return;
    if (event.key === "Escape") { setDraft(undefined); setMessage("Change cancelled."); return; }
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    if (draft && draft.key !== target.key) { setMessage("Save or cancel this display change first."); return; }
    const current = draft ?? target;
    setDraft({ ...current, geometry: changeFloorplanGeometry(current.geometry, direction[0] * 0.005, direction[1] * 0.005, event.shiftKey) });
    setMessage("Unsaved display position.");
  };
  const save = async () => {
    if (!draft || !onSave) return;
    setSaving(true);
    try { await onSave(draft); setDraft(undefined); setMessage("Display geometry saved in this browser. Product assignments are unchanged."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save. Your unsaved change is retained."); }
    finally { setSaving(false); }
  };
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center gap-2" aria-label="Floorplan view controls">
      <button type="button" className="rounded border px-3 py-2" aria-label="Zoom out" disabled={zoom === 1} onClick={() => setScale(zoom - 0.25)}>−</button>
      <output aria-label="Floorplan zoom">{Math.round(zoom * 100)}%</output>
      <button type="button" className="rounded border px-3 py-2" aria-label="Zoom in" disabled={zoom === 4} onClick={() => setScale(zoom + 0.25)}>+</button>
      <button type="button" className="rounded border px-3 py-2" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Fit floorplan</button>
      <button type="button" className="rounded border px-3 py-2" aria-pressed={panMode} onClick={() => setPanMode(!panMode)}>Pan floorplan</button>
      {onSave && <button type="button" className="rounded border px-3 py-2" aria-pressed={editing} disabled={saving || Boolean(draft)} onClick={() => { setEditing(!editing); setPanMode(false); setMessage(""); }}>{editing ? "Done editing" : "Edit display positions"}</button>}
      {editing && <><button type="button" className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={!draft || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save display position"}</button><button type="button" className="rounded border px-3 py-2" disabled={saving} onClick={() => { setDraft(undefined); setMessage("Change cancelled."); }}>Cancel change</button></>}
    </div>
    {editing && <p className="text-xs text-text-secondary">Drag an area to move it; use its bottom-right handle to resize. Arrow keys move, Shift+arrows resize, Escape cancels. Save one area at a time. These store-wide positions also appear in execution packs; images and source seeds stay unchanged.</p>}
    <p role="status" className="text-xs text-text-secondary">{message || (panMode ? "Drag anywhere on the map to pan. Zoom in to see more detail." : "Zoom with +/−. Drag the background to pan, or enable Pan floorplan to drag anywhere.")}</p>
    <div ref={viewport} data-testid="floorplan-viewport" className="relative w-full overflow-hidden border border-border" style={{ aspectRatio, touchAction: "none", cursor: panMode ? "grab" : undefined }}
      onPointerDown={(event) => {
        if (event.button !== 0 || (!panMode && (event.target as HTMLElement).closest("button"))) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, width: rect.width, height: rect.height, pan };
      }}
      onPointerMove={move}
      onPointerUp={() => { gesture.current = undefined; }}
      onPointerCancel={() => { if (gesture.current?.target) setDraft(gesture.current.previous); gesture.current = undefined; }}
      onDragStart={(event) => event.preventDefault()}
      onClickCapture={(event) => { if (panMode) { event.preventDefault(); event.stopPropagation(); } }}>
      <div ref={map} data-testid="floorplan-transform" className="h-full w-full origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        {/* eslint-disable-next-line react-hooks/refs -- Render prop receives event callbacks; those read DOM refs only when invoked by pointer events. */}
        {children({ editing, draft, start, keyboard })}
      </div>
    </div>
  </div>;
}
