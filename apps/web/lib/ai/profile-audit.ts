import OpenAI from "openai";
import { openRouterClient, OPENROUTER_MODELS } from "@/lib/openrouter-client";
import type { XTweet, XUser } from "@/lib/types/snipradar";
import type {
  ProfileAuditAiInsights,
  ProfileAuditAiPinnedTweet,
  ProfileAuditAiRewrite,
  ProfileAuditResult,
} from "@/lib/snipradar/profile-audit";

const DIRECT_MODEL =
  process.env.OPENAI_SNIPRADAR_AUDIT_MODEL?.trim() ??
  process.env.OPENAI_MODEL?.trim() ??
  "gpt-5-mini";
const PROFILE_AUDIT_TIMEOUT_MS = Number(process.env.OPENAI_SNIPRADAR_AUDIT_TIMEOUT_MS ?? 12_000);

const directClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/** OpenRouter takes priority; direct OpenAI is the fallback. */
const client = openRouterClient ?? directClient;
const PROFILE_AUDIT_MODEL = openRouterClient
  ? OPENROUTER_MODELS.snipradarProfileAudit
  : DIRECT_MODEL;

type GenerateProfileAuditInsightsParams = {
  profile: XUser;
  tweets: XTweet[];
  pinnedTweet: XTweet | null;
  heuristic: ProfileAuditResult;
  selectedNiche?: string | null;
};

function sanitizeLines(input: unknown, maxItems: number, fallback: string[] = []) {
  if (!Array.isArray(input)) return fallback;
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeBioRewrites(input: unknown): ProfileAuditAiRewrite[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;
      const text = typeof candidate.text === "string" ? candidate.text.trim().slice(0, 160) : "";
      if (!text) return null;
      return {
        label:
          typeof candidate.label === "string" && candidate.label.trim()
            ? candidate.label.trim().slice(0, 40)
            : `Option ${index + 1}`,
        text,
        rationale:
          typeof candidate.rationale === "string" && candidate.rationale.trim()
            ? candidate.rationale.trim().slice(0, 220)
            : "Sharper positioning and clearer conversion path.",
      };
    })
    .filter(Boolean)
    .slice(0, 3) as ProfileAuditAiRewrite[];
}

function sanitizePinnedTweet(input: unknown): ProfileAuditAiPinnedTweet {
  if (!input || typeof input !== "object") {
    return {
      headline: "Pin a proof-led authority post",
      bullets: [
        "Lead with a sharp opinion or founder lesson.",
        "Back it with one concrete result or story.",
        "Close with a CTA that points people to the next step.",
      ],
      cta: "Follow for more breakdowns.",
      rationale: "A pinned post should explain why someone should trust and follow you.",
    };
  }

  const candidate = input as Record<string, unknown>;
  return {
    headline:
      typeof candidate.headline === "string" && candidate.headline.trim()
        ? candidate.headline.trim().slice(0, 120)
        : "Pin a proof-led authority post",
    bullets: sanitizeLines(candidate.bullets, 4, [
      "Lead with a sharp opinion or founder lesson.",
      "Back it with one concrete result or story.",
      "Close with a CTA that points people to the next step.",
    ]),
    cta:
      typeof candidate.cta === "string" && candidate.cta.trim()
        ? candidate.cta.trim().slice(0, 120)
        : "Follow for more breakdowns.",
    rationale:
      typeof candidate.rationale === "string" && candidate.rationale.trim()
        ? candidate.rationale.trim().slice(0, 220)
        : "A pinned post should explain why someone should trust and follow you.",
  };
}

