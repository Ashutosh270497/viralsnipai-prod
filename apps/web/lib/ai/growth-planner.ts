import OpenAI from "openai";
import { openRouterClient, OPENROUTER_MODELS } from "@/lib/openrouter-client";
import { prisma } from "@/lib/prisma";

const DIRECT_MODEL =
  process.env.OPENAI_SNIPRADAR_GROWTH_PLANNER_MODEL?.trim() ?? "gpt-5-mini";

const directClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/** OpenRouter takes priority; direct OpenAI is the fallback. */
const client = openRouterClient ?? directClient;
const PLANNER_MODEL = openRouterClient
  ? OPENROUTER_MODELS.snipradarGrowthPlanner
  : DIRECT_MODEL;

export interface GrowthPhase {
  name: string;
  window: string;
  goal: string;
  weeklyTasks: string[];
  expectedLift: string;
  kpi: string;
}

export interface GrowthPlan {
  phases: GrowthPhase[];
  overallGoal: string;
  recommendedCadence: string;
  topContentSignal: string;
  generatedAt: string;
}

/** Static fallback plan when AI is unavailable — personalized where possible. */
function buildFallbackPlan(params: {
  followerCount: number;
  niche: string;
  postsLast30Days: number;
}): GrowthPlan {
  const { followerCount, niche, postsLast30Days } = params;
  const nicheLabel = niche || "your niche";
  const cadence = postsLast30Days >= 20 ? "5x/week" : postsLast30Days >= 10 ? "3x/week" : "daily";

  return {
    overallGoal: `Grow your ${nicheLabel} presence from ${followerCount.toLocaleString()} to ${Math.round(followerCount * 1.3).toLocaleString()} followers over 8 weeks.`,
    recommendedCadence: cadence,
    topContentSignal: "Publish consistently and test hook variety to find what resonates.",
    phases: [
      {
        name: "Phase 1: Foundation",
        window: "Week 1–2",
        goal: `Establish a reliable posting rhythm in ${nicheLabel}.`,
        weeklyTasks: [
          `Publish ${cadence} — mix single posts and short threads.`,
          "Use SnipRadar Discover to bookmark 5 high-performing posts daily.",
          "Write 3 hook variations per topic and track which gets the most replies.",
        ],
        expectedLift: "+4% to +10% follower growth",
        kpi: `${Math.round(followerCount * 0.05).toLocaleString()} new followers`,
      },
      {
        name: "Phase 2: Content Flywheel",
        window: "Week 3–6",
        goal: "Double down on your top-performing hook patterns and post formats.",
        weeklyTasks: [
          "Use Batch Composer to queue 7 days of drafts every Sunday.",
          "Identify your best-performing post format from analytics and replicate it 3x per week.",
          "Engage with 10 tracked accounts daily using the Relationships panel.",
        ],
        expectedLift: "+12% to +25% follower growth",
        kpi: `${Math.round(followerCount * 0.18).toLocaleString()} cumulative new followers`,
      },
      {
        name: "Phase 3: Amplification",
        window: "Week 7+",
        goal: "Maximize reach using optimal timing, threads, and automation.",
        weeklyTasks: [
          "Schedule all posts at recommended best times from the Publish tab.",
          "Write 2 long-form threads per week to build authority in " + nicheLabel + ".",
          "Run WinnerLoop automation to auto-generate variations of your viral posts.",
        ],
        expectedLift: "+20% to +40% follower growth",
        kpi: `${Math.round(followerCount * 0.3).toLocaleString()} cumulative new followers`,
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export async function generateGrowthPlan(userId: string): Promise<GrowthPlan | null> {
  // Fetch user niche + account state
  const [user, xAccount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { selectedNiche: true, nicheInterests: true, name: true },
    }),
    prisma.xAccount.findFirst({
      where: { userId, isActive: true },
      select: {
        id: true,
        xUsername: true,
        followerCount: true,
        followingCount: true,
      },
    }),
  ]);

  const niche =
    user?.selectedNiche ||
    (Array.isArray(user?.nicheInterests) && user.nicheInterests.length > 0
      ? user.nicheInterests.join(", ")
      : "");

  const followerCount = xAccount?.followerCount ?? 0;

  // Get 30-day posted drafts for pattern analysis
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const postedDrafts = xAccount
    ? await prisma.tweetDraft.findMany({
        where: {
          userId,
          xAccountId: xAccount.id,
          status: "posted",
          postedAt: { gte: thirtyDaysAgo },
        },
        select: {
          text: true,
          hookType: true,
          format: true,
          actualLikes: true,
          actualRetweets: true,
          actualReplies: true,
          actualImpressions: true,
          postedAt: true,
        },
        orderBy: { postedAt: "desc" },
        take: 30,
      })
    : [];

  const postsLast30Days = postedDrafts.length;

  // Build content signal summary
  const hookCounts = postedDrafts.reduce<Record<string, number>>((acc, d) => {
    if (d.hookType) acc[d.hookType] = (acc[d.hookType] ?? 0) + 1;
    return acc;
  }, {});
  const topHook =
    Object.entries(hookCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const totalImpressions = postedDrafts.reduce(
    (s, d) => s + (d.actualImpressions ?? 0),
    0
  );
  const totalEngagement = postedDrafts.reduce(
    (s, d) =>
      s + (d.actualLikes ?? 0) + (d.actualRetweets ?? 0) + (d.actualReplies ?? 0),
    0
  );
  const avgEngRate =
    totalImpressions > 0
      ? ((totalEngagement / totalImpressions) * 100).toFixed(2)
      : "0";

  const sorted = [...postedDrafts].sort(
    (a, b) =>
      (b.actualLikes ?? 0) +
      (b.actualRetweets ?? 0) +
      (b.actualReplies ?? 0) -
      ((a.actualLikes ?? 0) + (a.actualRetweets ?? 0) + (a.actualReplies ?? 0))
  );
  const bestPost = sorted[0];

  // If no AI key, return fallback immediately
  if (!client) {
    return buildFallbackPlan({ followerCount, niche, postsLast30Days });
  }

  const prompt = `You are an elite X (Twitter) growth strategist. Create a personalized 3-phase growth plan for this creator.

ACCOUNT STATE:
- Username: @${xAccount?.xUsername ?? "unknown"}
- Niche: ${niche || "general / not specified"}
- Current followers: ${followerCount.toLocaleString()}
- Following: ${xAccount?.followingCount?.toLocaleString() ?? "unknown"}
- Posts in last 30 days: ${postsLast30Days}
- Avg engagement rate: ${avgEngRate}%
- Total impressions (30d): ${totalImpressions.toLocaleString()}

${topHook ? `TOP PERFORMING HOOK TYPE: "${topHook}" (used ${hookCounts[topHook]}x)` : "No hook data yet."}

${
  bestPost
    ? `BEST POST (30d):
"${bestPost.text.slice(0, 120)}..."
Likes: ${bestPost.actualLikes ?? 0} | Retweets: ${bestPost.actualRetweets ?? 0} | Impressions: ${bestPost.actualImpressions ?? 0}`
    : "No posted content yet — creator is just starting out."
}

Generate a JSON growth plan with this exact shape:
{
  "overallGoal": "one sentence describing the 8-week growth target with specific follower numbers",
  "recommendedCadence": "e.g. 5x/week — include why this cadence fits their current state",
  "topContentSignal": "one actionable sentence about the strongest content pattern from their data (or what to test if no data)",
  "phases": [
    {
      "name": "Phase 1: Foundation",
      "window": "Week 1–2",
      "goal": "specific goal for this phase tied to their niche and account state",
      "weeklyTasks": ["task 1", "task 2", "task 3"],
      "expectedLift": "e.g. +5% to +12% follower growth",
      "kpi": "specific measurable outcome e.g. X new followers or Y avg impressions"
    },
    {
      "name": "Phase 2: Content Flywheel",
      "window": "Week 3–6",
      "goal": "...",
      "weeklyTasks": ["...", "...", "..."],
      "expectedLift": "...",
      "kpi": "..."
    },
    {
      "name": "Phase 3: Amplification",
      "window": "Week 7+",
      "goal": "...",
      "weeklyTasks": ["...", "...", "..."],
      "expectedLift": "...",
      "kpi": "..."
    }
  ]
}

Rules:
- Tasks must reference actual SnipRadar features: Thread Builder, Batch Composer, Discover feed, WinnerLoop, Relationships panel, Scheduler, Analytics tab
- Follower targets must be specific numbers derived from the current follower count
- Niche must be woven into goals and tasks naturally
- No generic platitudes — every sentence must be data-driven or account-specific
- Return valid JSON only, no markdown`;

  try {
    const completion = await client.chat.completions.create({
      model: PLANNER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an elite X growth strategist. Return valid JSON only. No markdown, no explanation.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return buildFallbackPlan({ followerCount, niche, postsLast30Days });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("[Growth Planner] Failed to parse AI response:", content.slice(0, 200));
      return buildFallbackPlan({ followerCount, niche, postsLast30Days });
    }

    const phases = Array.isArray(parsed.phases) ? parsed.phases : [];

    return {
      overallGoal: String(parsed.overallGoal ?? ""),
      recommendedCadence: String(parsed.recommendedCadence ?? ""),
      topContentSignal: String(parsed.topContentSignal ?? ""),
      phases: phases.map((p: Record<string, unknown>) => ({
        name: String(p.name ?? ""),
        window: String(p.window ?? ""),
        goal: String(p.goal ?? ""),
        weeklyTasks: Array.isArray(p.weeklyTasks)
          ? p.weeklyTasks.map(String)
          : [],
        expectedLift: String(p.expectedLift ?? ""),
        kpi: String(p.kpi ?? ""),
      })),
      generatedAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 429) {
      throw new Error("RATE_LIMIT: AI rate limit exceeded.");
    }
    console.error("[Growth Planner] Generation failed:", error);
    return buildFallbackPlan({ followerCount, niche, postsLast30Days });
  }
}
