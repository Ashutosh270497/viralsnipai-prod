"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PredictionResponse {
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
  objectiveScores: {
    balanced: number;
    reach: number;
    replies: number;
    follows: number;
    conversion: number;
  };
}

function scoreClass(score: number) {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  return "text-rose-500";
}

function barClass(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

export function TweetPredictor({
  defaultNiche = "tech",
  followerCount,
}: {
  defaultNiche?: string;
  followerCount?: number;
}) {
  const [text, setText] = useState("");
  const [niche, setNiche] = useState(defaultNiche);
  const [prediction, setPrediction] = useState<PredictionResponse["prediction"] | null>(null);
  const [objectiveScores, setObjectiveScores] = useState<PredictionResponse["objectiveScores"] | null>(null);
  const [rewrite, setRewrite] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const predictMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar/drafts/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, niche, followerCount }),
      });
      const payload = (await res.json()) as PredictionResponse | { error?: string };
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error ?? "Failed to predict");
      }
      return payload as PredictionResponse;
    },
    onSuccess: (payload) => {
      setPrediction(payload.prediction);
      setObjectiveScores(payload.objectiveScores);
    },
  });

  const rewriteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, tone: "Bold" }),
      });
      const payload = (await res.json()) as { rewritten?: string; error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to enhance text");
      }
      return payload;
    },
    onSuccess: (payload) => {
      if (payload.rewritten) {
        setRewrite(payload.rewritten);
      }
    },
  });

  const characterCount = useMemo(() => text.length, [text]);
  const canSubmit = text.trim().length >= 10;

  const breakdownRows = prediction
    ? [
        { label: "Hook strength", value: prediction.breakdown.hook },
        { label: "Emotional pull", value: prediction.breakdown.emotion },
        { label: "Share potential", value: prediction.breakdown.share },
        { label: "Reply potential", value: prediction.breakdown.reply },
        { label: "Timing relevance", value: prediction.breakdown.timing },
      ]
    : [];

  const copyOutput = async () => {
    const output = rewrite ?? text;
    if (!output.trim()) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AI Tweet Predictor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, 280))}
              placeholder="Paste or write your tweet draft..."
              className="min-h-[180px] text-sm leading-relaxed"
            />
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Niche</label>
              <input
                value={niche}
                onChange={(event) => setNiche(event.target.value.toLowerCase())}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="tech"
              />
              <div
                className={cn(
                  "rounded-md border border-border px-2 py-1.5 text-xs",
                  characterCount > 260 ? "text-amber-500" : "text-muted-foreground",
                )}
              >
                {characterCount}/280 chars
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => predictMutation.mutate()}
              disabled={!canSubmit || predictMutation.isPending}
              className="gap-1.5"
            >
              {predictMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Predict
            </Button>
            <Button
              variant="outline"
              onClick={() => rewriteMutation.mutate()}
              disabled={!canSubmit || rewriteMutation.isPending}
              className="gap-1.5"
            >
              {rewriteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Enhance
            </Button>
            <Button variant="ghost" onClick={copyOutput} disabled={!text.trim()} className="gap-1.5">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          {predictMutation.error ? (
            <p className="text-xs text-destructive">{(predictMutation.error as Error).message}</p>
          ) : null}
          {rewriteMutation.error ? (
            <p className="text-xs text-destructive">{(rewriteMutation.error as Error).message}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            Prediction Output
            {prediction ? (
              <Badge variant="outline" className={cn("text-xs", scoreClass(prediction.score))}>
                Score {prediction.score}/100
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {prediction ? (
            <>
              {objectiveScores ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(objectiveScores).map(([key, value]) => (
                    <Badge key={key} variant="outline" className={cn("text-xs capitalize", scoreClass(value))}>
                      {key} {value}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <div className="space-y-2">
                {breakdownRows.map((row) => (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className={scoreClass(row.value)}>{row.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all", barClass(row.value))}
                        style={{ width: `${Math.max(2, row.value)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {prediction.suggestion ? (
                <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">AI suggestion</p>
                  <p className="mt-1 leading-relaxed">{prediction.suggestion}</p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Run prediction to see score breakdown and optimization suggestion.
            </p>
          )}

          <div className="rounded-md border border-border bg-muted/20 p-3 text-sm leading-relaxed whitespace-pre-wrap">
            {(rewrite ?? text) || "Enhanced output appears here after Predict/Enhance."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
