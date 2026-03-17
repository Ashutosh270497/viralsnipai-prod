import { unstable_cache } from "next/cache";
import {
  buildActivationSummary,
  getActivationCheckpointStatuses,
} from "@/lib/analytics/activation";
import {
  PLAN_LIMITS,
  formatPlanName,
  getTotalMonthlyCoreAllowance,
  planHasUnlimitedCoreUsage,
  resolvePlanTier,
} from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";
import {
  ActivationSummary,
  DashboardMetrics,
  RecentActivityItem,
  UsageStats,
  InsightItem,
  OnboardingStep,
  DashboardData,
  PlanTier,
} from "@/types/dashboard";

// ─── Default / fallback ──────────────────────────────────────────────────────

function getDefaultMetrics(): DashboardMetrics {
  const freeTier = resolvePlanTier("free");
  return {
    totalIdeas: 0,
    scriptedIdeas: 0,
    publishedIdeas: 0,
    averageViralityScore: 0,
    creditsUsed: 0,
    creditsRemaining: getTotalMonthlyCoreAllowance(freeTier),
    subscriptionTier: "free",
    weekOverWeekGrowth: 0,
    mostPopularNiche: "Get started",
    topKeyword: "Create content",
  };
}

function getDefaultUsageStats(): UsageStats[] {
  const limits = PLAN_LIMITS.free;
  return [
    { feature: "Content Ideas", count: 0, limit: limits.ideas, percentage: 0 },
    { feature: "Scripts", count: 0, limit: limits.scripts, percentage: 0 },
    { feature: "Titles", count: 0, limit: limits.titles, percentage: 0 },
    { feature: "Thumbnails", count: 0, limit: limits.thumbnails, percentage: 0 },
  ];
}

function getDefaultInsights(): InsightItem[] {
  return [
    {
      id: "database-connection",
      type: "warning",
      title: "Unable to load analytics",
      description:
        "Check your database connection in .env file and ensure your Supabase project is active.",
    },
    {
      id: "welcome",
      type: "tip",
      title: "Get started with your first content idea",
      description:
        "Use our Content Calendar to brainstorm viral video ideas powered by AI.",
      actionLabel: "Create Content Idea",
      actionUrl: "/dashboard/content-calendar",
    },
  ];
}

function getDefaultOnboardingSteps(): OnboardingStep[] {
  return [
    { id: "start-onboarding", label: "Start creator onboarding", completed: false, url: "/onboarding" },
    { id: "complete-onboarding", label: "Complete creator setup", completed: false, url: "/dashboard" },
    { id: "create-idea", label: "Create your first content idea", completed: false, url: "/dashboard/content-calendar" },
    { id: "generate-script", label: "Generate a video script", completed: false, url: "/dashboard/script-generator" },
    { id: "generate-title", label: "Create optimized titles", completed: false, url: "/dashboard/title-generator" },
    { id: "generate-thumbnail", label: "Design eye-catching thumbnails", completed: false, url: "/dashboard/thumbnail-generator" },
  ];
}

function getDefaultActivationSummary(): ActivationSummary {
  return {
    ecosystemLabel: "Creator Studio",
    activated: false,
    activationEventLabel: "First script generated",
    activationCompletedAt: null,
    ahaMoment:
      "The first real value moment is turning an idea into a usable script, not just finishing setup.",
    successThreshold:
      "Activation requires onboarding completion, a first idea, and a first generated script.",
    progressPct: 0,
    completedSteps: 0,
    totalSteps: 6,
    nextStepLabel: "Onboarding started",
    nextStepUrl: "/onboarding",
  };
}

// ─── Sub-queries ──────────────────────────────────────────────────────────────

