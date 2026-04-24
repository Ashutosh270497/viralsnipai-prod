"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  Scissors,
  Palette,
  FolderKanban,
  Image as ImageIcon,
  Film,
  Mic,
  Download,
  Calendar,
  TrendingUp,
  Target,
  Users,
  Radar,
  Inbox,
  Settings,
  CreditCard,
  HelpCircle,
  ChevronsUpDown,
  MessageSquare,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { isFeatureEnabled } from "@/config/features";
import { useFeatureFlags } from "@/components/providers/feature-flag-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Ecosystem } from "@/lib/ecosystem";

type WorkspaceLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: string;
  activePaths?: string[];
};

type NavSection = {
  title: string;
  links: WorkspaceLink[];
};

interface WorkspaceNavProps {
  user?: {
    name?: string;
    email: string;
    image?: string;
  };
  ecosystem: Ecosystem;
  onNavigate?: () => void;
}

function NavLink({
  link,
  isActive,
  onNavigate,
}: {
  link: WorkspaceLink;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const Icon = link.icon;
  return (
    <Link
      href={link.disabled ? "#" : link.href}
      onClick={link.disabled ? undefined : onNavigate}
      aria-disabled={link.disabled ? "true" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-primary/[0.12] text-primary"
          : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
        link.disabled && "pointer-events-none opacity-40",
      )}
      title={link.disabled ? "Temporarily unavailable" : undefined}
    >
      {/* Left accent bar with glow */}
      {isActive && (
        <span
          className="absolute left-0 inset-y-2 w-[3px] rounded-r-full bg-primary"
          style={{ boxShadow: "0 0 8px hsl(160 84% 39% / 0.9), 0 0 16px hsl(160 84% 39% / 0.4)" }}
        />
      )}
      <Icon
        className={cn(
          "h-[15px] w-[15px] shrink-0 transition-colors",
          isActive
            ? "text-primary"
            : "text-muted-foreground/70 group-hover:text-foreground",
        )}
      />
      <span className="flex-1 truncate">{link.label}</span>
      {link.badge && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            link.badge === "New"
              ? "bg-emerald-500/15 text-emerald-400"
              : link.badge === "AI"
              ? "bg-primary/15 text-primary"
              : "bg-amber-500/15 text-amber-400",
          )}
        >
          {link.badge}
        </span>
      )}
    </Link>
  );
}

