export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import path from "path";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { downloadYouTubeVideo } from "@/lib/youtube";
import { saveBuffer } from "@/lib/storage";
import { transcribeFile, TranscriptionResult } from "@/lib/transcript";
import { probeDuration } from "@/lib/ffmpeg";

const youtubeSchema = z.object({
  mode: z.literal("youtube"),
  url: z.string().url(),
  title: z.string().optional()
});

type TranscriptSegment = {
  timestamp: string;
  speaker: string;
  text: string;
};

type SerializedJob = {
  id: string;
  status: string;
  sourceType: string;
  sourceUrl: string | null;
  title: string | null;
  fileUrl: string | null;
  transcript: string | null;
  segments: TranscriptSegment[];
  durationSec: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.transcriptJob.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 15
  });

  return NextResponse.json(
    { jobs: jobs.map(serializeJob) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = youtubeSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ error: payload.error.flatten() }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    return handleYouTubeJob({ userId: user.id, url: payload.data.url, title: payload.data.title });
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const mode = formData.get("mode");
    if (mode !== "upload") {
      return NextResponse.json({ error: "Unsupported mode" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const title = typeof formData.get("title") === "string" ? formData.get("title") : null;
    return handleUploadJob({ userId: user.id, file, title });
  }

  return NextResponse.json({ error: "Unsupported content type" }, { status: 415, headers: { "Cache-Control": "no-store" } });
}

async function handleYouTubeJob({ userId, url, title }: { userId: string; url: string; title?: string | null }) {
  const projectKey = `transcribe-${userId}`;
  let jobId: string | null = null;

  try {
    const download = await downloadYouTubeVideo(url, projectKey);

    const job = await prisma.transcriptJob.create({
      data: {
        userId,
        status: "processing",
        sourceType: "youtube",
        sourceUrl: url,
        filePath: download.filePath,
        fileUrl: download.publicPath,
        title: title ?? download.title ?? null,
        durationSec: download.durationSec ?? null
      }
    });
    jobId = job.id;

    const transcription = await transcribeFile(download.filePath);
    const { text, segments } = normalizeTranscription(transcription);

    const updated = await prisma.transcriptJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        transcript: text,
        segments,
        error: null
      }
    });

    return NextResponse.json(
      { job: serializeJob(updated) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("YouTube transcription failed", error);
    if (jobId) {
      await prisma.transcriptJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown transcription error"
        }
      }).catch((updateError) => {
        console.error("Failed to update transcript job status", updateError);
      });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to transcribe YouTube source." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

async function handleUploadJob({ userId, file, title }: { userId: string; file: File; title?: string | null }) {
  let jobId: string | null = null;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extension = getFileExtension(file);

    const saved = await saveBuffer(buffer, {
      prefix: `transcribe/${userId}/uploads/`,
      extension,
      contentType: file.type || undefined
    });

    let durationSec: number | null = null;
    try {
      const duration = await probeDuration(saved.storagePath);
      if (Number.isFinite(duration)) {
        durationSec = Math.round(Number(duration));
      }
    } catch (durationError) {
      console.warn("Unable to probe uploaded file duration", durationError);
    }

    const job = await prisma.transcriptJob.create({
      data: {
        userId,
        status: "processing",
        sourceType: "upload",
        filePath: saved.storagePath,
        fileUrl: saved.url,
        title: title ?? file.name ?? null,
        durationSec
      }
    });
    jobId = job.id;

    const transcription = await transcribeFile(saved.storagePath);
    const { text, segments } = normalizeTranscription(transcription);

    const updated = await prisma.transcriptJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        transcript: text,
        segments,
        error: null
      }
    });

    return NextResponse.json(
      { job: serializeJob(updated) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Upload transcription failed", error);
    if (jobId) {
      await prisma.transcriptJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown transcription error"
        }
      }).catch((updateError) => {
        console.error("Failed to update transcript job status", updateError);
      });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to transcribe uploaded file." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

function getFileExtension(file: File) {
  const nameExt = path.extname(file.name || "");
  if (nameExt) {
    return nameExt;
  }
  if (file.type) {
    const mapping: Record<string, string> = {
      "video/mp4": ".mp4",
      "video/mpeg": ".mpg",
      "video/quicktime": ".mov",
      "audio/mpeg": ".mp3",
      "audio/wav": ".wav",
      "audio/webm": ".webm"
    };
    return mapping[file.type] ?? "";
  }
  return "";
}

function normalizeTranscription(result: TranscriptionResult): { text: string; segments: TranscriptSegment[] } {
  const text = result.text.trim();
  if (result.segments.length > 0) {
    const mapped = result.segments
      .map((segment, index) => ({
        timestamp: formatTimestamp(Math.floor(segment.start ?? index * 5)),
        speaker: `Speaker ${String.fromCharCode(65 + (index % 26))}`,
        text: segment.text.trim()
      }))
      .filter((segment) => segment.text.length > 0);
    if (mapped.length > 0) {
      return { text, segments: mapped.slice(0, 500) };
    }
  }

  return { text, segments: generateSegmentsFromText(text) };
}

function generateSegmentsFromText(text: string): TranscriptSegment[] {
  if (!text) {
    return [];
  }
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.slice(0, 500).map((sentence, index) => ({
    timestamp: formatTimestamp(index * 8),
    speaker: `Speaker ${String.fromCharCode(65 + (index % 26))}`,
    text: sentence
  }));
}

function formatTimestamp(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function serializeJob(job: any): SerializedJob {
  const segments = Array.isArray(job.segments) ? (job.segments as TranscriptSegment[]) : [];

  return {
    id: job.id,
    status: job.status,
    sourceType: job.sourceType,
    sourceUrl: job.sourceUrl ?? null,
    title: job.title ?? null,
    fileUrl: job.fileUrl ?? null,
    transcript: job.transcript ?? null,
    segments,
    durationSec: job.durationSec ?? null,
    error: job.error ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}
