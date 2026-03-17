"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type AccentColor = "blue" | "violet" | "rose";

const COLOR_MAP: Record<AccentColor, string[]> = {
  blue: [
    "rgb(37 99 235)",         // blue-600 — punchy on light bg
    "rgb(59 130 246)",        // blue-500
    "rgb(96 165 250)",        // blue-400
    "rgb(96 165 250 / 0.70)",
    "rgb(96 165 250 / 0.45)",
    "rgb(96 165 250 / 0.25)",
  ],
  violet: [
    "rgb(124 58 237)",        // violet-600
    "rgb(139 92 246)",        // violet-500
    "rgb(167 139 250)",       // violet-400
    "rgb(167 139 250 / 0.70)",
    "rgb(167 139 250 / 0.45)",
    "rgb(167 139 250 / 0.25)",
  ],
  rose: [
    "rgb(225 29 72)",         // rose-600
    "rgb(244 63 94)",         // rose-500
    "rgb(251 113 133)",       // rose-400
    "rgb(251 113 133 / 0.70)",
    "rgb(251 113 133 / 0.45)",
    "rgb(251 113 133 / 0.25)",
  ],
};

const LABEL_COLOR: Record<AccentColor, string> = {
  blue:   "text-blue-600 dark:text-blue-400",
  violet: "text-violet-600 dark:text-violet-400",
  rose:   "text-rose-600 dark:text-rose-400",
};

const BG_COLOR: Record<AccentColor, string> = {
  blue:   "bg-blue-100 dark:bg-blue-500/10",
  violet: "bg-violet-100 dark:bg-violet-500/10",
  rose:   "bg-rose-100 dark:bg-rose-500/10",
};

interface PatternBreakdownProps {
  title: string;
  data: Record<string, number>;
  accentColor?: AccentColor;
}

export function PatternBreakdown({
  title,
  data,
  accentColor = "violet",
}: PatternBreakdownProps) {
  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const colors = COLOR_MAP[accentColor];
  const topEntry = entries[0];

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.03] to-transparent p-5">
        <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${LABEL_COLOR[accentColor]}`}>
          {title}
        </p>
        <p className="text-sm text-muted-foreground/50">No data yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.03] to-transparent p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${LABEL_COLOR[accentColor]}`}>
            {title}
          </p>
          {topEntry && (
            <p className="mt-0.5 text-xs text-muted-foreground/50">
              Top:{" "}
              <span className="font-medium text-foreground/70">{topEntry.name}</span>
              <span className="ml-1 text-muted-foreground/40">({topEntry.count})</span>
            </p>
          )}
        </div>
        <div className={`flex h-6 items-center justify-center rounded-md px-2 text-[10px] font-semibold ${BG_COLOR[accentColor]} ${LABEL_COLOR[accentColor]}`}>
          {entries.length} types
        </div>
      </div>

      {/* Chart */}
      <div className="h-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={entries}
            layout="vertical"
            margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              hide
              domain={[0, (topEntry?.count ?? 1) * 1.15]}
            />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              width={76}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "10px",
                fontSize: 12,
                color: "hsl(var(--popover-foreground))",
              }}
              formatter={(value) => [Number(value), "Count"]}
            />
            <Bar dataKey="count" radius={[0, 5, 5, 0]} barSize={15}>
              {entries.map((_, idx) => (
                <Cell key={idx} fill={colors[idx % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
