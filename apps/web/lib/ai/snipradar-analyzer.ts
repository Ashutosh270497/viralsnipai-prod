import type { TweetAnalysis, GeneratedTweet } from "@/lib/types/snipradar";
import { getActiveClient } from "@/lib/openrouter-client";

const ANALYSIS_TARGET = getActiveClient(null, "snipradarViralAnalysis");
const GENERATION_TARGET = getActiveClient(null, "snipradarDraftGeneration");
const PREDICTION_TARGET = getActiveClient(null, "snipradarPrediction");
const VARIANT_GENERATION_TARGET = getActiveClient(null, "snipradarVariantGeneration");
const VARIANT_SCORING_TARGET = getActiveClient(null, "snipradarVariantScoring");

// ============================================
// Analysis Prompt
// ============================================

const ANALYSIS_SYSTEM_PROMPT = `You are an expert viral tweet analyst with deep understanding of X (Twitter) algorithm mechanics and psychology.

Analyze the tweet and engagement metrics to determine WHY it went viral. Focus on SPECIFIC, ACTIONABLE insights.

Return a JSON object with these fields:

1. hookType: First-line attention grabber. Choose ONE:
   - "question" (poses question that demands answer)
   - "stat" (shocking number or data point)
   - "contrarian" (challenges common belief)
   - "story" (personal narrative or anecdote)
   - "list" (numbered list or bullet points)
   - "challenge" (dare or call to action)

2. format: Tweet structure. Choose ONE:
   - "one-liner" (single impactful sentence)
   - "thread" (connected multi-tweet story)
   - "listicle" (numbered tips or items)
   - "story" (beginning-middle-end narrative)
   - "hot-take" (bold controversial opinion)
   - "how-to" (instructional/educational)

3. emotionalTrigger: Primary emotion driving shares. Choose ONE:
   - "curiosity" (creates information gap)
   - "anger" (righteous indignation)
   - "awe" (inspires wonder)
   - "humor" (makes people laugh)
   - "fomo" (fear of missing out)
   - "controversy" (polarizing debate)

4. viralScore: 1-100 rating based on engagement rate relative to follower count
   - 90-100: Exceptional (top 1% for account size)
   - 70-89: Very strong (top 5%)
   - 50-69: Good viral performance
   - 1-49: Moderate viral traction

5. whyItWorked: 2-3 sentences explaining SPECIFIC mechanics:
   - What psychological principle was triggered?
   - What made people stop scrolling?
   - Why did people feel compelled to engage/share?

6. lessonsLearned: Array of 3-4 SPECIFIC, ACTIONABLE tactics:
   - Must be concrete and replicable
   - Focus on structure, timing, word choice, psychology
   - Example: "Start with 'Most people think...' to create immediate contrast"
   - Avoid generic advice like "be authentic" or "engage with audience"

CRITICAL: Base your analysis on the ACTUAL content and metrics provided. Be specific, not generic.

Return valid JSON only, no markdown formatting.`;

// ============================================
// Generation Prompt
// ============================================

const GENERATION_SYSTEM_PROMPT = `You are an elite X (Twitter) ghostwriter who creates viral content by reverse-engineering proven patterns.

Your task: Generate 3 ready-to-post tweets that apply viral mechanics from successful tweets in the user's niche.

CRITICAL RULES:
1. Each tweet MUST be ≤280 characters (this is non-negotiable)
2. Study the viral patterns provided - these are PROVEN winners in this niche
3. Apply the SPECIFIC tactics from "lessonsLearned" - don't guess, use what worked
4. Make it sound like the user wrote it (authentic voice, not corporate/AI)
5. Each tweet should use a DIFFERENT hook type and format for variety
6. No generic advice - be specific, opinionated, or surprising
7. No hashtags unless the viral examples use them heavily
8. No emoji unless the viral examples use them

For each tweet, provide:
- text: The complete tweet (MUST be ≤280 chars)
- hookType: "question" | "stat" | "contrarian" | "story" | "list" | "challenge"
- format: "one-liner" | "thread" | "listicle" | "story" | "hot-take" | "how-to"
- emotionalTrigger: "curiosity" | "anger" | "awe" | "humor" | "fomo" | "controversy"
- reasoning: 1-2 sentences on WHY this specific tweet should perform well (reference viral patterns)
- viralPrediction: 1-100 score (be realistic - most tweets won't hit 90+)

WRITING STRATEGY:
- Tweet 1: Use the MOST successful pattern from viral examples (highest engagement rate)
- Tweet 2: Combine 2 successful patterns in a unique way
- Tweet 3: Take a contrarian angle or unexpected twist on a popular pattern

QUALITY CHECKS BEFORE RETURNING:
✓ Each tweet is ≤280 characters
✓ Each uses a different hook type
✓ Each sounds like a real person, not a bot
✓ Each applies specific lessons from viral examples
✓ No vague platitudes or generic content

Return a JSON array of 3 tweet objects. No markdown formatting.`;

