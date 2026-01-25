import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPaidPlan } from "@/lib/watermark";

const schema = z.object({
  primaryHex: z.string().regex(/^#?[0-9A-Fa-f]{6}$/),
  fontFamily: z.string().min(2),
  logoPath: z.string().optional().nullable(),
  logoStoragePath: z.string().optional().nullable(),
  watermark: z.boolean(),
  captionStyle: z.object({
    karaoke: z.boolean(),
    outline: z.boolean(),
    position: z.enum(["bottom", "middle", "top"])
  })
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const result = schema.safeParse(json);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true }
  });
  const canToggleWatermark = isPaidPlan(dbUser?.plan);

  const payload = {
    ...result.data,
    watermark: canToggleWatermark ? result.data.watermark : true,
    primaryHex: result.data.primaryHex.startsWith("#")
      ? result.data.primaryHex
      : `#${result.data.primaryHex}`
  };

  const updated = await prisma.brandKit.upsert({
    where: { userId: user.id },
    update: payload,
    create: {
      userId: user.id,
      ...payload
    }
  });

  return NextResponse.json({ brandKit: updated });
}
