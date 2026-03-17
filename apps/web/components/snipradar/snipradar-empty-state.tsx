"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SnipRadarEmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
  hint,
  primaryAction,
  secondaryAction,
  className,
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  hint?: string;
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    disabled?: boolean;
  };
  className?: string;
}) {
  const PrimaryContent = (
    <>
      {primaryAction?.label}
      <ArrowRight className="h-3.5 w-3.5" />
    </>
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border/40 bg-white/[0.01] px-5 py-12 text-center",
        className,
      )}
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/[0.08] ring-1 ring-primary/20">
        <Icon className="h-5 w-5 text-primary/60" />
      </div>
      {eyebrow ? (
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">
          {eyebrow}
        </p>
      ) : null}
      <p className="mt-2 text-sm font-semibold text-foreground/80">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground/55">{description}</p>
      {hint ? <p className="mt-2.5 text-xs text-muted-foreground/40">{hint}</p> : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {primaryAction?.href ? (
            <Link
              href={primaryAction.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/[0.10] px-4 py-2 text-xs font-semibold text-primary/80 transition-colors hover:bg-primary/[0.16] hover:text-primary",
                primaryAction.disabled && "pointer-events-none opacity-50",
              )}
            >
              {PrimaryContent}
            </Link>
          ) : primaryAction ? (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/[0.10] px-4 py-2 text-xs font-semibold text-primary/80 transition-colors hover:bg-primary/[0.16] hover:text-primary disabled:pointer-events-none disabled:opacity-50"
            >
              {PrimaryContent}
            </button>
          ) : null}
          {secondaryAction?.href ? (
            <Link
              href={secondaryAction.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-foreground/60 transition-colors hover:bg-white/[0.06] hover:text-foreground/80",
                secondaryAction.disabled && "pointer-events-none opacity-50",
              )}
            >
              {secondaryAction.label}
            </Link>
          ) : secondaryAction ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-foreground/60 transition-colors hover:bg-white/[0.06] hover:text-foreground/80 disabled:pointer-events-none disabled:opacity-50"
            >
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
