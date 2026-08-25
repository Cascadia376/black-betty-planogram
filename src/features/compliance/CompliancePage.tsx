import { Check, MapPin, MessageSquareWarning, PackageX } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { ComplianceCheck, ComplianceReview, ReviewDecision } from "../../domain/types";
import { calculateComplianceScore } from "../../domain/rules";
import { Badge, Button, Card, DataState, EmptyState, Field, PageHeader, formatDate, humanize, inputClass } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";
import { buildAssignmentComplianceChecks, getExecutionContext } from "../execution/executionContext";

type ExecutionContext = ReturnType<typeof getExecutionContext>;

export function CompliancePage() {
  const { executionId } = useParams();
  const platform = usePlatform();
  const context = platform.data && executionId ? getExecutionContext(platform.data, executionId) : undefined;
  const review = platform.data?.complianceReviews.find((item) => item.executionId === executionId);
  if (!context?.execution || !context.area || (!context.campaign && !context.displayAssignment)) {
    return <DataState loading={platform.loading} error={platform.error}><EmptyState title="Compliance item not found" message="The requested execution is unavailable." /></DataState>;
  }
  return <DataState loading={platform.loading} error={platform.error}>{!context.execution.submission
    ? <WaitingForSubmission context={context} />
    : <ComplianceForm key={context.execution.id} context={context} review={review} reviewCompliance={platform.reviewCompliance} canReview={["admin", "operations", "merchandising"].includes(platform.role)} />}
  </DataState>;
}

function WaitingForSubmission({ context }: { context: ExecutionContext }) {
  const { execution, area, program, title } = context;
  if (!execution || !area) return null;
  return <div className="space-y-5"><PageHeader eyebrow={program?.name ?? "Verify"} title="Compliance review" description={`${title} · Display ${area.displayNumber} · ${area.name}`} /><EmptyState title="Waiting for execution submission" message="Complete the display task before reviewing compliance." /><Link className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground" to={`/executions/${execution.id}`}>Open execution task</Link></div>;
}

