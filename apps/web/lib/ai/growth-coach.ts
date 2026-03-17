import OpenAI from "openai";
import { openRouterClient, OPENROUTER_MODELS } from "@/lib/openrouter-client";
import { prisma } from "@/lib/prisma";

const DIRECT_MODEL =
  process.env.OPENAI_SNIPRADAR_GROWTH_COACH_MODEL?.trim() ?? "gpt-5-mini";

const directClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/** OpenRouter takes priority; direct OpenAI is the fallback. */
const client = openRouterClient ?? directClient;
const COACH_MODEL = openRouterClient
  ? OPENROUTER_MODELS.snipradarGrowthCoach
  : DIRECT_MODEL;

export interface GrowthReport {
  summary: string;
  whatsWorking: string;
  whatToImprove: string;
  actionItems: string[];
  suggestedSchedule: string;
  generatedAt: string;
}

export async function generateGrowthReport(userId: string): Promise<GrowthReport | null> {
  if (!client) {
    console.error("[Growth Coach] No OpenAI API key configured");
    return null;
  }

  const xAccount = await prisma.xAccount.findFirst({
    where: { userId, isActive: true },
  });

  if (!xAccount) return null;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get snapshots for follower tracking
  const snapshots = await prisma.xAccountSnapshot.findMany({
    where: { xAccountId: xAccount.id, createdAt: { gte: sevenDaysAgo } },
    orderBy: { createdAt: "asc" },
  });

  // Get posted tweets this week
  const postedTweets = await prisma.tweetDraft.findMany({
    where: {
      userId,
      xAccountId: xAccount.id,
      status: "posted",
      postedAt: { gte: sevenDaysAgo },
    },
    orderBy: { postedAt: "desc" },
  });

  const startFollowers = snapshots[0]?.followerCount ?? xAccount.followerCount;
  const endFollowers = snapshots.at(-1)?.followerCount ?? xAccount.followerCount;
  const followerChange = endFollowers - startFollowers;

  // Find best and worst tweets
  const tweetsWithEngagement = postedTweets.map((t) => ({
    text: t.text.slice(0, 100),
    likes: t.actualLikes ?? 0,
    retweets: t.actualRetweets ?? 0,
    replies: t.actualReplies ?? 0,
    impressions: t.actualImpressions ?? 0,
    hookType: t.hookType,
    format: t.format,
    postedAt: t.postedAt?.toISOString(),
  }));

  const sorted = [...tweetsWithEngagement].sort(
    (a, b) => (b.likes + b.retweets + b.replies) - (a.likes + a.retweets + a.replies)
  );
  const best = sorted[0];
  const worst = sorted.at(-1);

  const totalImpressions = tweetsWithEngagement.reduce((s, t) => s + t.impressions, 0);
  const totalEngagement = tweetsWithEngagement.reduce(
    (s, t) => s + t.likes + t.retweets + t.replies,
    0
  );
  const avgEngRate = totalImpressions > 0
    ? ((totalEngagement / totalImpressions) * 100).toFixed(2)
    : "0";

  const userMessage = `Analyze this creator's X (Twitter) performance for the past week and provide an actionable growth report.

ACCOUNT DATA:
- Current followers: ${endFollowers.toLocaleString()}
- Follower change this week: ${followerChange >= 0 ? "+" : ""}${followerChange}
- Posts published: ${postedTweets.length}
- Total impressions: ${totalImpressions.toLocaleString()}
- Total engagement: ${totalEngagement.toLocaleString()}
- Average engagement rate: ${avgEngRate}%

${best ? `BEST PERFORMING POST:
"${best.text}..." — ${best.likes} likes, ${best.impressions} impressions (${best.hookType ?? "unknown"} hook, ${best.format ?? "unknown"} format)` : "No posts this week."}

${worst && worst !== best ? `LOWEST PERFORMING POST:
"${worst.text}..." — ${worst.likes} likes, ${worst.impressions} impressions` : ""}

POSTING PATTERNS:
${tweetsWithEngagement.map((t) => `- "${t.text.slice(0, 50)}..." at ${t.postedAt ?? "unknown"}: ${t.likes} likes`).join("\n")}

Return a JSON object with:
- summary: 1-2 sentence overview of the week
- whatsWorking: 1-2 sentences on what's driving engagement
- whatToImprove: 1-2 sentences on areas for improvement
- actionItems: array of 3 specific, actionable tasks for next week
- suggestedSchedule: brief suggestion for best posting days/times based on data`;

  try {
    const completion = await client.chat.completions.create({
      model: COACH_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an elite X (Twitter) growth strategist. Analyze the data and give specific, data-driven advice. Be concise but actionable. No generic platitudes. Return valid JSON only.",
        },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("[Growth Coach] Failed to parse response:", content.slice(0, 200));
      return null;
    }

    return {
      summary: parsed.summary ?? "",
      whatsWorking: parsed.whatsWorking ?? parsed.whats_working ?? "",
      whatToImprove: parsed.whatToImprove ?? parsed.what_to_improve ?? "",
      actionItems: Array.isArray(parsed.actionItems ?? parsed.action_items)
        ? (parsed.actionItems ?? parsed.action_items)
        : [],
      suggestedSchedule: parsed.suggestedSchedule ?? parsed.suggested_schedule ?? "",
      generatedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    if (error?.status === 429) {
      throw new Error("RATE_LIMIT: AI rate limit exceeded.");
    }
    console.error("[Growth Coach] Generation failed:", error);
    return null;
  }
}
