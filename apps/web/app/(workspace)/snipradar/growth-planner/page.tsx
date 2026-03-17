"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { SnipRadarBillingGateCard } from "@/components/snipradar/billing-gate-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBillingSubscriptionState } from "@/hooks/use-billing-subscription";
import { trackSnipRadarEvent } from "@/lib/snipradar/events";
import type { GrowthPlan } from "@/lib/ai/growth-planner";

const PHASE_ICONS = [Target, TrendingUp, Zap];
const PHASE_COLORS = [
  "text-blue-500 bg-blue-500/10",
  "text-violet-500 bg-violet-500/10",
  "text-emerald-500 bg-emerald-500/10",
];

function PhaseSkeleton() {
  return (
    <Card className="border-border/70 animate-pulse">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-muted" />
          <div className="space-y-1">
            <div className="h-3.5 w-32 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
        </div>
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
        <div className="mt-2 space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 w-full rounded bg-muted" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PhaseCard({
  phase,
  index,
}: {
  phase: GrowthPlan["phases"][number];
  index: number;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const Icon = PHASE_ICONS[index] ?? Target;
  const colorClass = PHASE_COLORS[index] ?? PHASE_COLORS[0];

  return (
    <Card className="border-border/70">
      <CardContent className="p-4">
        <button
          type="button"
          className="flex w-full items-start gap-3 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{phase.name}</p>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {phase.window}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{phase.goal}</p>
          </div>
          <div className="shrink-0 text-muted-foreground/60">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 border-t border-border/40 pt-3">
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                Weekly Tasks
              </p>
              <ul className="space-y-1.5">
                {phase.weeklyTasks.map((task, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
                    {task}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  Expected Lift
                </p>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {phase.expectedLift}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  Target KPI
                </p>
                <p className="text-xs font-medium text-foreground/80">{phase.kpi}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SnipRadarGrowthPlannerPage() {
  const billingQuery = useBillingSubscriptionState();
  const growthPlannerLocked = billingQuery.data
    ? !billingQuery.data.limits.growthPlanAI
    : false;

  const [plan, setPlan] = useState<GrowthPlan | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar/growth", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to generate plan");
      }
      return res.json() as Promise<{ plan: GrowthPlan }>;
    },
    onSuccess: (data) => {
      setPlan(data.plan);
      trackSnipRadarEvent("snipradar_growth_plan_generated");
    },
  });

  const isGenerating = generateMutation.isPending;
  const hasPlan = Boolean(plan);

  return (
    <div className="space-y-6">
      {growthPlannerLocked ? (
        <SnipRadarBillingGateCard
          details={{
            kind: "upgrade_required",
            feature: "growthPlanAI",
            currentPlan: billingQuery.data!.plan.id,
            requiredPlan: "pro",
            upgradePlan: "pro",
          }}
        />
      ) : null}

      {/* Hero card */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
        <CardContent className="px-6 py-10 text-center">
          <Badge className="mb-4 gap-1.5" variant="secondary">
            <Sparkles className="h-3.5 w-3.5" />
            Growth Planner
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {hasPlan ? "Your Personalized X Growth Plan" : "Get Your Personalized X Growth Plan"}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
            {hasPlan
              ? "AI-generated 3-phase roadmap based on your account, niche, and content patterns."
              : "Generate a phased roadmap with actions, draft goals, and estimated follower lift — personalized to your account."}
          </p>

          {hasPlan && plan ? (
            <div className="mx-auto mt-6 max-w-xl rounded-xl border border-border/50 bg-muted/30 px-5 py-4 text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
                Your 8-Week Goal
              </p>
              <p className="mt-1 text-sm font-medium text-foreground/90">
                {plan.overallGoal}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground/70">Cadence: </span>
                  {plan.recommendedCadence}
                </span>
                <span>
                  <span className="font-semibold text-foreground/70">Signal: </span>
                  {plan.topContentSignal}
                </span>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {growthPlannerLocked ? (
              <Button size="lg" className="h-12 gap-2 px-7" disabled>
                Generate Your Growth Plan
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="h-12 gap-2 px-7"
                disabled={isGenerating}
                onClick={() => {
                  trackSnipRadarEvent("snipradar_growth_plan_generate_click");
                  generateMutation.mutate();
                }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating your plan…
                  </>
                ) : hasPlan ? (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Regenerate Plan
                  </>
                ) : (
                  <>
                    Generate Your Growth Plan
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>

          {generateMutation.isError ? (
            <p className="mt-3 text-xs text-destructive">
              {generateMutation.error?.message ?? "Something went wrong. Please try again."}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Phase cards */}
      {isGenerating ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <PhaseSkeleton key={i} />
          ))}
        </div>
      ) : hasPlan && plan ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {plan.phases.map((phase, i) => (
            <PhaseCard key={phase.name} phase={phase} index={i} />
          ))}
        </div>
      ) : (
        /* Pre-generate teaser — static preview to show the format */
        <div className="grid gap-3 opacity-50 lg:grid-cols-3">
          {[
            { name: "Phase 1: Foundation", window: "Week 1–2" },
            { name: "Phase 2: Content Flywheel", window: "Week 3–6" },
            { name: "Phase 3: Amplification", window: "Week 7+" },
          ].map((p, i) => {
            const Icon = PHASE_ICONS[i] ?? Target;
            const colorClass = PHASE_COLORS[i] ?? PHASE_COLORS[0];
            return (
              <Card key={p.name} className="border-border/70 blur-[1px]">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {p.window}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {[1, 2, 3].map((k) => (
                      <div
                        key={k}
                        className="h-3 rounded bg-muted/80"
                        style={{ width: `${70 + k * 8}%` }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
