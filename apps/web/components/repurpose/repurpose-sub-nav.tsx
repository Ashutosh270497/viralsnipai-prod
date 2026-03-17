"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronRight, Download, Scissors, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface RepurposeSubNavProps {
  projectId: string;
  hasAsset?: boolean;
  clipCount?: number;
  exportCount?: number;
}

const tabs = [
  { label: "Ingest & Detect", href: "/repurpose", icon: Upload, step: 1 },
  { label: "Edit & Enhance", href: "/repurpose/editor", icon: Scissors, step: 2 },
  { label: "Export & Translate", href: "/repurpose/export", icon: Download, step: 3 },
] as const;

export function RepurposeSubNav({ projectId, hasAsset, clipCount, exportCount }: RepurposeSubNavProps) {
  const pathname = usePathname();

  function isStepComplete(step: number) {
    if (step === 1) return !!hasAsset;
    if (step === 2) return (clipCount ?? 0) > 0;
    if (step === 3) return (exportCount ?? 0) > 0;
    return false;
  }

  return (
    <nav className="flex w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-border/60 bg-card/40 p-1.5">
      {tabs.map((tab, index) => {
        const isActive = pathname === tab.href;
        const hasProject = Boolean(projectId);
        const hasDetectedClips = (clipCount ?? 0) > 0;
        const requiresProject = tab.href !== "/repurpose";
        const requiresAsset = tab.href === "/repurpose/editor";
        const requiresClips = tab.href === "/repurpose/export";
        const isDisabled =
          !hasProject ||
          (requiresProject && !projectId) ||
          (requiresAsset && !hasAsset) ||
          (requiresClips && !hasDetectedClips);
        const href = projectId ? `${tab.href}?projectId=${projectId}` : tab.href;
        const Icon = tab.icon;
        const complete = isStepComplete(tab.step);

        const disabledReason = !hasProject
          ? "Select a project first"
          : requiresAsset && !hasAsset
            ? "Ingest media before opening the editor"
            : requiresClips && !hasDetectedClips
              ? "Detect clips before opening export"
              : undefined;

        const badge =
          tab.step === 2 && clipCount ? clipCount :
          tab.step === 3 && exportCount ? exportCount :
          null;

        return (
          <div key={tab.href} className="flex items-center">
            <Link
              href={isDisabled ? "/repurpose" : href}
              aria-disabled={isDisabled}
              aria-label={
                isDisabled && disabledReason
                  ? `${tab.label} (disabled: ${disabledReason})`
                  : tab.label
              }
              title={isDisabled ? disabledReason : undefined}
              tabIndex={isDisabled ? -1 : undefined}
              className={cn(
                "relative inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                isDisabled && "pointer-events-none opacity-40"
              )}
              prefetch={false}
            >
              {/* Step number / check */}
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : complete
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {complete && !isActive ? (
                  <Check className="h-3 w-3" />
                ) : (
                  tab.step
                )}
              </span>
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
              {badge ? (
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-0.5 h-5 min-w-[20px] px-1.5 text-[10px] font-semibold",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {badge}
                </Badge>
              ) : null}
            </Link>
            {/* Connector arrow */}
            {index < tabs.length - 1 && (
              <ChevronRight className="mx-0.5 h-4 w-4 shrink-0 text-border hidden sm:block" />
            )}
          </div>
        );
      })}
    </nav>
  );
}
