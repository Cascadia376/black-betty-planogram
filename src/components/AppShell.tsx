import {
  BarChart3,
  Building2,
  CalendarRange,
  ClipboardCheck,
  LayoutDashboard,
  Layers3,
  Lightbulb,
  Menu,
  Megaphone,
  Plus,
  RotateCcw,
  ShoppingCart,
  UploadCloud,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { clsx } from "clsx";
import { usePlatform } from "../services/PlatformProvider";
import type { PlatformSnapshot, UserRole } from "../domain/types";
import { Button } from "./ui";

function buildNavigation(data: PlatformSnapshot | undefined, role: UserRole) {
  const program = data?.programs.find((item) => item.status === "active") ?? data?.programs.find((item) => item.name.startsWith("OND")) ?? data?.programs[0];
  const membership = data?.programStores.find((item) => item.programId === program?.id && item.included && item.status !== "not_started")
    ?? data?.programStores.find((item) => item.programId === program?.id && item.included);
  const store = data?.stores.find((item) => item.id === membership?.storeId) ?? data?.stores[0];
  const execution = data?.executions.find((item) => item.status === "completed") ?? data?.executions[0];
  const planningRoles: UserRole[] = ["admin", "merchandising", "read_only"];
  const reviewRoles: UserRole[] = ["admin", "merchandising", "operations", "read_only"];
  const items = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, matches: (path: string) => path === "/", roles: undefined },
    ...(program ? [{ to: `/programs/${program.id}`, label: "OND Program", icon: CalendarRange, matches: (path: string) => path.startsWith("/programs"), roles: reviewRoles }] : []),
    { to: "/imports", label: "Uploads", icon: UploadCloud, matches: (path: string) => path.startsWith("/imports"), roles: planningRoles },
    { to: "/campaigns", label: "Campaigns", icon: Megaphone, matches: (path: string) => path.startsWith("/campaigns"), roles: planningRoles },
    ...(store ? [
      { to: `/stores/${store.id}/floorplan`, label: "Displays", icon: Layers3, matches: (path: string) => path.includes("/floorplan") || path.startsWith("/display-areas"), roles: undefined },
      { to: `/stores/${store.id}/workspace`, label: role === "store_manager" ? "My workspace" : "Stores", icon: Building2, matches: (path: string) => (path.startsWith("/stores") && !path.includes("/floorplan") && !path.includes("/orders")) || path.startsWith("/executions"), roles: undefined },
      { to: `/stores/${store.id}/orders${program ? `?program=${program.id}` : ""}`, label: "Orders", icon: ShoppingCart, matches: (path: string) => path.includes("/orders"), roles: undefined },
    ] : []),
    ...(execution ? [{ to: `/compliance/${execution.id}`, label: "Compliance", icon: ClipboardCheck, matches: (path: string) => path.startsWith("/compliance"), roles: reviewRoles }] : []),
    { to: "/performance", label: "Performance", icon: BarChart3, matches: (path: string, search: string) => path === "/performance" && !search.includes("view=recommendations"), roles: reviewRoles },
    { to: "/performance?view=recommendations", label: "Recommendations", icon: Lightbulb, matches: (path: string, search: string) => path === "/performance" && search.includes("view=recommendations"), roles: reviewRoles },
  ];
  return items.filter((item) => !item.roles || item.roles.includes(role));
}

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  merchandising: "Buying / Merchandising",
  operations: "Operations",
  store_manager: "Store Manager",
  read_only: "Read Only",
};

function Brand() {
  return (
    <div className="flex h-[107px] items-center gap-3 px-6">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">BB</span>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold leading-6 text-text-primary">Black Betty</p>
        <p className="text-xs font-medium leading-4 text-text-muted">Cascadia Merchandising</p>
      </div>
    </div>
  );
}

