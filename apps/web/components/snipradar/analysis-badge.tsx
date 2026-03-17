"use client";

import { cn } from "@/lib/utils";

const hookTypeConfig: Record<string, { label: string; color: string }> = {
  question: { label: "Question", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  stat: { label: "Stat", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  contrarian: { label: "Contrarian", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  story: { label: "Story", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  list: { label: "List", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  challenge: { label: "Challenge", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
};

const formatConfig: Record<string, { label: string; color: string }> = {
  "one-liner": { label: "One-liner", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  thread: { label: "Thread", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  listicle: { label: "Listicle", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  story: { label: "Story", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  "hot-take": { label: "Hot Take", color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  "how-to": { label: "How-to", color: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
};

const emotionConfig: Record<string, { label: string; color: string }> = {
  curiosity: { label: "Curiosity", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  anger: { label: "Anger", color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  awe: { label: "Awe", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  humor: { label: "Humor", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
  fomo: { label: "FOMO", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  controversy: { label: "Controversy", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
};

function AnalysisBadge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium", colorClass)}>
      {label}
    </span>
  );
}

export function HookTypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const config = hookTypeConfig[type];
  return (
    <AnalysisBadge
      label={config?.label ?? type}
      colorClass={config?.color ?? "bg-secondary text-secondary-foreground"}
    />
  );
}

export function FormatBadge({ format }: { format: string | null }) {
  if (!format) return null;
  const config = formatConfig[format];
  return (
    <AnalysisBadge
      label={config?.label ?? format}
      colorClass={config?.color ?? "bg-secondary text-secondary-foreground"}
    />
  );
}

export function EmotionBadge({ trigger }: { trigger: string | null }) {
  if (!trigger) return null;
  const config = emotionConfig[trigger];
  return (
    <AnalysisBadge
      label={config?.label ?? trigger}
      colorClass={config?.color ?? "bg-secondary text-secondary-foreground"}
    />
  );
}

export function ViralScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;

  const getScoreStyle = (s: number) => {
    if (s >= 70) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20";
    if (s >= 40) return "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20";
    return "bg-slate-500/10 text-slate-500 ring-1 ring-slate-500/10";
  };

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums", getScoreStyle(score))}>
      <ScoreIcon score={score} />
      {score}
    </span>
  );
}

function ScoreIcon({ score }: { score: number }) {
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#94a3b8";
  const pct = Math.min(score, 100);
  const r = 5;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <circle cx="7" cy="7" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.2} />
      <circle
        cx="7"
        cy="7"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
}
