"use client";

import { VideoIdea } from "@/lib/types/content-calendar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ContentMixChartProps {
  ideas: VideoIdea[];
}

export function ContentMixChart({ ideas }: ContentMixChartProps) {
  // Calculate content mix
  const trendingCount = ideas.filter((i) => i.contentCategory === "trending").length;
  const evergreenCount = ideas.filter((i) => i.contentCategory === "evergreen").length;
  const experimentalCount = ideas.filter((i) => i.contentCategory === "experimental").length;
  const total = ideas.length || 1;

  const trendingPercent = Math.round((trendingCount / total) * 100);
  const evergreenPercent = Math.round((evergreenCount / total) * 100);
  const experimentalPercent = Math.round((experimentalCount / total) * 100);

  // Calculate format mix
  const shortFormCount = ideas.filter((i) => i.videoType === "short").length;
  const longFormCount = ideas.filter((i) => i.videoType === "long-form").length;

  const shortFormPercent = Math.round((shortFormCount / total) * 100);
  const longFormPercent = Math.round((longFormCount / total) * 100);

  const contentMixData = [
    {
      label: "Trending",
      count: trendingCount,
      percent: trendingPercent,
      color: "bg-red-500",
      lightColor: "bg-red-500/10",
      textColor: "text-red-600",
      target: 30,
    },
    {
      label: "Evergreen",
      count: evergreenCount,
      percent: evergreenPercent,
      color: "bg-green-500",
      lightColor: "bg-green-500/10",
      textColor: "text-green-600",
      target: 50,
    },
    {
      label: "Experimental",
      count: experimentalCount,
      percent: experimentalPercent,
      color: "bg-purple-500",
      lightColor: "bg-purple-500/10",
      textColor: "text-purple-600",
      target: 20,
    },
  ];

  const formatMixData = [
    {
      label: "Long-form",
      count: longFormCount,
      percent: longFormPercent,
      color: "bg-blue-500",
      icon: "📺",
      target: 60,
    },
    {
      label: "Shorts",
      count: shortFormCount,
      percent: shortFormPercent,
      color: "bg-cyan-500",
      icon: "🎬",
      target: 40,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Content Category Mix */}
      <Card className="p-3">
        <h3 className="mb-3 text-sm font-semibold">Content Category Mix</h3>
        <div className="space-y-3">
          {/* Stacked bar */}
          <div className="flex h-6 w-full overflow-hidden rounded-full">
            {contentMixData.map((item, index) => (
              <div
                key={index}
                className={cn("transition-all duration-500", item.color)}
                style={{ width: `${item.percent}%` }}
                title={`${item.label}: ${item.percent}%`}
              />
            ))}
          </div>

          {/* Legend & Stats */}
          <div className="space-y-2">
            {contentMixData.map((item, index) => (
              <div key={index} className={cn("rounded-lg border p-2", item.lightColor)}>
                <div className="mb-1 flex items-center justify-between">
                  <span className={cn("text-[11px] font-semibold", item.textColor)}>
                    {item.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    Target: {item.target}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className={cn("text-xl font-bold leading-none", item.textColor)}>
                    {item.percent}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    ({item.count} ideas)
                  </span>
                </div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-secondary">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", item.color)}
                    style={{ width: `${Math.min((item.percent / item.target) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Format Mix */}
      <Card className="p-3">
        <h3 className="mb-3 text-sm font-semibold">Format Mix</h3>
        <div className="space-y-2">
          {formatMixData.map((item, index) => (
            <div key={index} className="rounded-lg border bg-secondary/20 p-2.5">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-[11px] font-semibold">{item.label}</span>
                </div>
                <span className="text-[9px] text-muted-foreground">
                  Target: {item.target}%
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold leading-none">{item.percent}%</span>
                <span className="text-[10px] text-muted-foreground">({item.count})</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", item.color)}
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Strategy Notes */}
      <Card className="border-primary/20 bg-primary/5 p-3">
        <h4 className="mb-2 text-xs font-semibold">Content Strategy</h4>
        <ul className="space-y-1.5 text-[10px] leading-relaxed text-muted-foreground">
          <li className="flex gap-1.5">
            <span className="text-red-500">•</span>
            <span><strong className="text-foreground">Trending (30%):</strong> Capitalize on current interest</span>
          </li>
          <li className="flex gap-1.5">
            <span className="text-green-500">•</span>
            <span><strong className="text-foreground">Evergreen (50%):</strong> Long-term value & consistent views</span>
          </li>
          <li className="flex gap-1.5">
            <span className="text-purple-500">•</span>
            <span><strong className="text-foreground">Experimental (20%):</strong> Stand out with unique angles</span>
          </li>
          <li className="flex gap-1.5">
            <span className="text-blue-500">•</span>
            <span><strong className="text-foreground">Long-form (60%):</strong> Deep engagement & watch time</span>
          </li>
          <li className="flex gap-1.5">
            <span className="text-cyan-500">•</span>
            <span><strong className="text-foreground">Shorts (40%):</strong> Quick reach & algorithm boost</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
