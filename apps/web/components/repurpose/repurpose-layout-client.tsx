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
    <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-black/30">
      {/* Left: Step N of 3 pill */}
      <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/20">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-white leading-none">{currentStep}</span>
        </div>
        <span className="text-sm font-semibold text-purple-300">Step {currentStep} of 3</span>
      </div>

      {/* Right: Previous / Next buttons */}
      <div className="flex items-center gap-2">
        {prevStep && (
          <Link
            href={prevDisabled ? "#" : `${prevStep.href}${projectId ? `?projectId=${projectId}` : ""}`}
            aria-disabled={prevDisabled}
            prefetch={false}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-all",
              prevDisabled
                ? "border-white/5 text-white/20 pointer-events-none cursor-not-allowed"
                : "border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
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
              "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
              nextDisabled
                ? "bg-white/5 text-white/20 pointer-events-none cursor-not-allowed"
                : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white hover:shadow-lg hover:shadow-purple-500/20"
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
    <div className="flex items-center justify-center gap-2 py-5">
      {STEPS.map((step, index) => {
        const active    = currentStep === step.number;
        const complete  = isComplete(step.number);
        const disabled  = isDisabled(step.number);
        const href      = projectId ? `${step.href}?projectId=${projectId}` : step.href;
        const Icon      = step.icon;

        return (
          <div key={step.number} className="flex items-center">
            <Link
              href={disabled ? "#" : href}
              aria-disabled={disabled}
              prefetch={false}
              className={cn(
                "flex items-center gap-3 px-5 py-3 rounded-xl border transition-all select-none",
                active
                  ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30"
                  : complete
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-white/[0.03] border-white/[0.07]",
                disabled
                  ? "pointer-events-none opacity-40"
                  : !active && "hover:border-white/15 hover:bg-white/[0.05]"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  active    ? "bg-gradient-to-br from-purple-500 to-pink-500"
                  : complete ? "bg-emerald-500"
                  : "bg-white/10"
                )}
              >
                {complete && !active ? (
                  <Check className="h-4 w-4 text-white" />
                ) : (
                  <Icon className="h-4 w-4 text-white" />
                )}
              </div>

              <div>
                <div
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-widest mb-0.5",
                    active ? "text-purple-400" : "text-white/30"
                  )}
                >
                  Step {step.number}
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold",
                    active ? "text-white" : complete ? "text-emerald-400" : "text-white/50"
                  )}
                >
                  {step.label}
                </div>
              </div>
            </Link>

            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-10 h-px mx-1.5",
                  isComplete(step.number) ? "bg-emerald-500/40" : "bg-white/[0.07]"
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
    <div className="-mx-4 -mt-4 lg:-mx-6 lg:-mt-6 min-h-screen">
      {/* Step nav bar */}
      <StepNavBar projectId={projectId} hasAsset={hasAsset} clipCount={clipCount} />

      {/* Step indicator */}
      <StepIndicator projectId={projectId} hasAsset={hasAsset} clipCount={clipCount} />

      {/* Page content */}
      <div className="px-4 lg:px-6 pb-10">
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
