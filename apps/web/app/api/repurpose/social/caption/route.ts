export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import {
  generatePlatformSocialCopy,
  socialCaptionGenerationSchema,
} from "@/lib/repurpose/social-publishing";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const json = await request.json().catch(() => null);
  const clipId = typeof json?.clipId === "string" ? json.clipId : null;
  let clipContext: any = null;

  if (clipId) {
    clipContext = await prisma.clip.findFirst({
      where: { id: clipId, project: { userId: user.id } },
      include: { project: true },
    });
    if (!clipContext) return ApiResponseBuilder.notFound("Clip not found");
  }

  const parsed = socialCaptionGenerationSchema.safeParse({
    platform: json?.platform,
    clipTitle: json?.clipTitle ?? clipContext?.title ?? "",
    clipSummary: json?.clipSummary ?? clipContext?.summary ?? "",
    transcriptExcerpt: json?.transcriptExcerpt ?? clipContext?.captionSrt ?? "",
    audience: json?.audience ?? clipContext?.project?.targetPlatform ?? undefined,
    tone: json?.tone,
    cta: json?.cta ?? clipContext?.callToAction ?? undefined,
  });

  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid social caption generation request", {
      errors: parsed.error.flatten(),
    });
  }

  try {
    const copy = await generatePlatformSocialCopy(parsed.data);
    return ApiResponseBuilder.success({ copy }, "Social copy generated");
  } catch (error) {
    return ApiResponseBuilder.badRequest(
      error instanceof Error ? error.message : "Could not generate social copy",
    );
  }
}
