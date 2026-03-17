"use client";

import { Check, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

interface HookListProps {
  hooks: string[];
  selectedHook?: string;
  onSelect?: (hook: string) => void;
}

export function HookList({ hooks, selectedHook, onSelect }: HookListProps) {
  if (hooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/40 bg-white/[0.01] py-12 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.08] ring-1 ring-primary/20">
          <Zap className="h-5 w-5 text-primary/60" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground/60">No hooks yet</p>
          <p className="text-xs text-muted-foreground/50">
            Fill in a topic and hit Generate Hooks
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {hooks.map((hook) => {
        const isSelected = selectedHook === hook;
        return (
          <button
            key={hook}
            type="button"
            onClick={() => onSelect?.(hook)}
            className={cn(
              "group relative flex h-full flex-col items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150",
              isSelected
                ? "border-primary/50 bg-primary/[0.08]"
                : "border-border/40 bg-white/[0.02] hover:border-primary/30 hover:bg-primary/[0.04]"
            )}
          >
            <span className="text-sm font-medium leading-relaxed text-foreground/90">{hook}</span>
            {isSelected ? (
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Check className="h-3 w-3" /> Selected
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
