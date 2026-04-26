export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail, parseJson } from "@/lib/api";
import { logger } from "@/lib/logger";
import { TranscriptionService } from "@/lib/domain/services/TranscriptionService";

const schema = z.object({
  assetId: z.string().min(1),
});

/**
 * POST /api/repurpose/retranscribe
 *
 * Re-runs Whisper transcription on a stored asset file and overwrites
 * Asset.transcript with the real result.  Use this to recover assets
 * whose transcript was generated as a synthetic/mock fallback.
 *
 * Body: { assetId: string }
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Unauthorized");

  const parsed = await parseJson(request, schema);
  if (!parsed.success) return parsed.response;

  const { assetId } = parsed.data;

  // Verify the asset belongs to this user.
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, project: { userId: user.id } },
    select: { id: true, path: true },
  });

  if (!asset) return fail(404, "Asset not found");
  if (!asset.path) return fail(400, "Asset has no stored file path — it may have been uploaded to remote storage only.");

  try {
    const service = new TranscriptionService();

    logger.info("Starting re-transcription", { assetId, userId: user.id });

    const result = await service.transcribe(asset.path);
    const serialized = service.serializeTranscription(result);

    await prisma.asset.update({
      where: { id: assetId },
      data: { transcript: serialized },
    });

    logger.info("Re-transcription completed", {
      assetId,
      userId: user.id,
      transcriptLength: serialized.length,
    });

    return ok({
      success: true,
      transcriptLength: serialized.length,
    });
  } catch (error) {
    logger.error("Re-transcription failed", { assetId, error });
    return fail(
      500,
      error instanceof Error
        ? error.message
        : "Transcription failed. Ensure the source file exists and a transcription provider (OPENAI_API_KEY) is configured."
    );
  }
}
