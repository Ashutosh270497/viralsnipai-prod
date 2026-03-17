export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateSnipRadarApiKey,
  normalizeSnipRadarApiScopes,
  serializeSnipRadarApiKey,
  SNIPRADAR_API_SCOPE_LABELS,
} from "@/lib/snipradar/public-api";

const createApiKeySchema = z.object({
  name: z.string().min(2).max(60),
  scopes: z.array(z.string()).max(12).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function GET() {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKeys = await prisma.snipRadarApiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        prefix: true,
        lastFour: true,
        scopes: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      apiKeys: apiKeys.map(serializeSnipRadarApiKey),
      scopeCatalog: Object.entries(SNIPRADAR_API_SCOPE_LABELS).map(([id, label]) => ({ id, label })),
    });
  } catch (error) {
    console.error("[SnipRadar Developer Keys] GET error:", error);
    return NextResponse.json({ error: "Failed to load API keys" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = createApiKeySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid API key payload" },
        { status: 400 }
      );
    }

    const { token, prefix, lastFour, keyHash } = generateSnipRadarApiKey();
    const apiKey = await prisma.snipRadarApiKey.create({
      data: {
        userId: user.id,
        name: parsed.data.name.trim(),
        prefix,
        lastFour,
        keyHash,
        scopes: normalizeSnipRadarApiScopes(parsed.data.scopes),
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastFour: true,
        scopes: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        apiKey: serializeSnipRadarApiKey(apiKey),
        token,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[SnipRadar Developer Keys] POST error:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}
