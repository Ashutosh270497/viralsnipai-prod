"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonetizationStarsProps {
  score: number; // 1-10
  maxStars?: number;
  size?: "sm" | "md" | "lg";
  showScore?: boolean;
}

const sizeConfig = {
  sm: { icon: "h-3 w-3", text: "text-xs", gap: "gap-0.5" },
  md: { icon: "h-4 w-4", text: "text-sm", gap: "gap-1" },
  lg: { icon: "h-5 w-5", text: "text-base", gap: "gap-1.5" },
};

export function MonetizationStars({
  score,
  maxStars = 5,
  size = "md",
  showScore = true,
}: MonetizationStarsProps) {
  const styles = sizeConfig[size];

  // Convert 1-10 score to stars (e.g., 8/10 = 4/5 stars)
  const filledStars = Math.round((score / 10) * maxStars);

  return (
    <div className={cn("flex items-center", styles.gap)}>
      <div className={cn("flex", styles.gap)}>
        {Array.from({ length: maxStars }).map((_, index) => (
          <Star
            key={index}
            className={cn(
              styles.icon,
              index < filledStars
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-200 text-gray-200 dark:fill-neutral-600 dark:text-neutral-600"
            )}
          />
        ))}
      </div>
      {showScore && (
        <span
          className={cn(
            "font-medium text-gray-600 dark:text-neutral-400",
            styles.text
          )}
        >
          {score}/10
        </span>
      )}
    </div>
  );
}
