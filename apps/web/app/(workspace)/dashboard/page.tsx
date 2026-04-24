import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileVideo,
  FolderKanban,
  Loader2,
  Scissors,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";

import { getCurrentUser, getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePlanTier, formatPlanName } from "@/lib/billing/plans";
import { formatDate } from "@/lib/utils";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { cn } from "@/lib/utils";

type ExportStatusSummary = {
  id: string;
  projectId: string;
  projectTitle: string;
  preset: string;
  status: string;
  updatedAt: Date;
};

type ProjectSummary = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  clipCount: number;
  exportCount: number;
  primaryAssetType: string | null;
  latestExportStatus: string | null;
};

function statusLabel(status: string): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "processing":
      return "Rendering";
    case "complete":
    case "completed":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function statusTone(status: string): string {
  switch (status) {
    case "complete":
    case "completed":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "failed":
      return "text-red-400 bg-red-500/10 border-red-500/20";
    case "processing":
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    default:
      return "text-muted-foreground bg-white/[0.04] border-border/40";
  }
}

function StatusIcon({ status, className }: { status: string; className?: string }) {
  if (status === "complete" || status === "completed") {
    return <CheckCircle2 className={cn("h-3.5 w-3.5", className)} />;
  }
  if (status === "failed") {
    return <XCircle className={cn("h-3.5 w-3.5", className)} />;
  }
  if (status === "processing") {
    return <Loader2 className={cn("h-3.5 w-3.5 animate-spin", className)} />;
  }
  return <Sparkles className={cn("h-3.5 w-3.5", className)} />;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const session = await getCurrentSession();
  if (session?.user && !session.user.onboardingCompleted) {
    redirect("/onboarding");
  }

  const [dbUser, projects, recentExports, monthlyUsage] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        plan: true,
        subscriptionTier: true,
        creditsRemaining: true,
      },
    }),
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { clips: true, exports: true } },
        assets: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { type: true },
        },
        exports: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { status: true },
        },
      },
    }),
    prisma.export.findMany({
      where: { project: { userId: user.id } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        projectId: true,
        preset: true,
        status: true,
        updatedAt: true,
        project: { select: { title: true } },
      },
    }),
    (() => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      return prisma.export.count({
        where: {
          project: { userId: user.id },
          createdAt: { gte: startOfMonth },
          status: { in: ["complete", "completed"] },
        },
      });
    })(),
  ]);

  const tier = resolvePlanTier(dbUser?.subscriptionTier || dbUser?.plan || "free");
  const creditsRemaining = dbUser?.creditsRemaining ?? 0;

  const summarizedProjects: ProjectSummary[] = projects.map((project) => ({
    id: project.id,
    title: project.title,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    clipCount: project._count.clips,
    exportCount: project._count.exports,
    primaryAssetType: project.assets[0]?.type ?? null,
    latestExportStatus: project.exports[0]?.status ?? null,
  }));

  const exportStatusRows: ExportStatusSummary[] = recentExports.map((exp) => ({
    id: exp.id,
    projectId: exp.projectId,
    projectTitle: exp.project.title,
    preset: exp.preset,
    status: exp.status,
    updatedAt: exp.updatedAt,
  }));

  const hasProjects = summarizedProjects.length > 0;
  const firstName = user.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6 pb-10 animate-enter">
      {/* ── Hero header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground/50">
            {greeting}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {firstName}&apos;s studio
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground/70">
            Upload a long video, let ViralSnipAI find the strongest moments, and export
            branded short-form clips ready to publish.
          </p>
        </div>
        {hasProjects ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs font-semibold text-foreground/80 transition-all hover:border-border hover:bg-card"
            >
              <FolderKanban className="h-3.5 w-3.5" />
              All projects
            </Link>
            <NewProjectDialog
              triggerLabel="Create new clip"
              triggerSize="sm"
              onSuccessRedirect="/repurpose"
            />
          </div>
        ) : null}
      </div>

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!hasProjects ? (
        <EmptyState />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Left: recent projects */}
          <div className="space-y-5 lg:col-span-2">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Recent projects</h2>
                  <p className="text-xs text-muted-foreground/60">
                    Continue a project or start a new clip from a long video.
                  </p>
                </div>
                <Link
                  href="/projects"
                  className="text-xs font-medium text-primary/80 hover:text-primary"
                >
                  View all →
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {summarizedProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/repurpose?projectId=${project.id}`}
                    className="group rounded-xl border border-border/50 bg-card/60 p-4 transition-all hover:border-border hover:bg-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {project.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                          Updated {formatDate(project.updatedAt)}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg ring-1",
                          project.primaryAssetType
                            ? "bg-primary/10 text-primary ring-primary/20"
                            : "bg-muted/30 text-muted-foreground/50 ring-border/40",
                        )}
                      >
                        <FileVideo className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground/70">
                      <span className="inline-flex items-center gap-1">
                        <Scissors className="h-3 w-3" />
                        {project.clipCount} clip{project.clipCount === 1 ? "" : "s"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {project.exportCount} export{project.exportCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    {project.latestExportStatus ? (
                      <div
                        className={cn(
                          "mt-3 inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                          statusTone(project.latestExportStatus),
                        )}
                      >
                        <StatusIcon status={project.latestExportStatus} />
                        {statusLabel(project.latestExportStatus)}
                      </div>
                    ) : null}
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-primary/80 transition-colors group-hover:text-primary">
                      Open project
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Export status</h2>
                  <p className="text-xs text-muted-foreground/60">
                    Recent renders across your projects.
                  </p>
                </div>
                <Link
                  href="/repurpose/export"
                  className="text-xs font-medium text-primary/80 hover:text-primary"
                >
                  All exports →
                </Link>
              </div>

              {exportStatusRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/40 bg-white/[0.02] p-6 text-center text-xs text-muted-foreground/60">
                  No exports yet. Finish editing clips to queue a render.
                </div>
              ) : (
                <div className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50 bg-card/40">
                  {exportStatusRows.map((row) => (
                    <Link
                      key={row.id}
                      href={`/repurpose/export?projectId=${row.projectId}`}
                      className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/[0.02]"
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                          statusTone(row.status),
                        )}
                      >
                        <StatusIcon status={row.status} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{row.projectTitle}</p>
                        <p className="truncate text-[11px] text-muted-foreground/60">
                          {row.preset}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground/60">
                        {formatDate(row.updatedAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right: usage + plan */}
          <div className="space-y-4">
            <UsageCard
              planLabel={formatPlanName(tier)}
              creditsRemaining={creditsRemaining}
              exportsThisMonth={monthlyUsage}
            />
            <QuickHelp />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border/50 bg-gradient-to-br from-primary/[0.06] via-background to-background p-8 sm:p-12">
      <div className="mx-auto max-w-2xl text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
            boxShadow: "0 0 24px hsl(160 84% 39% / 0.45)",
          }}
        >
          <Upload className="h-6 w-6 text-white" />
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
          Upload your first long video and turn it into viral-ready clips.
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground/70">
          Best for podcasts, webinars, tutorials, interviews, and long-form videos. We&apos;ll
          find the strongest moments and prepare clips for short-form platforms.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <NewProjectDialog
            triggerLabel="Create first clip"
            triggerSize="lg"
            onSuccessRedirect="/repurpose"
          />
          <Link
            href="/brand-kit"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 px-4 py-2.5 text-sm font-semibold text-foreground/80 transition-all hover:border-border hover:bg-card"
          >
            Set up brand kit
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <EmptyTile
            icon={<Upload className="h-4 w-4" />}
            title="Upload or paste a URL"
            description="MP4, MOV, WebM, MP3, or WAV — up to 4 GB."
          />
          <EmptyTile
            icon={<Sparkles className="h-4 w-4" />}
            title="AI finds the best moments"
            description="Auto-detected highlights scored for virality."
          />
          <EmptyTile
            icon={<Download className="h-4 w-4" />}
            title="Branded export, ready to post"
            description="Captions, brand kit, and aspect ratios applied."
          />
        </div>
      </div>
    </div>
  );
}

function EmptyTile({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-white/[0.02] p-4 text-left">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground/70">{description}</p>
    </div>
  );
}

function UsageCard({
  planLabel,
  creditsRemaining,
  exportsThisMonth,
}: {
  planLabel: string;
  creditsRemaining: number;
  exportsThisMonth: number;
}) {
  const isUnlimited = creditsRemaining >= 999_000;
  const creditsDisplay = isUnlimited
    ? "Unlimited"
    : creditsRemaining.toLocaleString();

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
          Your plan
        </p>
        <Link
          href="/billing"
          className="text-[11px] font-medium text-primary/80 hover:text-primary"
        >
          Manage →
        </Link>
      </div>
      <p className="mt-2 text-lg font-bold text-foreground">{planLabel}</p>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground/70">Credits remaining</span>
          <span className="font-semibold text-foreground">{creditsDisplay}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground/70">Exports this month</span>
          <span className="font-semibold text-foreground">{exportsThisMonth}</span>
        </div>
      </div>

      <Link
        href="/billing"
        className="mt-5 block w-full rounded-lg border border-border/60 bg-white/[0.02] px-3 py-2 text-center text-xs font-semibold text-foreground/80 transition-colors hover:border-border hover:bg-white/[0.04]"
      >
        Upgrade plan
      </Link>
    </div>
  );
}

function QuickHelp() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
        Tips
      </p>
      <ul className="mt-3 space-y-2 text-xs text-muted-foreground/80">
        <li>Start with 15–60 minute source videos for the best clip results.</li>
        <li>Set your brand kit once — colours, fonts, and captions flow to every export.</li>
        <li>Use the target platform in each project to get the right aspect ratio.</li>
      </ul>
    </div>
  );
}
