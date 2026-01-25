export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const exportRecord = await prisma.export.findFirst({
    where: {
      id: params.id,
      project: {
        userId: user.id
      }
    }
  });

  if (!exportRecord) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ export: exportRecord }, { headers: { "Cache-Control": "no-store" } });
}
