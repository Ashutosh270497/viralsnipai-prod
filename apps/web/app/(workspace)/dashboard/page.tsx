import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Lightbulb, FileText, TrendingUp, Target, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";

import { getUnifiedActivityData } from "@/lib/activity-center";
import { getCurrentUser, getCurrentSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/analytics/metrics";
import { ActivityCenterPanel } from "@/components/activity/activity-center-panel";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RecentActivityList } from "@/components/dashboard/recent-activity-list";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { ActivationProgressCard } from "@/components/dashboard/activation-progress-card";
import { Skeleton } from "@/components/ui/skeleton";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const session = await getCurrentSession();
  if (session?.user && !session.user.onboardingCompleted) {
    redirect("/onboarding");
  }

  const [dashboardData, activityData] = await Promise.all([
    getDashboardData(user.id),
    getUnifiedActivityData(user.id, { limit: 6 }),
  ]);
  const { metrics, recentActivity, usageStats, insights, onboarding, activation } = dashboardData;

  const firstName = user.name?.split(" ")[0] ?? "Creator";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6 pb-10 animate-enter">
      {/* ── Hero header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/50 mb-1">
            {greeting}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {firstName}&apos;s Studio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Here&apos;s what&apos;s happening with your content today
          </p>
        </div>

        {/* Quick-launch CTAs */}
        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/hooksmith"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/[0.1] px-3 py-2 text-xs font-semibold text-primary ring-1 ring-primary/20 transition-all hover:bg-primary/[0.16] hover:ring-primary/40"
          >
            <Zap className="h-3.5 w-3.5" />
            New Hook
          </Link>
          <Link
            href="/repurpose"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs font-semibold text-foreground/80 transition-all hover:border-border hover:bg-card"
          >
            Repurpose Video
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* ── Key Metrics ─────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 stagger">
        <MetricCard
          icon={Lightbulb}
          label="Content Ideas"
          value={metrics.totalIdeas}
          change={metrics.weekOverWeekGrowth}
          changeLabel="vs last week"
        />
        <MetricCard
          icon={FileText}
          label="Scripts Created"
          value={metrics.scriptedIdeas}
        />
        <MetricCard
          icon={TrendingUp}
          label="Published"
          value={metrics.publishedIdeas}
        />
        <MetricCard
          icon={Target}
          label="Avg Virality Score"
          value={metrics.averageViralityScore}
        />
      </div>

      {/* ── Main 2-col grid ─────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left column — 2/3 */}
        <div className="space-y-5 lg:col-span-2">
          <QuickActions />

          <Suspense
            fallback={
              <div className="space-y-3">
                <Skeleton className="h-40 w-full" />
              </div>
            }
          >
            <RecentActivityList activities={recentActivity} />
          </Suspense>

          <ActivityCenterPanel
            data={activityData}
            title="Operations & Jobs"
            description="Background work from Creator Studio, RepurposeOS, and Transcribe"
            maxItems={6}
            showViewAll
            emptyTitle="No operations yet"
            emptyDescription="Long-running jobs and workflow activity will appear here once you start creating."
          />
        </div>

        {/* Right column — 1/3 */}
        <div className="space-y-4">
          <ActivationProgressCard activation={activation} />
          <UsageMeter usageStats={usageStats} subscriptionTier={metrics.subscriptionTier} />
          <InsightsPanel insights={insights} onboarding={onboarding} />
        </div>
      </div>

      {/* ── Stats footer ────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/40 bg-card/40 p-4">
        <div className="grid gap-4 text-center md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/30">
          <div className="pb-3 md:pb-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Top Niche
            </p>
            <p className="mt-1.5 text-sm font-semibold text-foreground">
              {metrics.mostPopularNiche || "—"}
            </p>
          </div>
          <div className="py-3 md:py-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Top Keyword
            </p>
            <p className="mt-1.5 text-sm font-semibold text-foreground">
              {metrics.topKeyword || "—"}
            </p>
          </div>
          <div className="pt-3 md:pt-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Current Plan
            </p>
            <p className="mt-1.5 text-sm font-semibold capitalize text-primary">
              {metrics.subscriptionTier}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
