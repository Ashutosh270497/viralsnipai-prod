"use client";

import { useMemo } from "react";
import { AlertCircle, CheckCircle, TrendingUp, Clock, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface RetentionAnalysisProps {
  script: string;
  hook?: string;
  durationEstimate: number; // in seconds
}

interface RetentionIssue {
  timestamp: string;
  issue: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
}

export function RetentionAnalysis({ script, hook, durationEstimate }: RetentionAnalysisProps) {
  const analysis = useMemo(() => {
    const issues: RetentionIssue[] = [];
    const words = script.split(/\s+/).length;
    const estimatedDuration = words / 150; // 150 words per minute

    // Analyze hook strength
    const hookStrength = hook ? analyzeHookStrength(hook) : 0;

    // Check pacing
    const pacing = estimatedDuration < 3 ? "too-fast" : estimatedDuration > 15 ? "too-slow" : "good";

    // Detect long segments without breaks
    const sentences = script.split(/[.!?]+/).filter(Boolean);
    let currentTimestamp = 0;
    let wordCount = 0;

    sentences.forEach((sentence, index) => {
      const sentenceWords = sentence.trim().split(/\s+/).length;
      wordCount += sentenceWords;

      // Check for segments longer than 120 seconds without payoff
      if (wordCount > 300) { // ~2 minutes of content
        const timestamp = formatTimestamp(currentTimestamp);
        issues.push({
          timestamp,
          issue: "Long segment without break",
          suggestion: "Add a visual break, example, or payoff moment to reset attention",
          priority: "high",
        });
        wordCount = 0;
      }

      currentTimestamp += (sentenceWords / 150) * 60; // seconds
    });

    // Check for early drop-off risks (first 30 seconds)
    const first30Words = script.split(/\s+/).slice(0, 75).join(" "); // ~30 seconds
    if (!first30Words.match(/\?|!|wow|amazing|secret|discover|learn/i)) {
      issues.push({
        timestamp: "0:30",
        issue: "Weak early engagement",
        suggestion: "Add a tease or promise at 0:30 to prevent early drop-off",
        priority: "high",
      });
    }

    // Check conclusion length
    const conclusionStart = Math.max(0, words - 150); // Last ~60 seconds
    const conclusionWords = script.split(/\s+/).slice(conclusionStart).length;
    if (conclusionWords > 200) {
      const timestamp = formatTimestamp((words - conclusionWords) / 150 * 60);
      issues.push({
        timestamp,
        issue: "Conclusion too long",
        suggestion: "Shorten conclusion - viewers drop at 95% mark. Keep it under 60 seconds.",
        priority: "medium",
      });
    }

    // Calculate engagement points (questions, calls to action, etc.)
    const engagementPoints = (script.match(/\?|comment|subscribe|like|share|tell me|let me know/gi) || []).length;

    // Overall retention score (0-100)
    const overallScore = calculateRetentionScore(hookStrength, pacing, issues.length, engagementPoints);

    return {
      overallScore,
      hookStrength,
      pacing,
      engagementPoints,
      issues,
      suggestions: generateSuggestions(overallScore, hookStrength, pacing, issues),
    };
  }, [script, hook, durationEstimate]);

  return (
    <Card className="border border-border dark:border-white/[0.07] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Retention Analysis</h3>
        <Badge
          className={cn(
            "border",
            analysis.overallScore >= 80 && "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-600 border-emerald-300 dark:border-emerald-500/20",
            analysis.overallScore >= 60 && analysis.overallScore < 80 && "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-600 border-amber-300 dark:border-amber-500/20",
            analysis.overallScore < 60 && "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-600 border-red-300 dark:border-red-500/20"
          )}
        >
          {analysis.overallScore}/100
        </Badge>
      </div>

      {/* Overall Score */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Retention Score</span>
          <span className="font-semibold">{analysis.overallScore}%</span>
        </div>
        <Progress
          value={analysis.overallScore}
          className={cn(
            "h-3",
            analysis.overallScore >= 80 && "[&>div]:bg-green-500",
            analysis.overallScore >= 60 && analysis.overallScore < 80 && "[&>div]:bg-yellow-500",
            analysis.overallScore < 60 && "[&>div]:bg-red-500"
          )}
        />
      </div>

      {/* Metrics Grid */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border dark:border-white/[0.07] bg-muted/40 dark:bg-secondary/20 p-3 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" />
            Hook
          </div>
          <div className={cn(
            "text-xl font-bold",
            analysis.hookStrength >= 80 && "text-emerald-600 dark:text-emerald-500",
            analysis.hookStrength >= 60 && analysis.hookStrength < 80 && "text-amber-600 dark:text-amber-500",
            analysis.hookStrength < 60 && "text-red-600 dark:text-red-500"
          )}>
            {analysis.hookStrength}
          </div>
        </div>

        <div className="rounded-lg border border-border dark:border-white/[0.07] bg-muted/40 dark:bg-secondary/20 p-3 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Pacing
          </div>
          <div className={cn(
            "text-sm font-semibold",
            analysis.pacing === "good" && "text-emerald-600 dark:text-emerald-500",
            analysis.pacing !== "good" && "text-amber-600 dark:text-amber-500"
          )}>
            {analysis.pacing === "good" ? "Good" : analysis.pacing === "too-fast" ? "Fast" : "Slow"}
          </div>
        </div>

        <div className="rounded-lg border border-border dark:border-white/[0.07] bg-muted/40 dark:bg-secondary/20 p-3 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            Engagement
          </div>
          <div className="text-xl font-bold">{analysis.engagementPoints}</div>
        </div>
      </div>

      {/* Issues */}
      {analysis.issues.length > 0 && (
        <div className="mb-4 space-y-2">
          <h4 className="text-sm font-semibold">Issues Found:</h4>
          {analysis.issues.map((issue, index) => (
            <div
              key={index}
              className={cn(
                "rounded-lg border p-3",
                issue.priority === "high" && "border-red-300 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5",
                issue.priority === "medium" && "border-amber-300 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5",
                issue.priority === "low" && "border-blue-300 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5"
              )}
            >
              <div className="mb-1 flex items-center gap-2">
                <AlertCircle className={cn(
                  "h-4 w-4",
                  issue.priority === "high" && "text-red-600 dark:text-red-500",
                  issue.priority === "medium" && "text-amber-600 dark:text-amber-500",
                  issue.priority === "low" && "text-blue-600 dark:text-blue-500"
                )} />
                <span className="text-sm font-medium">{issue.timestamp}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {issue.priority}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{issue.issue}</p>
              <p className="text-xs text-muted-foreground">💡 {issue.suggestion}</p>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      <div className="rounded-lg border bg-secondary/20 p-3">
        <h4 className="mb-2 text-sm font-semibold">Recommendations:</h4>
        <ul className="space-y-1">
          {analysis.suggestions.map((suggestion, index) => (
            <li key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-500" />
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function analyzeHookStrength(hook: string): number {
  let score = 50; // Base score

  // Check for strong elements
  if (hook.match(/\?/)) score += 10; // Question
  if (hook.match(/!/)) score += 5; // Exclamation
  if (hook.match(/stop|wait|listen|pause/i)) score += 15; // Pattern interrupt
  if (hook.match(/secret|shocking|amazing|discover|reveal/i)) score += 15; // Curiosity gap
  if (hook.match(/\d+%|\d+ (million|thousand)/i)) score += 10; // Statistics
  if (hook.length > 50 && hook.length < 150) score += 10; // Good length

  return Math.min(score, 100);
}

function calculateRetentionScore(
  hookStrength: number,
  pacing: string,
  issueCount: number,
  engagementPoints: number
): number {
  let score = 50;

  // Hook contribution (30%)
  score += (hookStrength / 100) * 30;

  // Pacing contribution (20%)
  score += pacing === "good" ? 20 : 10;

  // Issues penalty (30%)
  score -= Math.min(issueCount * 10, 30);

  // Engagement bonus (20%)
  score += Math.min(engagementPoints * 2, 20);

  return Math.max(0, Math.min(Math.round(score), 100));
}

function generateSuggestions(
  score: number,
  hookStrength: number,
  pacing: string,
  issues: RetentionIssue[]
): string[] {
  const suggestions: string[] = [];

  if (hookStrength < 70) {
    suggestions.push("Strengthen your hook with a question, bold statement, or curiosity gap");
  }

  if (pacing === "too-fast") {
    suggestions.push("Add more depth and examples - viewers prefer valuable content over speed");
  } else if (pacing === "too-slow") {
    suggestions.push("Tighten your script - remove redundant points and keep it focused");
  }

  if (issues.length > 3) {
    suggestions.push("Break content into smaller segments with visual breaks every 90-120 seconds");
  }

  suggestions.push("Include engagement prompts (questions, comments, likes) throughout");
  suggestions.push("Add payoff moments at regular intervals to reward viewers for watching");

  if (score < 70) {
    suggestions.push("Consider using the 'More Engaging' revision to improve retention");
  }

  return suggestions.slice(0, 5); // Max 5 suggestions
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
