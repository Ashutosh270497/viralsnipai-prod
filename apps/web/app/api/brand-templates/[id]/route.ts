export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  brandTemplatePatchSchema,
  normalizeBrandTemplateInput,
  serializeBrandTemplate,
} from "@/lib/repurpose/brand-templates";

async function findTemplate(id: string, userId: string) {
  return (prisma as any).brandTemplate.findFirst({
    where: { id, userId },
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await findTemplate(params.id, user.id);
  if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const json = await request.json();
  const parsed = brandTemplatePatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const current = serializeBrandTemplate(existing);
  const normalized = normalizeBrandTemplateInput({ ...current, ...parsed.data }, current);
  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault === true) {
      await (tx as any).brandTemplate.updateMany({
        where: { userId: user.id, isDefault: true, id: { not: params.id } },
        data: { isDefault: false },
      });
    }
    return (tx as any).brandTemplate.update({
      where: { id: params.id },
      data: {
        ...normalized,
        isDefault: parsed.data.isDefault ?? existing.isDefault,
        defaultPlatformPresets: normalized.defaultPlatformPresets ?? undefined,
      },
    });
  });

  return NextResponse.json({ template: serializeBrandTemplate(updated) });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await findTemplate(params.id, user.id);
  if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  await (prisma as any).brandTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
