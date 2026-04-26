import Link from "next/link";
import type { ComponentPropsWithoutRef, ComponentType, ReactNode } from "react";
import { ArrowRight, LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppCard({
  children,
  className,
  interactive = false,
  ...props
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
} & ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl border border-border/70 bg-card/88 shadow-sm shadow-slate-950/5 backdrop-blur-sm",
        "dark:bg-white/[0.055] dark:shadow-black/20",
        interactive && "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-emerald-950/10",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-900/20">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <div>
          {eyebrow ? (
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primary,
  secondary,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  primary?: { label: string; href?: string; onClick?: () => void };
  secondary?: { label: string; href: string };
  className?: string;
  children?: ReactNode;
}) {
  const primaryContent = (
    <>
      {primary?.label}
      <ArrowRight className="ml-2 h-4 w-4" />
    </>
  );

  return (
    <AppCard className={cn("relative overflow-hidden p-10 text-center", className)}>
      <div className="absolute inset-x-12 top-0 h-24 rounded-full bg-gradient-to-r from-emerald-400/15 via-cyan-400/12 to-blue-500/12 blur-3xl" />
      <div className="relative mx-auto flex max-w-xl flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-xl shadow-emerald-900/20">
          <Icon className="h-7 w-7" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        {(primary || secondary) && (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {primary?.href ? (
              <Button asChild className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white">
                <Link href={primary.href}>{primaryContent}</Link>
              </Button>
            ) : primary ? (
              <Button onClick={primary.onClick} className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white">
                {primaryContent}
              </Button>
            ) : null}
            {secondary ? (
              <Button asChild variant="outline" className="rounded-full">
                <Link href={secondary.href}>{secondary.label}</Link>
              </Button>
            ) : null}
          </div>
        )}
        {children ? <div className="mt-7">{children}</div> : null}
      </div>
    </AppCard>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const normalized = status === "done" ? "completed" : status;
  const tone =
    normalized === "completed"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : normalized === "failed"
        ? "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300"
        : normalized === "processing" || normalized === "queued" || normalized === "retryable"
          ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
          : "border-border bg-muted/40 text-muted-foreground";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize", tone, className)}>
      {normalized}
    </span>
  );
}

export function UsageMeter({
  label,
  value,
  max,
  hint,
}: {
  label: string;
  value: number;
  max: number;
  hint?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{value}/{max}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${pct}%` }} />
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Stepper({
  steps,
  activeIndex,
}: {
  steps: Array<{ label: string; icon: ComponentType<{ className?: string }> }>;
  activeIndex: number;
}) {
  return (
    <div className="grid gap-2 rounded-2xl border border-border/70 bg-card/75 p-2 shadow-sm dark:bg-white/[0.04] sm:grid-cols-3">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const active = index === activeIndex;
        const done = index < activeIndex;
        return (
          <div
            key={step.label}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition",
              active
                ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-900/15"
                : done
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
