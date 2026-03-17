export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limiter";
import { formatPlanName, getRuntimeCoreUsageLimit, resolvePlanTier } from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { GenerateScriptRequest, ScriptSegmentStructured } from "@/lib/types/script";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const generateScriptSchema = z.object({
  contentIdeaId: z.string().optional(),
  videoTitle: z.string().min(5),
  videoDescription: z.string().optional(),
  targetDuration: z.number().min(0.5).max(60),
  scriptStyle: z.enum(['educational', 'entertaining', 'storytelling', 'review', 'tutorial']),
  tone: z.enum(['casual', 'professional', 'energetic', 'calm']),
  includeHook: z.boolean(),
  includeCTA: z.boolean(),
  keywords: z.array(z.string()).optional(),
  additionalContext: z.string().optional(),
  niche: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rateLimitResult = checkRateLimit(user.id, RATE_LIMITS.scriptGenerate);
    const rlHeaders = rateLimitHeaders(rateLimitResult, RATE_LIMITS.scriptGenerate);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before generating more.", retryAfterSec: rateLimitResult.retryAfterSec },
        { status: 429, headers: rlHeaders }
      );
    }

    const body = await request.json();
    const result = generateScriptSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data: GenerateScriptRequest = result.data;

    // Check usage limits
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, subscriptionTier: true },
    });

    const tier = resolvePlanTier(dbUser?.subscriptionTier || dbUser?.plan || "free");
    const limit = getRuntimeCoreUsageLimit(tier, "scripts");

    // Count scripts this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const scriptsThisMonth = await prisma.generatedScript.count({
      where: {
        userId: user.id,
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    if (Number.isFinite(limit) && scriptsThisMonth >= limit) {
      const planName = formatPlanName(tier);
      const upgradeMessage =
        tier === "free"
          ? "Upgrade to Starter for more monthly script runs or Creator to remove script caps."
          : "Upgrade to Creator to remove monthly script caps.";
      return NextResponse.json(
        {
          error: "Usage limit reached",
          message: `You've used all ${limit} script generations this month on the ${planName} plan. ${upgradeMessage}`,
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    logger.info('[Script Generator] Generating script', {
      userId: user.id,
      videoTitle: data.videoTitle,
      targetDuration: data.targetDuration,
    });

    // Generate script using AI
    const scriptData = await generateScriptWithAI(data);

    // Save to database
    const savedScript = await prisma.generatedScript.create({
      data: {
        userId: user.id,
        contentIdeaId: data.contentIdeaId,
        title: data.videoTitle,
        hook: scriptData.hook,
        intro: scriptData.intro,
        mainContent: JSON.stringify(scriptData.mainContent),
        conclusion: scriptData.conclusion,
        cta: scriptData.cta,
        fullScript: scriptData.fullScript,
        durationEstimate: scriptData.durationEstimate,
        retentionTips: scriptData.retentionTips,
        keywords: data.keywords || [],
      },
    });

    // Update content idea if linked
    if (data.contentIdeaId) {
      await prisma.contentIdea.update({
        where: { id: data.contentIdeaId },
        data: { status: 'scripted' },
      });
    }

    // Log usage
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        feature: 'script',
        creditsUsed: 1,
        metadata: {
          scriptId: savedScript.id,
          targetDuration: data.targetDuration,
        },
      },
    });

    await recordActivationCheckpointSafe({
      userId: user.id,
      checkpoint: "creator_first_script_generated",
      metadata: {
        source: "script_generator",
        scriptId: savedScript.id,
      },
    });

    logger.info('[Script Generator] Script generated successfully', {
      scriptId: savedScript.id,
      userId: user.id,
    });

    return NextResponse.json(
      {
        scriptId: savedScript.id,
        ...scriptData,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Script Generator] Generation error', { error });
    return NextResponse.json(
      { error: "Failed to generate script" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

async function generateScriptWithAI(data: GenerateScriptRequest) {
  const {
    videoTitle,
    videoDescription = "",
    targetDuration,
    scriptStyle,
    tone,
    includeHook,
    includeCTA,
    keywords = [],
    additionalContext = "",
    niche = "general content",
  } = data;

  // Account for visual cues that get removed in TTS (~30% overhead)
  // For accurate audio duration, we need MORE speakable words
  const targetWords = Math.floor(targetDuration * 180); // ~180 words per minute (accounts for visual cues)
  const hookWords = includeHook ? 100 : 0;
  const introWords = 130;
  const ctaWords = includeCTA ? 80 : 0;
  const mainContentWords = targetWords - hookWords - introWords - ctaWords;

  const keywordsText = keywords.length > 0 ? `\nSEO Keywords to include naturally: ${keywords.join(", ")}` : "";

  const systemPrompt = `You are a professional YouTube scriptwriter who understands the 2025-2026 algorithm.

CRITICAL RULES:
1. First 15 seconds MUST hook viewers (use pattern interrupts, curiosity gaps, bold statements)
2. Structure for maximum retention (90-120 second segments with payoffs)
3. Include visual cues in square brackets: [SHOW: diagram], [B-ROLL: cityscape], [GRAPHICS: chart]
4. Natural speaking style (not robotic, use contractions, conversational language)
5. Strategic keyword placement for SEO (natural, not forced)
6. End with strong CTA if requested
7. IMPORTANT: Generate ENOUGH speakable content - visual cues are removed during text-to-speech
8. Target ~${targetWords} words of ACTUAL SPOKEN CONTENT (not counting visual cues)

SCRIPT STRUCTURE (word counts = SPOKEN WORDS ONLY, not including visual cues):
${includeHook ? `[HOOK] (0:00-0:15) - Grab attention immediately (~${hookWords} spoken words + visual cues)` : ''}
[INTRO] (${includeHook ? '0:15' : '0:00'}-0:45) - Set expectations, tease value (~${introWords} spoken words + visual cues)
[MAIN CONTENT] (~${mainContentWords} spoken words + visual cues) - Structured in "chapters" with clear transitions
[CONCLUSION] (last 30-60s) - Recap value, deliver on promise
${includeCTA ? '[CTA] (last 15s) - Subscribe, comment, next video (~80 spoken words + visual cues)' : ''}

Target Duration: ${targetDuration} minutes
Target SPOKEN content: ${targetWords} words (THIS MUST BE MET - visual cues are EXTRA)
Style: ${scriptStyle}
Tone: ${tone}
Niche: ${niche}
${keywordsText}

VIDEO TITLE: "${videoTitle}"
${videoDescription ? `DESCRIPTION: ${videoDescription}` : ''}
${additionalContext ? `ADDITIONAL CONTEXT: ${additionalContext}` : ''}

Generate a complete script that:
- Keeps viewers watching (retention optimization)
- Delivers massive value (algorithm rewards satisfaction)
- Feels natural and conversational
- Includes strategic pauses for engagement
- Has clear structure with timestamps
- Includes visual cues throughout
- CRITICAL: Contains ${targetWords} words of ACTUAL SPOKEN CONTENT (visual cues in brackets don't count toward this target)
- When converted to speech (removing visual cues), should be exactly ${targetDuration} minutes at 150 words/min

Return ONLY valid JSON in this exact format:
{
  "hook": "Hook content here (if includeHook is true)",
  "intro": "Introduction content here",
  "mainContent": [
    {
      "timestamp": "0:45",
      "segment": "Problem Introduction",
      "content": "Main content for this segment...",
      "visualCue": "[SHOW: problem example]"
    }
  ],
  "conclusion": "Conclusion content here",
  "cta": "CTA content here (if includeCTA is true)",
  "fullScript": "Complete script from start to finish as one continuous text",
  "retentionTips": ["Tip 1", "Tip 2", "Tip 3"],
  "visualCues": ["Visual cue 1", "Visual cue 2"],
  "estimatedDuration": ${targetDuration * 60}
}`;

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate the complete YouTube script." },
        ],
        temperature: 0.8,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content generated");
      }

      const parsed = JSON.parse(content);
      return {
        hook: parsed.hook || "",
        intro: parsed.intro || "",
        mainContent: parsed.mainContent || [],
        conclusion: parsed.conclusion || "",
        cta: parsed.cta || "",
        fullScript: parsed.fullScript || "",
        durationEstimate: parsed.estimatedDuration || targetDuration * 60,
        retentionTips: parsed.retentionTips || [],
        visualCues: parsed.visualCues || [],
        keywords: keywords,
      };
    } catch (error) {
      logger.error("[Script Generator] OpenAI generation failed", { error });
      return generateMockScript(data);
    }
  }

  return generateMockScript(data);
}

