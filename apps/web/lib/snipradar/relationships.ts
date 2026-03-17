export const RELATIONSHIP_LEAD_STAGES = [
  "new",
  "engaged",
  "priority",
  "follow_up",
  "closed",
] as const;

export type RelationshipLeadStage = (typeof RELATIONSHIP_LEAD_STAGES)[number];

export const RELATIONSHIP_INTERACTION_TYPES = [
  "opportunity_saved",
  "opportunity_replied",
  "reply_generated",
  "author_tracked",
  "lead_updated",
] as const;

export type RelationshipInteractionType = (typeof RELATIONSHIP_INTERACTION_TYPES)[number];

const STAGE_RANK: Record<RelationshipLeadStage, number> = {
  new: 1,
  engaged: 2,
  priority: 3,
  follow_up: 4,
  closed: 0,
};

function clip(value: string, maxLength: number) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

export function isRelationshipLeadStage(value: string): value is RelationshipLeadStage {
  return RELATIONSHIP_LEAD_STAGES.includes(value as RelationshipLeadStage);
}

export function normalizeRelationshipHandle(value?: string | null) {
  return (value ?? "").trim().replace(/^@/, "").toLowerCase();
}

export function normalizeRelationshipTags(tags: string[] | null | undefined) {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 12)
    )
  );
}

export function mergeRelationshipStage(
  current: RelationshipLeadStage | null | undefined,
  incoming: RelationshipLeadStage | null | undefined
): RelationshipLeadStage {
  const currentStage = current && isRelationshipLeadStage(current) ? current : "new";
  const nextStage = incoming && isRelationshipLeadStage(incoming) ? incoming : currentStage;

  if (nextStage === "closed") {
    return "closed";
  }
  if (currentStage === "closed") {
    return nextStage;
  }

  return STAGE_RANK[nextStage] >= STAGE_RANK[currentStage] ? nextStage : currentStage;
}

export function buildRelationshipPriorityScore(params: {
  stage: RelationshipLeadStage;
  followerCount?: number | null;
  savedOpportunityCount?: number;
  replyCount?: number;
  inboxCaptureCount?: number;
  tracked?: boolean;
  dueFollowUp?: boolean;
}) {
  const followerBand = Math.min(20, Math.round(Math.log10(Math.max(1, params.followerCount ?? 1)) * 5));
  const stageBoost =
    params.stage === "follow_up"
      ? 34
      : params.stage === "priority"
        ? 28
        : params.stage === "engaged"
          ? 18
          : params.stage === "closed"
            ? 6
            : 10;

  const score =
    stageBoost +
    followerBand +
    Math.min(16, (params.savedOpportunityCount ?? 0) * 4) +
    Math.min(18, (params.replyCount ?? 0) * 6) +
    Math.min(8, (params.inboxCaptureCount ?? 0) * 2) +
    (params.tracked ? 10 : 0) +
    (params.dueFollowUp ? 12 : 0);

  return Math.max(1, Math.min(100, Math.round(score)));
}

export function stageFromOpportunityStatus(status: string): RelationshipLeadStage {
  if (status === "replied") return "follow_up";
  if (status === "saved") return "engaged";
  return "new";
}

export function defaultLeadNextAction(stage: RelationshipLeadStage) {
  if (stage === "follow_up") return "Check for reply, continue the conversation, and move to a direct ask if relevant.";
  if (stage === "priority") return "Keep this person in your active follow-up queue and engage on their next post.";
  if (stage === "engaged") return "Reply with a concrete insight or save them for your next engagement block.";
  if (stage === "closed") return "No immediate action.";
  return "Review recent posts and decide whether this contact should move into active follow-up.";
}

export function buildRelationshipInteractionSummary(params: {
  type: RelationshipInteractionType;
  username: string;
  text?: string | null;
}) {
  const handle = normalizeRelationshipHandle(params.username);
  if (params.type === "author_tracked") {
    return `Started tracking @${handle} as a priority relationship.`;
  }
  if (params.type === "reply_generated") {
    return `Generated a reply assist for @${handle}.`;
  }
  if (params.type === "opportunity_replied") {
    return `Marked an engagement opportunity from @${handle} as replied.`;
  }
  if (params.type === "opportunity_saved") {
    return `Saved an engagement opportunity from @${handle}.`;
  }
  return clip(params.text ?? `Updated relationship record for @${handle}.`, 180);
}