function ComplianceForm({ context, review, reviewCompliance, canReview }: { context: ExecutionContext; review?: ComplianceReview; reviewCompliance: ReturnType<typeof usePlatform>["reviewCompliance"]; canReview: boolean }) {
  const { execution, area, program, period, displayAssignment, products, title, requirement } = context;
  const submission = execution?.submission;
  const requiredSkus = products.filter((item) => item.required).map((item) => item.sku);
  const [checks, setChecks] = useState<ComplianceCheck[]>(review?.checks ?? buildAssignmentComplianceChecks(requiredSkus, submission?.unavailableSkus ?? [], submission?.substitutionRequested ?? false));
  const [decision, setDecision] = useState<ReviewDecision>(review?.decision ?? "approved");
  const [comment, setComment] = useState(review?.comment ?? "");
  const [saved, setSaved] = useState(false);
  if (!execution || !area || !submission) return null;
  const score = calculateComplianceScore(checks);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await reviewCompliance({ executionId: execution.id, decision, checks, comment });
    setSaved(true);
  };

  return <form onSubmit={submit} className="space-y-6">
    <PageHeader eyebrow={program?.name ?? "Verify"} title="Compliance review" description={`${title} · Display ${area.displayNumber} · ${area.name}`} actions={<><Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold" to={`/stores/${area.storeId}/floorplan?${program ? `program=${program.id}&` : ""}area=${area.id}`}><MapPin className="h-4 w-4" />Locate display</Link>{canReview && <Button><Check className="h-4 w-4" />Save review</Button>}</>} />
    {saved && <div role="status" className="rounded-md border border-success/30 bg-success-subtle p-3 text-sm text-success">Compliance review saved.</div>}
    {program && <Card className="p-4"><dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><Detail label="Program" value={program.name} /><Detail label="Display" value={`${area.displayNumber} · ${area.name}`} /><Detail label="Assignment period" value={period?.name ?? (displayAssignment ? `${formatDate(displayAssignment.startDate)} - ${formatDate(displayAssignment.endDate)}` : "Not assigned")} /><Detail label="Reset date" value={period?.resetDate ? formatDate(period.resetDate) : "No reset scheduled"} /></dl></Card>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <Card><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Assignment requirements</h2><Badge>Execution compliance</Badge></div><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Detail label="Required products" value={products.filter((item) => item.required).map((item) => `${item.sku} · ${item.plannedQuantity}`).join(", ") || "None"} /><Detail label="Recommended products" value={products.filter((item) => !item.required).map((item) => `${item.sku} · ${item.plannedQuantity}`).join(", ") || "None"} /><Detail label="Signage" value={requirement.signage} /><Detail label="Minimum merchandising requirement" value={requirement.minimumSpace} /><div className="sm:col-span-2"><Detail label="Placement requirement" value={requirement.executionNotes} /></div></dl></Card>
        <Card><h2 className="font-semibold">Requirements checklist</h2><div className="mt-4 divide-y divide-border">{checks.map((check) => <label key={check.key} className="flex cursor-pointer items-center justify-between gap-4 py-3"><span><span className="font-medium">{check.label}</span><span className="ml-2 text-xs text-text-muted">{check.required ? "Required" : "Advisory"}</span></span><input className="h-5 w-5 shrink-0" type="checkbox" checked={check.passed} onChange={(event) => setChecks((current) => current.map((item) => item.key === check.key ? { ...item, passed: event.target.checked } : item))} disabled={!canReview} /></label>)}</div></Card>
      </div>
      <div className="space-y-4">
        <Card><p className="text-sm text-text-muted">Requirements score</p><p className={`mt-1 text-4xl font-semibold ${score >= 80 ? "text-success" : "text-error"}`}>{score}%</p><div className="mt-3 h-2 rounded bg-subtle"><div className={`h-full rounded ${score >= 80 ? "bg-success" : "bg-error"}`} style={{ width: `${score}%` }} /></div></Card>
        <Card><h2 className="font-semibold">Decision</h2><div className="mt-3 grid gap-2">{(["approved", "fix_requested", "local_variation"] as ReviewDecision[]).map((value) => <label key={value} className={`flex items-center gap-2 rounded-md border p-3 text-sm ${decision === value ? "border-primary bg-primary/5" : "border-border"}`}><input type="radio" name="decision" value={value} checked={decision === value} onChange={() => setDecision(value)} disabled={!canReview} />{humanize(value)}</label>)}</div><div className="mt-4"><Field label="Reviewer comment"><textarea className={`${inputClass} min-h-24 py-2`} value={comment} onChange={(event) => setComment(event.target.value)} disabled={!canReview} /></Field></div></Card>
        <Card><div className="flex items-center gap-2"><MessageSquareWarning className="h-4 w-4 text-text-muted" /><h2 className="font-semibold">Execution submission</h2></div><dl className="mt-3 grid gap-3 text-sm"><Detail label="Completion photo metadata" value={submission.photoName ?? "No photo filename recorded"} detail={`Submitted ${new Date(submission.submittedAt).toLocaleString("en-CA")}`} /><Detail label="Store note" value={submission.note || "No completion note"} /><Detail label="Substitution request" value={submission.substitutionRequested ? "Approval requested" : "None"} /></dl>{submission.unavailableSkus.length > 0 && <div className="mt-4 flex gap-2 rounded-md bg-error-subtle p-3 text-sm text-error"><PackageX className="h-4 w-4 shrink-0" /><span>Unavailable at execution: {submission.unavailableSkus.join(", ")}</span></div>}</Card>
        {review && <Badge tone={review.decision === "approved" ? "success" : "warning"}>Last decision: {humanize(review.decision)}</Badge>}
      </div>
    </div>
  </form>;
}

function Detail({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="min-w-0"><p className="text-[10px] font-semibold uppercase text-text-muted">{label}</p><p className="mt-1 break-words font-medium text-text-primary">{value}</p>{detail && <p className="mt-1 text-xs text-text-muted">{detail}</p>}</div>;
}
