import { Copy, Edit3, Layers3, MapPin, Save, X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Badge, Card, DataState, EmptyState, PageHeader, humanize, inputClass } from "../../components/ui";
import type { CategorySpace } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";
import { FloorplanCanvas, type DisplayAreaState } from "./FloorplanCanvas";
import { ProgramDisplaySchedulePanel } from "./ProgramDisplaySchedulePanel";
import { orderStatusForAssignment } from "./programSchedule";

const numericFields = ["shelfWidthIn", "shelfDepthIn", "shelfCount", "maxFacings", "coolerDoorEquivalent"] as const;

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Capacity values must be non-negative numbers.");
  return parsed;
}

export function PhysicalStoreFloorplanPage() {
  const { storeId } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, duplicateStoreLayout, setCurrentStoreLayout, updateCategorySpace } = usePlatform();
  const [showBase, setShowBase] = useState(true);
  const [showCategories, setShowCategories] = useState(false);
  const [showDisplayAreas, setShowDisplayAreas] = useState(true);
  const [showCampaignPlacements, setShowCampaignPlacements] = useState(true);
  const [editing, setEditing] = useState(false);
  const [mutationError, setMutationError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const store = data?.stores.find((item) => item.id === storeId);
  const layouts = data?.storeLayouts.filter((item) => item.storeId === storeId) ?? [];
  const layout = layouts.find((item) => item.id === params.get("layout"))
    ?? layouts.find((item) => item.status === "current")
    ?? layouts[0];
  const spaces = data?.categorySpaces.filter((item) => item.layoutId === layout?.id && item.active) ?? [];
  const selectedProgram = data?.programs.find((item) => item.id === params.get("program"));
  const selectedCampaign = data?.campaigns.find((item) => item.id === params.get("campaign"));
  const programAssignments = data?.displayAssignments.filter((item) => item.programId === selectedProgram?.id && item.storeId === storeId && item.status !== "cancelled") ?? [];
  const areas = data?.displayAreas.filter((item) => item.storeId === storeId && (item.active || programAssignments.some((assignment) => assignment.displayAreaId === item.id))) ?? [];
  const displayAreaSections = data?.displayAreaSections.filter((section) => areas.some((area) => area.id === section.displayAreaId)) ?? [];
  const zones = data?.zones.filter((item) => item.storeId === storeId) ?? [];
  const fixtures = data?.fixtures.filter((item) => item.storeId === storeId) ?? [];
  const selectedSpace = spaces.find((item) => item.id === params.get("space"));
  const selectedArea = areas.find((item) => item.id === params.get("area"));
  const selectedDisplayClass = data?.displayClassDefinitions.find((item) => item.id === selectedArea?.displayClassDefinitionId);
  const sections = data?.categorySpaceSections.filter((item) => item.categorySpaceId === selectedSpace?.id).sort((a, b) => a.sortOrder - b.sortOrder) ?? [];

  const updateSelection = (key: "space" | "area", id?: string) => {
    setEditing(false);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete(key === "space" ? "area" : "space");
      if (id) next.set(key, id); else next.delete(key);
      return next;
    });
  };

  const operationalStateFor = (areaId: string): DisplayAreaState => {
    if (selectedCampaign && data) {
      const planned = data.campaignDisplayAssignments.filter((assignment) => assignment.campaignId === selectedCampaign.id && assignment.storeId === storeId && assignment.displayAreaId === areaId && assignment.status === "ASSIGNED");
      if (planned.length > 0) return selectedCampaign.status === "active" ? "active_campaign" : "upcoming_campaign";
    }
    if (selectedProgram && data) {
      const scheduled = programAssignments.filter((assignment) => assignment.displayAreaId === areaId);
      if (scheduled.length === 0) return "available";
      if (scheduled.some((assignment) => ["at_risk", "order_required"].includes(orderStatusForAssignment(assignment, data)))) return "requires_attention";
      if (scheduled.length > 1 || scheduled.some((assignment) => assignment.resetRequired)) return "upcoming_reset";
      return "current";
    }
    const assignment = data?.assignments.find((item) => {
      const campaign = data.campaigns.find((candidate) => candidate.id === item.campaignId);
      return item.displayAreaId === areaId && (campaign?.status === "active" || campaign?.status === "scheduled");
    });
    if (!assignment) return "available";
    const execution = data?.executions.find((item) => item.assignmentId === assignment.id);
    if (execution?.status === "issue") return "requires_attention";
    return data?.campaigns.find((item) => item.id === assignment.campaignId)?.status === "active" ? "active_campaign" : "upcoming_campaign";
  };
  const stateFor = (areaId: string): DisplayAreaState => selectedArea?.id === areaId ? "selected" : operationalStateFor(areaId);

  const duplicate = async () => {
    if (!layout) return;
    setSaving(true);
    setMutationError(undefined);
    try {
      const copy = await duplicateStoreLayout(layout.id, `${layout.name} - proposed reset`);
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set("layout", copy.id);
        next.delete("space");
        next.delete("area");
        return next;
      });
    } catch (cause) {
      setMutationError(cause instanceof Error ? cause.message : "Unable to duplicate layout.");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!layout || layout.status === "current") return;
    setSaving(true);
    setMutationError(undefined);
    try { await setCurrentStoreLayout(layout.id); }
    catch (cause) { setMutationError(cause instanceof Error ? cause.message : "Unable to make layout current."); }
    finally { setSaving(false); }
  };

  const saveSpace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSpace) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMutationError(undefined);
    try {
      const capacities = Object.fromEntries(numericFields.map((field) => [field, optionalNumber(form.get(field))]));
      await updateCategorySpace({
        categorySpaceId: selectedSpace.id,
        patch: {
          name: String(form.get("name") ?? "").trim(),
          category: String(form.get("category") ?? "").trim(),
          subcategory: String(form.get("subcategory") ?? "").trim() || undefined,
          notes: String(form.get("notes") ?? "").trim() || undefined,
          active: form.get("active") === "on",
          ...capacities,
        },
      });
      setEditing(false);
    } catch (cause) {
      setMutationError(cause instanceof Error ? cause.message : "Unable to save category space.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DataState loading={loading} error={error}>
      {!store ? <EmptyState title="Store not found" message="The requested store is not available." /> : !layout ? (
        <EmptyState title="No store layout" message="This store does not have a versioned physical layout yet." />
      ) : (
        <>
          <PageHeader
            eyebrow="Physical store layout"
            title={`${store.name} floorplan`}
            description="Regular category homes and persistent campaign display areas share one real floorplan without sharing domain semantics."
            actions={<><Link className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/stores/${store.id}/display-areas/new`}>New display area</Link><Link className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/stores/${store.id}/workspace`}>Store workspace</Link></>}
          />

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Layout
              <select className={inputClass} value={layout.id} onChange={(event) => setParams((current) => { const next = new URLSearchParams(current); next.set("layout", event.target.value); next.delete("space"); next.delete("area"); return next; })}>
                {layouts.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.status})</option>)}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={layout.status === "current" ? "success" : layout.status === "draft" ? "warning" : "neutral"}>{humanize(layout.status)}</Badge>
              <button type="button" disabled={saving} onClick={duplicate} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle disabled:opacity-50"><Copy className="h-4 w-4" />Duplicate as draft</button>
              {layout.status !== "current" && <button type="button" disabled={saving} onClick={publish} className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">Make current</button>}
            </div>
          </div>

          {mutationError && <p role="alert" className="mb-4 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{mutationError}</p>}

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="min-w-0 overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div><h2 className="text-sm font-semibold">Store layout</h2><p className="mt-1 text-xs text-text-muted">{spaces.filter((space) => space.geometry).length} mapped · {spaces.length} source-backed category spaces · {areas.length} display areas</p></div>
                <div className="flex flex-wrap gap-2" aria-label="Floorplan layers">
                  <button type="button" aria-pressed={showBase} onClick={() => setShowBase((value) => !value)} className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${showBase ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface"}`}><Layers3 className="h-4 w-4" />Base floorplan</button>
                  <button type="button" aria-pressed={showCategories} onClick={() => setShowCategories((value) => !value)} className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${showCategories ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface"}`}><Layers3 className="h-4 w-4" />Category layout</button>
                  <button type="button" aria-pressed={showDisplayAreas} onClick={() => setShowDisplayAreas((value) => !value)} className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${showDisplayAreas ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface"}`}><MapPin className="h-4 w-4" />Display areas</button>
                  <button type="button" aria-pressed={showCampaignPlacements} onClick={() => setShowCampaignPlacements((value) => !value)} className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${showCampaignPlacements ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface"}`}><MapPin className="h-4 w-4" />Campaign placements</button>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                <FloorplanCanvas storeName={store.name} zones={zones} fixtures={fixtures} areas={areas} displayAreaSections={displayAreaSections} categorySpaces={spaces} backgroundImageUrl={layout.backgroundImageUrl} backgroundAspectRatio={layout.backgroundAspectRatio} showBase={showBase} showCategories={showCategories} showDisplayAreas={showDisplayAreas} showCampaignPlacements={showCampaignPlacements} selectedAreaId={selectedArea?.id} selectedCategorySpaceId={selectedSpace?.id} stateFor={stateFor} onSelect={(id) => updateSelection("area", id)} onSelectCategorySpace={(id) => updateSelection("space", id)} />
                <p className="mt-3 text-xs text-text-muted">Display locations and campaign placements are emphasized by default. Turn on Category layout when regular shelf context is useful.</p>
              </div>
            </Card>

            <aside>
              {selectedSpace ? (
                <Card className="overflow-hidden p-0 xl:sticky xl:top-24">
                  <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                    <div><p className="text-[11px] font-semibold uppercase text-text-muted">Regular category space</p><h2 className="mt-1 text-lg font-semibold">{selectedSpace.name}</h2></div>
                    <button type="button" aria-label="Clear selection" onClick={() => updateSelection("space")}><X className="h-4 w-4" /></button>
                  </div>
                  {editing ? <CategorySpaceForm space={selectedSpace} saving={saving} onCancel={() => setEditing(false)} onSubmit={saveSpace} /> : (
                    <>
                      <dl className="grid grid-cols-2 gap-4 px-5 py-4 text-xs">
                        <Metric label="Category" value={selectedSpace.category} />
                        <Metric label="Subcategory" value={selectedSpace.subcategory} />
                        <Metric label="Fixture" value={selectedSpace.fixtureType ? humanize(selectedSpace.fixtureType) : undefined} />
                        <Metric label="Shelves" value={selectedSpace.shelfCount} />
                        <Metric label="Max facings" value={selectedSpace.maxFacings} />
                        <Metric label="Cooler doors" value={selectedSpace.coolerDoorEquivalent} />
                        <Metric label="Shelf width" value={selectedSpace.shelfWidthIn !== undefined ? `${selectedSpace.shelfWidthIn} in` : undefined} />
                        <Metric label="Shelf depth" value={selectedSpace.shelfDepthIn !== undefined ? `${selectedSpace.shelfDepthIn} in` : undefined} />
                      </dl>
                      {selectedSpace.notes && <p className="border-t border-border px-5 py-4 text-xs leading-5 text-text-secondary">{selectedSpace.notes}</p>}
                      {sections.length > 0 && <div className="border-t border-border px-5 py-4"><p className="text-[11px] font-semibold uppercase text-text-muted">Irregular sections</p>{sections.map((section) => <p key={section.id} className="mt-2 text-xs"><strong>{section.label ?? "Section"}</strong>: {section.shelfCount !== undefined ? `${section.shelfCount} shelves. ` : ""}{section.notes}</p>)}</div>}
                      <div className="border-t border-border p-4"><button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"><Edit3 className="h-4 w-4" />Edit category space</button></div>
                    </>
                  )}
                </Card>
              ) : selectedArea && selectedProgram && data ? (
                <ProgramDisplaySchedulePanel area={selectedArea} programId={selectedProgram.id} data={data} />
              ) : selectedArea ? (
                <Card><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold uppercase text-text-muted">Persistent display area</p><Badge tone={selectedArea.verificationStatus === "verified" ? "success" : "warning"}>{humanize(selectedArea.verificationStatus)}</Badge></div><h2 className="mt-1 text-lg font-semibold">{selectedArea.name}</h2><p className="mt-1 text-xs text-text-muted">Local {selectedArea.localCode ?? "named display"} · Global {selectedArea.code}</p><p className="mt-3 text-sm text-text-secondary">{selectedArea.description}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><Metric label="Family" value={selectedArea.displayFamily ? humanize(selectedArea.displayFamily) : undefined} /><Metric label="Class" value={selectedDisplayClass?.name} /><Metric label="Type" value={humanize(selectedArea.type)} /><Metric label="Capacity" value={selectedArea.capacity} /><Metric label="Primary category" value={selectedArea.primaryCategory} /><Metric label="Compatible categories" value={selectedArea.compatibleCategories?.join(", ")} /><Metric label="Active" value={selectedArea.active ? "Yes" : "No"} /><Metric label="Source" value={selectedArea.sourceReference} /></dl>{selectedArea.notes && <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-text-secondary">{selectedArea.notes}</p>}<div className="mt-4 grid gap-2"><Link className="inline-flex min-h-9 w-full items-center justify-center rounded-md border border-primary px-3 text-sm font-semibold text-primary" to={`/display-areas/${selectedArea.id}/edit`}>Edit Display Area</Link><Link className="inline-flex min-h-9 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground" to={`/display-areas/${selectedArea.id}`}>Persistent Display Area Profile</Link></div></Card>
              ) : (
                <Card><div className="grid min-h-56 place-items-center text-center"><div><MapPin className="mx-auto h-6 w-6 text-primary" /><h2 className="mt-3 text-sm font-semibold">Select a mapped space</h2><p className="mt-1 text-xs leading-5 text-text-muted">Choose a blue category outline or numbered display marker.</p></div></div></Card>
              )}
            </aside>
          </div>
        </>
      )}
    </DataState>
  );
}

function Metric({ label, value }: { label: string; value?: string | number }) {
  return <div><dt className="text-text-muted">{label}</dt><dd className="mt-1 font-semibold">{value ?? "Not recorded"}</dd></div>;
}

function CategorySpaceForm({ space, saving, onCancel, onSubmit }: { space: CategorySpace; saving: boolean; onCancel(): void; onSubmit(event: FormEvent<HTMLFormElement>): void }) {
  return <form onSubmit={onSubmit} className="space-y-4 p-5">
    <Field label="Name"><input name="name" required defaultValue={space.name} className={inputClass} /></Field>
    <Field label="Category"><input name="category" required defaultValue={space.category} className={inputClass} /></Field>
    <Field label="Subcategory"><input name="subcategory" defaultValue={space.subcategory} className={inputClass} /></Field>
    <div className="grid grid-cols-2 gap-3">
      {numericFields.map((field) => <Field key={field} label={humanize(field.replace("In", " in"))}><input name={field} type="number" min="0" step="any" defaultValue={space[field]} className={inputClass} /></Field>)}
    </div>
    <Field label="Notes"><textarea name="notes" rows={4} defaultValue={space.notes} className={`${inputClass} py-2`} /></Field>
    <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={space.active} />Active</label>
    <div className="flex gap-2"><button type="button" onClick={onCancel} className="min-h-9 flex-1 rounded-md border border-border px-3 text-sm font-semibold">Cancel</button><button type="submit" disabled={saving} className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" />Save</button></div>
  </form>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-text-secondary"><span className="mb-1 block">{label}</span>{children}</label>;
}