// ============================================
// Analyze a Viral Tweet
// ============================================

export async function analyzeTweet(params: {
  text: string;
  authorUsername: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
}): Promise<TweetAnalysis | null> {
  if (!ANALYSIS_TARGET.client || !ANALYSIS_TARGET.model) {
    console.error("[SnipRadar AI] No OpenRouter API key configured for viral analysis");
    return null;
  }

  try {
    const userMessage = `Tweet by @${params.authorUsername}:
"${params.text}"

Metrics:
- Likes: ${params.likes.toLocaleString()}
- Retweets: ${params.retweets.toLocaleString()}
- Replies: ${params.replies.toLocaleString()}
- Impressions: ${params.impressions.toLocaleString()}`;

    const completion = await ANALYSIS_TARGET.client.chat.completions.create({
      model: ANALYSIS_TARGET.model,
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    const analysis = JSON.parse(content) as TweetAnalysis;
    return analysis;
  } catch (error: any) {
    // Surface API-level errors so callers can give meaningful feedback
    if (error?.status === 429) {
      throw new Error("RATE_LIMIT: OpenRouter rate limit exceeded. Try again in a few minutes.");
    }
    if (error?.status === 401 || error?.status === 403) {
      throw new Error("AUTH_ERROR: OpenRouter API key is invalid or expired.");
    }
    console.error("[SnipRadar AI] Analysis failed:", error);
    return null;
  }
}

// ============================================
// Batch Analyze Multiple Tweets
// ============================================

export async function analyzeTweetBatch(
  tweets: Array<{
    id: string;
    text: string;
    authorUsername: string;
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
  }>
): Promise<Map<string, TweetAnalysis>> {
  const results = new Map<string, TweetAnalysis>();

  // Process in parallel, max 5 at a time
  const batchSize = 5;
  for (let i = 0; i < tweets.length; i += batchSize) {
    const batch = tweets.slice(i, i + batchSize);
    const analyses = await Promise.allSettled(
      batch.map((tweet) => analyzeTweet(tweet))
    );

    analyses.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        results.set(batch[idx].id, result.value);
      }
    });
  }

  return results;
}

// ============================================
// Generate Daily Tweet Drafts
// ============================================

