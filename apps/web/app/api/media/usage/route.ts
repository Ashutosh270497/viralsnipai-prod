export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import {
  getMediaUsageCount,
  getMediaUsageLimit,
  resolveUserPlanForMedia,
  type V1MediaUsageFeature,
} from "@/lib/media/v1-media-policy";

const FEATURES: Array<{ key: V1MediaUsageFeature; label: string }> = [
  { key: "video_upload", label: "Video uploads" },
  { key: "video_export", label: "Clip exports" },
];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return ApiResponseBuilder.unauthorized("Authentication required");
  }

  const billingUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, subscriptionTier: true },
  });
  const plan = resolveUserPlanForMedia(billingUser ?? {});
  const rows = await Promise.all(
    FEATURES.map(async (feature) => {
      const [used, limit] = await Promise.all([
        getMediaUsageCount(user.id, feature.key),
        Promise.resolve(getMediaUsageLimit(plan, feature.key)),
      ]);

      return {
        feature: feature.key,
        label: feature.label,
        used,
        limit,
        remaining: Math.max(0, limit - used),
        percentage: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0,
      };
    })
  );

  return ApiResponseBuilder.successResponse({
    plan,
    resetDate: getNextUsageResetDate().toISOString(),
    usage: rows,
  });
}

function getNextUsageResetDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}
