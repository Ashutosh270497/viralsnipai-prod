"use client";

import { useState } from "react";
import Image from "next/image";
import { Star, Download, TrendingUp, Eye, Lightbulb, Check, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ThumbnailCardProps {
  imageUrl: string;
  videoTitle: string;
  ctrScore: number;
  contrastScore: number;
  mobileReadability: number;
  emotionalImpact: number;
  nicheAlignment: number;
  overallRank: number;
  improvements: string[];
  reasoning: string;
  isPrimary?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onSetPrimary?: () => void;
  onDownload?: () => void;
}

export function ThumbnailCard({
  imageUrl,
  videoTitle,
  ctrScore,
  contrastScore,
  mobileReadability,
  emotionalImpact,
  nicheAlignment,
  overallRank,
  improvements,
  reasoning,
  isPrimary = false,
  isFavorite = false,
  onToggleFavorite,
  onSetPrimary,
  onDownload,
}: ThumbnailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600 dark:text-green-400";
    if (score >= 6) return "text-yellow-600 dark:text-yellow-400";
    return "text-orange-600 dark:text-orange-400";
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thumbnail-${overallRank}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      onDownload?.();
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card
      className={cn(
        "p-4 transition-all hover:shadow-md",
        isPrimary && "border-primary bg-primary/5 ring-1 ring-primary/20"
      )}
    >
      {/* Header with Rank and CTR Score */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant={overallRank === 1 ? "default" : "secondary"} className="shrink-0">
            #{overallRank}
          </Badge>
          {isPrimary && (
            <Badge className="bg-primary/10 text-primary border-primary/20">
              Selected
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

      {/* Thumbnail Image */}
      <div className="mb-3 overflow-hidden rounded-xl border border-border dark:border-white/[0.07] shadow-sm">
        <Image
          src={imageUrl}
          alt={videoTitle}
          width={640}
          height={360}
          className="h-auto w-full object-cover"
        />
      </div>

      {/* Mobile Preview Hint */}
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Eye className="h-3 w-3" />
        <span>Preview shown at full size • Mobile: ~320px width</span>
      </div>

      {/* Scores Grid */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-lg border border-border dark:border-white/[0.07] bg-muted/40 dark:bg-secondary/20 p-2">
          <div className="text-xs text-muted-foreground">Contrast</div>
          <div className={cn("text-lg font-bold", getScoreColor(contrastScore))}>
            {contrastScore}/10
          </div>
        </div>

        <div className="rounded-lg border border-border dark:border-white/[0.07] bg-muted/40 dark:bg-secondary/20 p-2">
          <div className="text-xs text-muted-foreground">Mobile</div>
          <div className={cn("text-lg font-bold", getScoreColor(mobileReadability))}>
            {mobileReadability}/10
          </div>
        </div>

        <div className="rounded-lg border border-border dark:border-white/[0.07] bg-muted/40 dark:bg-secondary/20 p-2">
          <div className="text-xs text-muted-foreground">Emotion</div>
          <div className={cn("text-lg font-bold", getScoreColor(emotionalImpact))}>
            {emotionalImpact}/10
          </div>
        </div>

        <div className="rounded-lg border border-border dark:border-white/[0.07] bg-muted/40 dark:bg-secondary/20 p-2">
          <div className="text-xs text-muted-foreground">Niche Fit</div>
          <div className={cn("text-lg font-bold", getScoreColor(nicheAlignment))}>
            {nicheAlignment}/10
          </div>
        </div>
      </div>

      {/* AI Reasoning (Collapsible) */}
      <div className="mb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left text-sm font-medium text-primary hover:underline"
        >
          {expanded ? "Hide" : "Show"} AI Analysis
        </button>
        {expanded && (
          <div className="mt-2 space-y-3">
            <div className="rounded-lg border border-l-2 border-l-amber-400 dark:border-l-amber-500 border-border dark:border-white/[0.07] bg-muted/30 dark:bg-secondary/20 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                <span className="text-sm font-semibold">Why This Works:</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {reasoning}
              </p>
            </div>

            {improvements.length > 0 && (
              <div className="rounded-lg border border-border dark:border-white/[0.07] bg-muted/30 dark:bg-secondary/20 p-3">
                <div className="mb-2 text-sm font-semibold">Improvement Suggestions:</div>
                <ul className="space-y-1">
                  {improvements.map((improvement, index) => (
                    <li key={index} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="text-primary">•</span>
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
          className="flex-1 sm:flex-none"
        >
          {downloading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download
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
                Selected
              </>
            ) : (
              "Use This"
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
