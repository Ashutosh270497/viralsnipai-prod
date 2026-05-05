export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/utils/error-handler";
import { parseCanonicalTranscript, getWordsBetween } from "@/lib/repurpose/transcript-ui";
import { srtUtils } from "@/lib/srt-utils";

const schema = z.object({
  assetId: z.string().min(1),
  projectId: z.string().min(1),
  startWordIndex: z.number().int().min(0),
  endWordIndex: z.number().int().min(0),
  title: z.string().max(120).optional(),
  intent: z.string().max(500).optional(),
});

const PRE_ROLL_MS = 300;
const POST_ROLL_MS = 500;
const MIN_CLIP_MS = 20_000;
const MAX_CLIP_MS = 45_000;

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser();
  if (!user) {
    return ApiResponseBuilder.unauthorized("Authentication required");
  }

  const json = await request.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid request body", {
      errors: parsed.error.flatten(),
    });
  }

  const { assetId, projectId, startWordIndex, endWordIndex, title, intent } = parsed.data;

  const asset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      projectId,
      project: { userId: user.id },
    },
    select: {
      id: true,
      projectId: true,
      durationSec: true,
      transcript: true,
    },
  });

  if (!asset) {
    return ApiResponseBuilder.notFound("Asset not found");
  }

  const transcript = parseCanonicalTranscript(asset.transcript);
  if (transcript.words.length === 0) {
    return ApiResponseBuilder.badRequest(
      "Word-level transcript is required to create clips from transcript selection",
      { precision: transcript.precision },
    );
  }

  const selectedWords = getWordsBetween(transcript, startWordIndex, endWordIndex);
  if (selectedWords.length === 0) {
    return ApiResponseBuilder.badRequest("Selected transcript words were not found");
  }

  const sourceDurationMs = Math.max(1, Math.round((asset.durationSec ?? 0) * 1000));
  const selectionStartMs = selectedWords[0].startMs;
  const selectionEndMs = selectedWords[selectedWords.length - 1].endMs;
  const expanded = expandSelectionBoundary(selectionStartMs, selectionEndMs, sourceDurationMs);
  const quote = selectedWords.map((word) => word.word).join(" ").replace(/\s+/g, " ").trim();
  const captionSrt = buildCaptionSrtForWords(
    transcript.words.filter(
      (word) => word.endMs > expanded.startMs && word.startMs < expanded.endMs,
    ),
    expanded.startMs,
  );

  const clipCount = await prisma.clip.count({ where: { projectId } });
  const clip = await prisma.clip.create({
    data: {
      projectId,
      assetId,
      startMs: expanded.startMs,
      endMs: expanded.endMs,
      title: title?.trim() || buildFallbackTitle(quote),
      summary: quote,
      captionSrt,
      order: clipCount,
      viralityFactors: {
        hookStrength: 0,
        emotionalPeak: 0,
        storyArc: 0,
        pacing: 0,
        transcriptQuality: transcript.precision === "word" ? 100 : 60,
        metadata: {
          source: "transcript_selection",
          intent: intent ?? null,
          candidateType: "quote",
          transcriptPrecision: transcript.precision,
          boundaryConfidence: transcript.precision === "word" ? "high" : "medium",
          boundaryReasons: ["Created from user-selected transcript word timestamps."],
          selectedWordRange: {
            startWordIndex: selectedWords[0].index,
            endWordIndex: selectedWords[selectedWords.length - 1].index,
          },
        },
      },
    },
  });

  await prisma.clipEditOperation.create({
    data: {
      clipId: clip.id,
      type: "add_range",
      startMs: expanded.startMs,
      endMs: expanded.endMs,
      payload: {
        source: "transcript_selection",
        quote,
        startWordIndex: selectedWords[0].index,
        endWordIndex: selectedWords[selectedWords.length - 1].index,
      },
    },
  });

  return ApiResponseBuilder.success({ clip }, "Clip created from transcript selection");
});

function expandSelectionBoundary(startMs: number, endMs: number, durationMs: number) {
  let nextStartMs = Math.max(0, startMs - PRE_ROLL_MS);
  let nextEndMs = Math.min(durationMs || endMs + POST_ROLL_MS, endMs + POST_ROLL_MS);
  const currentDuration = nextEndMs - nextStartMs;

  if (currentDuration < MIN_CLIP_MS) {
    const missing = MIN_CLIP_MS - currentDuration;
    const before = Math.min(nextStartMs, Math.floor(missing / 2));
    const after = Math.min(Math.max(0, durationMs - nextEndMs), missing - before);
    nextStartMs -= before;
    nextEndMs += after;
  }

  if (nextEndMs - nextStartMs > MAX_CLIP_MS) {
    nextEndMs = Math.min(nextEndMs, nextStartMs + MAX_CLIP_MS);
  }

  return {
    startMs: Math.max(0, Math.round(nextStartMs)),
    endMs: Math.max(Math.round(nextStartMs) + 1, Math.round(nextEndMs)),
  };
}

function buildCaptionSrtForWords(
  words: Array<{ word: string; startMs: number; endMs: number }>,
  clipStartMs: number,
) {
  const entries = [];
  for (let index = 0; index < words.length; index += 5) {
    const chunk = words.slice(index, index + 5);
    if (chunk.length === 0) {
      continue;
    }
    entries.push({
      index: entries.length + 1,
      startMs: Math.max(0, chunk[0].startMs - clipStartMs),
      endMs: Math.max(120, chunk[chunk.length - 1].endMs - clipStartMs),
      text: chunk.map((word) => word.word).join(" "),
    });
  }
  return srtUtils.buildSRT(entries);
}

function buildFallbackTitle(quote: string) {
  const clean = quote.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "Transcript clip";
  }
  return clean.length <= 70 ? clean : `${clean.slice(0, 67).trim()}...`;
}
