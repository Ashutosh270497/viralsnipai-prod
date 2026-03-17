"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivationSummary } from "@/types/dashboard";

export function ActivationProgressCard({
  activation,
}: {
  activation: ActivationSummary;
}) {
  const router = useRouter();

  return (
    <Card className="border-border/50 bg-card/80 p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {activation.ecosystemLabel}
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            {activation.activated ? "Activated" : "Activation in progress"}
          </h3>
        </div>
        {activation.activated ? (
          <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        ) : (
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {activation.completedSteps} of {activation.totalSteps} checkpoints complete
          </span>
          <span className="font-semibold text-foreground">{activation.progressPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
            style={{ width: `${activation.progressPct}%` }}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <p className="text-foreground">
          <span className="font-semibold">Activation event:</span>{" "}
          {activation.activationEventLabel}
        </p>
        <p className="text-muted-foreground">{activation.ahaMoment}</p>
        <p className="text-xs text-muted-foreground/80">{activation.successThreshold}</p>
        {activation.activationCompletedAt ? (
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Activated {formatDistanceToNow(new Date(activation.activationCompletedAt), { addSuffix: true })}
          </p>
        ) : null}
      </div>

      {!activation.activated && activation.nextStepLabel ? (
        <Button
          className="mt-4"
          size="sm"
          onClick={() => {
            if (activation.nextStepUrl) {
              router.push(activation.nextStepUrl);
            }
          }}
          disabled={!activation.nextStepUrl}
        >
          {activation.nextStepLabel}
        </Button>
      ) : null}
    </Card>
  );
}
