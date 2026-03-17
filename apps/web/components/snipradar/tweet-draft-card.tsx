"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Pencil, X, Loader2, Check, ExternalLink, ChevronDown, Sparkles, Clock, CalendarClock, Zap, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SnipRadarBillingGateCard } from "@/components/snipradar/billing-gate-card";
import { Textarea } from "@/components/ui/textarea";
import { getSnipRadarBillingGateDetails } from "@/lib/snipradar/billing-gates";
import {
  parseSnipRadarApiError,
  toSnipRadarApiError,
} from "@/lib/snipradar/client-errors";
import { cn } from "@/lib/utils";
import {
  HookTypeBadge,
  FormatBadge,
  EmotionBadge,
  ViralScoreBadge,
} from "./analysis-badge";

interface TweetDraftCardProps {
  draft: {
    id: string;
    text: string;
    hookType: string | null;
    format: string | null;
    emotionalTrigger: string | null;
    viralPrediction: number | null;
    aiReasoning: string | null;
    status: string;
    scheduledFor?: string | null;
    postedTweetId?: string | null;
    createdAt: string;
  };
  xUsername?: string;
}

function getMinScheduleDateTime(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5); // At least 5 min in the future
  // Format as local datetime-local value: YYYY-MM-DDTHH:MM
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatScheduledTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) return "Posting soon...";
  if (diff < 60 * 60 * 1000) {
    const mins = Math.ceil(diff / (60 * 1000));
    return `in ${mins}m`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const mins = Math.ceil((diff % (60 * 60 * 1000)) / (60 * 1000));
    return `in ${hours}h ${mins}m`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function TweetDraftCard({ draft, xUsername }: TweetDraftCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(draft.text);
  const [showReasoning, setShowReasoning] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [prediction, setPrediction] = useState<{
    score: number;
    breakdown: { hook: number; emotion: number; share: number; reply: number; timing: number };
    suggestion: string;
  } | null>(null);
  const [rewrittenText, setRewrittenText] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const scheduleMutation = useMutation({
    mutationFn: async (scheduledFor: string) => {
      const res = await fetch(`/api/snipradar/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "scheduled", scheduledFor }),
      });
      if (!res.ok) {
        throw await parseSnipRadarApiError(res, "Failed to schedule");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowScheduler(false);
      setScheduleDateTime("");
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-summary"] });
    },
  });

  const unscheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/snipradar/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft", scheduledFor: null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to unschedule");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-summary"] });
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/snipradar/drafts/${draft.id}/post`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to post");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-summary"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { text?: string; status?: string }) => {
      const res = await fetch(`/api/snipradar/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error ?? "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-summary"] });
    },
  });

  const predictMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar/drafts/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft.text }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to predict");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setPrediction(data.prediction);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/snipradar/drafts/${draft.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-summary"] });
    },
  });

  const rewriteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft.text }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to rewrite");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setRewrittenText(data.rewritten);
    },
  });

  const isPosted = draft.status === "posted";
  const isScheduled = draft.status === "scheduled";
  const isRejected = draft.status === "rejected";
  const isPending = postMutation.isPending || updateMutation.isPending || scheduleMutation.isPending || unscheduleMutation.isPending || predictMutation.isPending || rewriteMutation.isPending;
  const schedulingGateDetails = getSnipRadarBillingGateDetails(
    scheduleMutation.error ? toSnipRadarApiError(scheduleMutation.error, "Failed to schedule") : null
  );

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden transition-colors",
        isPosted && "border-emerald-500/20 bg-emerald-500/5",
        isScheduled && "border-blue-500/20 bg-blue-500/5",
        isRejected && "opacity-50",
        !isPosted && !isScheduled && !isRejected && "border-border bg-card hover:border-border/80"
      )}
    >
      <div className="p-4 space-y-3">
        {/* Tweet Text / Edit Mode */}
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="min-h-[80px] text-sm"
              maxLength={280}
            />
            <div className="flex items-center justify-between">
              <span className={cn("text-xs", editText.length > 260 ? "text-amber-500" : "text-muted-foreground")}>
                {editText.length}/280
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditText(draft.text);
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate({ text: editText })}
                  disabled={!editText.trim() || editText === draft.text || isPending}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{draft.text}</p>
        )}

        {/* Analysis Badges Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <HookTypeBadge type={draft.hookType} />
            <FormatBadge format={draft.format} />
            <EmotionBadge trigger={draft.emotionalTrigger} />
            <ViralScoreBadge score={draft.viralPrediction} />
          </div>
        </div>

        {/* Collapsible AI Reasoning */}
        {draft.aiReasoning && !isEditing && (
          <div>
            <button
              type="button"
              onClick={() => setShowReasoning(!showReasoning)}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Sparkles className="h-3 w-3" />
              AI reasoning
              <ChevronDown className={cn("h-3 w-3 transition-transform", showReasoning && "rotate-180")} />
            </button>
            {showReasoning && (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {draft.aiReasoning}
              </p>
            )}
          </div>
        )}

        {/* Status / Actions */}
        {isPosted ? (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Posted
            </span>
            {draft.postedTweetId && xUsername && (
              <a
                href={`https://x.com/${xUsername}/status/${draft.postedTweetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                View on X
              </a>
            )}
          </div>
        ) : isScheduled ? (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Scheduled {draft.scheduledFor ? formatScheduledTime(draft.scheduledFor) : ""}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => unscheduleMutation.mutate()}
                  disabled={isPending}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  {unscheduleMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Unschedule"
                  )}
                </Button>
              </div>
            </div>
            {draft.scheduledFor && (
              <p className="text-[11px] text-muted-foreground">
                {new Date(draft.scheduledFor).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        ) : isRejected ? (
          <span className="text-xs text-muted-foreground">Skipped</span>
        ) : (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => postMutation.mutate()}
                disabled={isPending}
                className="gap-1.5"
              >
                {postMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Post Now
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowScheduler(!showScheduler)}
                disabled={isPending}
                className="gap-1.5"
              >
                <Clock className="h-3.5 w-3.5" />
                Schedule
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                disabled={isPending}
                className="gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => predictMutation.mutate()}
                disabled={isPending || predictMutation.isPending}
                className="gap-1.5"
              >
                {predictMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                Predict
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => rewriteMutation.mutate()}
                disabled={isPending || rewriteMutation.isPending}
                className="gap-1.5"
              >
                {rewriteMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                Rewrite
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={isPending || deleteMutation.isPending}
                className="ml-auto text-muted-foreground hover:text-destructive"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            {/* Schedule Picker */}
            {showScheduler && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5">
                <CalendarClock className="h-4 w-4 text-blue-500 shrink-0" />
                <input
                  type="datetime-local"
                  min={getMinScheduleDateTime()}
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (!scheduleDateTime) return;
                    const utc = new Date(scheduleDateTime).toISOString();
                    scheduleMutation.mutate(utc);
                  }}
                  disabled={!scheduleDateTime || scheduleMutation.isPending}
                  className="shrink-0 gap-1.5"
                >
                  {scheduleMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowScheduler(false);
                    setScheduleDateTime("");
                  }}
                  className="h-8 w-8 p-0 shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Prediction Results */}
            {prediction && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    Viral Score: {prediction.score}/100
                  </span>
                  <button
                    type="button"
                    onClick={() => setPrediction(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {(Object.entries(prediction.breakdown) as [string, number][]).map(([key, val]) => (
                    <div key={key} className="space-y-1">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all"
                          style={{ width: `${val}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground capitalize block text-center">
                        {key}
                      </span>
                    </div>
                  ))}
                </div>
                {prediction.suggestion && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {prediction.suggestion}
                  </p>
                )}
              </div>
            )}

            {predictMutation.error && (
              <p className="text-xs text-red-500">
                {(predictMutation.error as Error).message}
              </p>
            )}

            {/* Rewritten Text */}
            {rewrittenText && (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <Wand2 className="h-3.5 w-3.5 text-violet-500" />
                    Rewritten
                  </span>
                  <button
                    type="button"
                    onClick={() => setRewrittenText(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {rewrittenText}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      updateMutation.mutate({ text: rewrittenText });
                      setRewrittenText(null);
                    }}
                    disabled={isPending}
                    className="h-7 text-xs gap-1"
                  >
                    <Check className="h-3 w-3" />
                    Apply
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    {rewrittenText.length}/280
                  </span>
                </div>
              </div>
            )}

            {rewriteMutation.error && (
              <p className="text-xs text-red-500">
                {(rewriteMutation.error as Error).message}
              </p>
            )}

            {schedulingGateDetails ? (
              <SnipRadarBillingGateCard details={schedulingGateDetails} compact />
            ) : null}

            {scheduleMutation.error && !schedulingGateDetails && (
              <p className="text-xs text-red-500">
                {(scheduleMutation.error as Error).message}
              </p>
            )}
          </div>
        )}

        {(postMutation.error || updateMutation.error) && (
          <p className="text-xs text-red-500">
            {(postMutation.error as Error)?.message ??
              (updateMutation.error as Error)?.message}
          </p>
        )}
      </div>
    </div>
  );
}
