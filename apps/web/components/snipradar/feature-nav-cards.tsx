"use client";

import Link from "next/link";
import { BarChart3, CalendarClock, Sparkles, Target, Wand2, ArrowRight } from "lucide-react";
import { trackSnipRadarEvent } from "@/lib/snipradar/events";
import { cn } from "@/lib/utils";

export function FeatureNavCards({
  trackedCount,
  draftCount,
}: {
  trackedCount: number;
  draftCount: number;
}) {
  const cards = [
    {
      title: "Discover",
      subtitle: "Track leaders and find viral patterns",
      href: "/snipradar/discover/tracker",
      icon: Target,
      badge: trackedCount > 0 ? `${trackedCount} account${trackedCount === 1 ? "" : "s"}` : null,
      // Cyan/blue accent
      iconBg: "bg-cyan-100 dark:bg-cyan-500/10",
      iconColor: "text-cyan-600 dark:text-cyan-400",
      borderHover: "hover:border-cyan-400 dark:hover:border-cyan-500/30",
      glowColor: "group-hover:bg-cyan-500/5",
      badgeColor: "bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-300 dark:border-cyan-500/20",
    },
    {
      title: "Create",
      subtitle: "Generate drafts and apply your style",
      href: "/snipradar/create/drafts",
      icon: Sparkles,
      badge: draftCount > 0 ? `${draftCount} draft${draftCount === 1 ? "" : "s"}` : null,
      // Purple/pink accent
      iconBg: "bg-purple-100 dark:bg-purple-500/10",
      iconColor: "text-purple-600 dark:text-purple-400",
      borderHover: "hover:border-purple-400 dark:hover:border-purple-500/30",
      glowColor: "group-hover:bg-purple-500/5",
      badgeColor: "bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-500/20",
    },
    {
      title: "Publish",
      subtitle: "Schedule posts and optimize timing",
      href: "/snipradar/publish/scheduler",
      icon: CalendarClock,
      badge: null,
      // Emerald accent
      iconBg: "bg-emerald-100 dark:bg-emerald-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      borderHover: "hover:border-emerald-400 dark:hover:border-emerald-500/30",
      glowColor: "group-hover:bg-emerald-500/5",
      badgeColor: "",
    },
    {
      title: "Analytics",
      subtitle: "Track growth and performance",
      href: "/snipradar/analytics",
      icon: BarChart3,
      badge: null,
      // Amber accent
      iconBg: "bg-amber-100 dark:bg-amber-500/10",
      iconColor: "text-amber-600 dark:text-amber-400",
      borderHover: "hover:border-amber-400 dark:hover:border-amber-500/30",
      glowColor: "group-hover:bg-amber-500/5",
      badgeColor: "",
    },
    {
      title: "Growth Plan",
      subtitle: "Open full-screen AI roadmap",
      href: "/snipradar/growth-planner",
      icon: Wand2,
      badge: "AI",
      // Gradient purple (premium feel)
      iconBg: "bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-500/20 dark:to-pink-500/10",
      iconColor: "text-pink-600 dark:text-pink-400",
      borderHover: "hover:border-pink-400 dark:hover:border-pink-500/30",
      glowColor: "group-hover:bg-pink-500/5",
      badgeColor: "bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-500/20 dark:to-pink-500/20 text-pink-700 dark:text-pink-400 border-pink-300 dark:border-pink-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.title}
            href={card.href}
            onClick={() =>
              trackSnipRadarEvent("snipradar_overview_drafts_pill_click", {
                source: "feature_nav",
                destination: card.href,
              })
            }
            className={cn(
              "group relative overflow-hidden rounded-xl border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.03] to-transparent p-4 transition-all",
              card.borderHover,
              "hover:from-muted/80 dark:hover:from-white/[0.06]"
            )}
          >
            {/* Subtle glow on hover */}
            <div
              className={cn(
                "pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity",
                card.glowColor
              )}
            />

            <div className="relative space-y-3">
              {/* Icon + badge row */}
              <div className="flex items-center justify-between">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", card.iconBg)}>
                  <Icon className={cn("h-4.5 w-4.5", card.iconColor)} style={{ width: 18, height: 18 }} />
                </div>
                {card.badge && (
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold",
                      card.badgeColor
                    )}
                  >
                    {card.badge}
                  </span>
                )}
              </div>

              {/* Text */}
              <div>
                <p className="text-sm font-semibold text-foreground/90 group-hover:text-foreground transition-colors">
                  {card.title}
                </p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-relaxed">
                  {card.subtitle}
                </p>
              </div>

              {/* Arrow — appears on hover */}
              <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
                <span>Open</span>
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
