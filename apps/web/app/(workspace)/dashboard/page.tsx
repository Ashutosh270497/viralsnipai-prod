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
  Zap,
} from "lucide-react";

import { getCurrentUser, getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePlanTier, formatPlanName } from "@/lib/billing/plans";
import { formatDate } from "@/lib/utils";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { cn } from "@/lib/utils";
import {
  AppCard,
  EmptyState as ProductEmptyState,
  PageHeader,
  StatusBadge,
  UsageMeter as ProductUsageMeter,
} from "@/components/product-ui/primitives";

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
          status: { in: ["done", "complete", "completed"] },
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
    <div className="w-full space-y-6 pb-10 animate-enter">
      <AppCard className="relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.18),transparent_32%),radial-gradient(circle_at_55%_70%,rgba(6,182,212,0.16),transparent_28%)] lg:block" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            eyebrow={greeting}
            title={`${firstName}'s studio`}
            description="Upload long videos, let ViralSnipAI find the strongest moments, and export branded short-form clips ready to publish."
            icon={Sparkles}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/projects"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border/70 bg-card px-4 text-sm font-semibold text-foreground transition hover:border-primary/35"
            >
              <FolderKanban className="h-4 w-4" />
              View projects
            </Link>
            <NewProjectDialog triggerLabel="Create new clip" triggerSize="sm" onSuccessRedirect="/repurpose" />
          </div>
        </div>
      </AppCard>

      {!hasProjects ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric title="Projects" value={summarizedProjects.length} icon={FolderKanban} />
            <Metric title="Clips generated" value={summarizedProjects.reduce((sum, item) => sum + item.clipCount, 0)} icon={Scissors} />
            <Metric title="Exports this month" value={monthlyUsage} icon={Download} />
            <Metric title="Credits remaining" value={creditsRemaining >= 999_000 ? "Unlimited" : creditsRemaining} icon={Zap} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <AppCard className="p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Recent projects</h2>
                    <p className="text-sm text-muted-foreground">
                      Continue a project or start a new clip from long-form video.
                    </p>
                  </div>
                  <Link href="/projects" className="text-sm font-semibold text-primary hover:underline">
                    View all
                  </Link>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                {summarizedProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/repurpose?projectId=${project.id}`}
                    className="group rounded-2xl border border-border/70 bg-background/60 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card hover:shadow-lg hover:shadow-emerald-950/10"
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
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
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
                      <StatusBadge status={statusLabel(project.latestExportStatus)} className="mt-3" />
                    ) : null}
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-primary/80 transition-colors group-hover:text-primary">
                      Open project
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
                </div>
              </AppCard>

              <AppCard className="p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Export status</h2>
                    <p className="text-sm text-muted-foreground">Recent renders across your projects.</p>
                  </div>
                  <Link href="/repurpose/export" className="text-sm font-semibold text-primary hover:underline">
                    All exports
                  </Link>
                </div>
              {exportStatusRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                  No exports yet. Finish editing clips to queue a render.
                </div>
              ) : (
                <div className="space-y-3">
                  {exportStatusRows.map((row) => (
                    <Link
                      key={row.id}
                      href={`/repurpose/export?projectId=${row.projectId}`}
                      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-sm transition hover:border-primary/35"
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"
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
                      <StatusBadge status={row.status} />
                    </Link>
                  ))}
                </div>
              )}
              </AppCard>
            </div>

            <div className="space-y-4">
            <UsageCard
              planLabel={formatPlanName(tier)}
              creditsRemaining={creditsRemaining}
              exportsThisMonth={monthlyUsage}
            />
            <QuickHelp />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <ProductEmptyState
      icon={Upload}
      title="Upload your first long video and turn it into clips"
      description="Best for podcasts, webinars, tutorials, interviews, and founder videos. ViralSnipAI finds the strongest moments and prepares short-form exports."
      secondary={{ label: "Set up brand kit", href: "/brand-kit" }}
      className="min-h-[420px]"
    >
      <NewProjectDialog triggerLabel="Create first clip" triggerSize="lg" onSuccessRedirect="/repurpose" />
    </ProductEmptyState>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: string | number; icon: typeof Sparkles }) {
  return (
    <AppCard className="p-5" interactive>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/14 to-cyan-500/14 text-primary ring-1 ring-primary/20">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </AppCard>
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
    <AppCard className="p-5">
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
        <ProductUsageMeter label="Exports this month" value={exportsThisMonth} max={tierLimit(planLabel)} />
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Credits remaining</span>
            <span className="font-semibold text-foreground">{creditsDisplay}</span>
          </div>
        </div>
      </div>

      <Link
        href="/billing"
        className="mt-5 block w-full rounded-lg border border-border/60 bg-white/[0.02] px-3 py-2 text-center text-xs font-semibold text-foreground/80 transition-colors hover:border-border hover:bg-white/[0.04]"
      >
        Upgrade plan
      </Link>
    </AppCard>
  );
}

function QuickHelp() {
  return (
    <AppCard className="p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
        Tips
      </p>
      <ul className="mt-3 space-y-2 text-xs text-muted-foreground/80">
        <li>Start with 15–60 minute source videos for the best clip results.</li>
        <li>Set your brand kit once — colours, fonts, and captions flow to every export.</li>
        <li>Use the target platform in each project to get the right aspect ratio.</li>
      </ul>
    </AppCard>
  );
}

function tierLimit(planLabel: string) {
  if (/pro/i.test(planLabel)) return 250;
  if (/plus|starter|creator/i.test(planLabel)) return 50;
  return 5;
}