function RoleSelect({ role, setRole, compact = false }: { role: UserRole; setRole(role: UserRole): void; compact?: boolean }) {
  return (
    <label className={clsx("grid gap-1 text-[11px] font-semibold uppercase text-text-muted", compact && "normal-case")}>
      <span className={compact ? "sr-only" : undefined}>Demo role</span>
      <select
        aria-label="Demo role"
        className={clsx(
          "rounded-md border border-input bg-surface font-medium text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-focus",
          compact ? "h-8 max-w-48 px-2 text-xs" : "h-9 w-full px-2 text-sm",
        )}
        value={role}
        onChange={(event) => setRole(event.target.value as UserRole)}
      >
        {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  );
}

function Navigation({ close }: { close?: () => void }) {
  const location = useLocation();
  const { data, role } = usePlatform();
  const navigation = buildNavigation(data, role);
  return (
    <nav aria-label="Primary navigation" className="space-y-1 px-2 py-2">
      {navigation.map(({ to, label, icon: Icon, matches }) => {
        const active = matches(location.pathname, location.search);
        return (
          <Link
            key={label}
            to={to}
            onClick={close}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex h-10 items-center gap-3 rounded-md px-4 text-sm font-medium transition-colors",
              active
                ? "bg-primary-subtle text-primary"
                : "text-text-secondary hover:bg-sidebar-hover hover:text-text-primary",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ close }: { close?: () => void }) {
  const { role, setRole, resetDemo } = usePlatform();
  const canCreateCampaign = role === "admin" || role === "merchandising";
  return (
    <div className="flex h-full flex-col">
      <Brand />
      {canCreateCampaign && <div className="border-y border-border px-4 py-4">
        <Link
          to="/campaigns/new"
          onClick={close}
          className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <Plus className="h-3.5 w-3.5" />
          New campaign
        </Link>
      </div>}
      <div className="min-h-0 flex-1 overflow-y-auto"><Navigation close={close} /></div>
      <div className="space-y-3 border-t border-border p-4 lg:hidden">
        <RoleSelect role={role} setRole={setRole} />
        <Button variant="secondary" className="w-full" onClick={() => void resetDemo()}><RotateCcw className="h-4 w-4" />Reset demo data</Button>
      </div>
      <div className="hidden border-t border-border px-4 py-3 lg:block">
        <button className="flex h-8 w-full items-center gap-3 rounded-md px-3 text-xs font-medium text-text-muted transition-colors hover:bg-sidebar-hover hover:text-text-primary" onClick={() => void resetDemo()}>
          <RotateCcw className="h-3.5 w-3.5" />Reset demo data
        </button>
        <p className="mt-1 px-3 text-[11px] text-text-muted">Synthetic development data</p>
      </div>
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role, setRole, data } = usePlatform();
  const pilotStore = data?.stores.find((store) => data.programStores.some((membership) => membership.storeId === store.id && membership.included && membership.status !== "not_started")) ?? data?.stores[0];
  return (
    <div className="min-h-screen overflow-x-hidden bg-page-canvas text-text-primary">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      <div className="min-w-0 lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-text-secondary hover:bg-subtle lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-5">Merchandising</p>
              <p className="truncate text-xs text-text-muted">{pilotStore ? `${pilotStore.name} pilot` : "Merchandising operations"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded border border-border bg-subtle px-2 py-1 text-[11px] font-semibold text-text-muted sm:inline-flex">MOCK DATA</span>
            <div className="hidden lg:block"><RoleSelect role={role} setRole={setRole} compact /></div>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-subtle text-xs font-bold text-primary">BB</span>
          </div>
        </header>

        <main className="min-w-0">
          <div className="mx-auto w-full max-w-[1180px] space-y-5 px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-overlay lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="h-full w-60 border-r border-border bg-sidebar shadow-overlay" onClick={(event) => event.stopPropagation()}>
            <div className="absolute left-[192px] top-4 z-10">
              <button type="button" aria-label="Close navigation" className="grid h-8 w-8 place-items-center rounded-md text-text-secondary hover:bg-sidebar-hover" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <SidebarContent close={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
