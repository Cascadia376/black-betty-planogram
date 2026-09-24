import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { Geometry } from "../../domain/types";
import { changeFloorplanGeometry, constrainPan, snapFloorplanGeometry } from "./floorplanGeometry";

export interface FloorplanGeometryEdit {
  key: string;
  areaId: string;
  sectionId?: string;
  geometry: Geometry;
  /** Geometry observed before the edit, retained across nudges and save retries. */
  originalGeometry?: Geometry;
}

export interface FloorplanEditState { dirty: boolean; saving: boolean }

interface EditorControls {
  editing: boolean;
  draft?: FloorplanGeometryEdit;
  start(event: PointerEvent<HTMLElement>, target: FloorplanGeometryEdit, resize?: boolean): void;
  keyboard(event: KeyboardEvent<HTMLElement>, target: FloorplanGeometryEdit, resize?: boolean): void;
}

type GestureState = {
  pointerId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  target?: FloorplanGeometryEdit;
  latest?: FloorplanGeometryEdit;
  resize?: boolean;
  pan: { x: number; y: number };
  previous?: FloorplanGeometryEdit;
};

/** Normalized geometry is durable; zoom/pan and the one-edit undo history are transient. */
export function FloorplanViewport({ aspectRatio, onSave, onEditStateChange, warningsForEdit, children }: {
  aspectRatio: number;
  onSave?(edit: FloorplanGeometryEdit): Promise<void>;
  onEditStateChange?(state: FloorplanEditState): void;
  warningsForEdit?(edit: FloorplanGeometryEdit): string[];
  children(controls: EditorControls): ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [editing, setEditing] = useState(false);
  const [snap, setSnap] = useState(false);
  const [draft, setDraft] = useState<FloorplanGeometryEdit>();
  const draftRef = useRef<FloorplanGeometryEdit | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [message, setMessage] = useState("");
  const [undo, setUndo] = useState<FloorplanGeometryEdit>();
  const gesture = useRef<GestureState | undefined>(undefined);
  const dirty = Boolean(draft) || saving;

  useEffect(() => { onEditStateChange?.({ dirty, saving }); }, [dirty, saving, onEditStateChange]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  const updateDraft = (next?: FloorplanGeometryEdit) => { draftRef.current = next; setDraft(next); };
  const cancelGesture = (pointerId?: number) => {
    const current = gesture.current;
    if (!current || (pointerId !== undefined && current.pointerId !== pointerId)) return;
    gesture.current = undefined;
    updateDraft(current.previous);
    setMessage(current.previous ? "Drag cancelled. Your earlier keyboard change is still unsaved." : "Drag cancelled. Saved position unchanged.");
  };
  const cancelUnsaved = () => {
    if (savingRef.current) return;
    gesture.current = undefined;
    updateDraft();
    setMessage("Unsaved change cancelled. Saved position unchanged.");
  };
  const setScale = (next: number) => {
    if (gesture.current || savingRef.current) return;
    const bounded = Math.max(1, Math.min(4, next));
    const rect = viewport.current?.getBoundingClientRect();
    if (rect) setPan(constrainPan(rect.width / 2 - (rect.width / 2 - pan.x) * bounded / zoom, rect.height / 2 - (rect.height / 2 - pan.y) * bounded / zoom, bounded, rect.width, rect.height));
    setZoom(bounded);
  };

  const persist = async (edit?: FloorplanGeometryEdit, undoing = false) => {
    // A ref closes the gap before React has rendered the disabled Save button.
    if (!edit || !onSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    updateDraft(edit);
    setMessage("Saving floorplan...");
    try {
      await onSave(edit);
      updateDraft();
      setUndo(!undoing && edit.originalGeometry ? { ...edit, geometry: edit.originalGeometry, originalGeometry: edit.geometry } : undefined);
      setMessage(undoing ? "Undo saved. Previous position restored." : "Floorplan saved. You can leave and reopen this layout.");
    } catch (error) {
      // The attempted geometry stays visible, not falsely reported as saved.
      updateDraft(edit);
      setMessage(`${error instanceof Error ? error.message : "Unable to save the floorplan."} Your change is still unsaved. Use Save floorplan to retry, or cancel it before reloading the latest layout.`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const start = (event: PointerEvent<HTMLElement>, target: FloorplanGeometryEdit, resize = false) => {
    if (!editing || panMode || savingRef.current || gesture.current || event.button !== 0) return;
    event.stopPropagation();
    const currentDraft = draftRef.current;
    if (currentDraft && currentDraft.key !== target.key) { setMessage("Save or cancel the unsaved floorplan change before editing another area."); return; }
    const rect = map.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    const effectiveTarget = currentDraft ?? { ...target, originalGeometry: { ...target.geometry } };
    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, width: rect.width, height: rect.height, target: effectiveTarget, resize, pan, previous: currentDraft };
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (current.target) {
      if (Math.abs(dx) + Math.abs(dy) < 2) return;
      let geometry = changeFloorplanGeometry(current.target.geometry, dx / current.width, dy / current.height, Boolean(current.resize));
      if (snap) geometry = snapFloorplanGeometry(geometry, Boolean(current.resize));
      current.latest = { ...current.target, geometry };
      updateDraft(current.latest);
      setMessage("Unsaved movement. Release to save, or press Escape to cancel this drag.");
    } else setPan(constrainPan(current.pan.x + dx, current.pan.y + dy, zoom, current.width, current.height));
  };

  const finish = (pointerId: number) => {
    const current = gesture.current;
    if (!current || current.pointerId !== pointerId) return;
    gesture.current = undefined;
    if (current.latest) void persist(current.latest);
  };

  const keyboard = (event: KeyboardEvent<HTMLElement>, target: FloorplanGeometryEdit, resize = false) => {
    if (!editing || savingRef.current || panMode) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (gesture.current) cancelGesture(); else cancelUnsaved();
      return;
    }
    if (gesture.current) return;
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const currentDraft = draftRef.current;
    if (currentDraft && currentDraft.key !== target.key) { setMessage("Save or cancel the unsaved floorplan change first."); return; }
    const current = currentDraft ?? { ...target, originalGeometry: { ...target.geometry } };
    updateDraft({ ...current, geometry: changeFloorplanGeometry(current.geometry, direction[0] * 0.005, direction[1] * 0.005, resize || event.shiftKey) });
    setMessage("Keyboard change is unsaved. Use Save floorplan when finished nudging.");
  };

  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center gap-2" aria-label="Floorplan view controls">
      <button type="button" className="rounded border px-3 py-2" aria-label="Zoom out" disabled={zoom === 1 || saving} onClick={() => setScale(zoom - 0.25)}>-</button>
      <output aria-label="Floorplan zoom">{Math.round(zoom * 100)}%</output>
      <button type="button" className="rounded border px-3 py-2" aria-label="Zoom in" disabled={zoom === 4 || saving} onClick={() => setScale(zoom + 0.25)}>+</button>
      <button type="button" className="rounded border px-3 py-2" disabled={saving} onClick={() => { if (!gesture.current) { setZoom(1); setPan({ x: 0, y: 0 }); } }}>Fit floorplan</button>
      <button type="button" className="rounded border px-3 py-2" disabled={saving} aria-pressed={panMode} onClick={() => { if (!gesture.current) setPanMode(!panMode); }}>Pan floorplan</button>
      {onSave && <button type="button" className="rounded border px-3 py-2" aria-pressed={editing} disabled={saving || (editing && dirty)} onClick={() => { setEditing(!editing); setPanMode(false); setMessage(""); }}>{editing ? "Done editing" : "Edit display positions"}</button>}
      {editing && <>
        <button type="button" className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={!draft || saving} onClick={() => { if (!gesture.current) void persist(draftRef.current); }}>{saving ? "Saving..." : "Save floorplan"}</button>
        <button type="button" className="rounded border px-3 py-2" disabled={saving || !draft} onClick={cancelUnsaved}>Cancel unsaved change</button>
        <button type="button" className="rounded border px-3 py-2" disabled={dirty || !undo} onClick={() => void persist(undo, true)}>Undo last saved change</button>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={snap} disabled={saving} onChange={(event) => { if (!gesture.current) setSnap(event.target.checked); }} />Snap to 0.5% grid</label>
      </>}
    </div>
    {editing && <p className="text-xs text-text-secondary">Drag to move; use the bottom-right handle to resize. Release saves the change. Arrow keys move, Shift+arrows resize, then Save floorplan. Escape cancels an unsaved change. Undo reverses the last saved change in this editing session.</p>}
    <p role="status" aria-live="polite" className="text-xs text-text-secondary">{message || (panMode ? "Drag anywhere on the map to pan. Zoom in to see more detail." : "Zoom with +/-; drag the background to pan when zoomed in.")}</p>
    {draft && warningsForEdit?.(draft).map((warning) => <p key={warning} className="rounded border border-warning p-2 text-xs">{warning}</p>)}
    <div ref={viewport} data-testid="floorplan-viewport" className="relative w-full overflow-hidden border border-border" style={{ aspectRatio, touchAction: editing || panMode || zoom > 1 ? "none" : "pan-y", cursor: panMode ? "grab" : undefined }}
      onPointerDown={(event) => {
        if (savingRef.current || gesture.current || event.button !== 0 || (zoom === 1 && !panMode) || (!panMode && (event.target as HTMLElement).closest("button"))) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, width: rect.width, height: rect.height, pan, previous: draftRef.current };
      }}
      onPointerMove={move} onPointerUp={(event) => finish(event.pointerId)} onPointerCancel={(event) => cancelGesture(event.pointerId)} onLostPointerCapture={(event) => cancelGesture(event.pointerId)}>
      <div ref={map} data-testid="floorplan-transform" style={{ width: "100%", transformOrigin: "top left", transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        {/* eslint-disable-next-line react-hooks/refs -- The render prop receives event handlers; it does not execute them during render. */}
        {children({ editing, draft, start, keyboard })}
      </div>
    </div>
  </div>;
}
