export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, ok, parseJson } from "@/lib/api";
import { logger } from "@/lib/logger";

const createStyleProfileSchema = z.object({
  name: z.string().min(1).max(100),
  referenceVideos: z.array(z.string()).optional().default([]),
  styleConfig: z
    .object({
      colorGrading: z
        .object({
          temperature: z.number().optional(),
          tint: z.number().optional(),
          contrast: z.number().optional(),
          saturation: z.number().optional(),
          highlights: z.number().optional(),
          shadows: z.number().optional(),
          vibrance: z.number().optional()
        })
        .optional(),
      aesthetics: z
        .object({
          vignette: z
            .object({
              enabled: z.boolean().optional(),
              intensity: z.number().optional()
            })
            .optional(),
          filmGrain: z
            .object({
              enabled: z.boolean().optional(),
              amount: z.number().optional()
            })
            .optional(),
          sharpen: z.number().optional(),
          blur: z.number().optional()
        })
        .optional(),
      composition: z
        .object({
          cropRatio: z.string().optional(),
          safeZones: z.boolean().optional(),
          rulesOfThirds: z.boolean().optional()
        })
        .optional()
    })
    .optional(),
  isDefault: z.boolean().optional()
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }

  const parsed = await parseJson(request, createStyleProfileSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { data } = parsed;

  // If this is being set as default, unset any existing defaults
  if (data.isDefault) {
    await prisma.agentStyleProfile.updateMany({
      where: {
        userId: user.id,
        isDefault: true
      },
      data: {
        isDefault: false
      }
    });
  }

  const profile = await prisma.agentStyleProfile.create({
    data: {
      userId: user.id,
      name: data.name,
      referenceVideos: data.referenceVideos,
      styleConfig: data.styleConfig ?? {},
      isDefault: data.isDefault ?? false
    }
  });

  logger.info("Created agent style profile", {
    profileId: profile.id,
    userId: user.id,
    name: data.name
  });

  return ok({ profile });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }

  const profiles = await prisma.agentStyleProfile.findMany({
    where: {
      userId: user.id
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
  });

  return ok({ profiles });
}