export async function generateDrafts(params: {
  niche: string;
  followerCount: number;
  targetFollowers?: number;
  styleExamples?: string[];
  viralPatterns: Array<{
    text: string;
    hookType: string;
    format: string;
    emotionalTrigger: string;
    likes: number;
    whyItWorked: string;
    lessonsLearned?: string[];
  }>;
  count?: number;
}): Promise<GeneratedTweet[]> {
  if (!GENERATION_TARGET.client || !GENERATION_TARGET.model) {
    console.error("[SnipRadar AI] No OpenRouter API key configured for draft generation");
    return [];
  }

  const {
    niche,
    followerCount,
    targetFollowers = 1000,
    styleExamples = [],
    viralPatterns,
    count = 3,
  } = params;

  try {
    // Sort by likes descending to prioritize most viral patterns
    const topPatterns = viralPatterns
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 10);

    const patternsStr = topPatterns
      .map((p, i) => {
        const lessonsStr = p.lessonsLearned?.length
          ? `\n   Lessons: ${p.lessonsLearned.map((l, idx) => `\n   ${idx + 1}) ${l}`).join("")}`
          : "";

        return `${i + 1}. VIRAL TWEET (${p.likes.toLocaleString()} likes):
   "${p.text.slice(0, 150)}${p.text.length > 150 ? "..." : ""}"

   Analysis:
   - Hook: ${p.hookType}
   - Format: ${p.format}
   - Emotion: ${p.emotionalTrigger}
   - Why it worked: ${p.whyItWorked}${lessonsStr}`;
      })
      .join("\n\n");

    const styleStr =
      styleExamples.length > 0
        ? `Writing style examples:\n${styleExamples.map((s) => `- "${s}"`).join("\n")}`
        : "No style examples provided — use a natural, conversational tone.";

    const userMessage = `Generate ${count} viral tweets for my X account by applying proven patterns.

MY ACCOUNT:
- Niche: ${niche}
- Current followers: ${followerCount.toLocaleString()}
- Growth goal: ${targetFollowers.toLocaleString()} followers
- ${styleStr}

TOP VIRAL PATTERNS FROM MY NICHE (sorted by engagement):
${patternsStr || "No patterns available yet — use general best practices for the niche."}

TASK:
Study the viral patterns above and create ${count} NEW tweets that:
1. Apply the specific "Lessons" from the top-performing tweets
2. Use the same emotional triggers and hook types that worked
3. Match the format patterns that drove engagement
4. Sound authentic to my niche and voice
5. Are completely original (not copies)

Remember: These patterns are PROVEN winners in my niche. Don't guess—use what worked!`;

    const completion = await GENERATION_TARGET.client.chat.completions.create({
      model: GENERATION_TARGET.model,
      messages: [
        { role: "system", content: GENERATION_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return [];

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("[SnipRadar AI] Failed to parse draft response:", content.slice(0, 200));
      return [];
    }

    // Handle both { tweets: [...] } and direct array formats
    const tweets = Array.isArray(parsed) ? parsed : parsed.tweets ?? parsed.drafts ?? [];

    return tweets as GeneratedTweet[];
  } catch (error: any) {
    if (error?.status === 429) {
      throw new Error("RATE_LIMIT: OpenRouter rate limit exceeded. Try again in a few minutes.");
    }
    if (error?.status === 401 || error?.status === 403) {
      throw new Error("AUTH_ERROR: OpenRouter API key is invalid or expired.");
    }
    console.error("[SnipRadar AI] Draft generation failed:", error);
    return [];
  }
}

// ============================================
// Predict Virality Score for a Draft
// ============================================

export interface ViralityPrediction {
  score: number; // 1-100
  breakdown: {
    hook: number;
    emotion: number;
    share: number;
    reply: number;
    timing: number;
  };
  suggestion: string;
}

export interface VariantCandidateDraft {
  label: string;
  strategyFocus: string;
  text: string;
  reasoning: string;
}

export async function predictVirality(params: {
  text: string;
  niche?: string;
  followerCount?: number;
}): Promise<ViralityPrediction | null> {
  if (!PREDICTION_TARGET.client || !PREDICTION_TARGET.model) {
    console.error("[SnipRadar AI] No OpenRouter API key configured for prediction");
    return null;
  }

  try {
    const userMessage = `Score this tweet for viral potential on X.

Tweet: "${params.text}"
${params.niche ? `Niche: ${params.niche}` : ""}
${params.followerCount ? `Follower count: ${params.followerCount.toLocaleString()}` : ""}

Evaluate each dimension (1-100):
- hook: Does the first line stop the scroll?
- emotion: What feeling does it evoke? How strong?
- share: Would people retweet/quote this?
- reply: Does it invite conversation?
- timing: Is it relevant to current trends?

Also provide 1 specific suggestion to improve the weakest dimension.

Return JSON: { score: number (1-100 overall), breakdown: { hook, emotion, share, reply, timing }, suggestion: string }`;

    const completion = await PREDICTION_TARGET.client.chat.completions.create({
      model: PREDICTION_TARGET.model,
      messages: [
        {
          role: "system",
          content: "You are an expert at predicting tweet virality. Be honest and specific. Most tweets score 30-60. Only truly exceptional tweets score 80+. Return valid JSON only.",
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
      return null;
    }

    return {
      score: Math.min(100, Math.max(1, parsed.score ?? 50)),
      breakdown: {
        hook: parsed.breakdown?.hook ?? 50,
        emotion: parsed.breakdown?.emotion ?? 50,
        share: parsed.breakdown?.share ?? 50,
        reply: parsed.breakdown?.reply ?? 50,
        timing: parsed.breakdown?.timing ?? 50,
      },
      suggestion: parsed.suggestion ?? "",
    };
  } catch (error: any) {
    if (error?.status === 429) {
      throw new Error("RATE_LIMIT: OpenRouter rate limit exceeded.");
    }
    console.error("[SnipRadar AI] Virality prediction failed:", error);
    return null;
  }
}

export async function generateVariantCandidates(params: {
  text: string;
  niche?: string;
  followerCount?: number;
  count?: number;
}): Promise<VariantCandidateDraft[]> {
  if (!VARIANT_GENERATION_TARGET.client || !VARIANT_GENERATION_TARGET.model) {
    return [];
  }

  const count = Math.min(4, Math.max(2, params.count ?? 3));
  const system = `You are Variant Lab, an elite X copy strategist.

Given one draft, produce ${count} DISTINCT improved variants for different publishing goals.

Rules:
- every variant must stay <= 280 characters
- preserve the core idea, but materially change framing
- vary the lead: e.g. contrarian, question, proof, authority, CTA
- avoid generic filler
- keep the output ready to publish
- return valid JSON only

Return this exact shape:
{
  "variants": [
    {
      "label": "string",
      "strategyFocus": "string",
      "text": "string <=280 chars",
      "reasoning": "string"
    }
  ]
}`;

  try {
    const completion = await VARIANT_GENERATION_TARGET.client.chat.completions.create({
      model: VARIANT_GENERATION_TARGET.model,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: JSON.stringify({
            niche: params.niche ?? "general",
            followerCount: params.followerCount ?? null,
            draft: params.text,
            targetVariants: count,
          }),
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content) as { variants?: VariantCandidateDraft[] };
    if (!Array.isArray(parsed.variants)) return [];

    return parsed.variants
      .map((variant) => ({
        label: typeof variant.label === "string" ? variant.label.trim().slice(0, 40) : "Variant",
        strategyFocus:
          typeof variant.strategyFocus === "string"
            ? variant.strategyFocus.trim().slice(0, 120)
            : "Alternative framing",
        text:
          typeof variant.text === "string"
            ? variant.text.replace(/\s+/g, " ").trim().slice(0, 280)
            : "",
        reasoning:
          typeof variant.reasoning === "string"
            ? variant.reasoning.trim().slice(0, 220)
            : "Alternative framing of the same core idea.",
      }))
      .filter((variant) => variant.text.length >= 10)
      .slice(0, count);
  } catch (error: any) {
    if (error?.status === 429) {
      throw new Error("RATE_LIMIT: OpenRouter rate limit exceeded. Try again in a few minutes.");
    }
    if (error?.status === 401 || error?.status === 403) {
      throw new Error("AUTH_ERROR: OpenRouter API key is invalid or expired.");
    }
    console.error("[SnipRadar AI] Variant generation failed:", error);
    return [];
  }
}

export async function scoreVariantCandidates(params: {
  variants: Array<{ id: string; text: string }>;
  niche?: string;
  followerCount?: number;
}): Promise<Record<string, ViralityPrediction>> {
  if (!VARIANT_SCORING_TARGET.client || !VARIANT_SCORING_TARGET.model || params.variants.length === 0) {
    return {};
  }

  const system = `You score X post variants for overall viral potential.

Be honest. Most variants should score between 35 and 70.
Return valid JSON only in this shape:
{
  "variants": [
    {
      "id": "string",
      "score": 1,
      "breakdown": {
        "hook": 1,
        "emotion": 1,
        "share": 1,
        "reply": 1,
        "timing": 1
      },
      "suggestion": "string"
    }
  ]
}`;

  try {
    const completion = await VARIANT_SCORING_TARGET.client.chat.completions.create({
      model: VARIANT_SCORING_TARGET.model,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: JSON.stringify({
            niche: params.niche ?? "general",
            followerCount: params.followerCount ?? null,
            variants: params.variants,
          }),
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return {};

    const parsed = JSON.parse(content) as {
      variants?: Array<{
        id: string;
        score: number;
        breakdown?: Record<string, number>;
        suggestion?: string;
      }>;
    };
    const result: Record<string, ViralityPrediction> = {};
    for (const variant of parsed.variants ?? []) {
      if (!variant?.id) continue;
      result[variant.id] = {
        score: Math.min(100, Math.max(1, Number(variant.score) || 50)),
        breakdown: {
          hook: Math.min(100, Math.max(1, Number(variant.breakdown?.hook) || 50)),
          emotion: Math.min(100, Math.max(1, Number(variant.breakdown?.emotion) || 50)),
          share: Math.min(100, Math.max(1, Number(variant.breakdown?.share) || 50)),
          reply: Math.min(100, Math.max(1, Number(variant.breakdown?.reply) || 50)),
          timing: Math.min(100, Math.max(1, Number(variant.breakdown?.timing) || 50)),
        },
        suggestion: typeof variant.suggestion === "string" ? variant.suggestion.trim().slice(0, 180) : "",
      };
    }
    return result;
  } catch (error: any) {
    if (error?.status === 429) {
      throw new Error("RATE_LIMIT: OpenRouter rate limit exceeded.");
    }
    console.error("[SnipRadar AI] Variant scoring failed:", error);
    return {};
  }
}
