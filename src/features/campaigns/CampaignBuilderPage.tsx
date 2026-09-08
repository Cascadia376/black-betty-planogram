import { ArrowRight } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Campaign, CampaignType, NewCampaignInput } from "../../domain/types";
import { validateCampaignDetails } from "../../domain/rules";
import { usePlatform } from "../../services/PlatformProvider";
import { Button, Card, DataState, Field, PageHeader, inputClass } from "../../components/ui";
import { mockBusinessClock } from "../../services/clock";
import { CampaignWorkflowStepper } from "./campaignWorkflow";
import { campaignSaveError } from "./campaignErrors";

const defaultCampaignStart = mockBusinessClock.today();
const defaultCampaignEnd = (() => { const date = new Date(`${defaultCampaignStart}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 30); return date.toISOString().slice(0, 10); })();

export function CampaignBuilderPage() {
  const { campaignId } = useParams();
  const { data, loading, error } = usePlatform();
  const existing = data?.campaigns.find((campaign) => campaign.id === campaignId);
  const editing = Boolean(campaignId);

  if (editing && loading) return <DataState loading error={error}><></></DataState>;
  if (editing && !existing) {
    return <div role="alert" className="rounded-md border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">Campaign not found. Return to Campaigns and choose an existing campaign.</div>;
  }

  return <CampaignDetailsForm key={existing?.id ?? "new"} existing={existing} />;
}

function initialCampaignInput(existing?: Campaign): NewCampaignInput {
  if (existing) {
    return {
      name: existing.name,
      type: existing.type,
      description: existing.description,
      startDate: existing.startDate,
      endDate: existing.endDate,
      owner: existing.owner,
      supplier: existing.supplier,
      products: existing.products,
      requirement: existing.requirement,
    };
  }

  return {
    name: "",
    type: "Monthly flyer",
    description: "",
    startDate: defaultCampaignStart,
    endDate: defaultCampaignEnd,
    owner: "Merchandising Team",
    supplier: "",
    products: [],
  };
}

function CampaignDetailsForm({ existing }: { existing?: Campaign }) {
  const navigate = useNavigate();
  const { createCampaign, updateCampaign, data } = usePlatform();
  const editing = Boolean(existing);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>();
  const submitting = useRef(false);
  const [input, setInput] = useState<NewCampaignInput>(() => initialCampaignInput(existing));
  const set = <K extends keyof NewCampaignInput>(key: K, value: NewCampaignInput[K]) => setInput((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const errors = validateCampaignDetails(input);
    if (errors.length) { setFormError(errors.join(" ")); return; }
    try {
      submitting.current = true;
      setSaving(true);
      if (existing) {
        await updateCampaign({ campaignId: existing.id, patch: {
          name: input.name, type: input.type, description: input.description, startDate: input.startDate,
          endDate: input.endDate, owner: input.owner, supplier: input.supplier,
        } });
        navigate(`/campaigns/${existing.id}`, { state: { updatedCampaignName: input.name.trim() } });
      } else {
        const id = await createCampaign(input);
        navigate(`/campaigns/${id}/products`, { state: { createdCampaignName: input.name.trim() } });
      }
    } catch (cause) {
      setFormError(campaignSaveError(cause));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return <form onSubmit={submit} className="space-y-6">
    <PageHeader eyebrow="Campaign details" title={editing ? `Edit ${existing?.name ?? "campaign"}` : "New campaign"} description={editing ? "Update the campaign details. Products, displays, and store choices will not be changed." : "Create the campaign shell before adding products, displays, and store placements."} actions={<><Button type="button" variant="secondary" onClick={() => navigate(existing ? `/campaigns/${existing.id}` : "/campaigns")}>Cancel</Button><Button disabled={saving} aria-busy={saving}><span>{saving ? "Saving..." : editing ? "Save campaign" : "Create campaign and continue"}</span>{!saving && !editing && <ArrowRight className="h-4 w-4" />}</Button></>} />
    <CampaignWorkflowStepper campaign={existing} data={data} current="campaign" />
    {formError && <div role="alert" className="rounded-md border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">{formError}</div>}
    <Card><h2 className="font-semibold">Campaign details</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Field label="Campaign name"><input className={inputClass} value={input.name} onChange={(event) => set("name", event.target.value)} required /></Field><Field label="Campaign type"><select className={inputClass} value={input.type} onChange={(event) => set("type", event.target.value as CampaignType)}>{["OND", "Monthly flyer", "Seasonal", "Supplier feature", "Category feature", "New product", "Clearance", "Local initiative"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Owner"><input className={inputClass} value={input.owner} onChange={(event) => set("owner", event.target.value)} required /></Field><Field label="Start date"><input type="date" className={inputClass} value={input.startDate} onChange={(event) => set("startDate", event.target.value)} required /></Field><Field label="End date"><input type="date" className={inputClass} value={input.endDate} onChange={(event) => set("endDate", event.target.value)} required /></Field><Field label="Supplier / partner"><input className={inputClass} value={input.supplier} onChange={(event) => set("supplier", event.target.value)} /></Field><div className="md:col-span-2 xl:col-span-3"><Field label="Description"><textarea className={`${inputClass} min-h-24 py-2`} value={input.description} onChange={(event) => set("description", event.target.value)} /></Field></div></div></Card>
  </form>;
}
