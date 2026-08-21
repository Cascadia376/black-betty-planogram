import { BarChart3, ClipboardCheck, LayoutDashboard, Map, Megaphone } from "lucide-react";

const compatibilityItems = [
  "Standalone deployable application",
  "Ursus-compatible React, TypeScript, Vite, Tailwind stack",
  "Semantic design tokens recreated locally",
  "Mock-first repository boundary before Supabase integration",
  "Stable routes for future Ursus navigation links",
];

const firstMilestones = [
  "Phase 1: domain model, repositories, mock seed data",
  "Phase 2: dashboard, campaign builder, assignments, Crown Isle floorplan",
  "Phase 3: execution and compliance workflows",
  "Phase 4: performance history and explainable recommendations",
  "Phase 5: Supabase adapter skeleton and integration readiness",
];

export function App() {
  return (
    <div className="min-h-screen bg-page-canvas text-text-primary">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-border bg-surface p-4 md:block">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Cascadia Liquor</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">Merchandising</h1>
          </div>
          <nav className="space-y-1 text-sm font-medium">
            <a className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-primary" href="/">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </a>
            <a className="flex items-center gap-2 rounded-md px-3 py-2 text-text-secondary hover:bg-muted" href="/campaigns">
              <Megaphone className="h-4 w-4" />
              Campaigns
            </a>
            <a className="flex items-center gap-2 rounded-md px-3 py-2 text-text-secondary hover:bg-muted" href="/stores/crown-isle/floorplan">
              <Map className="h-4 w-4" />
              Crown Isle Floorplan
            </a>
            <a className="flex items-center gap-2 rounded-md px-3 py-2 text-text-secondary hover:bg-muted" href="/compliance/demo">
              <ClipboardCheck className="h-4 w-4" />
              Compliance
            </a>
            <a className="flex items-center gap-2 rounded-md px-3 py-2 text-text-secondary hover:bg-muted" href="/performance">
              <BarChart3 className="h-4 w-4" />
              Performance
            </a>
          </nav>
        </aside>

        <main className="flex-1 px-4 py-5 md:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-text-muted">Initial standalone repository scaffold</p>
                <h2 className="mt-1 text-2xl font-semibold leading-8">Merchandising Platform</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                  Internal merchandising operations app for persistent display areas, campaign assignments,
                  store execution, compliance review, and performance history.
                </p>
              </div>
              <a
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover active:scale-95"
                href="/docs/URSUS_MAJOR_INTEGRATION.md"
              >
                Integration Contract
              </a>
            </header>

            <section className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg border border-border bg-surface p-5 shadow-sm lg:col-span-2">
                <h3 className="text-base font-semibold">Compatibility Commitments</h3>
                <ul className="mt-4 grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
                  {compatibilityItems.map((item) => (
                    <li key={item} className="rounded-md border border-border bg-page-canvas px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
                <h3 className="text-base font-semibold">Pilot Store</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-text-muted">Store</dt>
                    <dd className="font-medium">Crown Isle</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">First display area</dt>
                    <dd className="font-medium">Endcap A</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Data mode</dt>
                    <dd className="font-medium">Mock seed data only</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <h3 className="text-base font-semibold">Build Plan</h3>
              <ol className="mt-4 grid gap-3 text-sm text-text-secondary lg:grid-cols-5">
                {firstMilestones.map((milestone) => (
                  <li key={milestone} className="rounded-md border border-border bg-page-canvas p-3">
                    {milestone}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

