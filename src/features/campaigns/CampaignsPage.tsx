import { ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Card, DataState, PageHeader, formatDate } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";

export function CampaignsPage() {
  const { data, loading, error, role } = usePlatform();
  const canEdit = role === "admin" || role === "merchandising";
  return <DataState loading={loading} error={error}><PageHeader eyebrow="Plan" title="Campaigns" description="Define promotional programs, product requirements, and display guidance." actions={canEdit && <Link className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground" to="/campaigns/new"><Plus className="h-4 w-4" />New campaign</Link>} />
    <Card className="overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-subtle/60 text-xs uppercase text-text-muted"><tr><th className="px-4 py-3">Campaign</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Period</th><th className="px-4 py-3">Products</th><th className="px-4 py-3">Status</th><th className="w-12" /></tr></thead><tbody className="divide-y divide-border">{data?.campaigns.map((campaign) => <tr key={campaign.id} className="hover:bg-subtle/40"><td className="px-4 py-3"><Link className="font-semibold hover:text-primary" to={`/campaigns/${campaign.id}`}>{campaign.name}</Link><p className="mt-0.5 max-w-md text-xs text-text-muted">{campaign.description}</p></td><td className="px-4 py-3">{campaign.type}</td><td className="whitespace-nowrap px-4 py-3">{formatDate(campaign.startDate)}<br /><span className="text-text-muted">to {formatDate(campaign.endDate)}</span></td><td className="px-4 py-3">{campaign.products.length}</td><td className="px-4 py-3"><Badge tone={campaign.status === "active" ? "success" : campaign.status === "scheduled" ? "info" : "neutral"}>{campaign.status}</Badge></td><td><Link aria-label={`Open ${campaign.name}`} to={`/campaigns/${campaign.id}`}><ArrowRight className="h-4 w-4 text-text-muted" /></Link></td></tr>)}</tbody></table></div></Card>
  </DataState>;
}

