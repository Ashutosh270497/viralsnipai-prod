"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type UsageRow = {
  feature: "video_upload" | "video_export";
  label: string;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
};

type UsagePayload = {
  plan: string;
  resetDate: string;
  usage: UsageRow[];
};

export function V1UsageLimitsCard() {
  const [state, setState] = useState<UsagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUsage() {
      try {
        const response = await fetch("/api/media/usage", {
          cache: "no-store",
          next: { revalidate: 0 },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? "Usage unavailable");
        }
        if (!cancelled) {
          setState(payload?.data ?? payload);
          setError(null);
        }
      } catch (usageError) {
        if (!cancelled) {
          setError(usageError instanceof Error ? usageError.message : "Usage unavailable");
        }
      }
    }

    loadUsage();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <CreditCard className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">V1 usage limits</p>
          <p className="text-xs text-muted-foreground/65">
            {state
              ? `${formatPlan(state.plan)} plan · resets ${formatResetDate(state.resetDate)}`
              : "Backend-enforced upload and export limits"}
          </p>
        </div>
      </div>

      {!state && !error ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground/55">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading limits...
        </div>
      ) : error ? (
        <p className="text-xs text-amber-500">{error}</p>
      ) : (
        <div className="space-y-3">
          {state?.usage.map((row) => (
            <div key={row.feature} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-foreground/85">{row.label}</span>
                <span className="text-muted-foreground/70">
                  {row.used} / {row.limit}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    row.percentage >= 90
                      ? "bg-red-500"
                      : row.percentage >= 75
                        ? "bg-amber-500"
                        : "bg-gradient-to-r from-emerald-500 to-cyan-500"
                  )}
                  style={{ width: `${row.percentage}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground/55">
                {row.remaining} remaining this month
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatPlan(plan: string) {
  return plan ? `${plan.charAt(0).toUpperCase()}${plan.slice(1)}` : "Free";
}

function formatResetDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "next month";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
