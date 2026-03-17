"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface KeywordDensityCheckerProps {
  script: string;
  keywords: string[];
}

interface KeywordAnalysis {
  keyword: string;
  count: number;
  density: number; // percentage
  positions: number[]; // character positions
  status: "good" | "low" | "spam";
  suggestion: string;
}

export function KeywordDensityChecker({ script, keywords }: KeywordDensityCheckerProps) {
  const analysis = useMemo(() => {
    if (!script || keywords.length === 0) return [];

    const scriptLower = script.toLowerCase();
    const words = script.split(/\s+/).length;

    return keywords.map((keyword): KeywordAnalysis => {
      const keywordLower = keyword.toLowerCase().trim();
      if (!keywordLower) {
        return {
          keyword,
          count: 0,
          density: 0,
          positions: [],
          status: "low",
          suggestion: "Keyword is empty",
        };
      }

      // Find all occurrences
      const positions: number[] = [];
      let pos = scriptLower.indexOf(keywordLower);
      while (pos !== -1) {
        positions.push(pos);
        pos = scriptLower.indexOf(keywordLower, pos + 1);
      }

      const count = positions.length;
      const density = words > 0 ? (count / words) * 100 : 0;

      // Determine status and suggestion
      let status: "good" | "low" | "spam";
      let suggestion: string;

      if (density === 0) {
        status = "low";
        suggestion = `Keyword "${keyword}" not found. Add it naturally to your script.`;
      } else if (density < 0.5) {
        status = "low";
        suggestion = `Low density (${density.toFixed(2)}%). Consider adding "${keyword}" 1-2 more times.`;
      } else if (density > 2.5) {
        status = "spam";
        suggestion = `Over-stuffed (${density.toFixed(2)}%)! Remove some instances to avoid spam detection.`;
      } else {
        status = "good";
        suggestion = `Optimal density (${density.toFixed(2)}%). Well balanced!`;
      }

      return {
        keyword,
        count,
        density,
        positions,
        status,
        suggestion,
      };
    });
  }, [script, keywords]);

  const overallStatus = useMemo(() => {
    if (analysis.length === 0) return "none";
    const spamCount = analysis.filter((a) => a.status === "spam").length;
    const lowCount = analysis.filter((a) => a.status === "low").length;
    const goodCount = analysis.filter((a) => a.status === "good").length;

    if (spamCount > 0) return "spam";
    if (lowCount === analysis.length) return "low";
    if (goodCount === analysis.length) return "good";
    return "mixed";
  }, [analysis]);

  if (keywords.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-center text-sm text-muted-foreground">
          <Info className="mx-auto mb-2 h-8 w-8" />
          <p>No keywords specified. Add keywords to analyze density.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border border-border dark:border-white/[0.07] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Keyword Density Analysis</h3>
        <Badge
          className={cn(
            "border",
            overallStatus === "good" && "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-600 border-emerald-300 dark:border-emerald-500/20",
            overallStatus === "spam" && "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-600 border-red-300 dark:border-red-500/20",
            overallStatus === "low" && "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-600 border-amber-300 dark:border-amber-500/20",
            overallStatus === "mixed" && "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-600 border-blue-300 dark:border-blue-500/20"
          )}
        >
          {overallStatus === "good" && "✓ Optimized"}
          {overallStatus === "spam" && "⚠ Over-stuffed"}
          {overallStatus === "low" && "↓ Low Density"}
          {overallStatus === "mixed" && "~ Mixed"}
        </Badge>
      </div>

      <div className="space-y-3">
        {analysis.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.status === "good" && <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />}
                {item.status === "spam" && <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-500" />}
                {item.status === "low" && <Info className="h-4 w-4 text-amber-600 dark:text-amber-500" />}
                <span className="font-medium">{item.keyword}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {item.count} {item.count === 1 ? "time" : "times"}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {item.density.toFixed(2)}%
                </Badge>
              </div>
            </div>

            <Progress
              value={Math.min(item.density * 40, 100)} // Scale for visualization
              className={cn(
                "h-2",
                item.status === "good" && "[&>div]:bg-green-500",
                item.status === "spam" && "[&>div]:bg-red-500",
                item.status === "low" && "[&>div]:bg-yellow-500"
              )}
            />

            <p className="text-xs text-muted-foreground">{item.suggestion}</p>
          </div>
        ))}
      </div>

      {/* Overall Tips */}
      <div className="mt-4 rounded-lg border bg-secondary/20 p-3">
        <h4 className="mb-2 text-sm font-semibold">SEO Tips:</h4>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>• Optimal keyword density: 0.5% - 2.5%</li>
          <li>• Use keywords naturally in context</li>
          <li>• Avoid keyword stuffing (spam detection)</li>
          <li>• Include keywords in hook, intro, and conclusion</li>
          <li>• Use variations and related terms</li>
        </ul>
      </div>
    </Card>
  );
}
