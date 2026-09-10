import { Check, Clock3, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Card, DataState, EmptyState, Field, PageHeader, inputClass } from "../../components/ui";
import type { PromotionOpportunity, PromotionOpportunityStatus } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";

export function PromotionOpportunitiesPage() {
  const { data, loading, error, updatePromotionOpportunity } = usePlatform();
  const [filters, setFilters] = useState({ supplier: "", category: "", month: "", status: "", flyer: "", display: "" });
  const [comments, setComments] = useState<Record<string, string>>({});
  const opportunities = useMemo(() => (data?.promotionOpportunities ?? []).filter((item) =>
    (!filters.supplier || item.supplier.toLocaleLowerCase().includes(filters.supplier.toLocaleLowerCase()))
    && (!filters.category || (item.authoritativeCategory ?? item.supplierCategory ?? "").toLocaleLowerCase().includes(filters.category.toLocaleLowerCase()))
    && (!filters.month || [item.proposedStartDate, item.proposedEndDate, item.promotionEvidence.flyerRequest].some((value) => value?.toLocaleLowerCase().includes(filters.month.toLocaleLowerCase())))
    && (!filters.status || item.status === filters.status)
    && (!filters.flyer || String(Boolean(item.promotionEvidence.flyerRequest)) === filters.flyer)
    && (!filters.display || String(Boolean(item.merchandisingRequest.displayRequested)) === filters.display)
  ), [data?.promotionOpportunities, filters]);

  async function setStatus(item: PromotionOpportunity, status: PromotionOpportunityStatus) { await updatePromotionOpportunity({ opportunityId: item.id, status }); }
  async function saveComment(item: PromotionOpportunity) { await updatePromotionOpportunity({ opportunityId: item.id, jeremyComment: comments[item.id] ?? item.jeremyComment ?? "" }); }

  return <DataState loading={loading} error={error}>
    <PageHeader eyebrow="Merchant review" title="Promotion opportunities" description="Supplier proposals awaiting Jeremy’s commercial decision. Approval does not create a campaign." actions={<Badge tone="info">No AI score</Badge>} />
    <Card><div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
      <Field label="Supplier"><input aria-label="Supplier filter" className={inputClass} value={filters.supplier} onChange={(event) => setFilters({ ...filters, supplier: event.target.value })} /></Field>
      <Field label="Category"><input aria-label="Category filter" className={inputClass} value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })} /></Field>
      <Field label="Promotion month"><input aria-label="Promotion month filter" className={inputClass} placeholder="2026-10" value={filters.month} onChange={(event) => setFilters({ ...filters, month: event.target.value })} /></Field>
      <Field label="Status"><select aria-label="Status filter" className={inputClass} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All</option>{["NEW", "NEEDS_REVIEW", "READY_FOR_REVIEW", "APPROVED", "PASSED", "DEFERRED"].map((status) => <option key={status}>{status}</option>)}</select></Field>
      <Field label="Flyer requested"><select aria-label="Flyer requested filter" className={inputClass} value={filters.flyer} onChange={(event) => setFilters({ ...filters, flyer: event.target.value })}><option value="">All</option><option value="true">Yes</option><option value="false">No</option></select></Field>
      <Field label="Display requested"><select aria-label="Display requested filter" className={inputClass} value={filters.display} onChange={(event) => setFilters({ ...filters, display: event.target.value })}><option value="">All</option><option value="true">Yes</option><option value="false">No</option></select></Field>
    </div></Card>
    {!opportunities.length ? <EmptyState title="No opportunities found" message={(data?.promotionOpportunities.length ?? 0) ? "No opportunities match the current filters." : "Apply a supplier submission to create reviewable opportunities."} /> : <div className="space-y-3">{opportunities.map((item) => {
      const submission = data?.supplierSubmissions.find((candidate) => candidate.id === item.sourceSubmissionId);
      return <Card key={item.id}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{item.productName}</h2><Badge tone={statusTone(item.status)}>{item.status.replaceAll("_", " ")}</Badge></div><p className="mt-1 text-sm text-text-secondary">{item.authoritativeSku ?? item.supplierSku ?? "SKU unresolved"} · {item.supplier} · {item.authoritativeCategory ?? item.supplierCategory ?? "Uncategorized"}</p></div><div className="flex flex-wrap gap-2"><Button aria-label={`Approve ${item.productName}`} onClick={() => void setStatus(item, "APPROVED")}><Check className="h-4 w-4" />Approve</Button><Button variant="secondary" aria-label={`Pass ${item.productName}`} onClick={() => void setStatus(item, "PASSED")}><X className="h-4 w-4" />Pass</Button><Button variant="secondary" aria-label={`Defer ${item.productName}`} onClick={() => void setStatus(item, "DEFERRED")}><Clock3 className="h-4 w-4" />Defer</Button></div></div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Fact label="Promotion window" value={[item.proposedStartDate, item.proposedEndDate].filter(Boolean).join(" – ") || "Not supplied"} /><Fact label="LTO / TPR" value={[item.promotionEvidence.wholesaleLto !== undefined ? `$${item.promotionEvidence.wholesaleLto}` : "", item.promotionEvidence.tpr].filter(Boolean).join(" · ") || "None supplied"} /><Fact label="Case commitment" value={String(item.commercialTerms.caseCommitment ?? "Not supplied")} /><Fact label="Display requested" value={item.merchandisingRequest.displayRequested ? `Yes${item.merchandisingRequest.requestedDisplayFamily ? ` · ${item.merchandisingRequest.requestedDisplayFamily}` : ""}` : "No / not supplied"} /><Fact label="Source" value={submission ? `${submission.sourceFileName} · row ${item.provenance.row}` : `${item.provenance.workbookName} · row ${item.provenance.row}`} /></dl>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"><textarea aria-label={`Jeremy comment for ${item.productName}`} className={`${inputClass} min-h-20 py-2`} placeholder="Add Jeremy’s merchant comment…" value={comments[item.id] ?? item.jeremyComment ?? ""} onChange={(event) => setComments({ ...comments, [item.id]: event.target.value })} /><Button variant="secondary" onClick={() => void saveComment(item)}>Save comment</Button></div>
      </Card>;
    })}</div>}
  </DataState>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded bg-subtle p-3"><dt className="text-xs text-text-muted">{label}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>; }
function statusTone(status: PromotionOpportunityStatus): "neutral" | "success" | "warning" | "error" | "info" { return status === "APPROVED" ? "success" : status === "NEEDS_REVIEW" ? "warning" : status === "PASSED" ? "error" : status === "DEFERRED" ? "neutral" : "info"; }
