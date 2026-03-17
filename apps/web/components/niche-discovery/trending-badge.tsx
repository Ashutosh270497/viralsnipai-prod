"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GrowthTrend } from "@/lib/types/niche";

interface TrendingBadgeProps {
  trend: GrowthTrend;
  size?: "sm" | "md" | "lg";
}

const trendConfig = {
  rising: {
    label: "Rising",
    icon: TrendingUp,
    bgColor: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-700 dark:text-green-400",
    iconColor: "text-green-600 dark:text-green-400",
  },
  stable: {
    label: "Stable",
    icon: Minus,
    bgColor: "bg-gray-100 dark:bg-neutral-800",
    textColor: "text-gray-700 dark:text-neutral-300",
    iconColor: "text-gray-500 dark:text-neutral-400",
  },
  declining: {
    label: "Declining",
    icon: TrendingDown,
    bgColor: "bg-red-100 dark:bg-red-900/30",
    textColor: "text-red-700 dark:text-red-400",
    iconColor: "text-red-600 dark:text-red-400",
  },
};

const sizeConfig = {
  sm: { padding: "px-2 py-0.5", text: "text-xs", icon: "h-3 w-3", gap: "gap-1" },
  md: { padding: "px-2.5 py-1", text: "text-sm", icon: "h-4 w-4", gap: "gap-1.5" },
  lg: { padding: "px-3 py-1.5", text: "text-base", icon: "h-5 w-5", gap: "gap-2" },
};

export function TrendingBadge({ trend, size = "md" }: TrendingBadgeProps) {
  const config = trendConfig[trend];
  const styles = sizeConfig[size];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        config.bgColor,
        config.textColor,
        styles.padding,
        styles.text,
        styles.gap
      )}
    >
      <Icon className={cn(styles.icon, config.iconColor)} />
      {config.label}
    </span>
  );
}
