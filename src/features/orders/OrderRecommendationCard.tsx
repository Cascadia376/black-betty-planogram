import { useState } from "react";
import { Check, MapPin, PackageCheck, Pencil, Save, ShoppingCart, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Field, formatDate, humanize, inputClass } from "../../components/ui";
import type { UpdateOrderRecommendationInput } from "../../domain/repositories";
import type { PlatformSnapshot } from "../../domain/types";
import { productDetails } from "../programs/allocationPlanner";
import type { OrderWorkspaceItem } from "./orderingWorkspace";

export function OrderRecommendationCard({ item, data, programId, update }: { item: OrderWorkspaceItem; data: PlatformSnapshot; programId?: string; update(input: UpdateOrderRecommendationInput): Promise<void> }) {
  const { recommendation, assignmentProduct, assignment, area } = item;
  const [editingCases, setEditingCases] = useState(false);
  const [cases, setCases] = useState(recommendation.recommendedCases);
  const [note, setNote] = useState(recommendation.note ?? "");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const details = assignmentProduct ? productDetails(assignmentProduct, data) : { name: recommendation.productId, category: "Uncategorized", supplierName: item.supplierName };
  const residual = item.residualProjection;

  const act = async (input: Omit<UpdateOrderRecommendationInput, "id">, success: string) => {
    setActionError(""); setMessage("");
    try { await update({ id: recommendation.id, ...input }); setMessage(success); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Unable to update the recommendation."); }
  };
  const floorplanQuery = new URLSearchParams();
  if (programId) floorplanQuery.set("program", programId);
  if (area) floorplanQuery.set("area", area.id);

  return <Card className="p-0" ><div className="border-b border-border px-4 py-3">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{details.name}</h3><Badge>{assignmentProduct?.sku ?? "SKU unavailable"}</Badge><Badge tone={recommendation.status === "ordered" ? "success" : recommendation.status === "dismissed" ? "error" : recommendation.status === "pending" ? "warning" : "info"}>{humanize(recommendation.status)}</Badge></div><p className="mt-1 text-xs text-text-muted">Display {area?.displayNumber ?? "-"} · {area?.name ?? "Unassigned display"}</p></div><Badge tone={recommendation.recommendationType === "bridge_buy" ? "info" : recommendation.recommendationType === "exit_control" ? "warning" : "neutral"}>{humanize(recommendation.recommendationType)}</Badge></div>
    {recommendation.recommendationType === "bridge_buy" && <p className="mt-3 rounded-md border border-info/20 bg-info-subtle px-3 py-2 text-xs font-semibold text-info">Buying strategy: intentional bridge</p>}
    {recommendation.recommendationType === "exit_control" && <p className="mt-3 rounded-md border border-warning/20 bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning">Exit strategy: minimize post-program stock</p>}
  </div>
  <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_260px]"><div className="min-w-0">
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
      <Metric label="On hand" value={`${item.onHandCases} cases`} detail={item.reservedCases ? `${item.reservedCases} reserved` : undefined} />
      <Metric label="On order" value={`${item.onOrderCases} cases`} />
      <Metric label="Required display stock" value={`${assignmentProduct?.caseQuantity ?? 0} cases`} />
      <Metric label="Forecast need" value="Not calculated" />
      <Metric label="Recommended order" value={`${recommendation.recommendedCases} cases`} strong />
      <Metric label="Required by" value={formatDate(recommendation.requiredByDate)} />
    </dl>
    <dl className="mt-4 grid grid-cols-2 gap-3 rounded-md border border-border bg-surface p-3 sm:grid-cols-4">
      <Metric label="Projected Jan 1 inventory" value={residual ? `${residual.projectedInventoryAtProgramEnd} cases` : "Not available"} />
      <Metric label="Bridge inventory" value={residual ? `${residual.intentionalBridgeInventory} cases` : "Not available"} />
      <Metric label="Unwanted residual" value={residual ? `${residual.unwantedResidual} cases` : "Not available"} />
      <Metric label="Estimated bridge margin captured" value={residual?.incrementalMarginOpportunity !== undefined ? `$${residual.incrementalMarginOpportunity.toFixed(2)}` : "Not available"} />
    </dl>
    <div className="mt-4 rounded-md bg-subtle px-3 py-3"><p className="text-[10px] font-semibold uppercase text-text-muted">Rationale</p><p className="mt-1 text-sm leading-5 text-text-secondary">{recommendation.rationale}</p></div>
    {residual && <div className="mt-3 rounded-md border border-border px-3 py-3"><p className="text-[10px] font-semibold uppercase text-text-muted">Residual strategy</p><p className="mt-1 text-sm leading-5 text-text-secondary">{residual.explanation}</p></div>}
    <div className="mt-3 flex flex-wrap gap-2"><Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/stores/${recommendation.storeId}/floorplan?${floorplanQuery}`}><MapPin className="h-4 w-4" />Locate display</Link>{assignment && <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle" to={`/programs/${assignment.programId}/allocations`}><PackageCheck className="h-4 w-4" />Open assignment</Link>}<Button type="button" variant="secondary" disabled title="Product details route is not available yet">View product details</Button></div>
  </div><aside className="space-y-3 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
    <div><p className="text-[10px] font-semibold uppercase text-text-muted">Supplier</p><p className="mt-1 text-sm font-semibold">{item.supplierName}</p></div>
    {editingCases ? <div className="space-y-2"><Field label="Edited cases"><input className={inputClass} type="number" min="0" step="1" value={cases} onChange={(event) => setCases(Number(event.target.value))} /></Field><Button className="w-full" type="button" onClick={() => { void act({ status: "edited", recommendedCases: cases, note }, "Recommended cases updated."); setEditingCases(false); }}><Save className="h-4 w-4" />Save cases</Button></div> : <Button className="w-full" type="button" variant="secondary" onClick={() => setEditingCases(true)}><Pencil className="h-4 w-4" />Edit cases</Button>}
    <div className="grid grid-cols-2 gap-2"><Button type="button" variant="secondary" onClick={() => void act({ status: "accepted", recommendedCases: cases, note }, "Recommendation accepted.")}><Check className="h-4 w-4" />Accept</Button><Button type="button" onClick={() => void act({ status: "ordered", recommendedCases: cases, note }, "Recommendation marked ordered.")}><ShoppingCart className="h-4 w-4" />Mark ordered</Button></div>
    <Button className="w-full" type="button" variant="secondary" onClick={() => void act({ status: "dismissed", recommendedCases: cases, note }, "Recommendation dismissed.")}><X className="h-4 w-4" />Dismiss</Button>
    <Field label="Store note"><textarea className={`${inputClass} min-h-20 py-2`} value={note} onChange={(event) => setNote(event.target.value)} /></Field><Button className="w-full" type="button" variant="secondary" onClick={() => void act({ status: recommendation.status, recommendedCases: cases, note }, "Note saved.")}><Save className="h-4 w-4" />Add note</Button>
    {message && <p role="status" className="text-xs font-semibold text-success">{message}</p>}{actionError && <p role="alert" className="text-xs font-semibold text-error">{actionError}</p>}
  </aside></div></Card>;
}

function Metric({ label, value, detail, strong }: { label: string; value: string; detail?: string; strong?: boolean }) { return <div><dt className="text-[10px] font-semibold uppercase text-text-muted">{label}</dt><dd className={`mt-1 text-sm ${strong ? "font-semibold text-primary" : "font-medium"}`}>{value}</dd>{detail && <dd className="text-[10px] text-text-muted">{detail}</dd>}</div>; }
