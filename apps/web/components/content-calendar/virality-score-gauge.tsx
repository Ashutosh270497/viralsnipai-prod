"use client";

import { cn } from "@/lib/utils";

interface ViralityScoreGaugeProps {
  score: number; // 0-100
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function ViralityScoreGauge({ score, size = "md", showLabel = true }: ViralityScoreGaugeProps) {
  const normalizedScore = Math.min(Math.max(score, 0), 100);
  const rotation = (normalizedScore / 100) * 180 - 90; // -90 to 90 degrees

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-red-600 dark:text-red-500";
    if (score >= 50) return "text-amber-600 dark:text-amber-500";
    return "text-muted-foreground";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return "from-red-500 to-orange-500";
    if (score >= 50) return "from-amber-500 to-yellow-500";
    return "from-gray-400 to-gray-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "High";
    if (score >= 50) return "Medium";
    return "Growing";
  };

  const sizes = {
    sm: { gauge: "h-20 w-20", text: "text-lg", label: "text-xs" },
    md: { gauge: "h-32 w-32", text: "text-3xl", label: "text-sm" },
    lg: { gauge: "h-40 w-40", text: "text-4xl", label: "text-base" },
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("relative", sizes[size].gauge)}>
        {/* Background Arc */}
        <svg className="h-full w-full" viewBox="0 0 100 100">
          <defs>
            <linearGradient id={`gradient-${score}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" className="stop-color-start" />
              <stop offset="100%" className="stop-color-end" />
            </linearGradient>
          </defs>

          {/* Background track */}
          <path
            d="M 10 85 A 40 40 0 0 1 90 85"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className="text-gray-200 dark:text-gray-800"
          />

          {/* Score arc */}
          <path
            d="M 10 85 A 40 40 0 0 1 90 85"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(normalizedScore / 100) * 125.6} 125.6`}
            className={cn("transition-all duration-1000", getScoreColor(normalizedScore))}
          />

          {/* Needle */}
          <g transform="translate(50, 85)">
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="-35"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-foreground transition-transform duration-700"
              style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "center" }}
            />
            <circle cx="0" cy="0" r="3" fill="currentColor" className="text-foreground" />
          </g>
        </svg>

        {/* Score text */}
        <div className="absolute inset-0 flex items-center justify-center pt-4">
          <div className="text-center">
            <div className={cn("font-bold", sizes[size].text, getScoreColor(normalizedScore))}>
              {normalizedScore}
            </div>
          </div>
        </div>
      </div>

      {showLabel && (
        <div className="text-center">
          <div className={cn("font-semibold", sizes[size].label, getScoreColor(normalizedScore))}>
            {getScoreLabel(normalizedScore)} Virality
          </div>
        </div>
      )}
    </div>
  );
}
