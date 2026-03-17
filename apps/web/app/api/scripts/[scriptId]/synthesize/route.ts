export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { formatPlanName, getRuntimeCoreUsageLimit, resolvePlanTier } from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { z } from "zod";

const synthesizeSchema = z.object({
  voiceId: z.string().default("alloy"),
  model: z.enum(["tts-1", "tts-1-hd", "gpt-4o-mini-tts"]).default("tts-1"),
  format: z.enum(["mp3", "wav", "ogg", "flac"]).default("mp3"),
  section: z.enum(["fullScript", "hook", "intro", "mainContent", "conclusion", "cta"]).default("fullScript"),
  speed: z.number().min(0.25).max(4.0).default(1.0),
});

/**
 * POST /api/scripts/[scriptId]/synthesize
 * Generate audio from script text using TTS
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

    // Get script
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

    const body = await request.json();
    const validatedData = synthesizeSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validatedData.error.errors },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { voiceId, model, format, section, speed } = validatedData.data;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, subscriptionTier: true },
    });
    const tier = resolvePlanTier(dbUser?.subscriptionTier || dbUser?.plan || "free");
    const ttsLimit = getRuntimeCoreUsageLimit(tier, "tts");
    if (Number.isFinite(ttsLimit)) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const ttsThisMonth = await prisma.usageLog.count({
        where: {
          userId: user.id,
          feature: "script-tts",
          createdAt: { gte: startOfMonth },
        },
      });

      if (ttsThisMonth >= ttsLimit) {
        return NextResponse.json(
          {
            error: "Usage limit reached",
            message:
              tier === "free"
                ? `Script TTS is not included on the ${formatPlanName(tier)} plan. Upgrade to Starter for monthly TTS generations or Creator to remove caps.`
                : `You've used all ${ttsLimit} script TTS generations this month on the ${formatPlanName(tier)} plan. Upgrade to Creator to remove TTS caps.`,
          },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Get text based on section
    let textToSynthesize = "";
    let sectionName = section;

    switch (section) {
      case "hook":
        textToSynthesize = script.hook || "";
        break;
      case "intro":
        textToSynthesize = script.intro || "";
        break;
      case "mainContent":
        textToSynthesize = script.mainContent || "";
        break;
      case "conclusion":
        textToSynthesize = script.conclusion || "";
        break;
      case "cta":
        textToSynthesize = script.cta || "";
        break;
      default:
        textToSynthesize = script.fullScript || "";
        sectionName = "fullScript";
    }

    if (!textToSynthesize) {
      return NextResponse.json(
        { error: "No text available for selected section" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Clean text for TTS (remove visual cues)
    const cleanedText = textToSynthesize
      .replace(/\[SHOW:.*?\]/g, "")
      .replace(/\[B-ROLL:.*?\]/g, "")
      .replace(/\[GRAPHICS:.*?\]/g, "")
      .replace(/\[CUT TO:.*?\]/g, "")
      .trim();

    if (!cleanedText) {
      return NextResponse.json(
        { error: "No speakable text found after cleaning" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    logger.info('[Script TTS] Generating audio', {
      scriptId: params.scriptId,
      voice: voiceId,
      model: model,
      section: sectionName,
      textLength: cleanedText.length,
    });

    // Call existing TTS endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const ttsResponse = await fetch(`${baseUrl}/api/transcribe/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": request.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        text: cleanedText,
        voice: voiceId,
        model: model,
        format: format,
        speed: speed,
      }),
    });

    if (!ttsResponse.ok) {
      const errorData = await ttsResponse.json().catch(() => ({}));
      logger.error('[Script TTS] TTS generation failed', {
        status: ttsResponse.status,
        error: errorData,
      });
      throw new Error(errorData.error || "TTS generation failed");
    }

    const ttsData = await ttsResponse.json();

    // Calculate approximate duration (more accurate than size estimation)
    // Average speaking rate: ~150 words/min, or ~2.5 words/sec
    const wordCount = cleanedText.split(/\s+/).length;
    const estimatedDurationSec = Math.round((wordCount / 150) * 60); // 150 words per minute

    // Save audio metadata
    const scriptAudio = await prisma.scriptAudio.create({
      data: {
        scriptId: params.scriptId,
        userId: user.id,
        voiceId: voiceId,
        voiceModel: model,
        audioUrl: ttsData.audioUrl,
        audioStoragePath: ttsData.fileKey,
        durationSec: estimatedDurationSec,
        format: format,
        fileSize: ttsData.size || 0,
        section: sectionName,
      },
    });

    // Log usage
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        feature: "script-tts",
        creditsUsed: 1,
        metadata: {
          scriptId: params.scriptId,
          audioId: scriptAudio.id,
          voice: voiceId,
          model: model,
          section: sectionName,
          characterCount: cleanedText.length,
        },
      },
    });

    logger.info('[Script TTS] Audio generated successfully', {
      scriptId: params.scriptId,
      audioId: scriptAudio.id,
      duration: estimatedDurationSec,
    });

    return NextResponse.json(
      {
        success: true,
        audio: {
          id: scriptAudio.id,
          url: scriptAudio.audioUrl,
          duration: scriptAudio.durationSec,
          voice: scriptAudio.voiceId,
          model: scriptAudio.voiceModel,
          section: scriptAudio.section,
          format: scriptAudio.format,
          fileSize: scriptAudio.fileSize,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    logger.error('[Script TTS] Generation error', { error });
    return NextResponse.json(
      { error: error.message || "Failed to generate audio" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * GET /api/scripts/[scriptId]/synthesize
 * Retrieve existing audio files for a script
 */
export async function GET(
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

    // Verify script ownership
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

    // Fetch audio files
    const audioFiles = await prisma.scriptAudio.findMany({
      where: { scriptId: params.scriptId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        voiceId: true,
        voiceModel: true,
        audioUrl: true,
        durationSec: true,
        format: true,
        fileSize: true,
        section: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { audioFiles },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    logger.error('[Script TTS GET] Error fetching audio files', { error });
    return NextResponse.json(
      { error: "Failed to fetch audio files" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
