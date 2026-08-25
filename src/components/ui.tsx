/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import { clsx } from "clsx";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 md:flex-1">
        {eyebrow && <p className="text-xs font-semibold uppercase text-primary">{eyebrow}</p>}
        <h1 className="mt-1 break-words text-2xl font-semibold leading-8 text-text-primary">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm leading-5 text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 md:max-w-[65%] md:shrink-0 md:justify-end">{actions}</div>}
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx("min-w-0 rounded-md border border-border bg-surface p-5 shadow-card", className)}>{children}</section>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "error" | "info" }) {
  const tones = {
    neutral: "border-border bg-subtle text-text-secondary",
    success: "border-success/20 bg-success-subtle text-success",
    warning: "border-warning/20 bg-warning-subtle text-warning",
    error: "border-error/20 bg-error-subtle text-error",
    info: "border-info/20 bg-info-subtle text-info",
  };
  return <span className={clsx("inline-flex min-h-5 items-center rounded border px-2 py-0.5 text-[11px] font-semibold leading-4", tones[tone])}>{children}</span>;
}

export function Button({ children, variant = "primary", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary-hover",
        variant === "secondary" && "border border-border-strong bg-surface text-text-primary hover:bg-subtle",
        variant === "danger" && "bg-error text-destructive-foreground hover:bg-error-hover",
        className,
      )}
      {...props}
    >{children}</button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-text-secondary">{label}{children}{hint && <span className="text-xs font-normal leading-4 text-text-muted">{hint}</span>}</label>;
}

export const inputClass = "min-h-9 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm font-normal text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:bg-subtle disabled:text-text-muted";

export function DataState({ loading, error, children }: { loading: boolean; error?: string; children: ReactNode }) {
  if (loading) return <div role="status" aria-live="polite" className="flex min-h-48 items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface text-sm text-text-muted"><LoaderCircle className="h-4 w-4 animate-spin" />Loading merchandising data...</div>;
  if (error) return <div role="alert" className="flex min-h-48 items-center justify-center gap-2 rounded-md border border-error/20 bg-error-subtle p-6 text-sm text-error"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>;
  return <>{children}</>;
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="rounded-md border border-dashed border-border-strong bg-surface px-6 py-10 text-center"><span className="mx-auto grid h-9 w-9 place-items-center rounded-md bg-subtle text-text-muted"><Inbox className="h-4 w-4" /></span><p className="mt-3 text-sm font-semibold text-text-primary">{title}</p><p className="mx-auto mt-1 max-w-md text-sm leading-5 text-text-muted">{message}</p></div>;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
