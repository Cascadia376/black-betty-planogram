/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { clsx } from "clsx";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-start md:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase text-text-muted">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx("rounded-lg border border-border bg-surface p-4 shadow-sm", className)}>{children}</section>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "error" | "info" }) {
  const tones = {
    neutral: "bg-subtle text-text-secondary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    error: "bg-error/10 text-error",
    info: "bg-info/10 text-info",
  };
  return <span className={clsx("inline-flex rounded px-2 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function Button({ children, variant = "primary", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary-hover",
        variant === "secondary" && "border border-border bg-surface text-text-primary hover:bg-subtle",
        variant === "danger" && "bg-error text-white hover:bg-error/90",
        className,
      )}
      {...props}
    >{children}</button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}{children}{hint && <span className="text-xs font-normal text-text-muted">{hint}</span>}</label>;
}

export const inputClass = "min-h-10 w-full rounded-md border border-input bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

export function DataState({ loading, error, children }: { loading: boolean; error?: string; children: ReactNode }) {
  if (loading) return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-text-muted"><LoaderCircle className="h-4 w-4 animate-spin" />Loading merchandising data...</div>;
  if (error) return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-error"><AlertCircle className="h-4 w-4" />{error}</div>;
  return <>{children}</>;
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="rounded-lg border border-dashed border-border p-8 text-center"><p className="font-medium">{title}</p><p className="mt-1 text-sm text-text-muted">{message}</p></div>;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
