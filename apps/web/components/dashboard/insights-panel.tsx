"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InsightItem, OnboardingStep } from "@/types/dashboard";
import { useRouter } from "next/navigation";
import {
  Lightbulb,
  TrendingUp,
  Target,
  AlertTriangle,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightsPanelProps {
  insights: InsightItem[];
  onboarding?: OnboardingStep[];
}

const insightIcons = {
  tip: Lightbulb,
  trend: TrendingUp,
  opportunity: Target,
  warning: AlertTriangle,
};

const insightIconClasses = {
  tip: "text-primary bg-primary/10",
  trend: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
  opportunity: "text-violet-600 bg-violet-500/10 dark:text-violet-400",
  warning: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
};

export function InsightsPanel({ insights, onboarding }: InsightsPanelProps) {
  const router = useRouter();

  return (
    <div className="space-y-5">
      {/* Insights */}
      <Card className="border-border/50 bg-card/80 p-5 backdrop-blur-sm">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Insights & Opportunities
        </h3>
        <div className="mt-4 space-y-2.5">
          {insights.map((insight) => {
            const Icon = insightIcons[insight.type];
            const iconClass = insightIconClasses[insight.type];

            return (
              <div
                key={insight.id}
                className="flex items-start gap-3 rounded-2xl border border-border/40 bg-secondary/20 p-3.5"
              >
                <div className={cn("shrink-0 rounded-xl p-2", iconClass)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-foreground">{insight.title}</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">{insight.description}</p>
                  {insight.actionLabel && insight.actionUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                      onClick={() => router.push(insight.actionUrl!)}
                    >
                      {insight.actionLabel} →
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Onboarding Checklist */}
      {onboarding && onboarding.some((step) => !step.completed) && (
        <Card className="border-border/50 bg-card/80 p-5 backdrop-blur-sm">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Getting Started
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Complete these steps to unlock the full power of ViralSnipAI
          </p>
          <div className="mt-4 space-y-2">
            {onboarding.map((step) => (
              <button
                key={step.id}
                onClick={() => step.url && router.push(step.url)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition-all duration-150",
                  step.completed
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-border/50 bg-secondary/20 hover:border-primary/30 hover:bg-primary/5"
                )}
              >
                {step.completed ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-medium",
                        step.completed
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-foreground"
                      )}
                    >
                      {step.label}
                    </span>
                    {step.emphasis === "activation" ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Activation
                      </span>
                    ) : step.emphasis === "aha" ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        Aha
                      </span>
                    ) : null}
                  </div>
                  {step.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-primary/8 p-3">
            <p className="text-xs font-medium text-primary">
              {onboarding.filter((s) => s.completed).length} of {onboarding.length} steps completed
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
