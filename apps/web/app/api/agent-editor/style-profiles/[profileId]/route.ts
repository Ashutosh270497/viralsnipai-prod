export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, ok, parseJson } from "@/lib/api";
import { logger } from "@/lib/logger";

const updateStyleProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  referenceVideos: z.array(z.string()).optional(),
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

export async function GET(
  request: Request,
  { params }: { params: { profileId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }

  const profile = await prisma.agentStyleProfile.findFirst({
    where: {
      id: params.profileId,
      userId: user.id
    }
  });

  if (!profile) {
    return fail(404, "Style profile not found");
  }

  return ok({ profile });
}

export async function PATCH(
  request: Request,
  { params }: { params: { profileId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }

  const profile = await prisma.agentStyleProfile.findFirst({
    where: {
      id: params.profileId,
      userId: user.id
    }
  });

  if (!profile) {
    return fail(404, "Style profile not found");
  }

  const parsed = await parseJson(request, updateStyleProfileSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { data } = parsed;

  // If this is being set as default, unset any existing defaults
  if (data.isDefault) {
    await prisma.agentStyleProfile.updateMany({
      where: {
        userId: user.id,
        isDefault: true,
        id: { not: params.profileId }
      },
      data: {
        isDefault: false
      }
    });
  }

  const updateData: any = {};

  if (data.name !== undefined) {
    updateData.name = data.name;
  }

  if (data.referenceVideos !== undefined) {
    updateData.referenceVideos = data.referenceVideos;
  }

  if (data.styleConfig !== undefined) {
    updateData.styleConfig = data.styleConfig;
  }

  if (data.isDefault !== undefined) {
    updateData.isDefault = data.isDefault;
  }

  const updatedProfile = await prisma.agentStyleProfile.update({
    where: {
      id: params.profileId
    },
    data: updateData
  });

  logger.info("Updated agent style profile", {
    profileId: params.profileId,
    userId: user.id
  });

  return ok({ profile: updatedProfile });
}

export async function DELETE(
  request: Request,
  { params }: { params: { profileId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }

  const profile = await prisma.agentStyleProfile.findFirst({
    where: {
      id: params.profileId,
      userId: user.id
    }
  });

  if (!profile) {
    return fail(404, "Style profile not found");
  }

  await prisma.agentStyleProfile.delete({
    where: {
      id: params.profileId
    }
  });

  logger.info("Deleted agent style profile", {
    profileId: params.profileId,
    userId: user.id
  });

  return ok({ message: "Style profile deleted successfully" });
}
