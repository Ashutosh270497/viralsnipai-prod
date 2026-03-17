"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, TrendingDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface GrowthDataPoint {
  date: string;
  followers: number;
  following: number;
  growth: number;
}

function formatK(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

export function FollowerGrowthChart({ data }: { data: GrowthDataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 dark:border-white/[0.07] bg-gradient-to-br from-muted/30 dark:from-white/[0.03] to-transparent p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15">
            <Users className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400">
              Follower Growth
            </p>
            <p className="text-[11px] text-muted-foreground/50">Tracking over time</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground/50">
          No growth data yet. Check back after a few days of tracking.
        </p>
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  const latest = data[data.length - 1];
  const first = data[0];
  const netGrowth = latest ? latest.followers - first.followers : 0;
  const positiveGrowth = netGrowth >= 0;

  const minFollowers = Math.min(...data.map((d) => d.followers));
  const maxFollowers = Math.max(...data.map((d) => d.followers));
  const yMin = Math.max(0, minFollowers - Math.round((maxFollowers - minFollowers) * 0.1));

  return (
    <div className="rounded-2xl border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.03] to-transparent p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/15">
            <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
              Follower Growth
            </p>
            <p className="text-[11px] text-muted-foreground/60 dark:text-muted-foreground/50">
              {data.length}d window
            </p>
          </div>
        </div>

        {/* Stat chip */}
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-400 tracking-tight">
            {formatK(latest?.followers ?? 0)}
          </p>
          <div
            className={cn(
              "flex items-center justify-end gap-0.5 text-[11px] font-semibold",
              positiveGrowth ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}
          >
            {positiveGrowth ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {positiveGrowth ? "+" : ""}
            {formatK(netGrowth)} this period
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="followersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(167 139 250)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="rgb(167 139 250)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[yMin, "auto"]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatK}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: "rgb(167 139 250 / 0.3)", strokeWidth: 1 }}
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "10px",
                fontSize: 12,
                color: "hsl(var(--popover-foreground))",
              }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              formatter={(value) => [Number(value).toLocaleString(), "Followers"]}
            />
            <Area
              type="monotone"
              dataKey="followers"
              stroke="rgb(167 139 250)"
              strokeWidth={2}
              fill="url(#followersGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "rgb(167 139 250)", stroke: "hsl(var(--background))", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
