import { ArrowRight, FileSpreadsheet, Handshake, Megaphone, UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Card, DataState, PageHeader, formatDate } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";

function linkClass(primary = false) {
  return primary
    ? "inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
    : "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle";
}

export function ImportsPage() {
  const { data, loading, error } = usePlatform();
  const ondProgram = data?.programs.find((program) => program.status === "active") ?? data?.programs.find((program) => program.name.startsWith("OND"));

  return (
    <DataState loading={loading} error={error}>
      <PageHeader
        eyebrow="Uploads"
        title="Spreadsheet imports"
        description="Known-format workbook intake for merchandising planning. The prototype only writes to mock localStorage."
        actions={<Badge tone="info">Mock repository</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex min-h-72 flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-subtle text-primary"><Handshake className="h-5 w-5" /></span><Badge tone="success">Available</Badge></div>
            <h2 className="mt-4 text-lg font-semibold">Supplier promotion submission</h2>
            <p className="mt-2 text-sm leading-5 text-text-secondary">Upload the structured Cascadia supplier template. Exact SKUs reconcile to Product Master while commercial proposals remain supplier evidence for Jeremy to review.</p>
            <div className="mt-4 rounded-md border border-info/20 bg-info-subtle p-3 text-sm leading-5 text-info">Apply creates Promotion Opportunities only. It does not create a campaign, placement, allocation, or order.</div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2"><Link className={linkClass(true)} to="/imports/supplier"><UploadCloud className="h-4 w-4" />Import supplier file</Link><Link className={linkClass()} to="/opportunities">Review opportunities <ArrowRight className="h-4 w-4" /></Link></div>
        </Card>
        <Card className="flex min-h-72 flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-subtle text-primary"><FileSpreadsheet className="h-5 w-5" /></span>
              <Badge tone="success">Available</Badge>
            </div>
            <h2 className="mt-4 text-lg font-semibold">OND allocation spreadsheet</h2>
            <p className="mt-2 text-sm leading-5 text-text-secondary">
              Upload the known Cascadia OND allocation workbook format and review normalized display assignments, products, case quantities, and suppliers before applying.
            </p>
            {ondProgram && (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-subtle p-3"><dt className="text-xs text-text-muted">Program</dt><dd className="mt-1 font-semibold">{ondProgram.name}</dd></div>
                <div className="rounded-md bg-subtle p-3"><dt className="text-xs text-text-muted">Dates</dt><dd className="mt-1 font-semibold">{formatDate(ondProgram.startDate)} - {formatDate(ondProgram.endDate)}</dd></div>
              </dl>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {ondProgram && <Link className={linkClass(true)} to={`/programs/${ondProgram.id}/import`}><UploadCloud className="h-4 w-4" />Upload OND spreadsheet</Link>}
            {ondProgram && <Link className={linkClass()} to={`/programs/${ondProgram.id}/allocations`}>Review allocations <ArrowRight className="h-4 w-4" /></Link>}
          </div>
        </Card>

        <Card className="flex min-h-72 flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-subtle text-text-secondary"><Megaphone className="h-5 w-5" /></span>
              <Badge tone="success">Available</Badge>
            </div>
            <h2 className="mt-4 text-lg font-semibold">Flyer and campaign-planning workbook</h2>
            <p className="mt-2 text-sm leading-5 text-text-secondary">
              Upload the known monthly flyer or consolidated planning format. Review Product Master matches, promotional metadata, store cases, display-code mappings, and store-specific exceptions before Apply.
            </p>
            <div className="mt-4 rounded-md border border-info/20 bg-info-subtle p-3 text-sm leading-5 text-info">
              Exact SKU and store-scoped display codes are authoritative. Unresolved rows are retained for review and never silently matched.
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className={linkClass(true)} to="/imports/flyer"><UploadCloud className="h-4 w-4" />Import workbook</Link>
            <Link className={linkClass()} to="/campaigns">View campaigns <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </Card>
      </div>
    </DataState>
  );
}
