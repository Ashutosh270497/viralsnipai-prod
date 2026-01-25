export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { generateImagenImages, ImagenRequestError } from "@/lib/google-imagen";
import { getBrandKit } from "@/lib/brand-kit";
import { prisma } from "@/lib/prisma";
import { resolveWatermarkStyle } from "@/lib/watermark";

const aspectRatioEnum = z.enum(["1:1", "3:4", "4:3", "9:16", "16:9"]);
const qualityEnum = z.enum(["standard", "premium"]);

const schema = z.object({
  prompt: z.string().min(3, "Prompt must be at least 3 characters long."),
  negativePrompt: z.string().max(500).optional(),
  aspectRatio: aspectRatioEnum.optional(),
  quality: qualityEnum.optional(),
  count: z.number().int().min(1).max(4).optional(),
  stylePreset: z.string().max(120).optional(),
  seed: z.number().int().nonnegative().optional(),
  referenceImage: z
    .object({
      base64: z.string().min(10, "Reference image payload is required."),
      mimeType: z.string().min(3, "Reference MIME type is required."),
      filename: z.string().optional()
    })
    .optional(),
  referenceImages: z
    .array(
      z.object({
        base64: z.string().min(10, "Reference image payload is required."),
        mimeType: z.string().min(3, "Reference MIME type is required."),
        filename: z.string().optional()
      })
    )
    .max(5)
    .optional()
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    console.error("Invalid JSON payload for Imagen", error);
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.flatten() },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const payloadWithArray = {
    ...result.data,
    referenceImages:
      result.data.referenceImages ??
      (result.data.referenceImage ? [result.data.referenceImage] : undefined)
  };

  try {
    const [brandKit, account] = await Promise.all([
      getBrandKit(user.id),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { plan: true }
      })
    ]);
    const watermarkStyle = resolveWatermarkStyle(brandKit, account?.plan);
    const images = await generateImagenImages(payloadWithArray, {
      watermarkStyle
    });

    return NextResponse.json({ images }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ImagenRequestError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        {
          status: error.status && error.status >= 400 ? error.status : 502,
          headers: { "Cache-Control": "no-store" }
        }
      );
    }
    console.error("Unexpected Imagen error", error);
    return NextResponse.json(
      { error: "Unexpected Imagen failure" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
