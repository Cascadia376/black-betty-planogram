import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, DataState, EmptyState, PageHeader } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";
import {
  LEGACY_FLOORPLAN_STORAGE_KEY,
  compareFloorplanRecovery,
  createFloorplanRecoveryFromLegacyStorage,
  downloadFloorplanExport,
  parseFloorplanRecoveryInput,
  type FloorplanExport,
  type FloorplanRecoveryChange,
} from "./floorplanExport";

function geometryLabel(change: FloorplanRecoveryChange): string {
  const value = change.recoveredGeometry;
  return `${Math.round(value.x * 100)}%, ${Math.round(value.y * 100)}% · ${Math.round(value.width * 100)}×${Math.round(value.height * 100)}%`;
}

export function FloorplanRecoveryPage() {
  const {
    data,
    loading,
    error,
    blackBettyRole,
    userEmail,
    updateCategorySpace,
    updateDisplayArea,
  } = usePlatform();
  const [recovery, setRecovery] = useState<FloorplanExport>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const changes = useMemo(() => data && recovery ? compareFloorplanRecovery(data, recovery) : [], [data, recovery]);
  const stores = data ? new Map(data.stores.map((store) => [store.id, store])) : new Map();
  const canApply = blackBettyRole === "buyer" || blackBettyRole === "admin";

  const loadRecovery = (next: FloorplanExport) => {
    setRecovery(next);
    if (!data) return;
    const nextChanges = compareFloorplanRecovery(data, next);
    setSelected(new Set(nextChanges.map((change) => change.key)));
    setMessage(nextChanges.length
      ? `${nextChanges.length} recoverable geometry change${nextChanges.length === 1 ? "" : "s"} found. Nothing has been written yet.`
      : "No recoverable geometry differences were found.");
  };

  const recoverBrowser = () => {
    setMessage("");
    try {
      const stored = window.localStorage.getItem(LEGACY_FLOORPLAN_STORAGE_KEY);
      if (!stored) throw new Error("No legacy Black Betty browser snapshot was found in this browser.");
      loadRecovery(createFloorplanRecoveryFromLegacyStorage(stored));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to read legacy browser floorplan data.");
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); setMessage("");
    try { loadRecovery(parseFloorplanRecoveryInput(await file.text())); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to read the floorplan recovery file."); }
    finally { setBusy(false); }
  };

  const toggle = (key: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const apply = async () => {
    if (!data || !canApply) return;
    const selectedChanges = changes.filter((change) => selected.has(change.key));
    if (selectedChanges.length === 0) return;
    setBusy(true); setMessage("");
    try {
      downloadFloorplanExport(data, {
        source: "shared",
        exportedBy: userEmail,
        note: "Automatic backup created immediately before floorplan recovery apply.",
      });

      for (const change of selectedChanges) {
        if (change.kind === "display_area") {
          await updateDisplayArea({ displayAreaId: change.itemId, patch: { geometry: change.recoveredGeometry } });
        } else if (change.kind === "display_area_section" && change.parentId) {
          await updateDisplayArea({
            displayAreaId: change.parentId,
            patch: {},
            sectionGeometry: { sectionId: change.itemId, geometry: change.recoveredGeometry },
          });
        } else if (change.kind === "category_space") {
          await updateCategorySpace({ categorySpaceId: change.itemId, patch: { geometry: change.recoveredGeometry } });
        }
      }
      setMessage(`${selectedChanges.length} floorplan change${selectedChanges.length === 1 ? "" : "s"} restored to shared physical data. A pre-restore backup was downloaded.`);
      setSelected(new Set());
      setRecovery(undefined);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Floorplan recovery failed. Review the shared layout before retrying.");
    } finally {
      setBusy(false);
    }
  };

  return <DataState loading={loading} error={error}>
    {!data ? <EmptyState title="Floorplan recovery unavailable" message="Shared floorplan data could not be loaded." /> : (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Floorplan recovery"
          title="Recover floorplan work"
          description="Preview legacy browser or exported recovery data against the current shared physical layout. Recovery is geometry-only and never creates stores, displays, campaigns, or assignments."
          actions={<Link className="rounded border border-border px-3 py-2 text-sm font-semibold" to="/stores">Stores</Link>}
        />

        {message && <p role="status" className="rounded border border-warning/30 bg-warning-subtle p-3 text-sm">{message}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="font-semibold">This browser</h2>
            <p className="mt-2 text-sm text-text-secondary">Check the historical Black Betty localStorage snapshot on this browser. This does not write anything.</p>
            <button type="button" disabled={busy} onClick={recoverBrowser} className="mt-4 rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Recover legacy browser work</button>
          </Card>
          <Card>
            <h2 className="font-semibold">Recovery file</h2>
            <p className="mt-2 text-sm text-text-secondary">Upload a Black Betty floorplan recovery JSON file or a copied raw legacy localStorage snapshot.</p>
            <label className="mt-4 inline-flex cursor-pointer rounded border border-border px-3 py-2 text-sm font-semibold"><input className="sr-only" type="file" accept=".json,.txt" onChange={(event) => void upload(event.target.files?.[0])} />Choose recovery file</label>
          </Card>
        </div>

        {recovery && <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Recovery package</h2>
              <p className="mt-1 text-sm text-text-secondary">Exported {recovery.exportedAt}{recovery.version === 2 ? ` · ${recovery.source}` : " · legacy version 1"}</p>
            </div>
            <Badge tone={changes.length ? "warning" : "success"}>{changes.length} geometry differences</Badge>
          </div>
        </Card>}

        {changes.length > 0 && <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div><h2 className="font-semibold">Select changes to restore</h2><p className="text-sm text-text-secondary">Only checked geometry records will be applied.</p></div>
            <div className="flex gap-2">
              <button type="button" className="rounded border border-border px-3 py-2 text-sm font-semibold" onClick={() => setSelected(new Set(changes.map((change) => change.key)))}>Select all</button>
              <button type="button" className="rounded border border-border px-3 py-2 text-sm font-semibold" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          </div>
          <div className="max-h-[34rem] overflow-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 bg-subtle text-xs uppercase text-text-muted"><tr><th className="p-3">Restore</th><th className="p-3">Store</th><th className="p-3">Type</th><th className="p-3">Item</th><th className="p-3">Recovered position</th></tr></thead>
              <tbody>{changes.map((change) => <tr key={change.key} className="border-t border-border"><td className="p-3"><input aria-label={`Restore ${change.label}`} type="checkbox" checked={selected.has(change.key)} onChange={() => toggle(change.key)} /></td><td className="p-3">{stores.get(change.storeId)?.name ?? change.storeId}</td><td className="p-3">{change.kind.replaceAll("_", " ")}</td><td className="p-3 font-semibold">{change.label}</td><td className="p-3">{geometryLabel(change)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="border-t border-border p-4">
            <button type="button" disabled={!canApply || busy || selected.size === 0} onClick={() => void apply()} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Restoring…" : `Restore ${selected.size} selected change${selected.size === 1 ? "" : "s"}`}</button>
          </div>
        </Card>}
      </div>
    )}
  </DataState>;
}
