"use client";

import {
  AlertTriangle,
  BadgeCheck,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileText,
  Flame,
  Layers3,
  Loader2,
  RadioTower,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProjectClip } from "@/components/repurpose/types";

export type BoundaryConfidence = "high" | "medium" | "low";
export type TranscriptPrecision =
  | "word"
  | "segment"
  | "diarized_segment"
  | "approximate"
  | "none"
  | string;

export type AutoHighlightsAnalytics = {
  providerTranscription?: "openai" | string;
  providerReasoning?: "openrouter" | string;
  transcriptionModel?: string;
  rerankModel?: string;
  viralityModel?: string;
  transcriptPrecision?: TranscriptPrecision;
  candidatesGenerated?: number;
  candidatesReranked?: number;
  clipsCreated?: number;
  averageViralityScore?: number | null;
  previewFailures?: number;
  lowPrecisionWarning?: string | null;
  clipLengthPreset?: "short" | "balanced" | "detailed" | string;
  qualityMode?: "fast" | "balanced" | "best" | string;
  clipIntent?: string;
  selectedRerankModel?: string;
  rerankFallbackModels?: string[];
  selectedViralityModel?: string;
  selectedMetadataModel?: string;
  modelOverrideUsed?: boolean;
  modelSelectionReason?: string;
  clipPolicy?: {
    minMs: number;
    idealMs: number;
    maxMs: number;
  };
  boundaryConfidenceCounts?: {
    high: number;
    medium: number;
    low: number;
  };
  averageClipDurationSec?: number | null;
};

export function ProviderBadge({
  provider,
  label,
}: {
  provider: "openai" | "openrouter" | "local" | string;
  label?: string;
}) {
  const tone =
    provider === "openai"
      ? "border-sky-400/25 bg-sky-400/10 text-sky-200"
      : provider === "openrouter"
        ? "border-violet-400/25 bg-violet-400/10 text-violet-200"
        : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  const Icon =
    provider === "openai" ? RadioTower : provider === "openrouter" ? BrainCircuit : WandSparkles;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      <Icon className="h-3 w-3" />
      {label ?? provider}
    </span>
  );
}

export function TranscriptPrecisionBadge({
  precision,
}: {
  precision?: TranscriptPrecision | null;
}) {
  const value = precision ?? "none";
  const label =
    value === "word"
      ? "Word-level"
      : value === "segment" || value === "diarized_segment"
        ? "Segment-level"
        : "Low precision";
  const tone =
    value === "word"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
      : value === "segment" || value === "diarized_segment"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
        : "border-red-400/25 bg-red-400/10 text-red-200";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      <FileText className="h-3 w-3" />
      {label}
    </span>
  );
}

export function BoundaryConfidenceBadge({
  confidence,
}: {
  confidence?: BoundaryConfidence | null;
}) {
  const value = confidence ?? "low";
  const tone =
    value === "high"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
      : value === "medium"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
        : "border-red-400/25 bg-red-400/10 text-red-200";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize",
        tone,
      )}
    >
      {value === "high" ? (
        <BadgeCheck className="h-3 w-3" />
      ) : (
        <AlertTriangle className="h-3 w-3" />
      )}
      {value} boundary
    </span>
  );
}

export function ViralityScoreBadge({ score }: { score?: number | null }) {
  if (score == null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
        <Flame className="h-3 w-3" />
        Unscored
      </span>
    );
  }

  const tone =
    score >= 80
      ? "from-emerald-500 to-cyan-500"
      : score >= 60
        ? "from-amber-500 to-orange-500"
        : "from-orange-500 to-red-500";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r px-2.5 py-1 text-[11px] font-bold text-white shadow-sm",
        tone,
      )}
    >
      <Flame className="h-3 w-3" />
      {Math.round(score)}/100
    </span>
  );
}

export function ClipTypeBadge({ type }: { type?: string | null }) {
  const normalized = type?.replace(/_/g, " ") || "AI clip";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold capitalize text-cyan-200">
      <Layers3 className="h-3 w-3" />
      {normalized}
    </span>
  );
}

export function PlatformFitChips({
  platformFit,
}: {
  platformFit?: Record<string, unknown> | null;
}) {
  const platforms = [
    ["youtubeShorts", "Shorts"],
    ["instagramReels", "Reels"],
    ["tiktok", "TikTok"],
    ["x", "X"],
  ] as const;

  return (
    <div className="flex flex-wrap gap-1.5">
      {platforms.map(([key, label]) => {
        const score =
          typeof platformFit?.[key] === "number" ? Math.round(platformFit[key] as number) : null;
        const strong = score !== null && score >= 75;
        return (
          <span
            key={key}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              strong
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                : "border-border/60 bg-muted/30 text-muted-foreground",
            )}
          >
            {label}
            {score !== null ? ` ${score}` : ""}
          </span>
        );
      })}
    </div>
  );
}

export function ReviewStatusBadge({
  status,
}: {
  status: "needs_review" | "approved" | "rejected" | "export_ready";
}) {
  const copy = {
    needs_review: "Needs review",
    approved: "Approved",
    rejected: "Rejected",
    export_ready: "Export ready",
  }[status];
  const tone = {
    needs_review: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    approved: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    rejected: "border-red-400/25 bg-red-400/10 text-red-200",
    export_ready: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  }[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      {status === "needs_review" ? (
        <Clock3 className="h-3 w-3" />
      ) : (
        <CheckCircle2 className="h-3 w-3" />
      )}
      {copy}
    </span>
  );
}

