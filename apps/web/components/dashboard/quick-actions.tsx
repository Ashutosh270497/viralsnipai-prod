"use client";

import Link from "next/link";
import {
  Download,
  TrendingUp,
  Image as ImageIcon,
  Calendar,
  Palette,
  FolderKanban,
  Scissors,
} from "lucide-react";
import { isFeatureEnabled } from "@/config/features";

interface QuickAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  href: string;
  accent?: string; // Tailwind color name for the icon
}

const quickActions: QuickAction[] = [
  {
    icon: Scissors,
    label: "Create Clip",
    description: "Upload and detect short clips",
    href: "/repurpose",
  },
  {
    icon: FolderKanban,
    label: "Projects",
    description: "Manage source videos and clips",
    href: "/projects",
  },
  {
    icon: Download,
    label: "Exports",
    description: "Download branded clips",
    href: "/repurpose/export",
  },
  {
    icon: Palette,
    label: "Brand Kit",
    description: "Set captions and watermark",
    href: "/brand-kit",
  },
  ...(isFeatureEnabled("contentCalendar")
    ? [
        {
          icon: Calendar,
          label: "Content Calendar",
          description: "Plan your content strategy",
          href: "/dashboard/content-calendar",
        },
      ]
    : []),
  ...(isFeatureEnabled("youtubeTitleGenerator")
    ? [
        {
          icon: TrendingUp,
          label: "Title Generator",
          description: "Create click-worthy titles",
          href: "/dashboard/title-generator",
        },
      ]
    : []),
  ...(isFeatureEnabled("thumbnailIdeas")
    ? [
        {
          icon: ImageIcon,
          label: "Thumbnail Ideas",
          description: "Draft thumbnail concepts",
          href: "/dashboard/thumbnail-generator",
        },
      ]
    : []),
];

export function QuickActions() {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
      <div className="mt-3.5 grid grid-cols-2 gap-2 md:grid-cols-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex flex-col items-center gap-2.5 rounded-lg border border-border/40 bg-white/[0.02] p-4 text-center transition-all duration-150 hover:border-primary/30 hover:bg-primary/[0.06] hover:-translate-y-px"
              style={{ boxShadow: "none" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                  "0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px hsl(263 72% 56% / 0.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
              }}
            >
              <div className="rounded-lg bg-card/80 p-2 ring-1 ring-border/60 transition-all duration-150 group-hover:bg-primary/[0.1] group-hover:ring-primary/20">
                <Icon className="h-[18px] w-[18px] text-muted-foreground/70 transition-colors duration-150 group-hover:text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground/90">{action.label}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground/60">
                  {action.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
