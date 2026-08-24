import { Check, MessageSquareWarning } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { ComplianceCheck, ReviewDecision } from "../../domain/types";
import { calculateComplianceScore } from "../../domain/rules";
import { Badge, Button, Card, DataState, EmptyState, Field, PageHeader, humanize, inputClass } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";

const defaultChecks: ComplianceCheck[] = [
  { key: "products", label: "Required products present", passed: true, required: true },
  { key: "signage", label: "Required signage present", passed: true, required: true },
  { key: "facings", label: "Minimum facing requirements met", passed: true, required: true },
  { key: "prominence", label: "Feature product is prominent", passed: true, required: true },
  { key: "substitutions", label: "Only approved substitutions used", passed: true, required: true },
  { key: "unapproved", label: "No unapproved products added", passed: true, required: true },
];

export function CompliancePage() {
  const { executionId } = useParams();
  const { data, loading, error, reviewCompliance, role } = usePlatform();
  const execution = data?.executions.find((item) => item.id === executionId);
  const assignment = data?.assignments.find((item) => item.id === execution?.assignmentId);
  const campaign = data?.campaigns.find((item) => item.id === assignment?.campaignId);
  const area = data?.displayAreas.find((item) => item.id === assignment?.displayAreaId);
  const review = data?.complianceReviews.find((item) => item.executionId === executionId);
  const [checks, setChecks] = useState<ComplianceCheck[]>(review?.checks ?? defaultChecks);
  const [decision, setDecision] = useState<ReviewDecision>(review?.decision ?? "approved");
  const [comment, setComment] = useState(review?.comment ?? "");
  const [saved, setSaved] = useState(false);
  // A saved review may arrive after the adapter's initial asynchronous load.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (review) { setChecks(review.checks); setDecision(review.decision); setComment(review.comment); } }, [review]);
  const canReview = role === "admin" || role === "operations" || role === "merchandising";
  const score = calculateComplianceScore(checks);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!execution) return; await reviewCompliance({ executionId: execution.id, decision, checks, comment }); setSaved(true); };
  return <DataState loading={loading} error={error}>{!execution || !campaign || !area ? <EmptyState title="Compliance item not found" message="The requested execution is unavailable." /> : !execution.submission ? <><PageHeader eyebrow="Verify" title="Compliance review" description={`${campaign.name} · ${area.name}`} /><EmptyState title="Waiting for execution submission" message="Complete the display task before reviewing compliance." /><Link className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground" to={`/executions/${execution.id}`}>Open execution task</Link></> : <form onSubmit={submit} className="space-y-6"><PageHeader eyebrow="Verify" title="Compliance review" description={`${campaign.name} · ${area.name}. Review against requirements, not pixel-perfect placement.`} actions={canReview && <Button><Check className="h-4 w-4" />Save review</Button>} />{saved && <div role="status" className="rounded-md border border-success/30 bg-success/5 p-3 text-sm text-success">Compliance review saved.</div>}
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]"><Card><h2 className="font-semibold">Requirements checklist</h2><div className="mt-4 divide-y divide-border">{checks.map((check) => <label key={check.key} className="flex cursor-pointer items-center justify-between gap-4 py-3"><span><span className="font-medium">{check.label}</span><span className="ml-2 text-xs text-text-muted">{check.required ? "Required" : "Advisory"}</span></span><input className="h-5 w-5" type="checkbox" checked={check.passed} onChange={(event) => setChecks((current) => current.map((item) => item.key === check.key ? { ...item, passed: event.target.checked } : item))} disabled={!canReview} /></label>)}</div></Card><div className="space-y-4"><Card><p className="text-sm text-text-muted">Requirements score</p><p className={`mt-1 text-4xl font-semibold ${score >= 80 ? "text-success" : "text-error"}`}>{score}%</p><div className="mt-3 h-2 rounded bg-subtle"><div className={`h-full rounded ${score >= 80 ? "bg-success" : "bg-error"}`} style={{ width: `${score}%` }} /></div></Card><Card><h2 className="font-semibold">Decision</h2><div className="mt-3 grid gap-2">{(["approved", "fix_requested", "local_variation"] as ReviewDecision[]).map((value) => <label key={value} className={`flex items-center gap-2 rounded-md border p-3 text-sm ${decision === value ? "border-primary bg-primary/5" : "border-border"}`}><input type="radio" name="decision" value={value} checked={decision === value} onChange={() => setDecision(value)} disabled={!canReview} />{humanize(value)}</label>)}</div><div className="mt-4"><Field label="Reviewer comment"><textarea className={`${inputClass} min-h-24 py-2`} value={comment} onChange={(event) => setComment(event.target.value)} disabled={!canReview} /></Field></div></Card>{execution.submission.photoName && <Card><div className="flex items-center gap-2"><MessageSquareWarning className="h-4 w-4 text-text-muted" /><h2 className="font-semibold">Completion evidence</h2></div><p className="mt-2 text-sm">{execution.submission.photoName}</p><p className="mt-1 text-xs text-text-muted">Mock upload metadata only</p></Card>}{review && <Badge tone={review.decision === "approved" ? "success" : "warning"}>Last decision: {humanize(review.decision)}</Badge>}</div></div>
  </form>}</DataState>;
}
