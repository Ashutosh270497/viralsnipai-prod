"use client";

import { cn } from "@/lib/utils";
import type { CompetitionLevel } from "@/lib/types/niche";

interface CompetitionGaugeProps {
  level: CompetitionLevel;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

const levelConfig = {
  low: {
    label: "Low Competition",
    color: "bg-green-500",
    textColor: "text-green-600 dark:text-green-400",
    fillPercent: 33,
  },
  medium: {
    label: "Medium Competition",
    color: "bg-yellow-500",
    textColor: "text-yellow-600 dark:text-yellow-400",
    fillPercent: 66,
  },
  high: {
    label: "High Competition",
    color: "bg-red-500",
    textColor: "text-red-600 dark:text-red-400",
    fillPercent: 100,
  },
};

const sizeConfig = {
  sm: { height: "h-1.5", width: "w-16", text: "text-xs" },
  md: { height: "h-2", width: "w-24", text: "text-sm" },
  lg: { height: "h-3", width: "w-32", text: "text-base" },
};

export function CompetitionGauge({
  level,
  showLabel = true,
  size = "md",
}: CompetitionGaugeProps) {
  const config = levelConfig[level];
  const sizeStyles = sizeConfig[size];

  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          "relative overflow-hidden rounded-full bg-gray-200 dark:bg-neutral-700",
          sizeStyles.height,
          sizeStyles.width
        )}
      >
        <div
          className={cn(
            "absolute left-0 top-0 h-full rounded-full transition-all duration-500",
            config.color
          )}
          style={{ width: `${config.fillPercent}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn("font-medium", sizeStyles.text, config.textColor)}>
          {config.label}
        </span>
      )}
    </div>
  );
}