export async function generateProfileAuditInsights({
  profile,
  tweets,
  pinnedTweet,
  heuristic,
  selectedNiche,
}: GenerateProfileAuditInsightsParams): Promise<ProfileAuditAiInsights | null> {
  if (!client) {
    return null;
  }

  const recentTweets = tweets
    .slice(0, 12)
    .map((tweet, index) => {
      const metrics = tweet.public_metrics;
      const isReply =
        tweet.referenced_tweets?.some((reference) => reference.type === "replied_to") ?? false;
      return {
        index: index + 1,
        text: tweet.text.slice(0, 280),
        isReply,
        likes: metrics?.like_count ?? 0,
        reposts: metrics?.retweet_count ?? 0,
        replies: metrics?.reply_count ?? 0,
        impressions: metrics?.impression_count ?? 0,
        createdAt: tweet.created_at,
      };
    });

  const input = {
    selectedNiche: selectedNiche ?? "general",
    profile: {
      name: profile.name,
      username: profile.username,
      bio: profile.description ?? "",
      location: profile.location ?? "",
      url: profile.url ?? "",
      verified: Boolean(profile.verified),
      followers: profile.public_metrics?.followers_count ?? 0,
      following: profile.public_metrics?.following_count ?? 0,
      tweetCount: profile.public_metrics?.tweet_count ?? 0,
      hasPinnedTweet: Boolean(profile.pinned_tweet_id),
    },
    pinnedTweet: pinnedTweet
      ? {
          text: pinnedTweet.text,
          likes: pinnedTweet.public_metrics?.like_count ?? 0,
          reposts: pinnedTweet.public_metrics?.retweet_count ?? 0,
          replies: pinnedTweet.public_metrics?.reply_count ?? 0,
          impressions: pinnedTweet.public_metrics?.impression_count ?? 0,
        }
      : null,
    heuristic: {
      score: heuristic.score,
      grade: heuristic.grade,
      confidence: heuristic.confidence,
      quickWins: heuristic.quickWins,
      pillars: heuristic.pillars.map((pillar) => ({
        label: pillar.label,
        score: pillar.score,
        maxScore: pillar.maxScore,
        status: pillar.status,
        summary: pillar.summary,
        recommendations: pillar.recommendations,
      })),
      stats: heuristic.stats,
    },
    recentTweets,
  };

  const system = `You are an elite X growth strategist performing a profile audit.

You are given a creator's real X profile data, pinned tweet data when available, recent tweets, and a deterministic heuristic score.

Your task:
- produce a high-signal profile audit
- explain what is strong vs weak
- generate improved bio options
- recommend the right pinned tweet strategy
- generate a practical 7-day execution plan

Rules:
- recommendations must be specific and based on provided data
- avoid generic platitudes
- bio rewrites must be <= 160 characters each
- keep lists concise and actionable
- return valid JSON only

Return exactly this shape:
{
  "executiveSummary": "string",
  "positioningAssessment": "string",
  "conversionAssessment": "string",
  "contentAssessment": "string",
  "strengths": ["string", "string", "string"],
  "risks": ["string", "string", "string"],
  "priorityFixes": ["string", "string", "string"],
  "bioRewrites": [
    { "label": "string", "text": "string <=160 chars", "rationale": "string" }
  ],
  "pinnedTweetAssessment": "string",
  "pinnedTweetRecommendation": {
    "headline": "string",
    "bullets": ["string", "string", "string"],
    "cta": "string",
    "rationale": "string"
  },
  "contentPillars": ["string", "string", "string"],
  "next7DaysPlan": ["string", "string", "string", "string", "string"]
}`;

  try {
    const completion = await Promise.race([
      client.chat.completions.create({
        model: PROFILE_AUDIT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(input) },
        ],
        response_format: { type: "json_object" },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT: Profile audit AI request exceeded deadline.")), PROFILE_AUDIT_TIMEOUT_MS)
      ),
    ]);

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Record<string, unknown>;

    return {
      source: "ai",
      executiveSummary:
        typeof parsed.executiveSummary === "string" && parsed.executiveSummary.trim()
          ? parsed.executiveSummary.trim().slice(0, 420)
          : heuristic.summary,
      positioningAssessment:
        typeof parsed.positioningAssessment === "string" && parsed.positioningAssessment.trim()
          ? parsed.positioningAssessment.trim().slice(0, 320)
          : heuristic.pillars.find((pillar) => pillar.id === "positioning")?.summary ??
            "Positioning needs refinement.",
      conversionAssessment:
        typeof parsed.conversionAssessment === "string" && parsed.conversionAssessment.trim()
          ? parsed.conversionAssessment.trim().slice(0, 320)
          : heuristic.pillars.find((pillar) => pillar.id === "profile")?.summary ??
            "Profile conversion setup needs improvement.",
      contentAssessment:
        typeof parsed.contentAssessment === "string" && parsed.contentAssessment.trim()
          ? parsed.contentAssessment.trim().slice(0, 320)
          : heuristic.pillars.find((pillar) => pillar.id === "cadence")?.summary ??
            "Content cadence needs improvement.",
      strengths: sanitizeLines(parsed.strengths, 4, heuristic.pillars
        .filter((pillar) => pillar.status === "strong")
        .map((pillar) => pillar.summary)
        .slice(0, 3)),
      risks: sanitizeLines(parsed.risks, 4, heuristic.quickWins.slice(0, 3)),
      priorityFixes: sanitizeLines(parsed.priorityFixes, 5, heuristic.quickWins.slice(0, 3)),
      bioRewrites: sanitizeBioRewrites(parsed.bioRewrites),
      pinnedTweetAssessment:
        typeof parsed.pinnedTweetAssessment === "string" && parsed.pinnedTweetAssessment.trim()
          ? parsed.pinnedTweetAssessment.trim().slice(0, 320)
          : heuristic.stats.hasPinnedTweet
            ? "Your pinned tweet exists, but it should be evaluated against your current positioning."
            : "You need a pinned post that quickly explains your value and gives a reason to follow.",
      pinnedTweetRecommendation: sanitizePinnedTweet(parsed.pinnedTweetRecommendation),
      contentPillars: sanitizeLines(parsed.contentPillars, 4, [
        "Opinionated lessons from your niche",
        "Tactical frameworks and breakdowns",
        "Proof, case studies, and results",
      ]),
      next7DaysPlan: sanitizeLines(parsed.next7DaysPlan, 7, [
        "Rewrite your bio around one clear audience and outcome.",
        "Pin a proof-led post or thread.",
        "Publish at least 4 original posts this week.",
        "Reply to 10 niche conversations with sharp takes.",
        "Review which hook patterns earned the most replies.",
      ]),
    };
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith("TIMEOUT:")) {
      console.warn("[SnipRadar AI] Profile audit timed out, falling back to heuristic insight.");
      return null;
    }
    if (error?.status === 429) {
      throw new Error("RATE_LIMIT: OpenAI rate limit exceeded. Try again in a few minutes.");
    }
    if (error?.status === 401 || error?.status === 403) {
      throw new Error("AUTH_ERROR: OpenAI API key is invalid or expired.");
    }
    console.error("[SnipRadar AI] Profile audit failed:", error);
    return null;
  }
}
