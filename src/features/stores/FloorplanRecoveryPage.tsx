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

function editTimeLabel(change: FloorplanRecoveryChange): string {
  if (!change.lastEditedAt) return "Not recorded in legacy snapshot";
  const parsed = new Date(change.lastEditedAt);
  if (Number.isNaN(parsed.getTime())) return change.lastEditedAt;
  return parsed.toLocaleString();
}

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
    createDisplayArea,
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
  const duplicateFor = (change: FloorplanRecoveryChange) => {
    if (change.kind !== "missing_display_area" || !change.recoveredDisplayArea || !data) return undefined;
    const recovered = change.recoveredDisplayArea;
    const localCode = recovered.localCode?.trim().toLowerCase();
    const code = recovered.code?.trim().toLowerCase();
    return data.displayAreas.find((area) => area.storeId === recovered.storeId && (
      (localCode && area.localCode?.trim().toLowerCase() === localCode)
      || (code && area.code?.trim().toLowerCase() === code)
    ));
  };
  const restorableChanges = changes.filter((change) => change.kind !== "missing_display_area" || !duplicateFor(change));

  const loadRecovery = (next: FloorplanExport) => {
    setRecovery(next);
    if (!data) return;
    const nextChanges = compareFloorplanRecovery(data, next);
    const nextRestorable = nextChanges.filter((change) => {
      if (change.kind !== "missing_display_area" || !change.recoveredDisplayArea) return true;
      const recovered = change.recoveredDisplayArea;
      const localCode = recovered.localCode?.trim().toLowerCase();
      const code = recovered.code?.trim().toLowerCase();
      return !data.displayAreas.some((area) => area.storeId === recovered.storeId && (
        (localCode && area.localCode?.trim().toLowerCase() === localCode)
        || (code && area.code?.trim().toLowerCase() === code)
      ));
    });
    setSelected(new Set(nextRestorable.map((change) => change.key)));
    setMessage(nextChanges.length
      ? `${nextChanges.length} recoverable floorplan difference${nextChanges.length === 1 ? "" : "s"} found. Existing positions and missing displays can be selected for restore.`
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

      let createdDisplays = 0;
      let restoredGeometry = 0;
      for (const change of selectedChanges) {
        if (change.kind === "missing_display_area") {
          if (!change.recoveredDisplayArea) throw new Error(`Recovered display data is missing for ${change.label}.`);
          const duplicate = duplicateFor(change);
          if (duplicate) throw new Error(`${change.label} matches existing shared display ${duplicate.localCode ?? duplicate.name}. Clear it from the selection and review the existing display instead.`);
          const { id: legacyId, ...area } = change.recoveredDisplayArea;
          void legacyId;
          await createDisplayArea({ area });
          createdDisplays += 1;
        } else if (change.kind === "display_area") {
          await updateDisplayArea({ displayAreaId: change.itemId, patch: { geometry: change.recoveredGeometry } });
          restoredGeometry += 1;
        } else if (change.kind === "display_area_section" && change.parentId) {
          await updateDisplayArea({
            displayAreaId: change.parentId,
            patch: {},
            sectionGeometry: { sectionId: change.itemId, geometry: change.recoveredGeometry },
          });
          restoredGeometry += 1;
        } else if (change.kind === "category_space") {
          await updateCategorySpace({ categorySpaceId: change.itemId, patch: { geometry: change.recoveredGeometry } });
          restoredGeometry += 1;
        }
      }
      const parts = [
        createdDisplays ? `${createdDisplays} missing display${createdDisplays === 1 ? "" : "s"} recreated` : "",
        restoredGeometry ? `${restoredGeometry} position change${restoredGeometry === 1 ? "" : "s"} restored` : "",
      ].filter(Boolean);
      setMessage(`${parts.join(" and ")} in shared physical data. A pre-restore backup was downloaded.`);
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
          description="Preview legacy browser or exported recovery data against the current shared physical layout. You can restore existing positions and recreate missing displays after review."
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
            <Badge tone={changes.length ? "warning" : "success"}>{changes.length} floorplan differences</Badge>
          </div>
        </Card>}

        {changes.length > 0 && <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div><h2 className="font-semibold">Recovered floorplan differences</h2><p className="text-sm text-text-secondary">Select position changes and missing displays to restore them to shared floorplan data. Possible duplicates are blocked.</p></div>
            <div className="flex gap-2">
              <button type="button" className="rounded border border-border px-3 py-2 text-sm font-semibold" disabled={restorableChanges.length === 0} onClick={() => setSelected(new Set(restorableChanges.map((change) => change.key)))}>Select restorable ({restorableChanges.length})</button>
              <button type="button" className="rounded border border-border px-3 py-2 text-sm font-semibold" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          </div>
          <div className="max-h-[34rem] overflow-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 bg-subtle text-xs uppercase text-text-muted"><tr><th className="p-3">Restore</th><th className="p-3">Store</th><th className="p-3">Type</th><th className="p-3">Item</th><th className="p-3">Recovered position</th><th className="p-3">Last edit</th><th className="p-3">Details</th></tr></thead>
              <tbody>{changes.map((change) => <tr key={change.key} className="border-t border-border">
                <td className="p-3">{change.kind === "missing_display_area" && duplicateFor(change)
                  ? <Badge tone="warning">Duplicate</Badge>
                  : <input aria-label={`Restore ${change.label}`} type="checkbox" checked={selected.has(change.key)} onChange={() => toggle(change.key)} />}</td>
                <td className="p-3">{stores.get(change.storeId)?.name ?? change.storeId}</td>
                <td className="p-3">{change.kind === "missing_display_area" ? "new recovered display" : change.kind.replaceAll("_", " ")}</td>
                <td className="p-3 font-semibold">{change.label}</td>
                <td className="p-3">{geometryLabel(change)}</td>
                <td className="p-3 text-xs text-text-secondary">{change.kind === "missing_display_area" ? editTimeLabel(change) : "—"}</td>
                <td className="p-3 text-xs text-text-secondary">{change.kind === "missing_display_area"
                  ? duplicateFor(change)
                    ? `Matches existing display ${duplicateFor(change)?.localCode ?? duplicateFor(change)?.name}; not safe to recreate automatically.`
                    : [change.recoveredDisplayArea?.type, change.recoveredDisplayArea?.displayFamily, change.recoveredDisplayArea?.description].filter(Boolean).join(" · ") || "Recovered display can be recreated in shared data."
                  : "Existing shared record"}</td>
              </tr>)}</tbody>
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
