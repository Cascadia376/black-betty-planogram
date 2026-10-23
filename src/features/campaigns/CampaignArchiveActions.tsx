import { useRef, useState } from "react";
import { Button } from "../../components/ui";
import type { Campaign } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";

export function CampaignArchiveActions({ campaign, canEdit, hasReleases }: { campaign: Campaign; canEdit: boolean; hasReleases: boolean }) {
  const { setCampaignArchived, refresh } = usePlatform();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [refreshRequired, setRefreshRequired] = useState(false);
  const submitting = useRef(false);
  const archived = campaign.status === "archived";
  const available = canEdit && !hasReleases && (archived || campaign.status === "draft");

  async function changeStatus() {
    if (submitting.current || refreshRequired) return;
    const action = archived ? "Restore" : "Archive";
    const explanation = archived
      ? "Restore this campaign to draft? It will become eligible for purchasing source review again."
      : "Archive this draft? It will leave current purchasing selections. Imports, allocations and history will be preserved, and it can be restored to draft.";
    if (!window.confirm(`${action} ${campaign.name}\nCampaign ${campaign.id}\n\n${explanation}`)) return;
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    try { await setCampaignArchived(campaign.id, !archived); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "Campaign status could not be saved.");
      // A failed response may follow a successful write. Read authoritative state
      // before offering another mutation; never blindly replay the archive.
      setRefreshRequired(true);
    } finally { submitting.current = false; setBusy(false); }
  }

  async function reload() {
    setBusy(true);
    try { await refresh(); setRefreshRequired(false); setError(undefined); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reload the campaign."); }
    finally { setBusy(false); }
  }

  if (!available && !archived) return null;
  return <section aria-label="Campaign archive" className="space-y-2">
    {archived && <p role="status" className="text-sm text-text-secondary">Archived. Imports, allocations and history remain available. Restore to draft before purchasing or publishing.</p>}
    {available && <Button variant="secondary" disabled={busy || refreshRequired} onClick={() => void changeStatus()}>{busy ? "Saving…" : archived ? "Restore to draft" : "Archive draft"}</Button>}
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    {refreshRequired && <Button variant="secondary" disabled={busy} onClick={() => void reload()}>Reload campaign before retrying</Button>}
  </section>;
}