export function ProcessingStepTimeline({
  active,
  complete = false,
}: {
  active?: boolean;
  complete?: boolean;
}) {
  const steps = [
    "Preparing media",
    "Transcribing with OpenAI",
    "Detecting scenes",
    "Generating candidates",
    "Ranking with OpenRouter",
    "Refining boundaries",
    "Creating previews",
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">AI clipping pipeline</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Visible progress from source media to editable clips.
          </p>
        </div>
        {active ? (
          <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
        ) : complete ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
        ) : (
          <Sparkles className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="grid gap-2 md:grid-cols-7">
        {steps.map((step, index) => {
          const isLit = complete || (active && index <= 4);
          return (
            <div
              key={step}
              className="flex min-h-20 flex-col justify-between rounded-xl border border-border/60 bg-black/20 p-3"
            >
              <div
                className={cn(
                  "h-1.5 w-8 rounded-full",
                  isLit ? "bg-gradient-to-r from-emerald-400 to-cyan-400" : "bg-muted",
                )}
              />
              <p
                className={cn(
                  "mt-3 text-[11px] font-semibold leading-4",
                  isLit ? "text-foreground" : "text-muted-foreground/50",
                )}
              >
                {step}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function QualityDiagnosticsPanel({
  analytics,
}: {
  analytics?: AutoHighlightsAnalytics | null;
}) {
  if (!analytics) return null;
  const boundary = analytics.boundaryConfidenceCounts;
  const stats = [
    ["Candidates", analytics.candidatesGenerated],
    ["Reranked", analytics.candidatesReranked],
    ["Clips", analytics.clipsCreated],
    [
      "Avg score",
      analytics.averageViralityScore == null ? null : Math.round(analytics.averageViralityScore),
    ],
    [
      "Avg length",
      analytics.averageClipDurationSec == null ? null : `${analytics.averageClipDurationSec}s`,
    ],
    ["Preview fails", analytics.previewFailures ?? 0],
  ];

  return (
    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.045] p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Quality diagnostics</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generated from the latest auto-highlight run.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TranscriptPrecisionBadge precision={analytics.transcriptPrecision} />
          <ProviderBadge provider="openai" label="OpenAI Timing" />
          <ProviderBadge provider="openrouter" label="OpenRouter Ranking" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border/60 bg-black/20 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
              {label}
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">{value ?? "N/A"}</p>
          </div>
        ))}
      </div>
      {boundary ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(["high", "medium", "low"] as const).map((key) => (
            <div key={key} className="rounded-xl border border-border/60 bg-black/20 p-3">
              <BoundaryConfidenceBadge confidence={key} />
              <p className="mt-2 text-2xl font-semibold">{boundary[key]}</p>
            </div>
          ))}
        </div>
      ) : null}
      {analytics.lowPrecisionWarning ? (
        <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100">
          {analytics.lowPrecisionWarning}
        </div>
      ) : null}
      {(analytics.qualityMode || analytics.clipIntent || analytics.selectedRerankModel) && (
        <div className="mt-3 rounded-xl border border-violet-400/20 bg-violet-400/[0.06] p-3 text-xs leading-5 text-violet-100/80">
          <span className="font-semibold text-violet-100">Model routing:</span>{" "}
          {analytics.qualityMode ?? "balanced"} quality
          {analytics.clipIntent ? ` · ${analytics.clipIntent}` : ""}
          {analytics.selectedRerankModel ? ` · rerank ${analytics.selectedRerankModel}` : ""}
          {analytics.modelOverrideUsed ? " · override used" : ""}
          {analytics.modelSelectionReason ? (
            <span className="block text-violet-100/60">{analytics.modelSelectionReason}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function EmptyStateCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/60 bg-white/[0.035] p-8 text-center">
      <div className="absolute inset-x-12 top-0 h-20 rounded-full bg-gradient-to-r from-emerald-400/15 via-cyan-400/10 to-violet-400/10 blur-3xl" />
      <div className="relative mx-auto max-w-lg">
        <Sparkles className="mx-auto h-8 w-8 text-emerald-300/70" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

export function getClipMetadata(clip?: ProjectClip | null) {
  const metadata = clip?.viralityFactors?.metadata ?? {};
  const stringValue = (key: string) =>
    typeof metadata[key] === "string" ? (metadata[key] as string) : null;
  return {
    boundaryConfidence: stringValue("boundaryConfidence") as BoundaryConfidence | null,
    boundaryPrecision: stringValue("boundaryPrecision") as TranscriptPrecision | null,
    candidateType: stringValue("candidateType"),
    viralReason: stringValue("viralReason"),
    boundaryReasons: Array.isArray(metadata.boundaryReasons)
      ? (metadata.boundaryReasons.filter((item) => typeof item === "string") as string[])
      : [],
    candidateReasons: Array.isArray(metadata.candidateReasons)
      ? (metadata.candidateReasons.filter((item) => typeof item === "string") as string[])
      : [],
    editingNotes: Array.isArray(metadata.editingNotes)
      ? (metadata.editingNotes.filter((item) => typeof item === "string") as string[])
      : [],
    deterministicScore:
      typeof metadata.deterministicScore === "number" ? metadata.deterministicScore : null,
    selectionScore: typeof metadata.selectionScore === "number" ? metadata.selectionScore : null,
    llmScore: typeof metadata.llmScore === "number" ? metadata.llmScore : null,
    candidateId: stringValue("candidateId"),
    platformFit:
      typeof metadata.platformFit === "object" && metadata.platformFit !== null
        ? (metadata.platformFit as Record<string, unknown>)
        : null,
    providerTranscription: stringValue("providerTranscription"),
    providerReasoning: stringValue("providerReasoning"),
  };
}
