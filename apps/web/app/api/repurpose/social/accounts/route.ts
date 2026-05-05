export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { socialPlatformSchema } from "@/lib/repurpose/social-publishing";

const accountSchema = z.object({
  platform: socialPlatformSchema,
  accountName: z.string().max(120).nullable().optional(),
  accountHandle: z.string().max(120).nullable().optional(),
  status: z.enum(["placeholder", "connected", "expired", "disabled"]).optional().default("placeholder"),
  metadata: z.record(z.any()).nullable().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const accounts = await (prisma as any).socialAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return ApiResponseBuilder.success({
    accounts: accounts.map((account: any) => ({
      id: account.id,
      platform: account.platform,
      accountName: account.accountName ?? null,
      accountHandle: account.accountHandle ?? null,
      status: account.status,
      metadata: account.metadata ?? null,
      createdAt: account.createdAt?.toISOString?.() ?? account.createdAt,
      updatedAt: account.updatedAt?.toISOString?.() ?? account.updatedAt,
      hasTokens: Boolean(account.encryptedTokens),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const json = await request.json().catch(() => null);
  const parsed = accountSchema.safeParse(json);
  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid social account placeholder", {
      errors: parsed.error.flatten(),
    });
  }

  const input = parsed.data;
  const account = await (prisma as any).socialAccount.create({
    data: {
      userId: user.id,
      platform: input.platform,
      accountName: input.accountName ?? null,
      accountHandle: input.accountHandle ?? null,
      status: input.status,
      encryptedTokens: null,
      metadata: {
        ...(input.metadata ?? {}),
        note: "OAuth tokens are intentionally not stored until platform credentials and encryption are configured.",
      },
    },
  });

  return ApiResponseBuilder.success({ account }, "Social account placeholder saved");
}
