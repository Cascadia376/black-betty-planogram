import { Camera, CheckCircle2, MapPin, PackageX, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, DataState, EmptyState, Field, PageHeader, formatDate, humanize, inputClass } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";
import { getExecutionContext } from "./executionContext";

type ExecutionContext = ReturnType<typeof getExecutionContext>;

export function ExecutionPage() {
  const { executionId } = useParams();
  const platform = usePlatform();
  const context = platform.data && executionId ? getExecutionContext(platform.data, executionId) : undefined;
  return <DataState loading={platform.loading} error={platform.error}>{!context?.execution || !context.campaign || !context.area
    ? <EmptyState title="Execution not found" message="The requested task is unavailable." />
    : <ExecutionForm key={context.execution.id} context={context} completeExecution={platform.completeExecution} canExecute={platform.role !== "read_only"} />}
  </DataState>;
}

function ExecutionForm({ context, completeExecution, canExecute }: { context: ExecutionContext; completeExecution: ReturnType<typeof usePlatform>["completeExecution"]; canExecute: boolean }) {
  const navigate = useNavigate();
  const { execution, campaign, campaignAssignment, displayAssignment, area, program, period, products } = context;
  const submission = execution?.submission;
  const [note, setNote] = useState(submission?.note ?? "");
  const [photoName, setPhotoName] = useState(submission?.photoName ?? "");
  const [unavailable, setUnavailable] = useState<string[]>(submission?.unavailableSkus ?? []);
  const [substitution, setSubstitution] = useState(submission?.substitutionRequested ?? false);
  const [formError, setFormError] = useState<string>();
  if (!execution || !campaign || !area) return null;

  const programQuery = program ? `?program=${program.id}&area=${area.id}` : `?area=${area.id}`;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await completeExecution({ executionId: execution.id, note, photoName: photoName || undefined, unavailableSkus: unavailable, substitutionRequested: substitution });
      navigate(`/compliance/${execution.id}`);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Unable to submit execution.");
    }
  };

  return <form onSubmit={submit} className="space-y-6">
    <PageHeader eyebrow={program?.name ?? "Execute"} title={campaign.name} description={`Display ${area.displayNumber} · ${area.name} · ${area.description}`} actions={<><Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold" to={`/stores/${area.storeId}/floorplan${programQuery}`}><MapPin className="h-4 w-4" />Locate display</Link>{canExecute && <Button><Send className="h-4 w-4" />Submit completion</Button>}</>} />
    {formError && <div role="alert" className="rounded-md border border-error/30 bg-error-subtle p-3 text-sm text-error">{formError}</div>}
    {program && <Card className="p-4"><dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><Detail label="Program" value={program.name} /><Detail label="Display" value={`${area.displayNumber} · ${area.name}`} /><Detail label="Assignment period" value={period?.name ?? (displayAssignment ? `${formatDate(displayAssignment.startDate)} - ${formatDate(displayAssignment.endDate)}` : "Not assigned")} /><Detail label="Reset date" value={period?.resetDate ? formatDate(period.resetDate) : "No reset scheduled"} /></dl></Card>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="space-y-4">
        <Card><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Assignment products</h2><Badge tone={execution.status === "completed" ? "success" : execution.status === "issue" ? "error" : "warning"}>{humanize(execution.status)}</Badge></div><div className="mt-4 divide-y divide-border">{products.map((product) => <div key={product.id} className="py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{product.name}</p><Badge tone={product.required ? "error" : "info"}>{product.required ? "Required" : "Recommended"}</Badge></div><p className="mt-1 text-xs text-text-muted">{product.sku} · {product.placement}</p>{product.note && <p className="mt-1 text-xs text-text-secondary">{product.note}</p>}</div><label className="flex min-h-9 shrink-0 items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={unavailable.includes(product.sku)} onChange={(event) => setUnavailable((current) => event.target.checked ? [...new Set([...current, product.sku])] : current.filter((sku) => sku !== product.sku))} disabled={!canExecute} />Unavailable SKU</label></div><div className="mt-3 grid gap-3 sm:grid-cols-3"><Detail label="Planned" value={product.plannedQuantity} /><Detail label="Actual availability" value={product.onHandCases === undefined ? "Not recorded" : `${product.onHandCases} cases on hand`} detail={product.inboundCases ? `${product.inboundCases} inbound${product.nextArrival ? ` · ${formatDate(product.nextArrival)}` : ""}` : "No inbound recorded"} /><Detail label="Supplier" value={product.supplierName} /></div></div>)}</div></Card>
        <Card><h2 className="font-semibold">Display requirements</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Detail label="Signage" value={campaign.requirement.signage} /><Detail label="Minimum merchandising requirement" value={campaign.requirement.minimumSpace} /><div className="sm:col-span-2"><Detail label="Required / recommended placement" value={campaign.requirement.executionNotes} /></div><Detail label="Assignment notes" value={displayAssignment?.notes ?? campaignAssignment?.notes ?? "No assignment notes"} /><Detail label="Store execution notes" value={campaignAssignment?.notes ?? "No store-specific notes"} /></dl></Card>
      </div>
      <div className="space-y-4">
        <Card><div className="flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /><h2 className="font-semibold">Completion evidence</h2></div><div className="mt-4 space-y-4"><Field label="Completion photo" hint="Mock mode stores filename metadata only; image content and employee identity are not retained."><input type="file" accept="image/*" className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-subtle file:px-3 file:py-2 file:font-semibold" onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? "")} disabled={!canExecute} /></Field>{photoName && <div className="rounded-md bg-success-subtle p-3 text-sm text-success"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{photoName}</div>{submission?.submittedAt && <p className="mt-1 pl-6 text-xs">Submitted {new Date(submission.submittedAt).toLocaleString("en-CA")}</p>}</div>}<Field label="Completion note"><textarea className={`${inputClass} min-h-28 py-2`} value={note} onChange={(event) => setNote(event.target.value)} disabled={!canExecute} /></Field></div></Card>
        {unavailable.length > 0 && <Card><div className="flex gap-2 text-error"><PackageX className="h-5 w-5 shrink-0" /><div><h2 className="font-semibold">Product availability issue</h2><p className="mt-1 text-sm">{unavailable.join(", ")} marked unavailable at execution.</p></div></div><label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={substitution} onChange={(event) => setSubstitution(event.target.checked)} disabled={!canExecute} />Request an approved substitution</label></Card>}
      </div>
    </div>
  </form>;
}

function Detail({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="min-w-0"><p className="text-[10px] font-semibold uppercase text-text-muted">{label}</p><p className="mt-1 break-words font-medium text-text-primary">{value}</p>{detail && <p className="mt-1 text-xs text-text-muted">{detail}</p>}</div>;
}
