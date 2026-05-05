export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getBuiltInBrandTemplate,
  normalizeBrandTemplateInput,
  serializeBrandTemplate,
} from "@/lib/repurpose/brand-templates";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const builtIn = getBuiltInBrandTemplate(params.id);
  const existing = builtIn
    ? null
    : await (prisma as any).brandTemplate.findFirst({
        where: { id: params.id, userId: user.id },
      });
  const source = builtIn ?? (existing ? serializeBrandTemplate(existing) : null);
  if (!source) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const normalized = normalizeBrandTemplateInput(
    {
      ...source,
      name: `${source.name} Copy`,
      isDefault: false,
    },
    source,
  );
  const created = await (prisma as any).brandTemplate.create({
    data: {
      userId: user.id,
      ...normalized,
      isDefault: false,
    },
  });

  return NextResponse.json({ template: serializeBrandTemplate(created) }, { status: 201 });
}
