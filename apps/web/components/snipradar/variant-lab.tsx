"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Copy, Loader2, Sparkles, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SnipRadarBillingGateCard } from "@/components/snipradar/billing-gate-card";
import { useToast } from "@/components/ui/use-toast";
import { getSnipRadarBillingGateDetails } from "@/lib/snipradar/billing-gates";
import {
  parseSnipRadarApiError,
  toSnipRadarApiError,
} from "@/lib/snipradar/client-errors";
import { trackSnipRadarEvent } from "@/lib/snipradar/events";
import { cn } from "@/lib/utils";

type VariantObjective = "balanced" | "reach" | "replies" | "follows" | "conversion";

type VariantCandidate = {
  id: string;
  label: string;
  strategyFocus: string;
  text: string;
  reasoning: string;
  prediction: {
    score: number;
    breakdown: {
      hook: number;
      emotion: number;
      share: number;
      reply: number;
      timing: number;
    };
    suggestion: string;
  };
  objectiveScores: Record<VariantObjective, number>;
  winnerReasons: string[];
  isBaseline?: boolean;
};

type VariantLabResponse = {
  objective: VariantObjective;
  summary: string;
  recommendedVariantId: string | null;
  variants: VariantCandidate[];
};

const OBJECTIVES: Array<{ id: VariantObjective; label: string; help: string }> = [
  { id: "balanced", label: "Balanced", help: "Best overall pre-publish choice" },
  { id: "reach", label: "Reach", help: "Prioritize scroll-stop and shares" },
  { id: "replies", label: "Replies", help: "Optimize for conversation" },
  { id: "follows", label: "Follows", help: "Lean into authority and trust" },
  { id: "conversion", label: "Conversion", help: "Push clicks, waitlist, or CTA" },
];

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 65) return "text-amber-400";
  return "text-rose-400";
}

export function VariantLab({
  text,
  niche,
  followerCount,
  onApplyVariant,
}: {
  text: string;
  niche?: string;
  followerCount?: number;
  onApplyVariant: (variant: { text: string; score: number; label: string }) => void;
}) {
  const { toast } = useToast();
  const [objective, setObjective] = useState<VariantObjective>("balanced");
  const [lastRequestedText, setLastRequestedText] = useState("");
  const trimmedText = text.trim();
  const isOutdated = Boolean(lastRequestedText) && lastRequestedText !== trimmedText;

  const variantMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar/drafts/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmedText,
          niche,
          followerCount,
          objective,
        }),
      });
      if (!res.ok) {
        throw await parseSnipRadarApiError(res, "Failed to generate variants");
      }
      return (await res.json()) as VariantLabResponse;
    },
    onSuccess: () => {
      setLastRequestedText(trimmedText);
      trackSnipRadarEvent("snipradar_variant_lab_generate", {
        objective,
      });
    },
  });

  useEffect(() => {
    if (!variantMutation.data) return;
    if (variantMutation.data.objective !== objective) {
      variantMutation.reset();
    }
  }, [objective, variantMutation]);

  const gateDetails = getSnipRadarBillingGateDetails(
    variantMutation.error
      ? toSnipRadarApiError(variantMutation.error, "Failed to generate variants")
      : null
  );

  const canGenerate = trimmedText.length >= 20;
  const recommendedId = variantMutation.data?.recommendedVariantId ?? null;

  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4.5 w-4.5 text-emerald-500" />
              Variant Lab
            </CardTitle>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Generate multiple publish-ready variants, compare them by objective, and push the winner back into Draft
              Studio.
            </p>
          </div>
          <Button
            className="gap-2 self-start"
            disabled={!canGenerate || variantMutation.isPending}
            onClick={() => variantMutation.mutate()}
          >
            {variantMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Run Variant Lab
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {OBJECTIVES.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={objective === item.id ? "default" : "outline"}
              className="h-8"
              onClick={() => setObjective(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {OBJECTIVES.find((item) => item.id === objective)?.help}
        </p>

        {!canGenerate ? (
          <div className="rounded-xl border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
            Write at least 20 characters in Draft Studio to compare variants.
          </div>
        ) : null}

        {gateDetails ? (
          <SnipRadarBillingGateCard details={gateDetails} compact />
        ) : null}

        {variantMutation.error && !gateDetails ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {(variantMutation.error as Error).message}
          </div>
        ) : null}

        {isOutdated ? (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            The editor changed after the last run. Rerun Variant Lab to compare the latest draft.
          </div>
        ) : null}

        {variantMutation.data ? (
          <>
            <div className="rounded-xl border border-border/70 bg-background/40 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-medium">Decision summary</p>
                  <p className="mt-1 text-sm text-muted-foreground">{variantMutation.data.summary}</p>
                </div>
                <Badge variant="outline" className="self-start capitalize">
                  Objective: {variantMutation.data.objective}
                </Badge>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {variantMutation.data.variants.map((variant) => {
                const isRecommended = variant.id === recommendedId;
                const objectiveScore = variant.objectiveScores[objective];

                return (
                  <div
                    key={variant.id}
                    className={cn(
                      "rounded-2xl border bg-background/60 p-4 transition-colors",
                      isRecommended ? "border-emerald-500/40 shadow-[0_0_0_1px_rgba(16,185,129,0.18)]" : "border-border/70"
                    )}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{variant.label}</p>
                        {variant.isBaseline ? <Badge variant="secondary">Baseline</Badge> : null}
                        {isRecommended ? (
                          <Badge variant="success" className="gap-1">
                            <Trophy className="h-3 w-3" />
                            Recommended
                          </Badge>
                        ) : null}
                      </div>

                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{variant.strategyFocus}</p>
                      <p className="rounded-xl border border-border/70 bg-card/50 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                        {variant.text}
                      </p>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-border/70 bg-card/40 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Objective</p>
                          <p className={cn("mt-1 text-xl font-semibold", scoreTone(objectiveScore))}>{objectiveScore}</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-card/40 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Overall</p>
                          <p className={cn("mt-1 text-xl font-semibold", scoreTone(variant.prediction.score))}>
                            {variant.prediction.score}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-card/40 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Best signal</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {Object.entries(variant.prediction.breakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "hook"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {variant.winnerReasons.map((reason) => (
                          <Badge key={`${variant.id}-${reason}`} variant="outline" className="text-[10px]">
                            {reason}
                          </Badge>
                        ))}
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Why this version</p>
                        <p className="text-sm text-muted-foreground">{variant.reasoning}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Improvement suggestion</p>
                        <p className="text-sm text-muted-foreground">{variant.prediction.suggestion || "Ready to test as-is."}</p>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            onApplyVariant({
                              text: variant.text,
                              score: variant.prediction.score,
                              label: variant.label,
                            });
                            trackSnipRadarEvent("snipradar_variant_lab_apply", {
                              objective,
                              variantId: variant.id,
                              recommended: isRecommended,
                            });
                            toast({
                              title: "Variant applied",
                              description: `${variant.label} is now loaded into Draft Studio.`,
                            });
                          }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Apply to editor
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={async () => {
                            await navigator.clipboard.writeText(variant.text);
                            toast({ title: "Variant copied" });
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
