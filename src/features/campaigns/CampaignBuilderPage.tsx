import { ArrowRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { CampaignType, NewCampaignInput } from "../../domain/types";
import { validateCampaignDetails } from "../../domain/rules";
import { usePlatform } from "../../services/PlatformProvider";
import { Button, Card, Field, PageHeader, inputClass } from "../../components/ui";
import { mockBusinessClock } from "../../services/clock";
import { CampaignWorkflowStepper } from "./campaignWorkflow";

const defaultCampaignStart = mockBusinessClock.today();
const defaultCampaignEnd = (() => { const date = new Date(`${defaultCampaignStart}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 30); return date.toISOString().slice(0, 10); })();

export function CampaignBuilderPage() {
  const navigate = useNavigate();
  const { createCampaign } = usePlatform();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [input, setInput] = useState<NewCampaignInput>({
    name: "", type: "Monthly flyer", description: "", startDate: defaultCampaignStart, endDate: defaultCampaignEnd,
    owner: "Merchandising Team", supplier: "", products: [],
  });
  const set = <K extends keyof NewCampaignInput>(key: K, value: NewCampaignInput[K]) => setInput((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const errors = validateCampaignDetails(input);
    if (errors.length) { setFormError(errors.join(" ")); return; }
    try {
      setSaving(true);
      const id = await createCampaign(input);
      navigate(`/campaigns/${id}/products`);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Unable to create campaign.");
    } finally {
      setSaving(false);
    }
  };

  return <form onSubmit={submit} className="space-y-6">
    <PageHeader eyebrow="Campaign details" title="New campaign" description="Create the campaign shell before adding products, displays, and store placements." actions={<><Button type="button" variant="secondary" onClick={() => navigate("/campaigns")}>Cancel</Button><Button disabled={saving}><span>{saving ? "Creating..." : "Create campaign and continue"}</span>{!saving && <ArrowRight className="h-4 w-4" />}</Button></>} />
    <CampaignWorkflowStepper current="campaign" />
    {formError && <div role="alert" className="rounded-md border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">{formError}</div>}
    <Card><h2 className="font-semibold">Campaign details</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Field label="Campaign name"><input className={inputClass} value={input.name} onChange={(event) => set("name", event.target.value)} required /></Field><Field label="Campaign type"><select className={inputClass} value={input.type} onChange={(event) => set("type", event.target.value as CampaignType)}>{["Monthly flyer", "Seasonal", "Supplier feature", "Category feature", "New product", "Clearance", "Local initiative"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Owner"><input className={inputClass} value={input.owner} onChange={(event) => set("owner", event.target.value)} required /></Field><Field label="Start date"><input type="date" className={inputClass} value={input.startDate} onChange={(event) => set("startDate", event.target.value)} required /></Field><Field label="End date"><input type="date" className={inputClass} value={input.endDate} onChange={(event) => set("endDate", event.target.value)} required /></Field><Field label="Supplier / partner"><input className={inputClass} value={input.supplier} onChange={(event) => set("supplier", event.target.value)} /></Field><div className="md:col-span-2 xl:col-span-3"><Field label="Description"><textarea className={`${inputClass} min-h-24 py-2`} value={input.description} onChange={(event) => set("description", event.target.value)} /></Field></div></div></Card>
  </form>;
}
