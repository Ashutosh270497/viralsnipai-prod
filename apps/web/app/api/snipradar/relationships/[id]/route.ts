export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildRelationshipPriorityScore,
  normalizeRelationshipTags,
  RELATIONSHIP_LEAD_STAGES,
  type RelationshipLeadStage,
} from "@/lib/snipradar/relationships";
import { recordRelationshipInteraction } from "@/lib/snipradar/relationship-graph";
import { readEnvFeatureFlags } from "@/lib/feature-flags";

const updateSchema = z.object({
  stage: z.enum(RELATIONSHIP_LEAD_STAGES).optional(),
  personaTags: z.array(z.string().min(1).max(40)).max(12).optional(),
  notes: z.string().max(4000).nullable().optional(),
  nextAction: z.string().max(280).nullable().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!readEnvFeatureFlags().relationshipsCrmEnabled) {
    return NextResponse.json({ error: "Feature not available" }, { status: 403 });
  }
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid relationship payload" },
        { status: 400 }
      );
    }

    const lead = await prisma.xRelationshipLead.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!lead) {
      return NextResponse.json({ error: "Relationship lead not found" }, { status: 404 });
    }

    const nextStage = (parsed.data.stage ?? lead.stage) as RelationshipLeadStage;
    const nextTags =
      parsed.data.personaTags !== undefined
        ? normalizeRelationshipTags(parsed.data.personaTags)
        : lead.personaTags;
    const nextFollowUpAt =
      parsed.data.followUpAt !== undefined
        ? parsed.data.followUpAt
          ? new Date(parsed.data.followUpAt)
          : null
        : lead.followUpAt;
    const nextNotes = parsed.data.notes !== undefined ? parsed.data.notes : lead.notes;
    const nextAction =
      parsed.data.nextAction !== undefined ? parsed.data.nextAction : lead.nextAction;
    const nextPriorityScore = buildRelationshipPriorityScore({
      stage: nextStage,
      followerCount: lead.followerCount,
      savedOpportunityCount: lead.savedOpportunityCount,
      replyCount: lead.replyCount,
      inboxCaptureCount: lead.inboxCaptureCount,
      tracked: Boolean(lead.trackedAccountId),
      dueFollowUp: Boolean(nextFollowUpAt && nextFollowUpAt.getTime() <= Date.now()),
    });

    const updated = await prisma.xRelationshipLead.update({
      where: { id: lead.id },
      data: {
        stage: nextStage,
        personaTags: nextTags,
        notes: nextNotes,
        nextAction,
        followUpAt: nextFollowUpAt,
        priorityScore: nextPriorityScore,
        lastInteractionAt: new Date(),
      },
    });

    const changes: string[] = [];
    if (parsed.data.stage !== undefined && parsed.data.stage !== lead.stage) {
      changes.push(`stage -> ${parsed.data.stage}`);
    }
    if (parsed.data.followUpAt !== undefined) {
      changes.push(
        parsed.data.followUpAt ? `follow-up -> ${new Date(parsed.data.followUpAt).toLocaleString()}` : "follow-up cleared"
      );
    }
    if (parsed.data.nextAction !== undefined) {
      changes.push("next action updated");
    }
    if (parsed.data.notes !== undefined) {
      changes.push("notes updated");
    }
    if (parsed.data.personaTags !== undefined) {
      changes.push("tags updated");
    }

    if (changes.length > 0) {
      await recordRelationshipInteraction({
        userId: user.id,
        leadId: updated.id,
        trackedAccountId: updated.trackedAccountId,
        type: "lead_updated",
        summary: `Updated relationship record: ${changes.join(", ")}.`,
        metadata: {
          stage: updated.stage,
          followUpAt: updated.followUpAt?.toISOString() ?? null,
          personaTags: updated.personaTags,
        },
      });
    }

    return NextResponse.json({
      lead: {
        id: updated.id,
        stage: updated.stage,
        personaTags: updated.personaTags,
        notes: updated.notes,
        nextAction: updated.nextAction,
        followUpAt: updated.followUpAt?.toISOString() ?? null,
        priorityScore: updated.priorityScore,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[SnipRadar Relationships] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update relationship lead" }, { status: 500 });
  }
}
