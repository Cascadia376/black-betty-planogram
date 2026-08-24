import { BarChart3, Building2, ClipboardCheck, LayoutDashboard, Map, Megaphone, Menu, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { clsx } from "clsx";
import { usePlatform } from "../services/PlatformProvider";
import type { UserRole } from "../domain/types";
import { Button } from "./ui";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/stores/10000000-0000-4000-8000-000000000001/workspace", label: "Store workspace", icon: Building2 },
  { to: "/stores/10000000-0000-4000-8000-000000000001/floorplan", label: "Floorplan", icon: Map },
  { to: "/compliance/70000000-0000-4000-8000-000000000001", label: "Compliance", icon: ClipboardCheck },
  { to: "/performance", label: "Performance", icon: BarChart3 },
];

function Navigation({ close }: { close?: () => void }) {
  return <nav className="space-y-1">{nav.map(({ to, label, icon: Icon, end }) => (
    <NavLink key={to} to={to} end={end} onClick={close} className={({ isActive }) => clsx("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium", isActive ? "bg-primary/10 text-primary" : "text-text-secondary hover:bg-subtle hover:text-text-primary")}>
      <Icon className="h-4 w-4" />{label}
    </NavLink>
  ))}</nav>;
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role, setRole, resetDemo } = usePlatform();
  return (
    <div className="min-h-screen bg-page-canvas text-text-primary">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-border bg-surface px-3 py-5 lg:block">
        <div className="px-3"><p className="text-xs font-semibold uppercase text-text-muted">Cascadia Liquor</p><p className="mt-1 text-lg font-semibold">Merchandising</p></div>
        <div className="mt-7"><Navigation /></div>
        <div className="absolute inset-x-3 bottom-4 space-y-3 border-t border-border pt-4">
          <label className="grid gap-1 text-xs font-semibold text-text-muted">DEMO ROLE
            <select className="rounded-md border border-input bg-surface px-2 py-2 text-sm font-medium text-text-primary" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              <option value="admin">Admin</option><option value="merchandising">Buying / Merchandising</option><option value="operations">Operations</option><option value="store_manager">Store Manager</option><option value="read_only">Read Only</option>
            </select>
          </label>
          <Button variant="secondary" className="w-full" onClick={() => void resetDemo()}><RotateCcw className="h-4 w-4" />Reset demo data</Button>
          <p className="px-1 text-xs text-text-muted">Synthetic development data</p>
        </div>
      </aside>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <span className="font-semibold">Merchandising</span><button aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu /></button>
      </header>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-text-primary/35 lg:hidden" onClick={() => setMobileOpen(false)}><aside className="h-full w-72 bg-surface p-4" onClick={(event) => event.stopPropagation()}><div className="mb-6 flex items-center justify-between"><span className="font-semibold">Cascadia Liquor</span><button aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X /></button></div><Navigation close={() => setMobileOpen(false)} /></aside></div>}
      <main className="lg:pl-60"><div className="mx-auto max-w-[1440px] space-y-6 px-4 py-5 md:px-7 md:py-6"><Outlet /></div></main>
    </div>
  );
}

