"use client";

import { useState } from "react";
import {
  Heart,
  Repeat2,
  MessageCircle,
  Eye,
  ExternalLink,
  ChevronDown,
  Lightbulb,
  BookOpen,
  Wand2,
  Loader2,
} from "lucide-react";
import {
  HookTypeBadge,
  FormatBadge,
  EmotionBadge,
  ViralScoreBadge,
} from "./analysis-badge";
import { cn } from "@/lib/utils";

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    const val = num / 1_000_000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}M`;
  }
  if (num >= 1_000) {
    const val = num / 1_000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}K`;
  }
  return num.toLocaleString();
}

interface ViralTweetCardProps {
  tweet: {
    id: string;
    tweetId: string;
    text: string;
    authorUsername: string;
    authorDisplayName: string;
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    hookType: string | null;
    format: string | null;
    emotionalTrigger: string | null;
    viralScore: number | null;
    whyItWorked: string | null;
    lessonsLearned: string[];
    publishedAt: string;
    isAnalyzed: boolean;
  };
  onRemix?: (tweet: { id: string; text: string; authorUsername: string }) => void;
  remixPending?: boolean;
}

export function ViralTweetCard({ tweet, onRemix, remixPending }: ViralTweetCardProps) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const hasAnalysis =
    tweet.whyItWorked || (tweet.lessonsLearned && tweet.lessonsLearned.length > 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 dark:border-white/[0.07] bg-gradient-to-br from-muted/40 dark:from-white/[0.04] to-transparent transition-all hover:border-border/80 dark:border-white/[0.12] hover:from-muted/60 dark:from-white/[0.06]">
      <div className="space-y-3 p-4">
        {/* Author row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25 ring-1 ring-white/[0.07] text-xs font-bold text-violet-300">
              {(tweet.authorUsername ?? tweet.authorDisplayName ?? "?")[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold">@{tweet.authorUsername ?? "unknown"}</span>
              <span className="ml-2 text-[11px] text-muted-foreground/40">
                {new Date(tweet.publishedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <ViralScoreBadge score={tweet.viralScore} />
            <a
              href={`https://x.com/${tweet.authorUsername}/status/${tweet.tweetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 dark:border-white/[0.07] bg-muted/30 dark:bg-white/[0.03] text-muted-foreground/40 transition-colors hover:border-border/70 dark:border-white/15 hover:bg-muted/60 dark:bg-white/[0.07] hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Tweet text */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
          {tweet.text}
        </p>

        {/* Metrics bar */}
        <div className="flex items-center gap-3 rounded-xl border border-border/30 dark:border-white/[0.05] bg-muted/20 dark:bg-white/[0.02] px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs text-rose-400/70">
            <Heart className="h-3.5 w-3.5" />
            {formatNumber(tweet.likes)}
          </span>
          <span className="h-3 w-px bg-muted/60 dark:bg-white/[0.08]" />
          <span className="flex items-center gap-1.5 text-xs text-emerald-400/70">
            <Repeat2 className="h-3.5 w-3.5" />
            {formatNumber(tweet.retweets)}
          </span>
          <span className="h-3 w-px bg-muted/60 dark:bg-white/[0.08]" />
          <span className="flex items-center gap-1.5 text-xs text-blue-400/70">
            <MessageCircle className="h-3.5 w-3.5" />
            {formatNumber(tweet.replies)}
          </span>
          {tweet.impressions > 0 && (
            <>
              <span className="h-3 w-px bg-muted/60 dark:bg-white/[0.08]" />
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground/40">
                <Eye className="h-3.5 w-3.5" />
                {formatNumber(tweet.impressions)}
              </span>
            </>
          )}
        </div>

        {/* Analysis badges */}
        {tweet.isAnalyzed && (
          <div className="flex flex-wrap gap-1.5">
            <HookTypeBadge type={tweet.hookType} />
            <FormatBadge format={tweet.format} />
            <EmotionBadge trigger={tweet.emotionalTrigger} />
          </div>
        )}

        {/* Remix button */}
        {onRemix && (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() =>
                onRemix({
                  id: tweet.id,
                  text: tweet.text,
                  authorUsername: tweet.authorUsername,
                })
              }
              disabled={Boolean(remixPending)}
              className="flex items-center gap-1.5 rounded-lg border border-purple-500/25 bg-purple-500/[0.08] px-3 py-1.5 text-[12px] font-semibold text-purple-400 transition-all hover:bg-purple-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {remixPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              Remix in my voice
            </button>
          </div>
        )}
      </div>

      {/* Collapsible analysis section */}
      {tweet.isAnalyzed && hasAnalysis && (
        <>
          <button
            type="button"
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-border/30 dark:border-white/[0.05] bg-white/[0.01] px-4 py-2 text-[11px] font-semibold text-muted-foreground/40 transition-colors hover:bg-muted/30 dark:bg-white/[0.03] hover:text-muted-foreground"
          >
            <Lightbulb className={cn("h-3 w-3 transition-colors", showAnalysis && "text-amber-400")} />
            {showAnalysis ? "Hide" : "Show"} Analysis
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", showAnalysis && "rotate-180")}
            />
          </button>

          {showAnalysis && (
            <div className="space-y-4 border-t border-border/30 dark:border-white/[0.05] bg-white/[0.01] p-4">
              {tweet.whyItWorked && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                    <Lightbulb className="h-3 w-3" />
                    Why it worked
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/70">
                    {tweet.whyItWorked}
                  </p>
                </div>
              )}

              {tweet.lessonsLearned && tweet.lessonsLearned.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400">
                    <BookOpen className="h-3 w-3" />
                    Key takeaways
                  </div>
                  <ul className="space-y-1.5">
                    {tweet.lessonsLearned.map((lesson, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-foreground/70">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-[10px] font-semibold text-blue-400">
                          {i + 1}
                        </span>
                        {lesson}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