export function WorkspaceNav({ user, ecosystem, onNavigate }: WorkspaceNavProps) {
  const pathname = usePathname();
  const flags = useFeatureFlags();
  const v2CreatorGrowthEnabled =
    isFeatureEnabled("contentCalendar") ||
    isFeatureEnabled("youtubeTitleGenerator") ||
    isFeatureEnabled("keywordResearch");
  const v3AutomationEnabled = flags.snipRadarEnabled;
  const competitorTrackingEnabled = isFeatureEnabled("competitorTracking");

  const contentWorkflow: WorkspaceLink[] =
    ecosystem === "x" && v3AutomationEnabled
      ? [
          { href: "/snipradar/assistant", label: "Assistant", icon: MessageSquare, badge: "AI" },
          { href: "/snipradar/overview", label: "Overview", icon: LayoutDashboard },
          { href: "/snipradar/discover/tracker", label: "Discover", icon: Radar },
          { href: "/snipradar/inbox", label: "Inbox", icon: Inbox, badge: "New" },
          ...(flags.relationshipsCrmEnabled
            ? [{ href: "/snipradar/relationships", label: "Relationships", icon: Users }]
            : []),
          { href: "/snipradar/create/drafts", label: "Create", icon: Sparkles },
          { href: "/snipradar/publish/scheduler", label: "Publish", icon: Calendar },
          { href: "/snipradar/analytics", label: "Analytics", icon: TrendingUp },
          { href: "/snipradar/growth-planner", label: "Growth Plan", icon: Target, badge: "AI" },
        ]
      : [
          { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/projects", label: "Projects", icon: FolderKanban },
          {
            href: "/repurpose",
            label: "Create Clip",
            icon: Scissors,
            activePaths: ["/repurpose", "/repurpose/editor"],
          },
          { href: "/repurpose/export", label: "Exports", icon: Download },
          { href: "/brand-kit", label: "Brand Kit", icon: Palette },
          ...(v2CreatorGrowthEnabled
            ? [
                { href: "/dashboard/content-calendar", label: "Content Calendar", icon: Calendar },
                { href: "/dashboard/title-generator", label: "Title Generator", icon: TrendingUp },
                { href: "/keywords", label: "Keyword Research", icon: Target },
              ]
            : []),
          ...(flags.youtubeThumbnailGeneratorEnabled
            ? [{ href: "/dashboard/thumbnail-generator", label: "Thumbnail Generator", icon: ImageIcon }]
            : []),
          ...(competitorTrackingEnabled
            ? [{ href: "/competitors", label: "Competitors", icon: Users, badge: "V3" }]
            : []),
        ];

  const productionTools: WorkspaceLink[] =
    ecosystem === "x" || !v3AutomationEnabled
      ? []
      : [
          ...(flags.transcribeUiEnabled
            ? [{ href: "/transcribe", label: "Transcribe", icon: Download }]
            : []),
          ...(flags.imagenEnabled ? [{ href: "/imagen", label: "Imagen", icon: ImageIcon }] : []),
          ...(flags.soraEnabled ? [{ href: "/video", label: "Video Lab", icon: Film }] : []),
          ...(flags.youtubeVoicerEnabled ? [{ href: "/voicer", label: "Voicer", icon: Mic }] : []),
          ...(flags.veoEnabled ? [{ href: "/veo", label: "Veo", icon: Film }] : []),
        ];

  const assetManagement: WorkspaceLink[] =
    ecosystem === "x" ? [] : [];

  const sections: NavSection[] = [
    { title: "Workflow", links: contentWorkflow },
    { title: "Production", links: productionTools },
    { title: "Assets", links: assetManagement },
  ].filter((section) => section.links.length > 0);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (user?.email?.[0]?.toUpperCase() ?? "U");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Scrollable nav area */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/40 select-none">
                {section.title}
              </p>
              <div className="space-y-px">
                {section.links.map((link) => {
                  const isActive =
                    pathname === link.href ||
                    link.activePaths?.some((activePath) => pathname === activePath) ||
                    (link.href !== "/dashboard" &&
                      link.href !== "/repurpose" &&
                      pathname?.startsWith(`${link.href}/`));
                  return (
                    <NavLink
                      key={link.href}
                      link={link}
                      isActive={isActive}
                      onNavigate={onNavigate}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Bottom utility + user profile */}
      <div className="shrink-0 border-t border-border/40">
        {/* Utility links */}
        <div className="space-y-px px-2.5 py-2">
          {[
            { href: "/billing", icon: CreditCard, label: "Billing" },
            { href: "/settings", icon: Settings, label: "Settings" },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-sm font-medium transition-all duration-150",
                pathname?.startsWith(href)
                  ? "bg-primary/[0.12] text-primary"
                  : "text-muted-foreground/70 hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              <Icon className="h-[15px] w-[15px] shrink-0" />
              <span>{label}</span>
            </Link>
          ))}
          <Link
            href="https://docs.viralsnipai.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-sm font-medium text-muted-foreground/70 transition-all duration-150 hover:bg-white/[0.04] hover:text-foreground"
          >
            <HelpCircle className="h-[15px] w-[15px] shrink-0" />
            <span>Help & Docs</span>
          </Link>
        </div>

        {/* User profile card */}
        {user && (
          <div className="px-2.5 pb-3">
            <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-white/[0.03] px-3 py-2.5 transition-all duration-150 hover:border-border hover:bg-white/[0.05] cursor-pointer">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={user.image} alt={user.name ?? user.email} />
                <AvatarFallback
                  className="text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #047857, #10b981)" }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                {user.name && (
                  <p className="truncate text-xs font-semibold text-foreground">{user.name}</p>
                )}
                <p className="truncate text-[10px] text-muted-foreground/80">{user.email}</p>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
