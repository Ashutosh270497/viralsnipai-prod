export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentDbUser } from "@/lib/auth";
import { requireSnipRadarFeature } from "@/lib/snipradar/billing-gates-server";
import {
  ensureResearchIndex,
  getResearchIndexStatus,
  searchResearchIndex,
} from "@/lib/snipradar/research";

const requestSchema = z.object({
  query: z.string().min(2).max(120),
  limitPerSource: z.number().int().min(1).max(10).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await requireSnipRadarFeature(
      user.id,
      "researchCopilot",
      "Research Copilot is available on Plus and Pro plans."
    );
    if (!gate.ok) {
      return gate.response;
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid query payload" },
        { status: 400 }
      );
    }

    const initialStatus = await getResearchIndexStatus(user.id);
    if (initialStatus.totalDocuments === 0) {
      await ensureResearchIndex({
        userId: user.id,
        selectedNiche: user.selectedNiche,
        force: true,
      });
    }

    const response = await searchResearchIndex({
      userId: user.id,
      query: parsed.data.query.trim(),
      limitPerSource: parsed.data.limitPerSource,
      selectedNiche: user.selectedNiche,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[SnipRadar][Research] Query failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to search research corpus",
      },
      { status: 500 }
    );
  }
}
