"use client";

/**
 * RepurposeOS Header — 3 Layout Variants
 *
 * Variant A: "Compact Command" — single row, inline project + step pills (Linear/Vercel style)
 * Variant B: "Unified Panel"  — one bordered card wrapping title, stepper, project selector
 * Variant C: "Pipeline View"  — large visual node-based step tracker with project inline
 *
 * Usage: swap the import in repurpose-layout-client.tsx
 *   import { RepurposeHeaderA as RepurposeHeader } from "./repurpose-header-variants"
 *   import { RepurposeHeaderB as RepurposeHeader } from "./repurpose-header-variants"
 *   import { RepurposeHeaderC as RepurposeHeader } from "./repurpose-header-variants"
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Check,
  ChevronRight,
  Download,
  Scissors,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "./types";

// ─── Shared ───────────────────────────────────────────────────────────────────

const STEP_MAP: Record<string, number> = {
  "/repurpose": 1,
  "/repurpose/editor": 2,
  "/repurpose/export": 3,
};

const tabs = [
  { label: "Ingest & Detect", href: "/repurpose", icon: Upload, step: 1 },
  { label: "Edit & Enhance", href: "/repurpose/editor", icon: Scissors, step: 2 },
  { label: "Export & Translate", href: "/repurpose/export", icon: Download, step: 3 },
] as const;

interface RepurposeHeaderProps {
  projects: ProjectSummary[];
  projectId: string;
  setProjectId: (id: string) => void;
  hasAsset: boolean;
  clipCount: number;
  exportCount: number;
}

// ─── Variant A — "Compact Command" ───────────────────────────────────────────
// Single compact row: icon+title | project dropdown | step pills
// Clean, space-efficient, Pro-tool feel (Linear / Vercel style)

export function RepurposeHeaderA({
  projects,
  projectId,
  setProjectId,
  hasAsset,
  clipCount,
  exportCount,
}: RepurposeHeaderProps) {
  const pathname = usePathname();
  const currentStep = STEP_MAP[pathname] ?? 1;

  function isStepComplete(step: number) {
    if (step === 1) return !!hasAsset;
    if (step === 2) return clipCount > 0;
    if (step === 3) return exportCount > 0;
    return false;
  }

  function isStepDisabled(step: number) {
    if (step === 1) return false;
    if (step === 2) return !hasAsset;
    if (step === 3) return clipCount === 0;
    return true;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 backdrop-blur-sm">
      {/* Brand mark + title */}
      <div className="flex items-center gap-2.5 mr-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15">
          <Scissors className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none tracking-tight text-foreground">
            Repurpose OS
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground hidden sm:block">
            Step {currentStep} of 3
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="hidden h-8 w-px bg-border/60 sm:block" />

      {/* Project selector — inline, compact */}
      <Select value={projectId || undefined} onValueChange={setProjectId}>
        <SelectTrigger className="h-8 w-44 rounded-lg border-border/60 text-xs font-medium">
          <SelectValue placeholder="Select project" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem showIndicator key={p.id} value={p.id} className="text-xs">
              {p.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Divider */}
      <div className="hidden h-8 w-px bg-border/60 sm:block" />

      {/* Step pills */}
      <div className="flex items-center gap-0.5 ml-auto">
        {tabs.map((tab, i) => {
          const isActive = pathname === tab.href;
          const complete = isStepComplete(tab.step);
          const disabled = !projectId || isStepDisabled(tab.step);
          const href = projectId ? `${tab.href}?projectId=${projectId}` : tab.href;
          const Icon = tab.icon;

          return (
            <div key={tab.href} className="flex items-center">
              <Link
                href={disabled ? "#" : href}
                aria-disabled={disabled}
                prefetch={false}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : complete
                    ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  disabled && "pointer-events-none opacity-40"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
                    isActive
                      ? "bg-white/20"
                      : complete
                      ? "bg-emerald-500/15"
                      : "bg-muted"
                  )}
                >
                  {complete && !isActive ? <Check className="h-2.5 w-2.5" /> : tab.step}
                </span>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden md:inline">{tab.label}</span>
              </Link>
              {i < tabs.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 text-border mx-0.5" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Variant B — "Unified Panel" ─────────────────────────────────────────────
// One bordered card wrapping title row + stepper row + project selector row
// Structured, premium, everything contained in one surface

export function RepurposeHeaderB({
  projects,
  projectId,
  setProjectId,
  hasAsset,
  clipCount,
  exportCount,
}: RepurposeHeaderProps) {
  const pathname = usePathname();
  const currentStep = STEP_MAP[pathname] ?? 1;

  function isStepComplete(step: number) {
    if (step === 1) return !!hasAsset;
    if (step === 2) return clipCount > 0;
    if (step === 3) return exportCount > 0;
    return false;
  }

  function isStepDisabled(step: number) {
    if (step === 1) return false;
    if (step === 2) return !hasAsset;
    if (step === 3) return clipCount === 0;
    return true;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm">
      {/* Top row — title + step counter */}
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <Scissors className="h-[18px] w-[18px] text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Repurpose OS
            </h1>
            <p className="text-xs text-muted-foreground">
              Ingest long-form content, edit clips, and export channel-ready assets.
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs font-medium hidden sm:flex">
          Step {currentStep} of 3
        </Badge>
      </div>

      {/* Step progress bar */}
      <div className="flex items-stretch border-b border-border/40">
        {tabs.map((tab, i) => {
          const isActive = pathname === tab.href;
          const complete = isStepComplete(tab.step);
          const disabled = !projectId || isStepDisabled(tab.step);
          const href = projectId ? `${tab.href}?projectId=${projectId}` : tab.href;
          const Icon = tab.icon;

          return (
            <div key={tab.href} className="relative flex-1">
              {/* Active underline accent */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
              <Link
                href={disabled ? "#" : href}
                aria-disabled={disabled}
                prefetch={false}
                className={cn(
                  "flex h-full w-full items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : complete
                    ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  disabled && "pointer-events-none opacity-40",
                  i < tabs.length - 1 && "border-r border-border/40"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : complete
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {complete && !isActive ? <Check className="h-3 w-3" /> : tab.step}
                </span>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                {((tab.step === 2 && clipCount > 0) || (tab.step === 3 && exportCount > 0)) && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-1 h-5 min-w-[18px] px-1 text-[10px]",
                      isActive && "bg-primary/15 text-primary"
                    )}
                  >
                    {tab.step === 2 ? clipCount : exportCount}
                  </Badge>
                )}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Bottom row — project selector */}
      <div className="flex items-center gap-3 px-5 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          Active Project
        </span>
        <Select value={projectId || undefined} onValueChange={setProjectId}>
          <SelectTrigger className="h-8 w-56 rounded-lg border-border/60 text-xs font-medium">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem showIndicator key={p.id} value={p.id} className="text-xs">
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {projectId && clipCount > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {clipCount} clip{clipCount !== 1 ? "s" : ""}
            {exportCount > 0 ? ` · ${exportCount} exported` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Variant C — "Pipeline View" ─────────────────────────────────────────────
// Title + project selector inline at top, then large visual node-based step
// tracker centered below — puts maximum emphasis on the workflow pipeline

export function RepurposeHeaderC({
  projects,
  projectId,
  setProjectId,
  hasAsset,
  clipCount,
  exportCount,
}: RepurposeHeaderProps) {
  const pathname = usePathname();

  function isStepComplete(step: number) {
    if (step === 1) return !!hasAsset;
    if (step === 2) return clipCount > 0;
    if (step === 3) return exportCount > 0;
    return false;
  }

  function isStepDisabled(step: number) {
    if (step === 1) return false;
    if (step === 2) return !hasAsset;
    if (step === 3) return clipCount === 0;
    return true;
  }

  const stepMeta = [
    { hint: hasAsset ? "Asset ready" : "No asset yet", count: null },
    { hint: clipCount > 0 ? `${clipCount} clips` : "No clips yet", count: clipCount || null },
    { hint: exportCount > 0 ? `${exportCount} exported` : "No exports yet", count: exportCount || null },
  ];

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <Scissors className="h-[18px] w-[18px] text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Repurpose OS
            </h1>
            <p className="text-xs text-muted-foreground">
              Ingest · Clip · Export — channel-ready in minutes.
            </p>
          </div>
        </div>
        <Select value={projectId || undefined} onValueChange={setProjectId}>
          <SelectTrigger className="h-9 w-52 rounded-xl border-border/60 text-xs font-medium">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem showIndicator key={p.id} value={p.id} className="text-xs">
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pipeline node tracker */}
      <div className="relative flex items-start justify-between rounded-2xl border border-border/60 bg-card/60 px-6 py-5 backdrop-blur-sm">
        {/* Connecting line behind nodes */}
        <div className="absolute left-[calc(16.67%)] right-[calc(16.67%)] top-[calc(1.75rem+1.25rem)] h-px bg-border/60" />

        {tabs.map((tab, i) => {
          const isActive = pathname === tab.href;
          const complete = isStepComplete(tab.step);
          const disabled = !projectId || isStepDisabled(tab.step);
          const href = projectId ? `${tab.href}?projectId=${projectId}` : tab.href;
          const Icon = tab.icon;
          const meta = stepMeta[i];

          return (
            <Link
              key={tab.href}
              href={disabled ? "#" : href}
              aria-disabled={disabled}
              prefetch={false}
              className={cn(
                "group relative z-10 flex flex-1 flex-col items-center gap-2 text-center transition-all",
                disabled && "pointer-events-none opacity-40"
              )}
            >
              {/* Node circle */}
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]"
                    : complete
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border bg-background text-muted-foreground group-hover:border-primary/40"
                )}
              >
                {complete && !isActive ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>

              {/* Step label */}
              <div>
                <p
                  className={cn(
                    "text-xs font-semibold",
                    isActive
                      ? "text-primary"
                      : complete
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-foreground"
                  )}
                >
                  {tab.label}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{meta.hint}</p>
              </div>

              {/* Count badge */}
              {meta.count !== null && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "h-5 min-w-[20px] px-1.5 text-[10px] font-semibold",
                    isActive && "bg-primary/15 text-primary"
                  )}
                >
                  {meta.count}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
