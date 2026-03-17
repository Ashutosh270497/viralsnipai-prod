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

const reviseScriptSchema = z.object({
  revision: z.enum(['more-engaging', 'shorten', 'lengthen', 'change-tone', 'add-examples', 'simplify', 'custom']),
  customInstructions: z.string().optional(),
  targetDuration: z.number().optional(),
  newTone: z.enum(['casual', 'professional', 'energetic', 'calm']).optional(),
});

/**
 * POST /api/scripts/[scriptId]/revise
 * Revise an existing script with AI
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
    const result = reviseScriptSchema.safeParse(body);

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

    const { revision, customInstructions, targetDuration, newTone } = result.data;

    // Build revision instructions
    let revisionPrompt = "";
    switch (revision) {
      case "more-engaging":
        revisionPrompt = "Make this script more engaging by adding curiosity gaps, stronger hooks, and more compelling language. Keep the same core content but make it more captivating.";
        break;
      case "shorten":
        revisionPrompt = `Shorten this script ${targetDuration ? `to approximately ${targetDuration} minutes` : 'by 20-30%'}. Remove unnecessary content while keeping all key points.`;
        break;
      case "lengthen":
        revisionPrompt = `Expand this script ${targetDuration ? `to approximately ${targetDuration} minutes` : 'by 30-50%'}. Add more examples, explanations, and depth without diluting the message.`;
        break;
      case "change-tone":
        revisionPrompt = `Change the tone of this script to be more ${newTone}. Adjust the language, pacing, and delivery style accordingly.`;
        break;
      case "add-examples":
        revisionPrompt = "Add 2-3 concrete examples or case studies to illustrate the main points. Make them relatable and specific.";
        break;
      case "simplify":
        revisionPrompt = "Simplify the language in this script. Use shorter sentences, common words, and clearer explanations. Make it accessible to a general audience.";
        break;
      case "custom":
        revisionPrompt = customInstructions || "Improve this script overall.";
        break;
    }

    logger.info('[Script Revise] Revising script', {
      scriptId: params.scriptId,
      userId: user.id,
      revision,
    });

    // Revise script with AI
    const revisedScript = await reviseScriptWithAI(script, revisionPrompt);

    // Update script in database
    const updatedScript = await prisma.generatedScript.update({
      where: {
        id: params.scriptId,
      },
      data: {
        hook: revisedScript.hook || script.hook,
        intro: revisedScript.intro || script.intro,
        mainContent: revisedScript.mainContent || script.mainContent,
        conclusion: revisedScript.conclusion || script.conclusion,
        cta: revisedScript.cta || script.cta,
        fullScript: revisedScript.fullScript || script.fullScript,
        durationEstimate: revisedScript.durationEstimate || script.durationEstimate,
      },
    });

    logger.info('[Script Revise] Script revised successfully', {
      scriptId: params.scriptId,
      userId: user.id,
    });

    return NextResponse.json(
      { script: updatedScript },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Script Revise] Revision error', { error });
    return NextResponse.json(
      { error: "Failed to revise script" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

async function reviseScriptWithAI(script: any, revisionPrompt: string) {
  const systemPrompt = `You are a professional YouTube script editor. You're given a script and instructions to revise it.

CURRENT SCRIPT:
Hook: ${script.hook || 'N/A'}
Intro: ${script.intro || 'N/A'}
Main Content: ${script.mainContent || 'N/A'}
Conclusion: ${script.conclusion || 'N/A'}
CTA: ${script.cta || 'N/A'}

REVISION INSTRUCTIONS:
${revisionPrompt}

Generate a revised version that:
- Maintains the core message and structure
- Implements the requested changes
- Keeps the natural, conversational style
- Includes visual cues where appropriate

Return ONLY valid JSON in this exact format:
{
  "hook": "Revised hook content",
  "intro": "Revised intro content",
  "mainContent": "Revised main content (as JSON string if it was originally JSON, otherwise plain text)",
  "conclusion": "Revised conclusion content",
  "cta": "Revised CTA content",
  "fullScript": "Complete revised script as continuous text",
  "durationEstimate": estimated_seconds
}`;

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Revise the script according to the instructions." },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content generated");
      }

      return JSON.parse(content);
    } catch (error) {
      logger.error("[Script Revise] OpenAI revision failed", { error });
      // Return original script if AI fails
      return {
        hook: script.hook,
        intro: script.intro,
        mainContent: script.mainContent,
        conclusion: script.conclusion,
        cta: script.cta,
        fullScript: script.fullScript,
        durationEstimate: script.durationEstimate,
      };
    }
  }

  // No AI available, return original
  return {
    hook: script.hook,
    intro: script.intro,
    mainContent: script.mainContent,
    conclusion: script.conclusion,
    cta: script.cta,
    fullScript: script.fullScript,
    durationEstimate: script.durationEstimate,
  };
}
