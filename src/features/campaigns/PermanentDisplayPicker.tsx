import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Field, inputClass } from "../../components/ui";
import { campaignDisplayAreaCompatibility } from "../../domain/campaignDisplayAllocation";
import type { Campaign, PlatformSnapshot } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";

/** Overrides one store's placement; never creates a cross-store display concept. */
export function PermanentDisplayPicker({ campaign, data }: {
  campaign: Campaign; data: PlatformSnapshot;
}) {
  const { suggestCampaignDisplay, updateCampaignDisplayAssignment } = usePlatform();
  const [storeId, setStoreId] = useState("");
  const [displayId, setDisplayId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const displays = data.campaignDisplays.filter((item) => item.campaignId === campaign.id);
  const display = displays.find((item) => item.id === displayId);
  const store = data.stores.find((item) => item.id === storeId);
  const area = data.displayAreas.find((item) => item.id === areaId);
  const stores = data.stores.filter((item) => data.campaignStores.some((scope) => scope.campaignId === campaign.id && scope.storeId === item.id && scope.included));
  const save = async () => {
    if (!display || !store || !area || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const [assignment] = await suggestCampaignDisplay({ campaignId: campaign.id, campaignDisplayId: display.id, storeIds: [store.id] });
      await updateCampaignDisplayAssignment({ campaignDisplayAssignmentId: assignment.id, displayAreaId: area.id, status: "ASSIGNED", placementSource: "BUYER_SELECTED" });
      setMessage(`${display.name} is placed at ${area.localCode ?? area.displayNumber} · ${area.name} for ${store.name} only. Products and store case quantities are unchanged.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save placement."); }
    finally { setSaving(false); }
  };
  return <Card><h2 className="font-semibold">OND: import first, override only exceptions</h2>
    <p className="mt-2 text-sm">Import one consolidated workbook to create cross-store display concepts and store quantities.</p>
    <Link className="mt-2 inline-block font-semibold text-primary underline" to="/imports/flyer">Import consolidated OND workbook</Link>
    <details className="mt-4"><summary className="cursor-pointer font-semibold">Manual store placement override</summary>
      <p className="my-3 text-sm">Choose an existing campaign display, then approve a permanent area for one participating store. This does not add requirements to other stores or move products between campaign displays.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Override store"><select className={inputClass} value={storeId} onChange={(e) => { setStoreId(e.target.value); setAreaId(""); setMessage(""); }}><option value="">Choose store</option>{stores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Existing campaign display"><select className={inputClass} value={displayId} onChange={(e) => { setDisplayId(e.target.value); setAreaId(""); setMessage(""); }}><option value="">Choose imported display</option>{displays.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Permanent area"><select className={inputClass} disabled={!store || !display} value={areaId} onChange={(e) => { setAreaId(e.target.value); setMessage(""); }}><option value="">Choose permanent area</option>{data.displayAreas.filter((item) => item.storeId === storeId && item.active).map((item) => <option key={item.id} value={item.id} disabled={display && campaignDisplayAreaCompatibility(display, item, data).status === "incompatible"}>{item.localCode ?? item.displayNumber} · {item.name}</option>)}</select></Field>
      </div>
      {area && display && <p role="status" className="my-3">Selected: {store?.name} → {area.localCode ?? area.displayNumber} · {area.name}. Next: approve this store override.</p>}
      <Button className="mt-3" disabled={!area || !display || saving} onClick={() => void save()}>Approve store override</Button>
      {error && <p role="alert">{error}</p>}
      {message && <div role="status" className="mt-3 rounded border border-success p-3"><p>{message}</p><Link className="font-semibold text-primary underline" to={`/campaigns/${campaign.id}/stores/${storeId}/pack`}>Next: review products and cases in store pack</Link></div>}
    </details>
  </Card>;
}