async function calculateMetrics(userId: string, tier: PlanTier): Promise<DashboardMetrics> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // Fetch ideas, usage logs, and week counts all in parallel
  const [allIdeas, usageLogs, lastWeekCount, previousWeekCount] = await Promise.all([
    prisma.contentIdea.findMany({
      where: { userId },
      select: { status: true, viralityScore: true, contentCategory: true, keywords: true },
    }),
    prisma.usageLog.findMany({
      where: { userId, createdAt: { gte: startOfMonth } },
      select: { creditsUsed: true },
    }),
    prisma.contentIdea.count({ where: { userId, createdAt: { gte: lastWeek } } }),
    prisma.contentIdea.count({ where: { userId, createdAt: { gte: twoWeeksAgo, lt: lastWeek } } }),
  ]);

  const totalIdeas = allIdeas.length;
  const scriptedIdeas = allIdeas.filter(
    (i) => i.status === "scripted" || i.status === "published"
  ).length;
  const publishedIdeas = allIdeas.filter((i) => i.status === "published").length;

  const scoresWithValues = allIdeas.filter((i) => i.viralityScore !== null);
  const averageViralityScore =
    scoresWithValues.length > 0
      ? Math.round(
          scoresWithValues.reduce((sum, i) => sum + (i.viralityScore || 0), 0) /
            scoresWithValues.length
        )
      : 0;

  const creditsUsed = usageLogs.reduce((sum, l) => sum + (l.creditsUsed || 0), 0);

  const limits = PLAN_LIMITS[tier];
  const totalMonthlyLimit = getTotalMonthlyCoreAllowance(tier);
  const creditsRemaining =
    totalMonthlyLimit === 0 ? Infinity : Math.max(0, totalMonthlyLimit - creditsUsed);

  const weekOverWeekGrowth =
    previousWeekCount > 0
      ? Math.round(((lastWeekCount - previousWeekCount) / previousWeekCount) * 100)
      : lastWeekCount > 0
      ? 100
      : 0;

  const nicheCounts = allIdeas.reduce((acc, i) => {
    const niche = i.contentCategory || "General";
    acc[niche] = (acc[niche] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const mostPopularNiche =
    Object.entries(nicheCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "None yet";

  const keywordCounts = allIdeas.reduce((acc, i) => {
    const keywords = (i.keywords as string[]) || [];
    keywords.forEach((kw) => { acc[kw] = (acc[kw] || 0) + 1; });
    return acc;
  }, {} as Record<string, number>);
  const topKeyword =
    Object.entries(keywordCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "None yet";

  return {
    totalIdeas,
    scriptedIdeas,
    publishedIdeas,
    averageViralityScore,
    creditsUsed,
    creditsRemaining: creditsRemaining === Infinity ? 999999 : creditsRemaining,
    subscriptionTier: tier,
    weekOverWeekGrowth,
    mostPopularNiche,
    topKeyword,
  };
}

async function getRecentActivity(userId: string): Promise<RecentActivityItem[]> {
  const recentIdeas = await prisma.contentIdea.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      status: true,
      viralityScore: true,
      createdAt: true,
      contentCategory: true,
    },
  });

  return recentIdeas.map((idea) => ({
    id: idea.id,
    type: "idea" as const,
    title: idea.title,
    status: idea.status as "draft" | "scripted" | "published",
    viralityScore: idea.viralityScore || undefined,
    createdAt: idea.createdAt,
    niche: idea.contentCategory || undefined,
  }));
}

async function calculateUsageStats(userId: string, tier: PlanTier): Promise<UsageStats[]> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const limits = PLAN_LIMITS[tier];

  const [ideasCount, scriptsCount, titlesCount, thumbnailsCount] = await Promise.all([
    prisma.contentIdea.count({ where: { userId, createdAt: { gte: startOfMonth } } }),
    prisma.generatedScript.count({ where: { userId, createdAt: { gte: startOfMonth } } }),
    prisma.generatedTitle.count({ where: { userId, createdAt: { gte: startOfMonth } } }),
    prisma.thumbnail.count({ where: { userId, createdAt: { gte: startOfMonth } } }),
  ]);

  return [
    {
      feature: "Content Ideas",
      count: ideasCount,
      limit: limits.ideas === Infinity ? null : limits.ideas,
      percentage: limits.ideas === Infinity ? 0 : Math.min(100, (ideasCount / limits.ideas) * 100),
    },
    {
      feature: "Scripts",
      count: scriptsCount,
      limit: limits.scripts === Infinity ? null : limits.scripts,
      percentage: limits.scripts === Infinity ? 0 : Math.min(100, (scriptsCount / limits.scripts) * 100),
    },
    {
      feature: "Titles",
      count: titlesCount,
      limit: limits.titles === Infinity ? null : limits.titles,
      percentage: limits.titles === Infinity ? 0 : Math.min(100, (titlesCount / limits.titles) * 100),
    },
    {
      feature: "Thumbnails",
      count: thumbnailsCount,
      limit: limits.thumbnails === Infinity ? null : limits.thumbnails,
      percentage: limits.thumbnails === Infinity ? 0 : Math.min(100, (thumbnailsCount / limits.thumbnails) * 100),
    },
  ];
}

