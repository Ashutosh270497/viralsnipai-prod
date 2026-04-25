"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Download, Upload, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProjectSummary } from "./types";
import { RepurposeProvider, useRepurpose } from "./repurpose-context";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: "Ingest & Detect",    icon: Upload,   href: "/repurpose" },
  { number: 2, label: "Edit & Enhance",     icon: Sparkles, href: "/repurpose/editor" },
  { number: 3, label: "Export & Translate", icon: Download, href: "/repurpose/export" },
] as const;

const STEP_MAP: Record<string, number> = {
  "/repurpose": 1,
  "/repurpose/editor": 2,
  "/repurpose/export": 3,
};

// ─── Step Nav Bar (Top strip) ─────────────────────────────────────────────────

function StepNavBar({
  projectId,
  hasAsset,
  clipCount,
}: {
  projectId: string;
  hasAsset: boolean;
  clipCount: number;
}) {
  const pathname = usePathname();
  const currentStep = STEP_MAP[pathname] ?? 1;

  const prevStep = STEPS.find((s) => s.number === currentStep - 1);
  const nextStep = STEPS.find((s) => s.number === currentStep + 1);

  function isStepDisabled(step: number) {
    if (!projectId) return true;
    if (step === 2) return !hasAsset;
    if (step === 3) return clipCount === 0;
    return false;
  }

  const prevDisabled = !prevStep || isStepDisabled(prevStep.number);
  const nextDisabled = !nextStep || isStepDisabled(nextStep.number);

  return (
    <div className="flex items-center justify-between border-b border-border/50 bg-card/50 px-6 py-2.5 backdrop-blur-sm">
      {/* Left: Step pill */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
          <span className="text-[11px] font-bold leading-none">{currentStep}</span>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          Step <span className="font-semibold text-foreground">{currentStep}</span> of 3
        </span>
      </div>

      {/* Right: Previous / Next buttons */}
      <div className="flex items-center gap-2">
        {prevStep && (
          <Link
            href={prevDisabled ? "#" : `${prevStep.href}${projectId ? `?projectId=${projectId}` : ""}`}
            aria-disabled={prevDisabled}
            prefetch={false}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-all",
              prevDisabled
                ? "pointer-events-none cursor-not-allowed border-border/30 text-muted-foreground/30"
                : "border-border/60 bg-background text-foreground/80 hover:bg-secondary hover:text-foreground"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Link>
        )}
        {nextStep && (
          <Link
            href={nextDisabled ? "#" : `${nextStep.href}${projectId ? `?projectId=${projectId}` : ""}`}
            aria-disabled={nextDisabled}
            prefetch={false}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all",
              nextDisabled
                ? "pointer-events-none cursor-not-allowed bg-muted text-muted-foreground/30"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20"
            )}
          >
            Next Step
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Step Indicator (Centered pills) ──────────────────────────────────────────

function StepIndicator({
  projectId,
  hasAsset,
  clipCount,
}: {
  projectId: string;
  hasAsset: boolean;
  clipCount: number;
}) {
  const pathname = usePathname();
  const currentStep = STEP_MAP[pathname] ?? 1;

  function isComplete(step: number) {
    if (step === 1) return hasAsset;
    if (step === 2) return clipCount > 0;
    return false;
  }

  function isDisabled(step: number) {
    if (!projectId) return true;
    if (step === 1) return false;
    if (step === 2) return !hasAsset;
    if (step === 3) return clipCount === 0;
    return true;
  }

  return (
    <div className="flex items-center justify-center gap-2 border-b border-border/40 bg-background/40 px-6 py-4">
      {STEPS.map((step, index) => {
        const active   = currentStep === step.number;
        const complete = isComplete(step.number);
        const disabled = isDisabled(step.number);
        const href     = projectId ? `${step.href}?projectId=${projectId}` : step.href;
        const Icon     = step.icon;

        return (
          <div key={step.number} className="flex items-center">
            <Link
              href={disabled ? "#" : href}
              aria-disabled={disabled}
              prefetch={false}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-all select-none",
                active
                  ? "bg-primary/10 border-primary/30"
                  : complete
                  ? "bg-emerald-500/8 border-emerald-500/25 dark:bg-emerald-500/10 dark:border-emerald-500/30"
                  : "bg-background border-border/50",
                disabled
                  ? "pointer-events-none opacity-40"
                  : !active && "hover:border-border hover:bg-secondary/60 cursor-pointer"
              )}
            >
              {/* Step icon circle */}
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  active    ? "bg-primary text-primary-foreground"
                  : complete ? "bg-emerald-500 text-white"
                  : "bg-muted text-muted-foreground"
                )}
              >
                {complete && !active ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>

              {/* Step text */}
              <div>
                <div
                  className={cn(
                    "mb-0.5 text-[10px] font-semibold uppercase tracking-widest",
                    active ? "text-primary/70" : "text-muted-foreground/50"
                  )}
                >
                  Step {step.number}
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold",
                    active
                      ? "text-foreground"
                      : complete
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </div>
              </div>
            </Link>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1.5 h-px w-8",
                  isComplete(step.number)
                    ? "bg-emerald-500/30"
                    : "bg-border/50"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function RepurposeLayoutInner({ children }: { children: React.ReactNode }) {
  const { projectId, project, primaryAsset } = useRepurpose();

  const clipCount = project?.clips?.length ?? 0;
  const hasAsset  = !!primaryAsset;

  return (
    <div className="-mx-4 -mt-4 min-h-screen w-full min-w-0 flex-1 lg:-mx-6 lg:-mt-6">
      {/* Step nav bar */}
      <StepNavBar projectId={projectId} hasAsset={hasAsset} clipCount={clipCount} />

      {/* Step indicator */}
      <StepIndicator projectId={projectId} hasAsset={hasAsset} clipCount={clipCount} />

      {/* Page content */}
      <div className="px-4 lg:px-6 pb-10 pt-6">
        {children}
      </div>
    </div>
  );
}

export function RepurposeLayoutClient({
  children,
  projects,
}: {
  children: React.ReactNode;
  projects: ProjectSummary[];
}) {
  return (
    <RepurposeProvider projects={projects}>
      <RepurposeLayoutInner>{children}</RepurposeLayoutInner>
    </RepurposeProvider>
  );
}
