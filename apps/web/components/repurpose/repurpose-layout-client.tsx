"use client";

import { Download, Scissors, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn, formatDuration } from "@/lib/utils";
import type { ProjectSummary } from "./types";
import { RepurposeProvider, useRepurpose } from "./repurpose-context";

const NAV_ITEMS = [
  { label: "Create", href: "/repurpose", icon: Sparkles },
  { label: "Editor", href: "/repurpose/editor", icon: Scissors },
  { label: "Export", href: "/repurpose/export", icon: Download },
] as const;

function RepurposeLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { projectId, project, primaryAsset } = useRepurpose();
  const clipCount = project?.clips?.length ?? 0;
  const approvedCount =
    project?.clips?.filter((clip) => clip.reviewStatus === "approved" || clip.reviewStatus === "export_ready").length ?? 0;
  const status =
    !projectId
      ? "No project"
      : !primaryAsset
        ? "No source"
        : clipCount === 0
          ? "Source ready"
          : approvedCount > 0
            ? "Ready to export"
            : "Clips ready";

  return (
    <div className="-mx-4 -mt-4 min-h-screen w-full min-w-0 flex-1 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_34%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.07),transparent_32%)] lg:-mx-6 lg:-mt-6">
      <div className="border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur-xl lg:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/55">
              ViralSnipAI
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {project?.title ?? "Create Clips"}
              </h1>
              <span className="rounded-full border border-border/60 bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {status}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground/60">
              {primaryAsset?.durationSec ? formatDuration(primaryAsset.durationSec * 1000) : "No source duration"} · {clipCount} clip{clipCount === 1 ? "" : "s"} · {project?.exports?.length ?? 0} export{(project?.exports?.length ?? 0) === 1 ? "" : "s"}
            </p>
          </div>
          <nav className="flex w-full gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card/50 p-1 xl:w-auto">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              const disabled = !projectId || (item.href !== "/repurpose" && clipCount === 0);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={disabled ? "/repurpose" : `${item.href}${projectId ? `?projectId=${projectId}` : ""}`}
                  aria-disabled={disabled}
                  className={cn(
                    "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    disabled && "pointer-events-none opacity-45",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <main className="px-4 pb-10 pt-6 lg:px-6">
        {children}
      </main>
    </div>
  );
}

export function RepurposeLayoutClient({
  children,
  projects,
}: {
  children: React.ReactNode;
  projects: ProjectSummary[];
}) {
  return (
    <RepurposeProvider projects={projects}>
      <RepurposeLayoutInner>{children}</RepurposeLayoutInner>
    </RepurposeProvider>
  );
}
