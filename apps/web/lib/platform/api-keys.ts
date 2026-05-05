import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const PLATFORM_API_SCOPES = [
  "all",
  "projects:read",
  "projects:write",
  "assets:write",
  "clips:read",
  "clips:write",
  "exports:read",
  "exports:write",
  "analytics:read",
] as const;

export type PlatformApiScope = (typeof PLATFORM_API_SCOPES)[number];

export const DEFAULT_PLATFORM_API_SCOPES: PlatformApiScope[] = [
  "projects:read",
  "projects:write",
  "assets:write",
  "clips:read",
  "clips:write",
  "exports:read",
  "exports:write",
  "analytics:read",
];

export const platformApiScopeSchema = z.enum(PLATFORM_API_SCOPES);

export const createPlatformApiKeySchema = z.object({
  name: z.string().trim().min(2).max(80),
  workspaceId: z.string().min(1).nullable().optional(),
  scopes: z.array(z.string()).max(16).optional(),
});

const API_KEY_PREFIX = "vsai_live_";

export function hashPlatformApiKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generatePlatformApiKey() {
  const token = `${API_KEY_PREFIX}${randomBytes(28).toString("base64url")}`;
  return {
    token,
    keyHash: hashPlatformApiKey(token),
    prefix: token.slice(0, 16),
  };
}

export function normalizePlatformApiScopes(scopes: string[] | null | undefined): PlatformApiScope[] {
  const normalized = Array.from(
    new Set((scopes ?? []).filter((scope): scope is PlatformApiScope => PLATFORM_API_SCOPES.includes(scope as any))),
  );
  if (normalized.includes("all")) return ["all"];
  return normalized.length > 0 ? normalized : DEFAULT_PLATFORM_API_SCOPES.slice();
}

export function hasRequiredScopes(granted: string[], required: PlatformApiScope[]) {
  const normalized = normalizePlatformApiScopes(granted);
  if (normalized.includes("all")) return true;
  return required.every((scope) => normalized.includes(scope));
}

export function extractPlatformApiKey(request: NextRequest | Request) {
  const headers = request.headers;
  const bearer = headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const header = headers.get("x-api-key")?.trim();
  return bearer || header || null;
}

export function safeCompareHash(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function serializePlatformApiKey(record: any) {
  return {
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    scopes: normalizePlatformApiScopes(record.scopes),
    status: record.status,
    workspaceId: record.workspaceId ?? null,
    lastUsedAt: record.lastUsedAt?.toISOString?.() ?? record.lastUsedAt ?? null,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    revokedAt: record.revokedAt?.toISOString?.() ?? record.revokedAt ?? null,
  };
}

export function platformApiError(message: string, status: number, details?: unknown) {
  return Response.json(
    {
      success: false,
      error: {
        message,
        details,
      },
    },
    {
      status,
      headers: { "Cache-Control": "no-store", "X-ViralSnipAI-API-Version": "2026-05-05" },
    },
  );
}

export function platformApiSuccess<T>(data: T, status = 200) {
  return Response.json(
    { success: true, data },
    {
      status,
      headers: { "Cache-Control": "no-store", "X-ViralSnipAI-API-Version": "2026-05-05" },
    },
  );
}

export async function authenticatePlatformApiRequest(
  request: NextRequest | Request,
  requiredScopes: PlatformApiScope[],
): Promise<
  | {
      ok: true;
      context: {
        userId: string;
        workspaceId: string | null;
        apiKeyId: string;
        scopes: PlatformApiScope[];
      };
    }
  | { ok: false; response: Response }
> {
  const token = extractPlatformApiKey(request);
  if (!token) {
    return { ok: false, response: platformApiError("Provide an API key in Authorization: Bearer.", 401) };
  }

  const keyHash = hashPlatformApiKey(token);
  const apiKey = await (prisma as any).apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      userId: true,
      workspaceId: true,
      keyHash: true,
      scopes: true,
      status: true,
      lastUsedAt: true,
    },
  });

  if (!apiKey || !safeCompareHash(apiKey.keyHash ?? keyHash, keyHash) || apiKey.status !== "active") {
    return { ok: false, response: platformApiError("Invalid or revoked API key.", 401) };
  }

  const scopes = normalizePlatformApiScopes(apiKey.scopes);
  const missing = requiredScopes.find((scope) => !hasRequiredScopes(scopes, [scope]));
  if (missing) {
    return {
      ok: false,
      response: platformApiError(`This API key does not include the required scope: ${missing}.`, 403),
    };
  }

  if (!apiKey.lastUsedAt || Date.now() - new Date(apiKey.lastUsedAt).getTime() > 5 * 60_000) {
    await (prisma as any).apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });
  }

  return {
    ok: true,
    context: {
      userId: apiKey.userId,
      workspaceId: apiKey.workspaceId ?? null,
      apiKeyId: apiKey.id,
      scopes,
    },
  };
}
