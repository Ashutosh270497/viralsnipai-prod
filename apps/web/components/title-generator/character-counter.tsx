"use client";

import { cn } from "@/lib/utils";

interface CharacterCounterProps {
  current: number;
  maxLength: number;
  className?: string;
}

export function CharacterCounter({ current, maxLength, className }: CharacterCounterProps) {
  const isOptimal = current >= 50 && current <= 70;
  const isAcceptable = (current >= 40 && current < 50) || (current > 70 && current <= 80);
  const isOver = current > maxLength;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative h-2 w-full rounded-full bg-secondary">
        <div
          className={cn(
            "absolute left-0 top-0 h-full rounded-full transition-all duration-300",
            isOptimal && "bg-green-500",
            isAcceptable && "bg-yellow-500",
            isOver && "bg-red-500",
            !isOptimal && !isAcceptable && !isOver && "bg-gray-400"
          )}
          style={{
            width: `${Math.min((current / maxLength) * 100, 100)}%`,
          }}
        />
      </div>
      <div className="flex items-baseline gap-1 text-sm">
        <span
          className={cn(
            "font-semibold",
            isOptimal && "text-green-600 dark:text-green-400",
            isAcceptable && "text-yellow-600 dark:text-yellow-400",
            isOver && "text-red-600 dark:text-red-400",
            !isOptimal && !isAcceptable && !isOver && "text-muted-foreground"
          )}
        >
          {current}
        </span>
        <span className="text-muted-foreground">/ {maxLength}</span>
      </div>
    </div>
  );
}

export function CharacterGuide() {
  return (
    <div className="space-y-2 rounded-lg border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.03] to-transparent p-3">
      <h4 className="text-xs font-semibold">Character Length Guide:</h4>
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-muted-foreground">50-70 chars: Optimal (recommended)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-yellow-500" />
          <span className="text-muted-foreground">40-49 or 71-80: Acceptable</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-muted-foreground">&lt;40 or &gt;80: Not recommended</span>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        YouTube truncates titles at ~60 characters on mobile. Keep your primary keyword in the first 60 chars.
      </p>
    </div>
  );
}
