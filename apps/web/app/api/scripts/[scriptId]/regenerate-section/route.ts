export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const regenerateSectionSchema = z.object({
  section: z.enum(['hook', 'intro', 'mainContent', 'conclusion', 'cta']),
  context: z.string().optional(),
});

/**
 * POST /api/scripts/[scriptId]/regenerate-section
 * Regenerate a specific section of the script
 */
export async function POST(
  request: Request,
  { params }: { params: { scriptId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await request.json();
    const result = regenerateSectionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Verify ownership and fetch script
    const script = await prisma.generatedScript.findFirst({
      where: {
        id: params.scriptId,
        userId: user.id,
      },
    });

    if (!script) {
      return NextResponse.json(
        { error: "Script not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { section, context } = result.data;

    logger.info('[Script Regenerate Section] Regenerating section', {
      scriptId: params.scriptId,
      userId: user.id,
      section,
    });

    // Regenerate the specific section
    const regeneratedContent = await regenerateSectionWithAI(script, section, context);

    // Update only the specific section
    const updateData: any = {};
    updateData[section] = regeneratedContent;

    // Also update fullScript if it exists
    if (script.fullScript) {
      updateData.fullScript = updateFullScript(script, section, regeneratedContent);
    }

    const updatedScript = await prisma.generatedScript.update({
      where: {
        id: params.scriptId,
      },
      data: updateData,
    });

    logger.info('[Script Regenerate Section] Section regenerated successfully', {
      scriptId: params.scriptId,
      userId: user.id,
      section,
    });

    return NextResponse.json(
      { script: updatedScript, section, content: regeneratedContent },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Script Regenerate Section] Regeneration error', { error });
    return NextResponse.json(
      { error: "Failed to regenerate section" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

async function regenerateSectionWithAI(
  script: any,
  section: string,
  customContext?: string
): Promise<string> {
  const sectionPrompts: Record<string, string> = {
    hook: `Generate a compelling 15-second hook for a YouTube video titled "${script.title}".

REQUIREMENTS:
- Must grab attention immediately (use curiosity gap, bold statement, or pattern interrupt)
- 80-100 words (~15 seconds)
- Natural and conversational
- Creates desire to keep watching
${customContext ? `\nADDITIONAL CONTEXT: ${customContext}` : ''}

Current hook (for reference): ${script.hook || 'None'}

Generate ONLY the new hook text, no JSON or formatting.`,

    intro: `Generate an engaging introduction for a YouTube video titled "${script.title}".

REQUIREMENTS:
- Set expectations and tease the value viewers will get
- 100-120 words (~30-45 seconds)
- Establish credibility if needed
- Create curiosity about what's coming
${customContext ? `\nADDITIONAL CONTEXT: ${customContext}` : ''}

Hook: ${script.hook || 'N/A'}
Current intro (for reference): ${script.intro || 'None'}

Generate ONLY the new intro text, no JSON or formatting.`,

    mainContent: `Generate the main content section for a YouTube video titled "${script.title}".

REQUIREMENTS:
- Deliver the core value and information
- Break into logical segments with timestamps
- Include visual cues [SHOW:], [B-ROLL:], [GRAPHICS:]
- Natural transitions between points
- Keep viewer engaged with examples and payoffs
${customContext ? `\nADDITIONAL CONTEXT: ${customContext}` : ''}

Hook: ${script.hook || 'N/A'}
Intro: ${script.intro || 'N/A'}
Current main content (for reference): ${script.mainContent || 'None'}

Generate ONLY the new main content, structured with timestamps and visual cues.`,

    conclusion: `Generate a strong conclusion for a YouTube video titled "${script.title}".

REQUIREMENTS:
- Recap the key value delivered
- 60-80 words (~30 seconds)
- Reinforce the main takeaway
- Natural transition to CTA if present
${customContext ? `\nADDITIONAL CONTEXT: ${customContext}` : ''}

Main content covered: ${script.mainContent ? 'Available' : 'N/A'}
Current conclusion (for reference): ${script.conclusion || 'None'}

Generate ONLY the new conclusion text, no JSON or formatting.`,

    cta: `Generate a compelling call-to-action for a YouTube video titled "${script.title}".

REQUIREMENTS:
- Encourage likes, comments, and subscriptions
- 50-60 words (~15 seconds)
- Specific ask (comment topic, what to watch next, etc.)
- Enthusiastic and natural
${customContext ? `\nADDITIONAL CONTEXT: ${customContext}` : ''}

Current CTA (for reference): ${script.cta || 'None'}

Generate ONLY the new CTA text, no JSON or formatting.`,
  };

  const prompt = sectionPrompts[section];

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a professional YouTube scriptwriter. Generate natural, engaging script content optimized for retention.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.9,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content generated");
      }

      return content.trim();
    } catch (error) {
      logger.error("[Script Regenerate Section] OpenAI generation failed", { error });
      return generateMockSection(section, script);
    }
  }

  return generateMockSection(section, script);
}

function generateMockSection(section: string, script: any): string {
  const mockContent: Record<string, string> = {
    hook: `Stop! If you're interested in ${script.title.toLowerCase()}, what I'm about to show you will completely change your approach. Stay with me for the next few minutes because this is game-changing.`,
    intro: `Welcome back! Today we're diving deep into ${script.title}. I've spent months researching this, testing different approaches, and I'm going to share everything that actually works. By the end of this video, you'll have a clear roadmap to get results. Let's jump right in!`,
    mainContent: `Let me break this down into three key points. First, understanding the fundamentals [SHOW: diagram]. Most people skip this step, but it's crucial for long-term success. Second, the practical implementation [B-ROLL: examples]. I'll show you exactly how to apply this in real situations. And third, avoiding the common pitfalls [GRAPHICS: mistakes to avoid]. These are the errors that trip up 90% of people.`,
    conclusion: `So to recap: we covered the fundamentals, the step-by-step implementation, and the mistakes to avoid. If you take action on what we discussed today, you'll see results faster than you expect. Now here's what you need to do next...`,
    cta: `If you found this helpful, hit that like button and subscribe for more content like this. Drop a comment below and let me know which part was most valuable to you. I'll see you in the next video!`,
  };

  return mockContent[section] || `Regenerated ${section} content for ${script.title}`;
}

function updateFullScript(script: any, section: string, newContent: string): string {
  // Rebuild the full script with the new section
  const parts: string[] = [];

  if (section === 'hook' || script.hook) {
    parts.push(section === 'hook' ? newContent : script.hook);
  }

  if (section === 'intro' || script.intro) {
    parts.push(section === 'intro' ? newContent : script.intro);
  }

  if (section === 'mainContent' || script.mainContent) {
    parts.push(section === 'mainContent' ? newContent : script.mainContent);
  }

  if (section === 'conclusion' || script.conclusion) {
    parts.push(section === 'conclusion' ? newContent : script.conclusion);
  }

  if (section === 'cta' || script.cta) {
    parts.push(section === 'cta' ? newContent : script.cta);
  }

  return parts.filter(Boolean).join('\n\n');
}