function generateMockScript(data: GenerateScriptRequest) {
  const { videoTitle, targetDuration, includeHook, includeCTA } = data;

  return {
    hook: includeHook
      ? `Stop! If you're interested in ${videoTitle.toLowerCase()}, you're probably making the same mistakes I made. But don't worry, by the end of this video, you'll know exactly what to do differently.`
      : "",
    intro: `Welcome back to the channel! Today, we're diving deep into ${videoTitle}. This is something I've spent months researching, and I'm going to share everything I've learned so you can get results faster than I did. So let's jump right in!`,
    mainContent: [
      {
        timestamp: "0:45",
        segment: "Understanding the Basics",
        content: `First, let's talk about what ${videoTitle} really means. [SHOW: definition on screen] Most people think it's just about X, but it's actually much more than that. It's about understanding Y and implementing Z in a way that actually works for your specific situation.`,
        visualCue: "[GRAPHICS: animated explanation]",
      },
      {
        timestamp: `${Math.floor(targetDuration * 0.33)}:00`,
        segment: "Common Mistakes",
        content: `Now here's where most people go wrong. [B-ROLL: examples of mistakes] They try to do everything at once, without understanding the fundamentals. I made this mistake too, and it cost me weeks of wasted effort. Don't let that happen to you.`,
        visualCue: "[SHOW: mistake examples]",
      },
      {
        timestamp: `${Math.floor(targetDuration * 0.66)}:00`,
        segment: "The Solution",
        content: `So what's the solution? It's actually simpler than you think. [SHOW: step-by-step process] You just need to focus on these three key things: First, understand the foundation. Second, implement consistently. And third, measure your results and adjust.`,
        visualCue: "[GRAPHICS: 3-step process]",
      },
    ],
    conclusion: `Alright, so to recap: we covered what ${videoTitle} really means, the common mistakes to avoid, and the exact steps you need to take to see results. If you implement what we discussed today, you'll be ahead of 90% of people trying to do this.`,
    cta: includeCTA
      ? `If you found this helpful, smash that like button and subscribe for more content like this. Drop a comment below and let me know what you want me to cover next. I'll see you in the next video!`
      : "",
    fullScript: `${includeHook ? `Stop! If you're interested in ${videoTitle.toLowerCase()}, you're probably making the same mistakes I made...` : ''} Welcome back to the channel! Today, we're diving deep into ${videoTitle}...`,
    durationEstimate: targetDuration * 60,
    retentionTips: [
      "Add a visual break every 90-120 seconds to maintain engagement",
      "Include a 'payoff moment' in each segment to reward viewers for watching",
      "Use pattern interrupts ('Now here's the interesting part...') to reset attention",
    ],
    visualCues: [
      "[SHOW: definition on screen]",
      "[GRAPHICS: animated explanation]",
      "[B-ROLL: examples]",
      "[SHOW: step-by-step process]",
    ],
    keywords: data.keywords || [],
  };
}