async function generateInsights(userId: string, tier: PlanTier): Promise<InsightItem[]> {
  const insights: InsightItem[] = [];

  const [ideasCount, scriptsCount, recentIdeas] = await Promise.all([
    prisma.contentIdea.count({ where: { userId } }),
    prisma.generatedScript.count({ where: { userId } }),
    prisma.contentIdea.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { status: true, viralityScore: true, contentCategory: true },
    }),
  ]);

  if (ideasCount === 0) {
    insights.push({
      id: "welcome",
      type: "tip",
      title: "Get started with your first content idea",
      description: "Use our Content Calendar to brainstorm viral video ideas powered by AI.",
      actionLabel: "Create Content Idea",
      actionUrl: "/dashboard/content-calendar",
    });
  }

  if (ideasCount > 0 && scriptsCount === 0) {
    insights.push({
      id: "first-script",
      type: "opportunity",
      title: "Ready to write your first script?",
      description:
        "Transform your content ideas into production-ready scripts with AI assistance.",
      actionLabel: "Generate Script",
      actionUrl: "/dashboard/script-generator",
    });
  }

  const highViralityIdeas = recentIdeas.filter((i) => (i.viralityScore || 0) >= 80);
  if (highViralityIdeas.length > 0) {
    insights.push({
      id: "high-virality",
      type: "trend",
      title: `You have ${highViralityIdeas.length} high-potential idea${highViralityIdeas.length > 1 ? "s" : ""}`,
      description:
        "These ideas scored 80+ on virality. Consider prioritizing them for production.",
      actionLabel: "View Ideas",
      actionUrl: "/dashboard/content-calendar",
    });
  }

  if (tier === "free") {
    insights.push({
      id: "upgrade-prompt",
      type: "opportunity",
      title: "Unlock higher limits and publishing workflows",
      description:
        "Upgrade to Starter for higher monthly quotas or Creator to remove monthly caps on core generation.",
      actionLabel: "View Plans",
      actionUrl: "/pricing",
    });
  } else if (!planHasUnlimitedCoreUsage(tier)) {
    insights.push({
      id: "creator-upgrade-prompt",
      type: "tip",
      title: `Need more headroom than ${formatPlanName(tier)}?`,
      description:
        "Creator removes monthly caps on ideas, scripts, titles, thumbnails, and TTS so your workflow can stay always-on.",
      actionLabel: "Compare plans",
      actionUrl: "/pricing",
    });
  }

  const niches = recentIdeas.map((i) => i.contentCategory).filter(Boolean);
  const uniqueNiches = new Set(niches);
  if (uniqueNiches.size > 5 && recentIdeas.length >= 10) {
    insights.push({
      id: "niche-focus",
      type: "tip",
      title: "Consider focusing on fewer niches",
      description:
        "Successful creators often focus on 2-3 core niches to build a dedicated audience.",
    });
  }

  const draftIdeas = recentIdeas.filter((i) => i.status === "draft").length;
  if (draftIdeas >= 7 && recentIdeas.length >= 10) {
    insights.push({
      id: "completion-rate",
      type: "warning",
      title: "Many ideas are still in draft",
      description:
        "Complete your content workflow by generating scripts and thumbnails for your ideas.",
      actionLabel: "View Drafts",
      actionUrl: "/dashboard/content-calendar?status=draft",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "keep-creating",
      type: "tip",
      title: "Keep up the great work!",
      description:
        "Consistency is key to YouTube success. Aim to publish 2-3 videos per week.",
    });
  }

  return insights;
}

function toDashboardActivationSummary(
  summary: ReturnType<typeof buildActivationSummary>
): ActivationSummary {
  return {
    ecosystemLabel: summary.ecosystemLabel,
    activated: summary.activated,
    activationEventLabel: summary.activationEventLabel,
    activationCompletedAt: summary.activationCompletedAt,
    ahaMoment: summary.ahaMoment,
    successThreshold: summary.successThreshold,
    progressPct: summary.progressPct,
    completedSteps: summary.steps.filter((step) => step.completed).length,
    totalSteps: summary.steps.length,
    nextStepLabel: summary.nextStep?.label ?? null,
    nextStepUrl: summary.nextStep?.url,
  };
}

function toDashboardOnboardingSteps(
  summary: ReturnType<typeof buildActivationSummary>
): OnboardingStep[] {
  return summary.steps.map((step) => ({
    id: step.id,
    label: step.label,
    description: step.description,
    completed: step.completed,
    completedAt: step.completedAt,
    emphasis: step.kind,
    url: step.url,
  }));
}

