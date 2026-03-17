export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getViralTemplates } from "@/lib/data/viral-templates";
import { getActiveClient } from "@/lib/openrouter-client";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";

const TEMPLATE_REMIX_TARGET = getActiveClient(null, "snipradarTemplatesRemix");

/**
 * GET /api/snipradar/templates
 * List templates with optional filters:
 * ?category=hook&niche=tech&intent=authority&difficulty=easy&q=search&curatedOnly=true&minQuality=80
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const niche = searchParams.get("niche");
    const intent = searchParams.get("intent");
    const difficulty = searchParams.get("difficulty");
    const q = searchParams.get("q")?.toLowerCase();
    const curatedOnly = searchParams.get("curatedOnly") === "true";
    const minQuality = Number(searchParams.get("minQuality") ?? 0);

    let templates = getViralTemplates();

    if (category) {
      templates = templates.filter((t) => t.category === category);
    }
    if (niche) {
      templates = templates.filter(
        (t) => t.niche === niche || t.niche === null
      );
    }
    if (intent) {
      templates = templates.filter((t) => t.intent === intent);
    }
    if (difficulty) {
      templates = templates.filter((t) => t.difficulty === difficulty);
    }
    if (curatedOnly) {
      templates = templates.filter((t) => t.curated);
    }
    if (Number.isFinite(minQuality) && minQuality > 0) {
      templates = templates.filter((t) => t.qualityScore >= minQuality);
    }
    if (q) {
      templates = templates.filter(
        (t) =>
          t.template.toLowerCase().includes(q) ||
          t.exampleFilled.toLowerCase().includes(q) ||
          t.intent.toLowerCase().includes(q) ||
          t.difficulty.toLowerCase().includes(q) ||
          t.hookType.toLowerCase().includes(q) ||
          t.emotionalTrigger.toLowerCase().includes(q)
      );
    }

    const allTemplates = getViralTemplates();
    return NextResponse.json({
      templates,
      total: templates.length,
      categories: [...new Set(allTemplates.map((t) => t.category))],
      niches: [
        ...new Set(
          allTemplates.map((t) => t.niche).filter(Boolean) as string[]
        ),
      ],
      intents: [...new Set(allTemplates.map((t) => t.intent))],
      difficulties: [...new Set(allTemplates.map((t) => t.difficulty))],
      curatedCount: allTemplates.filter((t) => t.curated).length,
    });
  } catch (error) {
    console.error("[SnipRadar Templates] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/snipradar/templates
 * Remix a template with AI personalization
 * Body: { template: string, niche: string, context?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:templates:remix", user.id, [
      {
        name: "burst",
        windowMs: SNIPRADAR.AI_RATE_LIMIT_BURST_WINDOW_MS,
        maxHits: SNIPRADAR.AI_RATE_LIMIT_BURST_MAX_REQUESTS,
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before remixing more templates." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const body = await req.json();
    const { template, niche, context } = body;

    if (!template || !niche) {
      return NextResponse.json(
        { error: "Template and niche are required" },
        { status: 400 }
      );
    }

    if (!TEMPLATE_REMIX_TARGET.client || !TEMPLATE_REMIX_TARGET.model) {
      return NextResponse.json(
        { error: "AI not configured" },
        { status: 503 }
      );
    }

    const response = await TEMPLATE_REMIX_TARGET.client.chat.completions.create({
      model: TEMPLATE_REMIX_TARGET.model,
      messages: [
        {
          role: "system",
          content: `You are an expert tweet writer. Given a viral tweet template, create 3 unique, personalized variations for the specified niche.

Rules:
- Each variation must be ≤280 characters
- Fill in all placeholders with niche-relevant content
- Keep the structural pattern that makes the template viral
- Make each variation distinct in tone/angle
- Output ONLY a JSON array of 3 strings: ["tweet1", "tweet2", "tweet3"]`,
        },
        {
          role: "user",
          content: `Template: ${template}\nNiche: ${niche}${context ? `\nAdditional context: ${context}` : ""}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "AI returned empty response" },
        { status: 500 }
      );
    }

    try {
      const parsed = JSON.parse(content);
      const variations: string[] = Array.isArray(parsed)
        ? parsed
        : parsed.tweets || parsed.variations || Object.values(parsed);

      return NextResponse.json({
        variations: variations.slice(0, 3).map((v: string) => v.slice(0, 280)),
      });
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    if (error?.message?.startsWith("RATE_LIMIT:")) {
      return NextResponse.json(
        { error: "AI rate limit reached. Try again in a few minutes." },
        { status: 429 }
      );
    }
    console.error("[SnipRadar Templates] POST error:", error);
    return NextResponse.json(
      { error: "Failed to remix template" },
      { status: 500 }
    );
  }
}
