export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BUILT_IN_BRAND_TEMPLATES,
  brandTemplateSchema,
  getBuiltInBrandTemplate,
  normalizeBrandTemplateInput,
  serializeBrandTemplate,
} from "@/lib/repurpose/brand-templates";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await (prisma as any).brandTemplate.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({
    templates: rows.map(serializeBrandTemplate),
    builtIns: BUILT_IN_BRAND_TEMPLATES,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json();
  const parsed = brandTemplateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const source = parsed.data.builtinId ? getBuiltInBrandTemplate(parsed.data.builtinId) : undefined;
  if (parsed.data.builtinId && !source) {
    return NextResponse.json({ error: "Built-in template not found" }, { status: 404 });
  }

  const normalized = normalizeBrandTemplateInput(parsed.data, source ?? undefined);
  const created = await prisma.$transaction(async (tx) => {
    if (normalized.isDefault) {
      await (tx as any).brandTemplate.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    return (tx as any).brandTemplate.create({
      data: {
        userId: user.id,
        ...normalized,
        defaultPlatformPresets: normalized.defaultPlatformPresets ?? undefined,
      },
    });
  });

  return NextResponse.json({ template: serializeBrandTemplate(created) }, { status: 201 });
}
