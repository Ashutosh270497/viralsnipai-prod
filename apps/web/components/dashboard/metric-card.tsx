import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
}

export function MetricCard({ icon: Icon, label, value, change, changeLabel }: MetricCardProps) {
  const isPositiveChange = change !== undefined && change >= 0;
  const hasChange = change !== undefined;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/50 bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.4)]",
        "transition-all duration-200",
        "hover:-translate-y-px hover:border-primary/25 hover:shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_0_1px_hsl(263_72%_56%_/_0.12)]",
      )}
    >
      {/* Subtle violet glow in top-right corner on hover */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/[0.06] opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
            {label}
          </p>
          <h3 className="mt-2.5 text-[28px] font-bold leading-none tracking-tight text-foreground">
            {value}
          </h3>
          {hasChange && (
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  isPositiveChange
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400",
                )}
              >
                {isPositiveChange ? "↑" : "↓"} {Math.abs(change!)}%
              </span>
              {changeLabel && (
                <span className="text-muted-foreground/60">{changeLabel}</span>
              )}
            </div>
          )}
        </div>

        {/* Icon — glowing pill */}
        <div
          className="shrink-0 rounded-lg bg-primary/[0.1] p-2.5 ring-1 ring-primary/20"
        >
          <Icon className="h-[18px] w-[18px] text-primary" />
        </div>
      </div>
    </div>
  );
}
