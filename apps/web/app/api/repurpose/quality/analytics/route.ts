export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { aggregateClipQualityAnalytics } from "@/lib/repurpose/quality-analytics";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const workspaceId = url.searchParams.get("workspaceId");

  const projectWhere = {
    userId: user.id,
    ...(projectId ? { id: projectId } : {}),
    ...(workspaceId ? { workspaceId } : {}),
  };

  const [clips, feedback, exports, socialPosts] = await Promise.all([
    (prisma as any).clip.findMany({ where: { project: projectWhere }, take: 500 }),
    (prisma as any).clipFeedback.findMany({ where: { userId: user.id, ...(workspaceId ? { workspaceId } : {}) }, take: 1000 }),
    (prisma as any).export.findMany({ where: { project: projectWhere }, take: 500 }),
    (prisma as any).socialPost.findMany({ where: { userId: user.id, ...(projectId ? { projectId } : {}), ...(workspaceId ? { workspaceId } : {}) }, take: 500 }),
  ]);

  return ApiResponseBuilder.success({
    analytics: aggregateClipQualityAnalytics({ clips, feedback, exports, socialPosts }),
  });
}
