export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentDbUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import {
  createPlatformApiKeySchema,
  generatePlatformApiKey,
  normalizePlatformApiScopes,
  serializePlatformApiKey,
} from "@/lib/platform/api-keys";
import { assertWorkspaceAccess } from "@/lib/platform/workspaces";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const apiKeys = await (prisma as any).apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return ApiResponseBuilder.success({ apiKeys: apiKeys.map(serializePlatformApiKey) });
}

export async function POST(request: Request) {
  const user = await getCurrentDbUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const parsed = createPlatformApiKeySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid API key payload", { errors: parsed.error.flatten() });
  }

  const workspaceId = parsed.data.workspaceId ?? null;
  if (workspaceId) {
    const role = await assertWorkspaceAccess(user.id, workspaceId, "admin");
    if (!role) return ApiResponseBuilder.forbidden("Workspace admin access required");
  }

  const generated = generatePlatformApiKey();
  const apiKey = await (prisma as any).apiKey.create({
    data: {
      userId: user.id,
      workspaceId,
      name: parsed.data.name,
      keyHash: generated.keyHash,
      prefix: generated.prefix,
      scopes: normalizePlatformApiScopes(parsed.data.scopes),
      status: "active",
    },
  });

  return ApiResponseBuilder.success(
    {
      apiKey: serializePlatformApiKey(apiKey),
      token: generated.token,
      warning: "Copy this token now. It is shown only once and only the hash is stored.",
    },
    "API key created",
  );
}