async function getCreatorActivationData(
  userId: string,
  options: {
    userCreatedAt: Date | null;
    onboardingCompleted: boolean;
  }
): Promise<{ activation: ActivationSummary; onboarding: OnboardingStep[] }> {
  const [activationStatuses, hasIdea, hasScript, hasTitle, hasThumbnail] = await Promise.all([
    getActivationCheckpointStatuses(userId),
    prisma.contentIdea.findFirst({ where: { userId }, select: { createdAt: true } }),
    prisma.generatedScript.findFirst({ where: { userId }, select: { createdAt: true } }),
    prisma.generatedTitle.findFirst({ where: { userId }, select: { createdAt: true } }),
    prisma.thumbnail.findFirst({ where: { userId }, select: { createdAt: true } }),
  ]);

  const creatorSummary = buildActivationSummary("creator", {
    ...activationStatuses,
    ...(options.userCreatedAt
      ? {
          creator_onboarding_started: {
            completed: true,
            completedAt: options.userCreatedAt,
            source: "derived",
          },
        }
      : {}),
    ...(options.onboardingCompleted
      ? {
          creator_onboarding_completed: {
            completed: true,
            completedAt: null,
            source: "derived",
          },
        }
      : {}),
    ...(hasIdea
      ? {
          creator_first_content_idea_created: {
            completed: true,
            completedAt: hasIdea.createdAt,
            source: "derived",
          },
        }
      : {}),
    ...(hasScript
      ? {
          creator_first_script_generated: {
            completed: true,
            completedAt: hasScript.createdAt,
            source: "derived",
          },
        }
      : {}),
    ...(hasTitle
      ? {
          creator_first_title_generated: {
            completed: true,
            completedAt: hasTitle.createdAt,
            source: "derived",
          },
        }
      : {}),
    ...(hasThumbnail
      ? {
          creator_first_thumbnail_generated: {
            completed: true,
            completedAt: hasThumbnail.createdAt,
            source: "derived",
          },
        }
      : {}),
  });

  return {
    activation: toDashboardActivationSummary(creatorSummary),
    onboarding: toDashboardOnboardingSteps(creatorSummary),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

async function fetchDashboardData(userId: string): Promise<DashboardData> {
  try {
    // Fetch user once — shared across all sub-queries to avoid redundant DB roundtrips
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, subscriptionTier: true, createdAt: true, onboardingCompleted: true },
    });
    const tier = (user?.subscriptionTier || user?.plan || "free") as PlanTier;

    const [metrics, recentActivity, usageStats, insights, activationData] = await Promise.all([
      calculateMetrics(userId, tier).catch((err) => {
        console.error("[Metrics] Error calculating metrics:", err.message);
        return getDefaultMetrics();
      }),
      getRecentActivity(userId).catch((err) => {
        console.error("[Metrics] Error getting recent activity:", err.message);
        return [];
      }),
      calculateUsageStats(userId, tier).catch((err) => {
        console.error("[Metrics] Error calculating usage stats:", err.message);
        return getDefaultUsageStats();
      }),
      generateInsights(userId, tier).catch((err) => {
        console.error("[Metrics] Error generating insights:", err.message);
        return getDefaultInsights();
      }),
      getCreatorActivationData(userId, {
        userCreatedAt: user?.createdAt ?? null,
        onboardingCompleted: user?.onboardingCompleted ?? false,
      }).catch((err) => {
        console.error("[Metrics] Error getting activation data:", err.message);
        return {
          activation: getDefaultActivationSummary(),
          onboarding: getDefaultOnboardingSteps(),
        };
      }),
    ]);

    return {
      metrics,
      recentActivity,
      usageStats,
      insights,
      onboarding: activationData.onboarding,
      activation: activationData.activation,
    };
  } catch (error: any) {
    console.error("[Metrics] Fatal error in getDashboardData:", error.message);
    return {
      metrics: getDefaultMetrics(),
      recentActivity: [],
      usageStats: getDefaultUsageStats(),
      insights: getDefaultInsights(),
      onboarding: getDefaultOnboardingSteps(),
      activation: getDefaultActivationSummary(),
    };
  }
}

// Cache dashboard data per-user for 60 seconds — eliminates redundant DB hits on navigation
export const getDashboardData = unstable_cache(fetchDashboardData, ["dashboard-data"], {
  revalidate: 60,
});
