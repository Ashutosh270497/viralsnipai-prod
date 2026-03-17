"use client";

import { useState } from "react";
import { Copy, Star, Check, TrendingUp, Target, Lightbulb, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CharacterCounter } from "./character-counter";

interface TitleVariationCardProps {
  title: string;
  characterLength: number;
  titleType: string;
  reasoning: string;
  ctrScore: number;
  keywordOptimizationScore: number;
  curiosityScore: number;
  clarityScore: number;
  powerWordCount: number;
  lengthOptimal: boolean;
  keywordOptimized: boolean;
  overallRank: number;
  isFavorite?: boolean;
  isPrimary?: boolean;
  maxLength: number;
  onToggleFavorite?: () => void;
  onSetPrimary?: () => void;
  onCopy?: () => void;
}

export function TitleVariationCard({
  title,
  characterLength,
  titleType,
  reasoning,
  ctrScore,
  keywordOptimizationScore,
  curiosityScore,
  clarityScore,
  powerWordCount,
  lengthOptimal,
  keywordOptimized,
  overallRank,
  isFavorite = false,
  isPrimary = false,
  maxLength,
  onToggleFavorite,
  onSetPrimary,
  onCopy,
}: TitleVariationCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(title);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const getCTRColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-orange-600 dark:text-orange-400";
  };

  const getCTRBgColor = (score: number) => {
    if (score >= 80) return "bg-green-100 dark:bg-green-500/10 border-green-200 dark:border-green-500/20";
    if (score >= 60) return "bg-yellow-100 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20";
    return "bg-orange-100 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20";
  };

  return (
    <Card
      className={cn(
        "p-4 transition-all duration-200 hover:shadow-lg",
        isPrimary && "border-primary bg-primary/5 ring-1 ring-primary/20"
      )}
    >
      {/* Header with Rank and CTR Score */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant={overallRank <= 3 ? "default" : "secondary"} className="shrink-0">
            #{overallRank}
          </Badge>
          {isPrimary && (
            <Badge className="bg-primary/10 text-primary border-primary/20">
              Your Pick
            </Badge>
          )}
          {isFavorite && (
            <Star className="h-4 w-4 fill-amber-500 dark:fill-yellow-500 text-amber-500 dark:text-yellow-500" />
          )}
        </div>
        <div className={cn("flex items-baseline gap-1 rounded-lg border px-2 py-1", getCTRBgColor(ctrScore))}>
          <TrendingUp className={cn("h-4 w-4", getCTRColor(ctrScore))} />
          <span className={cn("text-2xl font-bold", getCTRColor(ctrScore))}>
            {ctrScore}
          </span>
          <span className="text-xs text-muted-foreground">/100 CTR</span>
        </div>
      </div>

      {/* Title */}
      <div className="mb-3">
        <p className="text-lg font-semibold leading-tight">{title}</p>
        <div className="mt-2">
          <CharacterCounter current={characterLength} maxLength={maxLength} />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-lg border border-border dark:border-white/[0.07] bg-muted/40 dark:bg-secondary/20 p-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Target className="h-3 w-3" />
            Keywords
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg font-bold">{keywordOptimizationScore}</span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
          {keywordOptimized && (
            <div className="mt-1 text-[10px] text-green-600 dark:text-green-400">✓ Optimized</div>
          )}
        </div>

        <div className="rounded-lg border border-border dark:border-white/[0.07] bg-muted/40 dark:bg-secondary/20 p-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lightbulb className="h-3 w-3" />
            Curiosity
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg font-bold">{curiosityScore}</span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>

        <div className="rounded-lg border border-border dark:border-white/[0.07] bg-muted/40 dark:bg-secondary/20 p-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-3 w-3" />
            Clarity
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg font-bold">{clarityScore}</span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>

        <div className="rounded-lg border border-border dark:border-white/[0.07] bg-muted/40 dark:bg-secondary/20 p-2">
          <div className="text-xs text-muted-foreground">Power Words</div>
          <div className="mt-1 text-lg font-bold">{powerWordCount}</div>
        </div>
      </div>

      {/* Badges */}
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge variant="outline" className="text-xs capitalize">
          {titleType}
        </Badge>
        {lengthOptimal && (
          <Badge variant="secondary" className="bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-600 border-green-200 dark:border-green-500/20 text-xs">
            ✓ Optimal Length
          </Badge>
        )}
      </div>

      {/* Reasoning (Collapsible) */}
      <div className="mb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left text-sm font-medium text-primary hover:underline"
        >
          {expanded ? "Hide" : "Show"} AI Reasoning
        </button>
        {expanded && (
          <p className="mt-2 rounded-lg border border-l-2 border-l-violet-400 dark:border-l-violet-500 border-border dark:border-white/[0.07] bg-muted/30 dark:bg-secondary/20 p-3 text-sm leading-relaxed text-muted-foreground">
            {reasoning}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="flex-1 sm:flex-none"
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </>
          )}
        </Button>

        {onSetPrimary && (
          <Button
            variant={isPrimary ? "default" : "outline"}
            size="sm"
            onClick={onSetPrimary}
            disabled={isPrimary}
            className="flex-1 sm:flex-none"
          >
            {isPrimary ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Your Title
              </>
            ) : (
              "Use This Title"
            )}
          </Button>
        )}

        {onToggleFavorite && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFavorite}
            className="h-9 w-9 p-0"
          >
            <Star className={cn("h-4 w-4", isFavorite && "fill-amber-500 dark:fill-yellow-500 text-amber-500 dark:text-yellow-500")} />
          </Button>
        )}
      </div>
    </Card>
  );
}
