import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card, DataState, EmptyState, PageHeader, humanize, inputClass } from "../../components/ui";
import type { DisplayArea, DisplayType } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";

const displayTypes: DisplayType[] = ["endcap", "feature_display", "seasonal_table", "floor_stack", "cooler_doors", "window", "checkout", "contest_space", "supplier_display", "flex", "other", "feature_table", "floor_display", "seasonal_area"];

function numberValue(form: FormData, name: string, required = true): number | undefined {
  const raw = String(form.get(name) ?? "").trim();
  if (!raw && !required) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${humanize(name)} must be a number.`);
  return value;
}

export function DisplayAreaAdminPage() {
  const { displayAreaId, storeId } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, createDisplayArea, updateDisplayArea, deleteDisplayArea } = usePlatform();
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string>();
  const existing = data?.displayAreas.find((area) => area.id === displayAreaId);
  const resolvedStoreId = existing?.storeId ?? storeId;
  const store = data?.stores.find((item) => item.id === resolvedStoreId);
  const initial: Omit<DisplayArea, "id" | "storeId"> = existing ?? {
    displayNumber: "",
    code: "",
    name: "",
    type: "other",
    description: "",
    capacity: "",
    compatibleCategories: [],
    flexible: false,
    geometry: { x: 0, y: 0, width: 0.05, height: 0.05 },
    active: true,
    verificationStatus: "unverified",
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resolvedStoreId) return;
    const form = new FormData(event.currentTarget);
    const values = {
      displayNumber: String(form.get("displayNumber") ?? "").trim(),
      code: String(form.get("code") ?? "").trim(),
      name: String(form.get("name") ?? "").trim(),
      type: String(form.get("type")) as DisplayType,
      description: String(form.get("description") ?? "").trim(),
      capacity: String(form.get("capacity") ?? "").trim(),
      primaryCategory: String(form.get("primaryCategory") ?? "").trim() || undefined,
      compatibleCategories: String(form.get("compatibleCategories") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      flexible: form.get("flexible") === "on",
      active: form.get("active") === "on",
      verificationStatus: String(form.get("verificationStatus")) as DisplayArea["verificationStatus"],
      geometry: {
        x: numberValue(form, "x")!, y: numberValue(form, "y")!, width: numberValue(form, "width")!, height: numberValue(form, "height")!,
        ...(numberValue(form, "rotation", false) === undefined ? {} : { rotation: numberValue(form, "rotation", false) }),
      },
    };
    setSaving(true);
    setMutationError(undefined);
    try {
      const saved = existing
        ? await updateDisplayArea({ displayAreaId: existing.id, patch: values })
        : await createDisplayArea({ area: { ...values, storeId: resolvedStoreId } });
      navigate(`/stores/${saved.storeId}/floorplan?area=${saved.id}`);
    } catch (cause) {
      setMutationError(cause instanceof Error ? cause.message : "Unable to save display area.");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!existing) return;
    setSaving(true);
    setMutationError(undefined);
    try {
      await deleteDisplayArea(existing.id);
      navigate(`/stores/${existing.storeId}/floorplan`);
    } catch (cause) {
      setMutationError(cause instanceof Error ? cause.message : "Unable to delete display area.");
    } finally { setSaving(false); }
  };

  return <DataState loading={loading} error={error}>{!store || (displayAreaId && !existing) ? <EmptyState title="Display area not found" message="The requested display area or store is not available." /> : <>
    <PageHeader eyebrow="Display area administration" title={existing ? `Edit ${existing.name}` : `New ${store.name} display area`} description="Maintain promotional DisplayArea metadata independently from regular CategorySpace homes." actions={<Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold" to={`/stores/${store.id}/floorplan`}><ArrowLeft className="h-4 w-4" />Floorplan</Link>} />
    <Card className="mx-auto max-w-4xl">
      {mutationError && <p role="alert" className="mb-4 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{mutationError}</p>}
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3"><Field label="Display number"><input required name="displayNumber" defaultValue={initial.displayNumber} className={inputClass} /></Field><Field label="Code"><input required name="code" defaultValue={initial.code} className={inputClass} /></Field><Field label="Name"><input required name="name" defaultValue={initial.name} className={inputClass} /></Field></div>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="Type"><select name="type" defaultValue={initial.type} className={inputClass}>{displayTypes.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}</select></Field><Field label="Capacity"><input name="capacity" defaultValue={initial.capacity} className={inputClass} /></Field><Field label="Primary category"><input name="primaryCategory" defaultValue={initial.primaryCategory} className={inputClass} /></Field></div>
        <Field label="Description"><textarea required name="description" rows={3} defaultValue={initial.description} className={`${inputClass} py-2`} /></Field>
        <Field label="Compatible categories (comma-separated)"><input name="compatibleCategories" defaultValue={initial.compatibleCategories?.join(", ")} className={inputClass} /></Field>
        <fieldset><legend className="mb-2 text-sm font-semibold">Normalized geometry</legend><div className="grid grid-cols-2 gap-4 sm:grid-cols-5">{(["x", "y", "width", "height", "rotation"] as const).map((field) => <Field key={field} label={humanize(field)}><input required={field !== "rotation"} name={field} type="number" step="any" defaultValue={initial.geometry[field]} className={inputClass} /></Field>)}</div></fieldset>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="Verification"><select name="verificationStatus" defaultValue={initial.verificationStatus} className={inputClass}><option value="unverified">Unverified</option><option value="verified">Verified</option></select></Field><label className="flex items-center gap-2 pt-6 text-sm"><input name="flexible" type="checkbox" defaultChecked={initial.flexible} />Flexible</label><label className="flex items-center gap-2 pt-6 text-sm"><input name="active" type="checkbox" defaultChecked={initial.active} />Active</label></div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5">{existing ? <button type="button" disabled={saving} onClick={remove} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-error px-3 text-sm font-semibold text-error disabled:opacity-50"><Trash2 className="h-4 w-4" />Delete permanently</button> : <span />}<button type="submit" disabled={saving} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" />Save display area</button></div>
      </form>
    </Card>
  </>}</DataState>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-text-secondary"><span className="mb-1 block">{label}</span>{children}</label>;
}
