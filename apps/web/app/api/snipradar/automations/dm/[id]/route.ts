export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentDbUser } from "@/lib/auth";
import { deleteAutoDmAutomation, updateAutoDmAutomation } from "@/lib/snipradar/auto-dm";

const patchSchema = z.object({
  keyword: z.string().trim().max(80).optional().nullable(),
  dmTemplate: z.string().trim().min(10).max(1000).optional(),
  dailyCap: z.coerce.number().int().min(1).max(250).optional(),
  isActive: z.boolean().optional(),
  name: z.string().trim().max(80).optional().nullable(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid automation payload" },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const automation = await updateAutoDmAutomation({
      id,
      userId: user.id,
      input: parsed.data,
    });

    return NextResponse.json({ automation });
  } catch (error) {
    console.error("[SnipRadar Auto-DM] PATCH error:", error);
    if (error instanceof Error && error.message === "Automation not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update Auto-DM automation" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    await deleteAutoDmAutomation({ id, userId: user.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SnipRadar Auto-DM] DELETE error:", error);
    if (error instanceof Error && error.message === "Automation not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete Auto-DM automation" }, { status: 500 });
  }
}
