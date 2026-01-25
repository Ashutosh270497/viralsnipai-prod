"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface HookListProps {
  hooks: string[];
  selectedHook?: string;
  onSelect?: (hook: string) => void;
}

export function HookList({ hooks, selectedHook, onSelect }: HookListProps) {
  if (hooks.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Generate hooks to see them here.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {hooks.map((hook) => {
        const isSelected = selectedHook === hook;
        return (
          <button
            key={hook}
            type="button"
            onClick={() => onSelect?.(hook)}
            className={cn(
              "flex h-full flex-col items-start gap-3 rounded-xl border px-4 py-3 text-left transition hover:border-primary hover:bg-primary/5",
              isSelected ? "border-primary bg-primary/10" : "border-border"
            )}
          >
            <span className="text-sm font-medium leading-relaxed">{hook}</span>
            {isSelected ? (
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Check className="h-4 w-4" /> Selected
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
