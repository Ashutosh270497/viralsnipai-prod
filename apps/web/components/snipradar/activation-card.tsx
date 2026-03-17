"use client";

import { AlertTriangle, CheckCircle2, Circle, Gauge } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSnipRadar } from "@/components/snipradar/snipradar-context";

export function SnipRadarActivationCard() {
  const { activation, unitEconomics } = useSnipRadar();

  return (
    <Card className="border-border/50 bg-card/80 p-5 backdrop-blur-sm">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {activation.ecosystemLabel}
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                {activation.activated ? "Activated" : "Activation in progress"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{activation.ahaMoment}</p>
            </div>
            <div
              className={cn(
                "rounded-xl p-2",
                activation.activated
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-primary/10 text-primary"
              )}
            >
              {activation.activated ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Gauge className="h-4 w-4" />
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{activation.activationEventLabel}</span>
              <span className="font-semibold text-foreground">{activation.progressPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${activation.progressPct}%` }}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {activation.steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "rounded-xl border p-3",
                  step.completed
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-border/50 bg-secondary/20"
                )}
              >
                <div className="flex items-start gap-2">
                  {step.completed ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{step.label}</p>
                      {step.kind === "activation" ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Activation
                        </span>
                      ) : step.kind === "aha" ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          Aha
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={cn(
                "h-4 w-4",
                unitEconomics.guardrailState === "high"
                  ? "text-red-500"
                  : unitEconomics.guardrailState === "watch"
                  ? "text-amber-500"
                  : "text-emerald-500"
              )}
            />
            <p className="text-sm font-semibold text-foreground">X API guardrails</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-xl border border-border/40 bg-background/60 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estimated reads / day</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {unitEconomics.estimatedDailyReadCalls}
              </p>
              <p className="text-xs text-muted-foreground">
                {unitEconomics.trackedAccounts} tracked accounts at the current fetch cadence
              </p>
            </div>
            <div className="rounded-xl border border-border/40 bg-background/60 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Guardrail state</p>
              <p
                className={cn(
                  "mt-1 text-2xl font-semibold capitalize",
                  unitEconomics.guardrailState === "high"
                    ? "text-red-500"
                    : unitEconomics.guardrailState === "watch"
                    ? "text-amber-500"
                    : "text-emerald-500"
                )}
              >
                {unitEconomics.guardrailState}
              </p>
              <p className="text-xs text-muted-foreground">{unitEconomics.packagingRecommendation}</p>
            </div>
          </div>

          {unitEconomics.reasons.length > 0 ? (
            <div className="mt-4 space-y-2">
              {unitEconomics.reasons.map((reason) => (
                <div
                  key={reason}
                  className="rounded-xl border border-border/40 bg-background/60 px-3 py-2 text-xs text-muted-foreground"
                >
                  {reason}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
