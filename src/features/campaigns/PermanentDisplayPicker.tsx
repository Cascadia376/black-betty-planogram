import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Field, humanize, inputClass } from "../../components/ui";
import type { Campaign, DisplayArea, PlatformSnapshot } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";

export function PermanentDisplayPicker({ campaign, data, onSelected }: {
  campaign: Campaign;
  data: PlatformSnapshot;
  onSelected(id: string): void;
}) {
  const { createCampaignDisplay } = usePlatform();
  const [storeId, setStoreId] = useState(data.stores[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const areas = data.displayAreas.filter((area) => area.active && area.storeId === storeId
    && `${area.name} ${area.localCode ?? area.displayNumber}`.toLowerCase().includes(query.toLowerCase()));

  const selectArea = async (area: DisplayArea) => {
    setSaving(true);
    setError("");
    try {
      const store = data.stores.find((item) => item.id === area.storeId);
      const display = await createCampaignDisplay({
        campaignId: campaign.id, displayAreaId: area.id,
        display: { name: `${store?.name} · ${area.name}`, displayType: area.type, displayFamily: area.displayFamily,
          placementMode: "STORE_SPECIFIC", description: area.description, minimumSpace: area.capacity, prescriptive: false },
      });
      onSelected(display.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to use this display area."); }
    finally { setSaving(false); }
  };

  return <Card>
    <h2 className="font-semibold">Permanent floorplan display areas</h2>
    <p className="mt-1 text-sm text-text-secondary">Choose an existing store display area for this campaign. Then select products below and use Add / move selected. The store is included automatically.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <Field label="Display area store"><select className={inputClass} value={storeId} onChange={(event) => setStoreId(event.target.value)}>{data.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field>
      <Field label="Find permanent display"><input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Display name or code" /></Field>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    <div className="mt-3 grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
      {areas.map((area) => {
        const placement = data.campaignDisplayAssignments.find((item) => item.displayAreaId === area.id && item.status === "ASSIGNED" && item.startDate <= campaign.endDate && item.endDate >= campaign.startDate);
        const own = placement?.campaignId === campaign.id;
        return <div key={area.id} className="rounded-md border border-border p-3 text-sm">
          <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{area.name}</h3><p className="text-xs text-text-muted">{area.localCode ?? area.displayNumber} · {humanize(area.type)}</p></div><Badge tone={own ? "success" : placement ? "warning" : "info"}>{own ? "In this campaign" : placement ? "Occupied for these dates" : "Available for these dates"}</Badge></div>
          <p className="mt-2 text-text-secondary">{area.capacity}</p>
          <div className="mt-3 flex flex-wrap gap-2"><Button disabled={saving || Boolean(placement && !own)} onClick={() => { if (own && placement) onSelected(placement.campaignDisplayId); else void selectArea(area); }}>{own ? "Select for products" : "Use this area"}</Button><Link className="inline-flex items-center px-2 text-primary underline" to={`/stores/${area.storeId}/floorplan?area=${area.id}&campaign=${campaign.id}`}>View on floorplan</Link></div>
        </div>;
      })}
      {!areas.length && <p className="text-sm text-text-muted">No active display areas match this search.</p>}
    </div>
  </Card>;
}
